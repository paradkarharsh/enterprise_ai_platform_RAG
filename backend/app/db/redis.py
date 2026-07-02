"""
Redis connection management for caching, sessions, and rate limiting.
"""
import logging
from typing import Optional
import redis.asyncio as aioredis
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

redis_client: Optional[aioredis.Redis] = None


async def init_redis():
    """Initialize Redis connection."""
    global redis_client
    try:
        redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
        )
        await redis_client.ping()
        logger.info("✅ Redis connected at %s:%s", settings.REDIS_HOST, settings.REDIS_PORT)
    except Exception as e:
        logger.warning("⚠️ Redis connection failed: %s. Caching disabled.", e)
        redis_client = None


async def close_redis():
    """Close Redis connection."""
    global redis_client
    if redis_client:
        await redis_client.close()
        logger.info("Redis connection closed")


async def get_redis() -> Optional[aioredis.Redis]:
    """Dependency: get Redis client."""
    return redis_client


class RedisCache:
    """High-level cache operations."""

    @staticmethod
    async def get(key: str) -> Optional[str]:
        if redis_client:
            return await redis_client.get(key)
        return None

    @staticmethod
    async def set(key: str, value: str, expire: int = 3600):
        if redis_client:
            await redis_client.set(key, value, ex=expire)

    @staticmethod
    async def delete(key: str):
        if redis_client:
            await redis_client.delete(key)

    @staticmethod
    async def increment(key: str, expire: int = 60) -> int:
        if redis_client:
            pipe = redis_client.pipeline()
            pipe.incr(key)
            pipe.expire(key, expire)
            results = await pipe.execute()
            return results[0]
        return 0

    @staticmethod
    async def get_count(key: str) -> int:
        if redis_client:
            val = await redis_client.get(key)
            return int(val) if val else 0
        return 0
