"""
LangGraph Agentic RAG Workflow — 6-agent pipeline.
Query Understanding → Knowledge Graph → Retriever → Reranker → Verifier → Response
"""
import logging
import time
from typing import TypedDict, Optional, List, Dict, Any, Annotated
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class AgentState(TypedDict):
    """Shared state flowing through the agent graph."""
    # Input
    query: str
    conversation_history: List[Dict[str, str]]
    user_id: Optional[str]
    model: Optional[str]
    provider: Optional[str]

    # Query Understanding
    intent: Optional[str]
    intents: Optional[List[str]]
    domain: Optional[str]
    rewritten_query: Optional[str]
    metadata_filters: Optional[Dict[str, Any]]
    sub_queries: Optional[List[str]]

    # Knowledge Graph
    graph_results: Optional[List[Dict]]
    cypher_query: Optional[str]
    graph_context: Optional[str]

    # Retrieval
    retrieved_chunks: Optional[List[Dict]]
    retrieval_strategy: Optional[str]

    # Reranking
    reranked_chunks: Optional[List[Dict]]

    # Verification
    confidence_score: Optional[float]
    hallucination_score: Optional[float]
    verified_sources: Optional[List[Dict]]
    escalation: Optional[Dict[str, Any]]

    # Response
    response: Optional[str]
    citations: Optional[List[Dict]]
    agent_trace: Optional[List[Dict]]
    total_latency_ms: Optional[int]
    token_usage: Optional[Dict[str, int]]


class AgentTrace(BaseModel):
    """Trace of a single agent execution."""
    agent: str
    status: str  # running, completed, failed
    start_time: float
    end_time: Optional[float] = None
    latency_ms: Optional[int] = None
    output_summary: Optional[str] = None
    error: Optional[str] = None


async def query_understanding_agent(state: AgentState) -> AgentState:
    """Agent A: Intent classification, domain, metadata extraction using Intents Agent."""
    trace = AgentTrace(agent="query_understanding", status="running", start_time=time.time())

    try:
        from app.agents.intents import detect_intent
        
        data = await detect_intent(state["query"], provider=state.get("provider"), model=state.get("model"))
        
        state["intent"] = data.get("intents", ["general"])[0]
        state["intents"] = data.get("intents", ["general"])
        state["domain"] = data.get("domain", "general")
        state["rewritten_query"] = data.get("rewritten_query", state["query"])
        state["sub_queries"] = data.get("sub_queries", [])
        state["metadata_filters"] = data.get("metadata_filters", {})

        trace.status = "completed"
        trace.output_summary = f"Intents: {state['intents']}, Domain: {state['domain']}"
    except Exception as e:
        logger.error("Query understanding failed: %s", e)
        state["intent"] = "factual"
        state["intents"] = ["general"]
        state["domain"] = "general"
        state["rewritten_query"] = state["query"]
        trace.status = "failed"
        trace.error = str(e)

    trace.end_time = time.time()
    trace.latency_ms = int((trace.end_time - trace.start_time) * 1000)

    traces = state.get("agent_trace", []) or []
    traces.append(trace.model_dump())
    state["agent_trace"] = traces
    return state


async def knowledge_graph_agent(state: AgentState) -> AgentState:
    """Agent B: Graph traversal, relationship reasoning, Cypher generation."""
    trace = AgentTrace(agent="knowledge_graph", status="running", start_time=time.time())

    try:
        from app.knowledge_graph.engine import get_kg_engine

        engine = get_kg_engine()
        query = state.get("rewritten_query", state["query"])

        # Generate Cypher from natural language
        cypher = await engine.natural_language_to_cypher(query)
        state["cypher_query"] = cypher

        # Execute Cypher
        results = await engine.execute_cypher(cypher)
        state["graph_results"] = results[:20]  # Limit results

        # Build graph context
        if results:
            context_parts = []
            for r in results[:10]:
                context_parts.append(str(r))
            state["graph_context"] = "\n".join(context_parts)

        trace.status = "completed"
        trace.output_summary = f"Cypher: {cypher[:100]}... Results: {len(results)}"
    except Exception as e:
        logger.warning("Knowledge graph agent failed: %s", e)
        state["graph_results"] = []
        state["graph_context"] = ""
        trace.status = "failed"
        trace.error = str(e)

    trace.end_time = time.time()
    trace.latency_ms = int((trace.end_time - trace.start_time) * 1000)

    traces = state.get("agent_trace", []) or []
    traces.append(trace.model_dump())
    state["agent_trace"] = traces
    return state


