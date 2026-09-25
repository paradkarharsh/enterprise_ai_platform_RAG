"""
Seed the knowledge base by ingesting all markdown files from the knowledge_base/ directory.
Works without requiring a specific user to exist in the database.
"""
import os
import sys
import asyncio
import uuid
import shutil
from datetime import datetime, timezone

# Add parent directory to path to allow importing app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select, delete
from app.db.postgres import async_session, engine, init_db
from app.db.models import Document, Chunk, SourceType, DocumentStatus, User
from app.api.routes.upload import process_document_task, SOURCE_TYPE_MAP

KB_DIR_LOCAL = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/knowledge_base"))
KB_DIR_EXTERNAL = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../knowledge_base"))
KB_DIR = KB_DIR_LOCAL if os.path.exists(KB_DIR_LOCAL) else KB_DIR_EXTERNAL
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../uploads"))


async def seed_knowledge_base(clear_existing: bool = False):
    """Seed the knowledge base files, preserving existing documents by default."""
    logger = logging.getLogger(__name__)
    
    if not os.path.exists(KB_DIR):
        logger.warning(f"KB directory does not exist at {KB_DIR}")
        return

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    owner_id = None
    async with async_session() as session:
        result = await session.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if user:
            owner_id = user.id

        if clear_existing:
            logger.info("Clearing existing documents and chunks...")
            await session.execute(delete(Chunk))
            await session.execute(delete(Document))
            await session.commit()

    kb_files = [f for f in os.listdir(KB_DIR) if f.endswith(".md") or f.endswith(".markdown")]
    logger.info(f"Found {len(kb_files)} files in KB directory: {kb_files}")

    success_count = 0
    fail_count = 0

    for filename in kb_files:
        src_path = os.path.join(KB_DIR, filename)
        ext = os.path.splitext(filename)[1].lower()

        # Check if already indexed
        if not clear_existing:
            async with async_session() as session:
                existing = await session.execute(select(Document).where(Document.title == filename))
                if existing.scalar_one_or_none():
                    continue

        doc_id = uuid.uuid4()
        dest_filename = f"{doc_id}{ext}"
        dest_path = os.path.join(UPLOAD_DIR, dest_filename)

        shutil.copy2(src_path, dest_path)
        file_size = os.path.getsize(dest_path)

        async with async_session() as session:
            doc = Document(
                id=doc_id,
                owner_id=owner_id,
                title=filename,
                description=f"Knowledge Base: {filename.replace('.md', '').replace('_', ' ')}",
                source_type=SOURCE_TYPE_MAP.get(ext, SourceType.MARKDOWN),
                file_path=dest_path,
                file_size=file_size,
                file_hash=str(uuid.uuid4()),
                mime_type="text/markdown",
                status=DocumentStatus.PENDING,
                progress=0,
                processing_stage="queued"
            )
            session.add(doc)
            await session.commit()

        try:
            await process_document_task(doc_id, dest_path)
            logger.info(f"[{filename}] Successfully indexed")
            success_count += 1
        except Exception as e:
            logger.warning(f"[{filename}] Failed indexing: {e}")
            fail_count += 1

    logger.info(f"KB Seeding finished: {success_count} indexed, {fail_count} failed")


async def seed():
    await init_db()
    await seed_knowledge_base(clear_existing=True)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
