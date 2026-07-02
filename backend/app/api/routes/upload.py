"""
Upload API route: document upload, parsing, chunking, embedding, graph extraction.
"""
import logging
import os
import shutil
from uuid import uuid4
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.postgres import get_db
from app.db.models import Document, Chunk, DocumentStatus, SourceType, User
from app.auth.jwt import get_optional_user
from app.ingestion.pipeline import parse_document, chunk_text, compute_file_hash

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter()

SOURCE_TYPE_MAP = {
    ".pdf": SourceType.PDF,
    ".docx": SourceType.DOCX,
    ".pptx": SourceType.PPTX,
    ".txt": SourceType.TXT,
    ".csv": SourceType.CSV,
    ".xlsx": SourceType.EXCEL,
    ".xls": SourceType.EXCEL,
}


@router.post("/")
async def upload_document(
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Upload and process a document through the full ingestion pipeline."""
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    # Save file
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_id = str(uuid4())
    file_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}{ext}")

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_size = os.path.getsize(file_path)
    file_hash = compute_file_hash(file_path)

    # Create document record
    doc = Document(
        owner_id=current_user.id if current_user else None,
        title=file.filename,
        description=description,
        source_type=SOURCE_TYPE_MAP.get(ext, SourceType.TXT),
        file_path=file_path,
        file_size=file_size,
        file_hash=file_hash,
        mime_type=file.content_type,
        status=DocumentStatus.PROCESSING,
    )
    db.add(doc)
    await db.flush()

    try:
        # Parse document
        parsed = await parse_document(file_path)
        doc.page_count = parsed.page_count

        # Chunk text
        chunks = chunk_text(parsed.content, metadata={"document_id": str(doc.id), "title": parsed.title})
        doc.chunk_count = len(chunks)

        # Store chunks in database
        for chunk in chunks:
            db_chunk = Chunk(
                document_id=doc.id,
                content=chunk.content,
                chunk_index=chunk.chunk_index,
                page_number=chunk.page_number,
                start_char=chunk.start_char,
                end_char=chunk.end_char,
                token_count=chunk.token_count,
                meta=chunk.metadata,
            )
            db.add(db_chunk)

        # Embed and store in vector DB (async)
        try:
            from app.llm.embeddings import get_embedding_provider
            from app.vectorstore.factory import get_vector_store

            embedder = get_embedding_provider()
            store = get_vector_store()

            texts = [c.content for c in chunks]
            ids = [c.id for c in chunks]
            metadatas = [{**c.metadata, "chunk_index": c.chunk_index} for c in chunks]

            # Batch embed
            batch_size = 50
            for i in range(0, len(texts), batch_size):
                batch_texts = texts[i:i + batch_size]
                batch_ids = ids[i:i + batch_size]
                batch_metas = metadatas[i:i + batch_size]
                embeddings = await embedder.embed_texts(batch_texts)
                await store.add(batch_ids, batch_texts, embeddings, batch_metas)

            logger.info("Embedded %d chunks for document %s", len(chunks), doc.id)
        except Exception as e:
            logger.warning("Embedding failed (will retry): %s", e)

        # Extract entities for knowledge graph
        try:
            from app.knowledge_graph.extractor import extract_entities_and_relationships
            from app.knowledge_graph.engine import get_kg_engine

            engine = get_kg_engine()
            # Process first few chunks for entity extraction
            sample_text = "\n\n".join([c.content for c in chunks[:5]])
            entities, relationships = await extract_entities_and_relationships(sample_text)

            for entity in entities:
                await engine.add_entity(entity)
            for rel in relationships:
                await engine.add_relationship(rel)

            doc.entity_count = len(entities)
            logger.info("Extracted %d entities, %d relationships", len(entities), len(relationships))
        except Exception as e:
            logger.warning("Graph extraction failed: %s", e)

        doc.status = DocumentStatus.INDEXED
        await db.flush()

        return {
            "id": str(doc.id),
            "title": doc.title,
            "status": doc.status.value,
            "page_count": doc.page_count,
            "chunk_count": doc.chunk_count,
            "entity_count": doc.entity_count,
            "file_size": doc.file_size,
        }

    except Exception as e:
        doc.status = DocumentStatus.FAILED
        doc.error_message = str(e)
        await db.flush()
        logger.error("Document processing failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Document processing failed: {str(e)}")


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Delete a document and its associated data."""
    from sqlalchemy import select
    query = select(Document).where(Document.id == document_id)
    if current_user:
        query = query.where(Document.owner_id == current_user.id)
    result = await db.execute(query)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file
    if doc.file_path and os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    await db.delete(doc)
    return {"status": "deleted", "id": document_id}
