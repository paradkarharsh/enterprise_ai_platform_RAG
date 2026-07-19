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

KB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../knowledge_base"))
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../uploads"))


async def seed():
    print("Initializing database...")
    await init_db()

    # Find any existing user (or use None for ownerless public documents)
    owner_id = None
    async with async_session() as session:
        result = await session.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if user:
            owner_id = user.id
            print(f"Found user: {user.username} ({user.id})")
        else:
            print("No users found — documents will be created without an owner (public).")

        # Clear existing documents and chunks
        print("Clearing existing documents and chunks...")
        await session.execute(delete(Chunk))
        await session.execute(delete(Document))
        await session.commit()

    # Get all markdown files in KB directory
    print(f"\nReading files from {KB_DIR}...")
    if not os.path.exists(KB_DIR):
        print(f"Error: KB directory does not exist at {KB_DIR}")
        return

    kb_files = [f for f in os.listdir(KB_DIR) if f.endswith(".md") or f.endswith(".markdown")]
    print(f"Found {len(kb_files)} files to ingest: {kb_files}\n")

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    success_count = 0
    fail_count = 0

    for filename in kb_files:
        src_path = os.path.join(KB_DIR, filename)
        ext = os.path.splitext(filename)[1].lower()

        doc_id = uuid.uuid4()
        dest_filename = f"{doc_id}{ext}"
        dest_path = os.path.join(UPLOAD_DIR, dest_filename)

        # Copy file to uploads folder
        shutil.copy2(src_path, dest_path)
        file_size = os.path.getsize(dest_path)

        print(f"[{filename}] Registering document...")

        async with async_session() as session:
            doc = Document(
                id=doc_id,
                owner_id=owner_id,
                title=filename,
                description=f"Knowledge Base: {filename.replace('.md', '').replace('_', ' ')}",
                source_type=SOURCE_TYPE_MAP.get(ext, SourceType.MARKDOWN),
                file_path=dest_path,
                file_size=file_size,
                file_hash=str(uuid.uuid4()),  # Dummy hash
                mime_type="text/markdown",
                status=DocumentStatus.PENDING,
                progress=0,
                processing_stage="queued"
            )
            session.add(doc)
            await session.commit()

        print(f"[{filename}] Running ingestion pipeline...")
        try:
            await process_document_task(doc_id, dest_path)
            print(f"[{filename}] OK - Successfully indexed\n")
            success_count += 1
        except Exception as e:
            print(f"[{filename}] FAILED - {e}\n")
            fail_count += 1

    # Dispose database engine connections
    await engine.dispose()
    print(f"Seeding completed! {success_count} indexed OK, {fail_count} failed")


if __name__ == "__main__":
    asyncio.run(seed())
