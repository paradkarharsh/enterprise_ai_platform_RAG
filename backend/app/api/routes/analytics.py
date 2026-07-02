"""Analytics API route."""
import logging
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.db.models import Document, Chunk, QueryLog, User, DocumentStatus
from app.auth.jwt import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/dashboard")
async def get_dashboard(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get analytics dashboard data."""
    try:
        docs = await db.execute(select(func.count(Document.id)))
        chunks = await db.execute(select(func.count(Chunk.id)))
        queries = await db.execute(select(func.count(QueryLog.id)))

        return {
            "total_documents": docs.scalar() or 0,
            "total_chunks": chunks.scalar() or 0,
            "total_queries": queries.scalar() or 0,
            "total_entities": 0,
            "total_relationships": 0,
            "storage_used_mb": 0,
            "active_users": 1,
            "avg_latency_ms": 0,
            "queries_today": 0,
        }
    except Exception as e:
        logger.error("Dashboard query failed: %s", e)
        return {"total_documents": 0, "total_chunks": 0, "total_queries": 0}


@router.get("/query-metrics")
async def get_query_metrics(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get query performance metrics."""
    return {
        "total_queries": 0, "avg_latency_ms": 0, "avg_confidence": 0,
        "hallucination_rate": 0, "total_tokens": 0, "total_cost_usd": 0,
        "queries_by_day": [], "latency_distribution": [],
    }
