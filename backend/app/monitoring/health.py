"""Health check and monitoring endpoints."""
from fastapi import APIRouter
from app.config import get_settings

router = APIRouter()
settings = get_settings()


@router.get("/health")
async def health_check():
    """Application health check."""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@router.get("/health/detailed")
async def detailed_health():
    """Detailed health check with dependency status."""
    checks = {"app": "healthy"}

    try:
        from app.db.redis import redis_client
        if redis_client:
            await redis_client.ping()
            checks["redis"] = "healthy"
        else:
            checks["redis"] = "unavailable"
    except Exception:
        checks["redis"] = "unhealthy"

    try:
        from app.knowledge_graph.engine import get_kg_engine
        engine = get_kg_engine()
        if engine._get_driver():
            checks["neo4j"] = "healthy"
        else:
            checks["neo4j"] = "unavailable"
    except Exception:
        checks["neo4j"] = "unavailable"

    from app.llm.factory import list_available_providers
    providers = list_available_providers()
    checks["llm_providers"] = {p["name"]: "available" if p["available"] else "unavailable" for p in providers}

    return {"status": "healthy", "checks": checks}
