"""Query API route."""
import logging
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.auth.jwt import get_optional_user
from app.db.models import User
from app.agents.graph import run_agent_pipeline

logger = logging.getLogger(__name__)
router = APIRouter()


class QueryRequest(BaseModel):
    query: str
    model: Optional[str] = None
    provider: Optional[str] = None


@router.post("/")
async def query(request: QueryRequest, current_user: Optional[User] = Depends(get_optional_user)):
    """Execute a RAG query through the agent pipeline."""
    user_id = str(current_user.id) if current_user else None
    state = await run_agent_pipeline(
        query=request.query, user_id=user_id,
        model=request.model, provider=request.provider,
    )
    return {
        "response": state.get("response", ""),
        "citations": state.get("citations", []),
        "confidence_score": state.get("confidence_score", 0),
        "agent_trace": state.get("agent_trace", []),
        "latency_ms": state.get("total_latency_ms", 0),
    }
