"""
Upload API route: document upload, async parsing, chunking, embedding, graph extraction.
"""
import logging
import os
import shutil
import uuid
from typing import Optional, List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.postgres import get_db, async_session
from app.db.models import Document, Chunk, DocumentStatus, SourceType, User
from app.auth.jwt import get_optional_user, get_current_user
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
    ".md": SourceType.MARKDOWN,
    ".markdown": SourceType.MARKDOWN,
}


class DocumentResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    source_type: str
    file_size: Optional[int] = None
    status: str
    progress: int = 0
    processing_stage: Optional[str] = None
    page_count: Optional[int] = None
    chunk_count: int = 0
    entity_count: int = 0
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_document(cls, doc) -> "DocumentResponse":
        """Build from an ORM Document, handling UUID/enum/datetime conversion."""
        return cls(
            id=str(doc.id),
            title=doc.title,
            description=doc.description,
            source_type=doc.source_type.value if hasattr(doc.source_type, "value") else str(doc.source_type),
            file_size=doc.file_size,
            status=doc.status.value if hasattr(doc.status, "value") else str(doc.status),
            progress=doc.progress or 0,
            processing_stage=doc.processing_stage,
            page_count=doc.page_count,
            chunk_count=doc.chunk_count or 0,
            entity_count=doc.entity_count or 0,
            created_at=doc.created_at.isoformat() if doc.created_at else None,
        )


async def process_document_task(doc_id: uuid.UUID, file_path: str):
    """Background task to parse, chunk, embed, and extract knowledge graph from a document."""
    from app.llm.embeddings import get_embedding_provider
    from app.vectorstore.factory import get_vector_store
    from app.knowledge_graph.extractor import extract_entities_and_relationships
    from app.knowledge_graph.engine import get_kg_engine

    logger.info("Starting background processing for document: %s", doc_id)

    async with async_session() as session:
        result = await session.execute(select(Document).where(Document.id == doc_id))
        doc = result.scalar_one_or_none()
        if not doc:
            logger.error("Document %s not found in background task", doc_id)
            return

        try:
            # Stage: Parsing
            doc.status = DocumentStatus.PROCESSING
            doc.processing_stage = "parsing"
            doc.progress = 10
            await session.commit()

            parsed = await parse_document(file_path)
            doc.page_count = parsed.page_count
            doc.processing_stage = "chunking"
            doc.progress = 30
            await session.commit()

            # Clean up existing chunks from DB and vector store before adding new ones
            try:
                from sqlalchemy import delete
                chunk_select = select(Chunk).where(Chunk.document_id == doc.id)
                chunk_res = await session.execute(chunk_select)
                old_chunks = chunk_res.scalars().all()
                if old_chunks:
                    store = get_vector_store()
                    old_ids = [str(c.id) for c in old_chunks]
                    await store.delete(old_ids)
                    await session.execute(delete(Chunk).where(Chunk.document_id == doc.id))
                    await session.commit()
                    logger.info("Cleared %d existing chunks for document %s", len(old_chunks), doc.id)
            except Exception as clean_err:
                logger.warning("Chunk cleanup failed for document %s: %s", doc.id, clean_err)

            # Stage: Chunking
            chunks = chunk_text(
                parsed.content,
                metadata={
                    "document_id": str(doc.id),
                    "title": parsed.title,
                    "source_type": doc.source_type.value if hasattr(doc.source_type, "value") else str(doc.source_type)
                }
            )
            doc.chunk_count = len(chunks)

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
                session.add(db_chunk)

            doc.processing_stage = "embedding"
            doc.progress = 50
            await session.commit()

            # Stage: Embedding
            try:
                embedder = get_embedding_provider()
                store = get_vector_store()

                texts = [c.content for c in chunks]
                ids = [c.id for c in chunks]
                metadatas = [{**c.metadata, "chunk_index": c.chunk_index} for c in chunks]

                batch_size = 50
                for i in range(0, len(texts), batch_size):
                    batch_texts = texts[i:i + batch_size]
                    batch_ids = ids[i:i + batch_size]
                    batch_metas = metadatas[i:i + batch_size]
                    embeddings = await embedder.embed_texts(batch_texts)
                    await store.add(batch_ids, batch_texts, embeddings, batch_metas)

                logger.info("Embedded %d chunks for document %s", len(chunks), doc.id)
            except Exception as embed_err:
                logger.error("Embedding failed for document %s: %s", doc.id, embed_err)

            doc.processing_stage = "graph_extraction"
            doc.progress = 80
            await session.commit()

            # Stage: Graph Extraction
            try:
                engine = get_kg_engine()
                sample_text = "\n\n".join([c.content for c in chunks[:5]])
                entities, relationships = await extract_entities_and_relationships(sample_text)

                for entity in entities:
                    await engine.add_entity(entity)
                for rel in relationships:
                    await engine.add_relationship(rel)

                doc.entity_count = len(entities)
                logger.info("Extracted %d entities, %d relationships for document %s", len(entities), len(relationships), doc.id)
            except Exception as graph_err:
                logger.error("Graph extraction failed for document %s: %s", doc.id, graph_err)

            # Generate suggested questions based on the document content using Gemini
            try:
                from app.llm.factory import generate_with_fallback, LLMMessage
                import json
                import re

                sample_text = "\n\n".join([c.content for c in chunks[:5]])
                messages = [
                    LLMMessage(role="system", content="""Based on the provided document snippet, generate 3 distinct, high-quality, and relevant questions that a user might ask about this document. 
Return them as a JSON list of strings. Example:
[
  "What is the refund policy?",
  "How long is the warranty?",
  "What is the pricing plan?"
]
Return ONLY a valid JSON list. Do not include markdown code block formatting or any explanations."""),
                    LLMMessage(role="user", content=f"Document title: {doc.title}\n\nDocument Snippet:\n{sample_text}")
                ]
                
                logger.info("Generating suggested questions for document %s...", doc.id)
                response = await generate_with_fallback(
                    messages,
                    temperature=0.7,
                    max_tokens=256,
                )
                
                content = response.content.strip()
                questions = []
                
                # 1. Try JSON list parsing
                try:
                    candidate = content
                    if candidate.startswith("```"):
                        candidate = re.sub(r"^```(?:json)?\n", "", candidate)
                        candidate = re.sub(r"\n```$", "", candidate)
                        candidate = candidate.strip()
                    
                    start_idx = candidate.find('[')
                    end_idx = candidate.rfind(']')
                    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                        parsed = json.loads(candidate[start_idx:end_idx+1])
                        if isinstance(parsed, list):
                            questions = [str(q).strip() for q in parsed if q]
                except Exception:
                    pass

                # 2. Try regex numbered list fallback if JSON failed
                if not questions:
                    for line in content.split("\n"):
                        line = line.strip()
                        match = re.match(r'^(?:\d+[\s\.\)\]\-:]+|\-\s*)(.+)$', line)
                        if match:
                            q = match.group(1).strip().strip('"\'')
                            if q:
                                questions.append(q)
                                
                # 3. Final fallback: raw lines
                if not questions:
                    questions = [line.strip().strip('"\'') for line in content.split("\n") if len(line.strip()) > 10]

                if questions:
                    meta = dict(doc.meta or {})
                    meta["suggested_questions"] = [q for q in questions[:3]]
                    doc.meta = meta
                    logger.info("Generated questions for %s: %s", doc.title, meta["suggested_questions"])
            except Exception as q_err:
                logger.warning("Failed to generate suggested questions for document %s: %s", doc.id, q_err)

            doc.status = DocumentStatus.INDEXED
            doc.processing_stage = "completed"
            doc.progress = 100
            doc.indexed_at = datetime.now(timezone.utc)
            await session.commit()
            logger.info("Completed background processing for document: %s", doc_id)

        except Exception as e:
            logger.error("Failed to process document %s: %s", doc.id, e, exc_info=True)
            doc.status = DocumentStatus.FAILED
            doc.processing_stage = "failed"
            doc.progress = 100
            doc.error_message = str(e)
            await session.commit()


