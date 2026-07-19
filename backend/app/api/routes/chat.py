"""
Chat API route: streaming AI chat with agent pipeline.
"""
import logging
import json
from typing import Optional, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.db.models import Conversation, Message, User, QueryLog
from app.auth.jwt import get_current_user, get_optional_user
from app.agents.graph import run_agent_pipeline
from app.config import get_settings

settings = get_settings()

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None
    stream: bool = True


class ChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    response: str
    citations: list = []
    agent_trace: list = []
    confidence_score: float = 0
    latency_ms: int = 0
    token_usage: dict = {}


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Send a message and get an AI response using the agent pipeline."""
    user_id = str(current_user.id) if current_user else None

    # Get or create conversation
    conversation = None
    history = []

    if request.conversation_id and current_user:
        result = await db.execute(
            select(Conversation).where(Conversation.id == request.conversation_id)
        )
        conversation = result.scalar_one_or_none()
        if conversation:
            # Load message history
            msg_result = await db.execute(
                select(Message)
                .where(Message.conversation_id == conversation.id)
                .order_by(Message.created_at)
            )
            messages = msg_result.scalars().all()
            history = [{"role": m.role, "content": m.content} for m in messages[-10:]]

    if not conversation and current_user:
        conversation = Conversation(
            user_id=current_user.id,
            title=request.message[:100],
            model_used=request.model,
        )
        db.add(conversation)
        await db.flush()

    # Save user message
    if conversation:
        user_msg = Message(
            conversation_id=conversation.id,
            role="user",
            content=request.message,
        )
        db.add(user_msg)
        await db.flush()

    # Run agent pipeline
    state = await run_agent_pipeline(
        query=request.message,
        conversation_history=history,
        user_id=user_id,
        model=request.model,
        provider=request.provider,
    )

    # Save assistant message
    message_id = str(uuid4())
    if conversation:
        assistant_msg = Message(
            conversation_id=conversation.id,
            role="assistant",
            content=state.get("response", ""),
            citations=state.get("citations"),
            agent_trace=state.get("agent_trace"),
            model_used=state.get("token_usage", {}).get("model"),
            latency_ms=state.get("total_latency_ms"),
            confidence_score=state.get("confidence_score"),
        )
        db.add(assistant_msg)
        message_id = str(assistant_msg.id)
        await db.flush()

    # Calculate token values and cost
    tok_in = state.get("token_usage", {}).get("input", 0) if state.get("token_usage") else 0
    tok_out = state.get("token_usage", {}).get("output", 0) if state.get("token_usage") else 0
    cost_usd = (tok_in * 0.00015 / 1000) + (tok_out * 0.0006 / 1000)

    # Determine hallucination score (simple heuristic: 1.0 - confidence_score)
    conf_val = state.get("confidence_score", 0.0)
    hallucination_score = round(1.0 - conf_val, 2) if conf_val is not None else None

    # Save QueryLog
    query_log = QueryLog(
        user_id=current_user.id if current_user else None,
        query_text=request.message,
        query_type="chat",
        intent=state.get("intent") or "general",
        model_used=state.get("token_usage", {}).get("model") or request.model or settings.DEFAULT_LLM_MODEL,
        retrieval_strategy=state.get("retrieval_strategy") or "hybrid",
        results_count=len(state.get("retrieved_chunks") or []),
        latency_ms=state.get("total_latency_ms", 0),
        token_input=tok_in,
        token_output=tok_out,
        cost_usd=cost_usd,
        confidence_score=conf_val,
        hallucination_score=hallucination_score,
    )
    db.add(query_log)
    await db.flush()

    return ChatResponse(
        conversation_id=str(conversation.id) if conversation else "",
        message_id=message_id,
        response=state.get("response", ""),
        citations=state.get("citations", []),
        agent_trace=state.get("agent_trace", []),
        confidence_score=state.get("confidence_score", 0),
        latency_ms=state.get("total_latency_ms", 0),
        token_usage=state.get("token_usage", {}),
    )


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Stream a chat response using the multi-agent graph and Server-Sent Events with Redis caching."""
    from app.agents.graph import compiled_graph
    from app.db.redis import RedisCache
    import asyncio

    user_id = str(current_user.id) if current_user else "anonymous"
    model_name = request.model or "default"
    cache_key = f"chat:cache:{user_id}:{request.message}:{model_name}"

    # Get or create conversation
    conversation = None
    history = []

    if request.conversation_id and current_user:
        result = await db.execute(
            select(Conversation).where(Conversation.id == request.conversation_id)
        )
        conversation = result.scalar_one_or_none()
        if conversation:
            msg_result = await db.execute(
                select(Message)
                .where(Message.conversation_id == conversation.id)
                .order_by(Message.created_at)
            )
            messages = msg_result.scalars().all()
            history = [{"role": m.role, "content": m.content} for m in messages[-10:]]

    if not conversation and current_user:
        conversation = Conversation(
            user_id=current_user.id,
            title=request.message[:100],
            model_used=request.model,
        )
        db.add(conversation)
        await db.flush()

    # Save user message
    if conversation:
        user_msg = Message(
            conversation_id=conversation.id,
            role="user",
            content=request.message,
        )
        db.add(user_msg)
        await db.flush()

    async def generate():
        try:
            # 1. Try Redis cache lookup
            cached_data = await RedisCache.get(cache_key)
            if cached_data:
                logger.info("Redis Cache HIT for key: %s", cache_key)
                try:
                    cached_json = json.loads(cached_data)
                    response_text = cached_json.get("response", "")
                    citations = cached_json.get("citations", [])

                    yield f"data: {json.dumps({'type': 'trace', 'content': '⚡ Cache HIT: Retrieving response from memory'})}\n\n"

                    chunk_size = 10
                    for i in range(0, len(response_text), chunk_size):
                        chunk = response_text[i:i + chunk_size]
                        yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"

                    yield f"data: {json.dumps({'type': 'citations', 'content': citations})}\n\n"

                    # Save assistant message in DB on cache hit & log query
                    if conversation:
                        assistant_msg = Message(
                            conversation_id=conversation.id,
                            role="assistant",
                            content=response_text,
                            citations=citations,
                            agent_trace=["Cache HIT"],
                            model_used=model_name,
                            confidence_score=1.0,
                        )
                        db.add(assistant_msg)

                    query_log = QueryLog(
                        user_id=current_user.id if current_user else None,
                        query_text=request.message,
                        query_type="chat",
                        intent="general",
                        model_used=model_name,
                        retrieval_strategy="cache",
                        results_count=len(citations),
                        latency_ms=5,
                        token_input=0,
                        token_output=0,
                        cost_usd=0.0,
                        confidence_score=1.0,
                        hallucination_score=0.0,
                    )
                    db.add(query_log)
                    await db.commit()

                    yield f"data: {json.dumps({'type': 'done'})}\n\n"
                    return
                except Exception as cache_err:
                    logger.warning("Failed to decode cached data: %s", cache_err)

            # 2. Cache MISS: Run full LangGraph pipeline
            logger.info("Redis Cache MISS. Running graph pipeline.")
            state = {
                "query": request.message,
                "conversation_history": history,
                "user_id": user_id,
                "model": request.model,
                "provider": request.provider,
                "intent": None,
                "intents": None,
                "domain": None,
                "rewritten_query": None,
                "metadata_filters": None,
                "sub_queries": None,
                "graph_results": None,
                "cypher_query": None,
                "graph_context": None,
                "retrieved_chunks": None,
                "retrieval_strategy": None,
                "reranked_chunks": None,
                "confidence_score": None,
                "hallucination_score": None,
                "verified_sources": None,
                "response": None,
                "citations": None,
                "agent_trace": [],
                "total_latency_ms": None,
                "token_usage": None,
            }

            final_state = state

            async for event in compiled_graph.astream(state):
                for node_name, node_state in event.items():
                    final_state.update(node_state)
                    
                    if node_name == "query_understanding":
                        intent_val = node_state.get("intent")
                        domain_val = node_state.get("domain")
                        yield f"data: {json.dumps({'type': 'trace', 'content': f'🔍 Classified Intent: {intent_val} ({domain_val})'})}\n\n"
                    elif node_name == "parallel_retrieval":
                        yield f"data: {json.dumps({'type': 'trace', 'content': '🕸️ Running Knowledge Graph & Vector Search in parallel'})}\n\n"
                        # Stream graph results
                        graph_results = node_state.get("graph_results")
                        if graph_results:
                            yield f"data: {json.dumps({'type': 'graph', 'content': graph_results})}\n\n"
                        chunks_len = len(node_state.get("retrieved_chunks") or [])
                        yield f"data: {json.dumps({'type': 'trace', 'content': f'📥 Retrieved {chunks_len} document contexts'})}\n\n"
                    elif node_name == "reranker":
                        yield f"data: {json.dumps({'type': 'trace', 'content': '🎯 Cross-encoder neural rerank complete'})}\n\n"
                    elif node_name == "verifier":
                        conf_score = node_state.get("confidence_score")
                        yield f"data: {json.dumps({'type': 'trace', 'content': f'✅ Fact verification completed (Score: {conf_score})'})}\n\n"

            # Stream final response in small chunks for typing effect
            response_text = final_state.get("response", "")
            if not response_text:
                response_text = "No response generated by the agent pipeline."

            chunk_size = 10
            for i in range(0, len(response_text), chunk_size):
                chunk = response_text[i:i + chunk_size]
                yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"

            citations = final_state.get("citations") or []
            yield f"data: {json.dumps({'type': 'citations', 'content': citations})}\n\n"

            # Save assistant message in DB & log query
            if conversation:
                assistant_msg = Message(
                    conversation_id=conversation.id,
                    role="assistant",
                    content=response_text,
                    citations=citations,
                    agent_trace=final_state.get("agent_trace"),
                    model_used=final_state.get("token_usage", {}).get("model") or model_name,
                    confidence_score=final_state.get("confidence_score"),
                )
                db.add(assistant_msg)

            # Calculate token values and cost
            tok_in = final_state.get("token_usage", {}).get("input", 0) if final_state.get("token_usage") else 0
            tok_out = final_state.get("token_usage", {}).get("output", 0) if final_state.get("token_usage") else 0
            cost_usd = (tok_in * 0.00015 / 1000) + (tok_out * 0.0006 / 1000)

            # Determine hallucination score
            conf_val = final_state.get("confidence_score", 0.0)
            hallucination_score = round(1.0 - conf_val, 2) if conf_val is not None else None

            query_log = QueryLog(
                user_id=current_user.id if current_user else None,
                query_text=request.message,
                query_type="chat",
                intent=final_state.get("intent") or "general",
                model_used=final_state.get("token_usage", {}).get("model") or request.model or settings.DEFAULT_LLM_MODEL,
                retrieval_strategy=final_state.get("retrieval_strategy") or "hybrid",
                results_count=len(final_state.get("retrieved_chunks") or []),
                latency_ms=final_state.get("total_latency_ms", 0),
                token_input=tok_in,
                token_output=tok_out,
                cost_usd=cost_usd,
                confidence_score=conf_val,
                hallucination_score=hallucination_score,
            )
            db.add(query_log)
            await db.commit()

            # Cache the result for future identical queries
            try:
                cache_payload = json.dumps({"response": response_text, "citations": citations})
                await RedisCache.set(cache_key, cache_payload, expire=3600)
                logger.info("Saved response to Redis cache with key: %s", cache_key)
            except Exception as set_cache_err:
                logger.warning("Failed to save response to Redis: %s", set_cache_err)

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            logger.error("Chat stream failed: %s", e, exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/conversations")
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List user's conversations."""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id, Conversation.is_archived == False)
        .order_by(Conversation.updated_at.desc())
        .limit(50)
    )
    conversations = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "title": c.title,
            "folder": c.folder,
            "is_pinned": c.is_pinned,
            "model_used": c.model_used,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        }
        for c in conversations
    ]


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get messages for a conversation."""
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()
    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "citations": m.citations,
            "agent_trace": m.agent_trace,
            "model_used": m.model_used,
            "latency_ms": m.latency_ms,
            "confidence_score": m.confidence_score,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


@router.get("/suggested-questions")
async def get_suggested_questions(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Retrieve suggested questions based on uploaded documents."""
    from sqlalchemy import select
    from app.db.models import Document, DocumentStatus
    
    query = select(Document).where(Document.status == DocumentStatus.INDEXED)
    if current_user:
        if current_user.role != "admin":
            if current_user.organization_id:
                query = query.where(Document.organization_id == current_user.organization_id)
            else:
                query = query.where(Document.owner_id == current_user.id)
                
    result = await db.execute(query)
    documents = result.scalars().all()
    
    questions = []
    seen = set()
    
    # 1. Retrieve generated questions from documents' metadata
    for doc in documents:
        if doc.meta and "suggested_questions" in doc.meta:
            for q in doc.meta["suggested_questions"]:
                q_strip = q.strip()
                if q_strip and q_strip.lower() not in seen:
                    seen.add(q_strip.lower())
                    category = str(doc.source_type.value).upper() if hasattr(doc.source_type, "value") else str(doc.source_type).upper()
                    if "CRICKET" in category:
                        questions.append({
                            "text": q_strip,
                            "category": category,
                        })
                    
    # 2. If we don't have enough questions, fallback to default questions
    default_questions = [
        {"text": "Who won the first ever international football match?", "category": "FOOTBALL"},
        {"text": "Who holds the record for most centuries in Test cricket?", "category": "CRICKET"},
        {"text": "Who is the GOAT of cricket?", "category": "CRICKET"},
        {"text": "Which country has won the most ICC World Cups?", "category": "CRICKET"},
    ]
    
    for dq in default_questions:
        if len(questions) >= 4:
            break
        if dq["text"].lower() not in seen:
            seen.add(dq["text"].lower())
            questions.append(dq)
            
    return questions[:4]
