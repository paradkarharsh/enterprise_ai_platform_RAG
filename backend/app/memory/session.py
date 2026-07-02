"""Session and long-term memory management."""
import logging
import json
from typing import Optional, List, Dict
from datetime import datetime, timezone
from app.db.redis import RedisCache
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class SessionMemory:
    """Short-term session memory backed by Redis."""

    @staticmethod
    async def get_history(session_id: str, limit: int = 20) -> List[Dict]:
        raw = await RedisCache.get(f"session:{session_id}:history")
        if raw:
            history = json.loads(raw)
            return history[-limit:]
        return []

    @staticmethod
    async def add_message(session_id: str, role: str, content: str):
        key = f"session:{session_id}:history"
        raw = await RedisCache.get(key)
        history = json.loads(raw) if raw else []
        history.append({"role": role, "content": content, "timestamp": datetime.now(timezone.utc).isoformat()})
        # Keep last 50 messages
        if len(history) > 50:
            history = history[-50:]
        await RedisCache.set(key, json.dumps(history), expire=86400)

    @staticmethod
    async def clear(session_id: str):
        from app.db.redis import redis_client
        if redis_client:
            await redis_client.delete(f"session:{session_id}:history")


class LongTermMemory:
    """Long-term user memory backed by PostgreSQL."""

    @staticmethod
    async def store(user_id: str, memory_type: str, content: str, importance: float = 0.5):
        from app.db.postgres import async_session
        from app.db.models import UserMemory
        async with async_session() as session:
            memory = UserMemory(
                user_id=user_id, memory_type=memory_type,
                content=content, importance=importance,
            )
            session.add(memory)
            await session.commit()

    @staticmethod
    async def recall(user_id: str, memory_type: Optional[str] = None, limit: int = 10) -> List[Dict]:
        from app.db.postgres import async_session
        from app.db.models import UserMemory
        from sqlalchemy import select

        async with async_session() as session:
            query = select(UserMemory).where(UserMemory.user_id == user_id)
            if memory_type:
                query = query.where(UserMemory.memory_type == memory_type)
            query = query.order_by(UserMemory.importance.desc(), UserMemory.updated_at.desc()).limit(limit)
            result = await session.execute(query)
            memories = result.scalars().all()
            return [{"type": m.memory_type, "content": m.content, "importance": m.importance} for m in memories]
