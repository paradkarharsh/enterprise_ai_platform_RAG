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
from app.db.models import Conversation, Message, User
from app.auth.jwt import get_current_user, get_optional_user
from app.agents.graph import run_agent_pipeline

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


@router.post("/", response_model=ChatResponse)
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
):
    """Stream a chat response using Server-Sent Events."""
    from app.llm.factory import stream_with_fallback, LLMMessage

    async def generate():
        try:
            messages = [
                LLMMessage(role="system", content="You are an Enterprise AI Knowledge Assistant. Provide helpful, accurate, well-formatted responses in Markdown."),
                LLMMessage(role="user", content=request.message),
            ]

            async for chunk in stream_with_fallback(
                messages,
                provider_name=request.provider,
                model=request.model,
            ):
                yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"

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
