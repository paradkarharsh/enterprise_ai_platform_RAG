"""
Rate limiting middleware using Redis.
"""
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware based on client IP."""

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path in ["/health", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        key = f"rate_limit:{client_ip}:{int(time.time() // 60)}"

        try:
            from app.db.redis import redis_client
            if redis_client:
                count = await redis_client.incr(key)
                if count == 1:
                    await redis_client.expire(key, 60)

                if count > settings.RATE_LIMIT_PER_MINUTE:
                    return JSONResponse(
                        status_code=429,
                        content={"error": "Rate limit exceeded", "detail": f"Max {settings.RATE_LIMIT_PER_MINUTE} requests per minute"},
                    )
        except Exception as e:
            logger.debug("Rate limiting unavailable: %s", e)

        response = await call_next(request)
        return response
