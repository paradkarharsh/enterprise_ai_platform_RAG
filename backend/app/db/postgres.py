"""
PostgreSQL async connection management using SQLAlchemy.
"""
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config import get_settings
from app.db.models import Base

logger = logging.getLogger(__name__)
settings = get_settings()

import os

# Ensure data directory exists for SQLite
os.makedirs("data", exist_ok=True)

# Determine database type and URL
db_url = os.environ.get("DATABASE_URL")
if db_url or settings.ENVIRONMENT == "production" or os.environ.get("ENVIRONMENT") == "production":
    url = db_url or settings.DATABASE_URL
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    engine = create_async_engine(
        url,
        echo=settings.DEBUG,
        pool_pre_ping=True,
        pool_recycle=3600,
    )
    is_sqlite = False
else:
    engine = create_async_engine(
        "sqlite+aiosqlite:///./data/enterprise_ai.db",
        echo=settings.DEBUG,
        pool_pre_ping=True,
        pool_recycle=3600,
    )
    is_sqlite = True

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    """Initialize database: create tables if they don't exist."""
    db_type = "SQLite" if is_sqlite else "PostgreSQL"
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info(f"✅ {db_type} database connected and tables created")
    except Exception as e:
        logger.warning(f"⚠️ {db_type} connection failed: {e}. Running in demo mode.")


async def close_db():
    """Close database connections."""
    await engine.dispose()
    db_type = "SQLite" if is_sqlite else "PostgreSQL"
    logger.info(f"{db_type} connections closed")


async def get_db() -> AsyncSession:
    """Dependency: get async database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
