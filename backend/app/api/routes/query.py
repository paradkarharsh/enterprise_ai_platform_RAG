"""Query API route."""
import logging
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.db.models import User, QueryLog
from app.auth.jwt import get_optional_user
from app.agents.graph import run_agent_pipeline
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


class QueryRequest(BaseModel):
    query: str
    model: Optional[str] = None
    provider: Optional[str] = None


@router.post("")
async def query(
    request: QueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Execute a RAG query through the agent pipeline."""
    user_id = str(current_user.id) if current_user else None
    user_keys = current_user.get_all_llm_api_keys() if current_user else {}
    req_prov = request.provider or (current_user.preferences.get("default_llm_provider") if current_user and current_user.preferences else None) or settings.DEFAULT_LLM_PROVIDER
    active_key = user_keys.get(req_prov) or (user_keys.get("gemini") if "gemini" in user_keys else None)

    state = await run_agent_pipeline(
        query=request.query,
        user_id=user_id,
        model=request.model,
        provider=req_prov,
        user_api_keys=user_keys,
        api_key=active_key,
    )

    # Calculate token values and cost
    raw_tokens = state.get("token_usage")
    tok_dict = raw_tokens if isinstance(raw_tokens, dict) else {}
    tok_in = int(tok_dict.get("input", 0) or 0)
    tok_out = int(tok_dict.get("output", 0) or 0)
    cost_usd = (tok_in * 0.00015 / 1000) + (tok_out * 0.0006 / 1000)

    # Determine hallucination score
    conf_raw = state.get("confidence_score")
    conf_val = float(conf_raw) if isinstance(conf_raw, (int, float)) else 0.0
    hallucination_score = round(1.0 - conf_val, 2) if isinstance(conf_raw, (int, float)) else None

    # Save QueryLog
    query_log = QueryLog(
        user_id=current_user.id if current_user else None,
        query_text=request.query,
        query_type="query",
        intent=state.get("intent") or "general",
        model_used=tok_dict.get("model") or request.model or settings.DEFAULT_LLM_MODEL,
        retrieval_strategy=state.get("retrieval_strategy") or "hybrid",
        results_count=len(state.get("retrieved_chunks") or []),
        latency_ms=state.get("total_latency_ms") or 0,
        token_input=tok_in,
        token_output=tok_out,
        cost_usd=cost_usd,
        confidence_score=conf_val,
        hallucination_score=hallucination_score,
    )
    db.add(query_log)
    await db.flush()

    return {
        "response": state.get("response") or "",
        "citations": state.get("citations") or [],
        "confidence_score": conf_val,
        "agent_trace": state.get("agent_trace") or [],
        "latency_ms": state.get("total_latency_ms") or 0,
    }