async def retriever_agent(state: AgentState) -> AgentState:
    """Agent C: Dense, sparse, and hybrid retrieval using HybridRetriever."""
    trace = AgentTrace(agent="retriever", status="running", start_time=time.time())

    try:
        from app.retrieval.retriever import HybridRetriever

        query = state.get("rewritten_query", state["query"])
        retriever = HybridRetriever()

        results = await retriever.retrieve(
            query=query,
            sub_queries=state.get("sub_queries"),
            top_k=20,
            filters=state.get("metadata_filters"),
        )

        # Apply keyword boost
        if results:
            results = await retriever.keyword_search(query, results)

        state["retrieved_chunks"] = [r.model_dump() for r in results[:30]]
        state["retrieval_strategy"] = "hybrid"

        trace.status = "completed"
        trace.output_summary = f"Retrieved {len(results)} chunks"
    except Exception as e:
        logger.error("Retriever agent failed: %s", e)
        state["retrieved_chunks"] = []
        trace.status = "failed"
        trace.error = str(e)

    trace.end_time = time.time()
    trace.latency_ms = int((trace.end_time - trace.start_time) * 1000)

    traces = state.get("agent_trace", []) or []
    traces.append(trace.model_dump())
    state["agent_trace"] = traces
    return state


async def reranker_agent(state: AgentState) -> AgentState:
    """Agent D: Rerank retrieved chunks using Reranker (cross-encoder + TF-IDF fallback)."""
    trace = AgentTrace(agent="reranker", status="running", start_time=time.time())

    try:
        chunks = state.get("retrieved_chunks", [])
        if not chunks:
            state["reranked_chunks"] = []
        else:
            from app.reranking.reranker import Reranker

            query = state.get("rewritten_query", state["query"])
            reranker = Reranker()
            reranked = reranker.rerank(query, chunks, top_k=10)
            state["reranked_chunks"] = reranked

        trace.status = "completed"
        trace.output_summary = f"Reranked to {len(state.get('reranked_chunks', []))} chunks"
    except Exception as e:
        logger.error("Reranker agent failed: %s", e)
        state["reranked_chunks"] = state.get("retrieved_chunks", [])[:10]
        trace.status = "failed"
        trace.error = str(e)

    trace.end_time = time.time()
    trace.latency_ms = int((trace.end_time - trace.start_time) * 1000)

    traces = state.get("agent_trace", []) or []
    traces.append(trace.model_dump())
    state["agent_trace"] = traces
    return state


async def verification_agent(state: AgentState) -> AgentState:
    """Agent E: Hallucination detection, source verification, confidence scoring."""
    trace = AgentTrace(agent="verifier", status="running", start_time=time.time())

    try:
        from app.llm.factory import generate_with_fallback, LLMMessage
        import json

        chunks = state.get("reranked_chunks", [])
        query = state.get("rewritten_query", state["query"])

        if chunks:
            context = "\n---\n".join([c["content"] for c in chunks[:5]])

            messages = [
                LLMMessage(role="system", content="""Evaluate retrieval quality. Return JSON:
{
  "confidence_score": 0.0-1.0,
  "relevance_scores": [0.0-1.0 for each chunk],
  "sufficient_context": true/false,
  "potential_gaps": ["gap1", "gap2"]
}
Return ONLY valid JSON."""),
                LLMMessage(role="user", content=f"Query: {query}\n\nRetrieved Context:\n{context}"),
            ]

            response = await generate_with_fallback(
                messages,
                provider_name=state.get("provider"),
                model=state.get("model"),
                temperature=0.1,
                max_tokens=512,
            )
            content = response.content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            data = json.loads(content)
            state["confidence_score"] = data.get("confidence_score", 0.5)

            # Filter low-relevance chunks
            relevance_scores = data.get("relevance_scores", [])
            verified = []
            for i, chunk in enumerate(chunks):
                score = relevance_scores[i] if i < len(relevance_scores) else 0.5
                if score >= 0.3:
                    chunk["relevance_score"] = score
                    verified.append(chunk)
            state["verified_sources"] = verified
        else:
            state["confidence_score"] = 0.0
            state["verified_sources"] = []
            
        # Check for Human Escalation
        from app.agents.escalation import check_escalation
        # Convert history dicts to string for summary
        history_str = "\\n".join([f"{m['role']}: {m['content']}" for m in state.get("conversation_history", [])[-3:]])
        escalation = await check_escalation(
            query=query,
            confidence_score=state["confidence_score"],
            threshold=0.5, # Configurable
            user_id=state.get("user_id"),
            conversation_summary=history_str,
            department=state.get("domain", "general")
        )
        state["escalation"] = escalation

        trace.status = "completed"
        trace.output_summary = f"Confidence: {state.get('confidence_score', 0):.2f}"
    except Exception as e:
        logger.error("Verification agent failed: %s", e)
        state["confidence_score"] = 0.5
        state["verified_sources"] = state.get("reranked_chunks", [])
        state["escalation"] = {"escalated": False}
        trace.status = "failed"
        trace.error = str(e)

    trace.end_time = time.time()
    trace.latency_ms = int((trace.end_time - trace.start_time) * 1000)

    traces = state.get("agent_trace", []) or []
    traces.append(trace.model_dump())
    state["agent_trace"] = traces
    return state