@router.post("", response_model=DocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Upload a document and trigger processing in a background task."""
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    # Save file
    os.makedirs(settings.UPLOADS_ABSOLUTE_DIR, exist_ok=True)
    file_id = str(uuid.uuid4())
    file_path = os.path.join(settings.UPLOADS_ABSOLUTE_DIR, f"{file_id}{ext}")

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_size = os.path.getsize(file_path)
    file_hash = compute_file_hash(file_path)

    # Create document record
    doc = Document(
        owner_id=current_user.id if current_user else None,
        organization_id=current_user.organization_id if current_user else None,
        title=file.filename,
        description=description,
        source_type=SOURCE_TYPE_MAP.get(ext, SourceType.TXT),
        file_path=file_path,
        file_size=file_size,
        file_hash=file_hash,
        mime_type=file.content_type,
        status=DocumentStatus.PENDING,
        progress=0,
        processing_stage="queued",
    )
    db.add(doc)
    await db.flush()

    # Enqueue background task
    background_tasks.add_task(process_document_task, doc.id, file_path)

    return DocumentResponse.from_document(doc)


@router.get("", response_model=List[DocumentResponse])
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """List all documents for the current user's organization."""
    query = select(Document)
    if current_user:
        if current_user.role != "admin":
            if current_user.organization_id:
                query = query.where(Document.organization_id == current_user.organization_id)
            else:
                query = query.where(Document.owner_id == current_user.id)
            
    query = query.order_by(Document.created_at.desc())
    result = await db.execute(query)
    documents = result.scalars().all()
    
    return [DocumentResponse.from_document(d) for d in documents]


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document_status(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Get the status and details of a single document."""
    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid document ID format")

    doc = await db.get(Document, doc_uuid)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if current_user and current_user.role != "admin" and doc.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this document")

    return DocumentResponse.from_document(doc)


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Delete a document and its associated data."""
    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid document ID format")

    query = select(Document).where(Document.id == doc_uuid)
    if current_user and current_user.role != "admin":
        query = query.where(Document.owner_id == current_user.id)
    result = await db.execute(query)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception as e:
            logger.warning("Failed to delete physical file %s: %s", doc.file_path, e)

    # Delete chunks from vector store if embedding exists
    try:
        from app.vectorstore.factory import get_vector_store
        store = get_vector_store()
        # Find chunks associated with document to delete from vector store
        chunks_query = select(Chunk).where(Chunk.document_id == doc.id)
        chunks_result = await db.execute(chunks_query)
        chunks = chunks_result.scalars().all()
        if chunks:
            chunk_ids = [str(c.id) for c in chunks]
            await store.delete(chunk_ids)
    except Exception as e:
        logger.warning("Failed to delete chunks from vector store for document %s: %s", doc.id, e)

    await db.delete(doc)
    return {"status": "deleted", "id": document_id}
