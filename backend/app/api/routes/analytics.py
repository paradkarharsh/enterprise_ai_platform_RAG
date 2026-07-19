"""Analytics API route."""
import logging
from datetime import datetime, timedelta, timezone
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
        # Document and Chunk counts
        docs_res = await db.execute(select(func.count(Document.id)))
        total_docs = docs_res.scalar() or 0

        chunks_res = await db.execute(select(func.count(Chunk.id)))
        total_chunks = chunks_res.scalar() or 0

        # Query counts
        queries_res = await db.execute(select(func.count(QueryLog.id)))
        total_queries = queries_res.scalar() or 0

        # Storage used in MB
        storage_res = await db.execute(select(func.sum(Document.file_size)))
        storage_bytes = storage_res.scalar() or 0
        storage_mb = round(storage_bytes / (1024 * 1024), 2)

        # Active Users count
        users_res = await db.execute(select(func.count(User.id)))
        active_users = users_res.scalar() or 1

        # Average Latency
        latency_res = await db.execute(select(func.avg(QueryLog.latency_ms)))
        avg_latency = round(latency_res.scalar() or 0.0, 2)

        # Queries Today
        today_start = datetime.now(timezone.utc) - timedelta(days=1)
        today_queries_res = await db.execute(select(func.count(QueryLog.id)).where(QueryLog.created_at >= today_start))
        queries_today = today_queries_res.scalar() or 0

        # Neo4j Entity & Relationship counts
        total_nodes = 0
        total_relationships = 0
        try:
            from app.knowledge_graph.engine import get_kg_engine
            engine = get_kg_engine()
            stats = await engine.get_graph_stats()
            total_nodes = stats.get("total_nodes", 0)
            total_relationships = stats.get("total_relationships", 0)
        except Exception as graph_err:
            logger.warning("Failed to retrieve Neo4j graph stats: %s", graph_err)

        return {
            "total_documents": total_docs,
            "total_chunks": total_chunks,
            "total_queries": total_queries,
            "total_entities": total_nodes,
            "total_relationships": total_relationships,
            "storage_used_mb": storage_mb,
            "active_users": active_users,
            "avg_latency_ms": avg_latency,
            "queries_today": queries_today,
        }
    except Exception as e:
        logger.error("Dashboard analytics compilation failed: %s", e)
        return {
            "total_documents": 0,
            "total_chunks": 0,
            "total_queries": 0,
            "total_entities": 0,
            "total_relationships": 0,
            "storage_used_mb": 0.0,
            "active_users": 1,
            "avg_latency_ms": 0.0,
            "queries_today": 0,
        }


@router.get("/query-metrics")
async def get_query_metrics(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get query performance metrics."""
    try:
        # Total queries
        q_res = await db.execute(select(func.count(QueryLog.id)))
        total_queries = q_res.scalar() or 0

        # Average latency
        l_res = await db.execute(select(func.avg(QueryLog.latency_ms)))
        avg_latency = round(l_res.scalar() or 0.0, 2)

        # Average confidence
        c_res = await db.execute(select(func.avg(QueryLog.confidence_score)))
        avg_confidence = round(c_res.scalar() or 0.0, 2)

        # Hallucination rate
        h_res = await db.execute(select(func.avg(QueryLog.hallucination_score)))
        hallucination_rate = round(h_res.scalar() or 0.0, 2)

        # Total tokens
        tokens_res = await db.execute(select(func.sum(QueryLog.token_input + QueryLog.token_output)))
        total_tokens = tokens_res.scalar() or 0

        # Total MTD Cost USD
        cost_res = await db.execute(select(func.sum(QueryLog.cost_usd)))
        total_cost = round(cost_res.scalar() or 0.0, 4)

        # Get logs from the last 30 days to process timelines in Python (fully dialect agnostic)
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        logs_res = await db.execute(select(QueryLog).where(QueryLog.created_at >= cutoff))
        logs = logs_res.scalars().all()

        # Group queries by day
        by_day = {}
        for log in logs:
            day_str = log.created_at.strftime('%Y-%m-%d') if log.created_at else datetime.now().strftime('%Y-%m-%d')
            by_day[day_str] = by_day.get(day_str, 0) + 1

        queries_by_day = [{"date": k, "count": v} for k, v in sorted(by_day.items())]

        # Latency distribution bins
        latency_bins = {"0-200ms": 0, "200-500ms": 0, "500-1000ms": 0, "1-2s": 0, "2s+": 0}
        for log in logs:
            l = log.latency_ms or 0
            if l < 200:
                latency_bins["0-200ms"] += 1
            elif l < 500:
                latency_bins["200-500ms"] += 1
            elif l < 1000:
                latency_bins["500-1000ms"] += 1
            elif l < 2000:
                latency_bins["1-2s"] += 1
            else:
                latency_bins["2s+"] += 1

        latency_distribution = [{"bin": k, "count": v} for k, v in latency_bins.items()]

        return {
            "total_queries": total_queries,
            "avg_latency_ms": avg_latency,
            "avg_confidence": avg_confidence,
            "hallucination_rate": hallucination_rate,
            "total_tokens": total_tokens,
            "total_cost_usd": total_cost,
            "queries_by_day": queries_by_day,
            "latency_distribution": latency_distribution,
        }
    except Exception as e:
        logger.error("Query metrics compilation failed: %s", e)
        return {
            "total_queries": 0,
            "avg_latency_ms": 0.0,
            "avg_confidence": 0.0,
            "hallucination_rate": 0.0,
            "total_tokens": 0,
            "total_cost_usd": 0.0,
            "queries_by_day": [],
            "latency_distribution": [],
        }