async def response_agent(state: AgentState) -> AgentState:
    """Agent F: Final answer generation with citations and markdown."""
    trace = AgentTrace(agent="response", status="running", start_time=time.time())

    try:
        from app.llm.factory import generate_with_fallback, LLMMessage

        query = state["query"]
        sources = state.get("verified_sources", [])
        graph_context = state.get("graph_context", "")
        history = state.get("conversation_history", [])

        # Build context
        context_parts = []
        if graph_context:
            context_parts.append(f"**Knowledge Graph Context (Entity Relationships):**\n{graph_context}")
        if sources:
            context_parts.append("**Retrieved Document Chunks:**")
            for i, s in enumerate(sources[:7]):
                context_parts.append(f"**[Source {i+1}]** (Score: {s.get('score', 0):.2f})\n{s['content']}")

        context = "\n\n---\n\n".join(context_parts) if context_parts else "No specific context found."

        # Merge specialized prompts based on intents
        from app.agents.specialized import call_specialized_agent
        intents = state.get("intents", ["general"])
        
        prompts_dict = {
            "billing": "Role: Billing Support Agent. Handle invoices, payments, refunds, subscriptions, and billing history. Use precise financial language.",
            "technical": "Role: Technical Support Agent. Handle login issues, installation, bugs, errors, and troubleshooting. Provide step-by-step guidance.",
            "product": "Role: Product Agent. Handle product details, pricing, comparisons, and recommendations. Highlight features/benefits.",
            "complaint": "Role: Complaint Agent. Be empathetic, professional, and focus on de-escalating the situation.",
            "faq": "Role: FAQ Agent. Answer questions about company policies, shipping, warranty, and contact details."
        }
        
        specialized_roles = "\n".join([prompts_dict[i] for i in intents if i in prompts_dict])
        if not specialized_roles:
            specialized_roles = "Role: General Enterprise Support Agent. Provide helpful, accurate assistance."

        escalation = state.get("escalation", {})
        escalation_msg = ""
        if escalation.get("escalated"):
            ticket_id = escalation.get("ticket_id", "N/A")
            escalation_msg = f"\n\nNOTE: This query has been escalated to human support. A ticket ({ticket_id}) has been created. Acknowledge this to the user gracefully."

        messages = [
            LLMMessage(role="system", content=f"""You are an Enterprise AI Knowledge Assistant incorporating the following specialized roles:
{specialized_roles}

Rules:
1. Provide a comprehensive, natural, and direct answer to the user's query based ONLY on the provided context.
2. Cite sources using [Source N] format.
3. Format response in clear Markdown with headings, bullet points, and structured sections where appropriate, but prioritize conversational flow.
4. If context is insufficient, say so honestly.
5. Include a confidence level at the end.{escalation_msg}

Context:
{context}"""),
        ]

        # Add conversation history
        for msg in history[-6:]:
            messages.append(LLMMessage(role=msg["role"], content=msg["content"]))
        messages.append(LLMMessage(role="user", content=query))

        response = await generate_with_fallback(
            messages,
            provider_name=state.get("provider"),
            model=state.get("model"),
            temperature=0.7,
            max_tokens=8192,
        )

        state["response"] = response.content
        state["token_usage"] = {
            "input": response.token_input,
            "output": response.token_output,
            "model": response.model,
            "provider": response.provider,
        }

        # Build citations
        citations = []
        for i, s in enumerate(sources[:7]):
            citations.append({
                "index": i + 1,
                "chunk_id": s.get("id", ""),
                "content": s.get("content", "")[:200],
                "score": s.get("score", 0),
                "metadata": s.get("metadata", {}),
            })
        state["citations"] = citations

        trace.status = "completed"
        trace.output_summary = f"Generated {len(response.content)} chars, {len(citations)} citations"
    except Exception as e:
        logger.error("Response agent failed: %s", e)
        state["response"] = f"I apologize, but I encountered an error generating the response: {str(e)}"
        state["citations"] = []
        trace.status = "failed"
        trace.error = str(e)

    trace.end_time = time.time()
    trace.latency_ms = int((trace.end_time - trace.start_time) * 1000)

    traces = state.get("agent_trace", []) or []
    traces.append(trace.model_dump())
    state["agent_trace"] = traces
    return state


