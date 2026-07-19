import os
import sys
import asyncio
import uuid
import shutil
from datetime import datetime, timezone

# Add parent directory to path to allow importing app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from app.db.postgres import async_session, engine, init_db
from app.db.models import Document, Chunk, SourceType, User
from app.api.routes.upload import process_document_task, SOURCE_TYPE_MAP

KB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../knowledge_base"))
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../uploads"))

async def seed_demo():
    print("Initializing database...")
    await init_db()

    # Find the test user ID
    user_id = "5972f81ffa8a488b8a9c375c9b609e04"
    user_uuid = uuid.UUID(user_id)
    async with async_session() as session:
        result = await session.execute(select(User).where(User.id == user_uuid))
        user = result.scalar_one_or_none()
        if not user:
            print("Error: test user test_enterprise_user not found in database.")
            return
        print(f"Found user: {user.username} ({user.id})")

    # Ingest football and cricket files
    demo_files = ["football_wiki.md", "cricket_wiki.md"]
    print(f"Reading files from {KB_DIR}...")
    
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    for filename in demo_files:
        src_path = os.path.join(KB_DIR, filename)
        if not os.path.exists(src_path):
            print(f"Warning: Demo file not found at {src_path}")
            continue
            
        ext = os.path.splitext(filename)[1].lower()
        doc_id = uuid.uuid4()
        dest_filename = f"{doc_id}{ext}"
        dest_path = os.path.join(UPLOAD_DIR, dest_filename)
        
        # Copy file to uploads folder
        shutil.copy2(src_path, dest_path)
        file_size = os.path.getsize(dest_path)
        
        print(f"Registering demo document {filename}...")
        
        async with async_session() as session:
            doc = Document(
                id=doc_id,
                owner_id=user.id,
                title=filename,
                description=f"Demo Knowledge Base: {filename.replace('.md', '').replace('_', ' ')}",
                source_type=SOURCE_TYPE_MAP.get(ext, SourceType.MARKDOWN),
                file_path=dest_path,
                file_size=file_size,
                file_hash=str(uuid.uuid4()),  # Dummy hash
                mime_type="text/markdown",
                status="pending",
                progress=0,
                processing_stage="queued"
            )
            session.add(doc)
            await session.commit()
            
        print(f"Processing ingestion tasks for {filename}...")
        try:
            await process_document_task(doc_id, dest_path)
            print(f"Successfully indexed demo document {filename}")
        except Exception as e:
            print(f"Failed to ingest demo document {filename}: {e}")

    # Dispose database engine connections
    await engine.dispose()
    print("Demo seeding completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed_demo())
