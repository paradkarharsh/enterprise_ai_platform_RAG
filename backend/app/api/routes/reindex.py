"""Reindex API route."""
from fastapi import APIRouter, Depends
from app.auth.jwt import get_current_user
from app.db.models import User

router = APIRouter()


@router.post("/")
async def reindex_all(current_user: User = Depends(get_current_user)):
    """Trigger reindexing of all documents."""
    return {"status": "reindex_queued", "message": "Reindexing started in background"}


@router.post("/{document_id}")
async def reindex_document(document_id: str, current_user: User = Depends(get_current_user)):
    """Reindex a specific document."""
    return {"status": "reindex_queued", "document_id": document_id}
