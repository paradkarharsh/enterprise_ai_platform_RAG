"""Reindex API route."""
import logging
import uuid
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.db.models import User, Document, DocumentStatus
from app.auth.jwt import get_current_user
from app.api.routes.upload import process_document_task

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("")
async def reindex_all(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trigger reindexing of all documents."""
    try:
        result = await db.execute(select(Document))
        docs = result.scalars().all()

        count = 0
        for doc in docs:
            doc.status = DocumentStatus.PENDING
            doc.progress = 0
            doc.processing_stage = "queued"
            background_tasks.add_task(process_document_task, doc.id, doc.file_path)
            count += 1

        await db.commit()
        return {"status": "reindex_queued", "message": f"Reindexing started in background for {count} documents"}
    except Exception as e:
        logger.error(f"Failed to queue bulk reindexing: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{document_id}")
async def reindex_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reindex a specific document."""
    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid document ID format")

    doc = await db.get(Document, doc_uuid)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if current_user.role != "admin" and doc.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to reindex this document")

    try:
        doc.status = DocumentStatus.PENDING
        doc.progress = 0
        doc.processing_stage = "queued"
        await db.commit()

        background_tasks.add_task(process_document_task, doc.id, doc.file_path)
        return {"status": "reindex_queued", "document_id": document_id}
    except Exception as e:
        logger.error(f"Failed to queue reindexing for document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
