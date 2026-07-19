"""
Enterprise AI Knowledge Platform - FastAPI Application Entry Point.
Production-grade API server with middleware, error handling, and OpenAPI docs.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.utils import get_openapi

from app.config import get_settings
from app.api.routes import auth, upload, query, search, chat, graph, analytics, reindex, tickets, feedback, integrations, voice
from app.api.middleware.rate_limit import RateLimitMiddleware
from app.db.postgres import init_db, close_db
from app.db.redis import init_redis, close_redis
from app.monitoring.health import router as health_router

logger = logging.getLogger(__name__)
settings = get_settings()

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle: startup and shutdown."""
    logger.info("🚀 Starting Enterprise AI Knowledge Platform v%s", settings.APP_VERSION)

    # Create data directories
    from pathlib import Path
    base_dir = Path(__file__).resolve().parent.parent  # backend/
    for dir_name in ["data/uploads", "data/chroma", "data/faiss_index", settings.UPLOADS_ABSOLUTE_DIR]:
        dir_path = base_dir / dir_name if not Path(dir_name).is_absolute() else Path(dir_name)
        dir_path.mkdir(parents=True, exist_ok=True)
        logger.info("📁 Ensured directory exists: %s", dir_path)

    # Initialize database connections
    await init_db()
    await init_redis()

    logger.info("✅ All services initialized successfully")
    yield

    # Cleanup
    logger.info("🔻 Shutting down services...")
    await close_db()
    await close_redis()
    logger.info("👋 Shutdown complete")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "Production-grade Enterprise AI Knowledge Platform combining "
            "Knowledge Graph Intelligence, Agentic RAG, Enterprise Search, "
            "Multi-Agent Workflows, and Analytics."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Rate Limiting
    app.add_middleware(RateLimitMiddleware)

    # Exception handlers
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled exception: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal server error",
                "detail": str(exc) if settings.DEBUG else "An unexpected error occurred",
            },
        )

    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": "Not found", "detail": "The requested resource was not found"},
        )

    # Register routers
    prefix = settings.API_PREFIX
    app.include_router(health_router, tags=["Health"])
    app.include_router(auth.router, prefix=f"{prefix}/auth", tags=["Authentication"])
    app.include_router(upload.router, prefix=f"{prefix}/upload", tags=["Upload"])
    app.include_router(query.router, prefix=f"{prefix}/query", tags=["Query"])
    app.include_router(search.router, prefix=f"{prefix}/search", tags=["Search"])
    app.include_router(chat.router, prefix=f"{prefix}/chat", tags=["Chat"])
    app.include_router(graph.router, prefix=f"{prefix}/graph", tags=["Knowledge Graph"])
    app.include_router(analytics.router, prefix=f"{prefix}/analytics", tags=["Analytics"])
    app.include_router(reindex.router, prefix=f"{prefix}/reindex", tags=["Reindex"])
    app.include_router(tickets.router, prefix=f"{prefix}/tickets", tags=["Tickets"])
    app.include_router(feedback.router, prefix=f"{prefix}/feedback", tags=["Feedback"])
    app.include_router(integrations.router, prefix=f"{prefix}/integrations", tags=["Integrations"])
    app.include_router(voice.router, prefix=f"{prefix}/voice", tags=["Voice"])

    return app


app = create_app()