async def run_agent_pipeline(
    query: str,
    conversation_history: List[Dict[str, str]] = None,
    user_id: str = None,
    model: str = None,
    provider: str = None,
) -> AgentState:
    """Execute the full 6-agent RAG pipeline."""
    start_time = time.time()

    state: AgentState = {
        "query": query,
        "conversation_history": conversation_history or [],
        "user_id": user_id,
        "model": model,
        "provider": provider,
        "intent": None,
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

    # Execute pipeline via compiled LangGraph
    state = await compiled_graph.ainvoke(state)

    state["total_latency_ms"] = int((time.time() - start_time) * 1000)

    logger.info(
        "Agent pipeline completed in %dms | Intent: %s | Confidence: %.2f",
        state["total_latency_ms"],
        state.get("intent"),
        state.get("confidence_score", 0),
    )

    return state


# ─────────────────────────────────────────────
# LangGraph Workflow Construction
# ─────────────────────────────────────────────
from langgraph.graph import StateGraph, START, END

async def parallel_retrieval_agent(state: AgentState) -> AgentState:
    """Agent: Run Knowledge Graph and Retriever agents in parallel."""
    import asyncio
    
    state_kg = state.copy()
    state_ret = state.copy()
    state_kg["agent_trace"] = list(state.get("agent_trace", []))
    state_ret["agent_trace"] = list(state.get("agent_trace", []))
    
    results = await asyncio.gather(
        knowledge_graph_agent(state_kg),
        retriever_agent(state_ret)
    )
    
    res_kg, res_ret = results
    
    state["cypher_query"] = res_kg.get("cypher_query")
    state["graph_results"] = res_kg.get("graph_results")
    state["graph_context"] = res_kg.get("graph_context")
    state["retrieved_chunks"] = res_ret.get("retrieved_chunks")
    state["retrieval_strategy"] = res_ret.get("retrieval_strategy")
    
    traces = list(state.get("agent_trace", []))
    kg_new_traces = res_kg.get("agent_trace", [])[len(traces):]
    ret_new_traces = res_ret.get("agent_trace", [])[len(traces):]
    traces.extend(kg_new_traces)
    traces.extend(ret_new_traces)
    state["agent_trace"] = traces
    return state


# Initialize StateGraph with the state schema
workflow = StateGraph(AgentState)

# Add pipeline agents as nodes
workflow.add_node("query_understanding", query_understanding_agent)
workflow.add_node("parallel_retrieval", parallel_retrieval_agent)
workflow.add_node("reranker", reranker_agent)
workflow.add_node("verifier", verification_agent)
workflow.add_node("response", response_agent)

# Set up sequential progression flow
workflow.add_edge(START, "query_understanding")
workflow.add_edge("query_understanding", "parallel_retrieval")
workflow.add_edge("parallel_retrieval", "reranker")
workflow.add_edge("reranker", "verifier")
workflow.add_edge("verifier", "response")
workflow.add_edge("response", END)

# Compile into an executable graph
compiled_graph = workflow.compile()
