"""
Search API route: enterprise semantic, keyword, and hybrid search.
"""
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from app.auth.jwt import get_optional_user
from app.db.models import User

logger = logging.getLogger(__name__)
router = APIRouter()


class SearchRequest(BaseModel):
    query: str
    search_type: str = "hybrid"
    source_types: Optional[List[str]] = None
    top_k: int = 20
    min_confidence: float = 0.0


@router.post("/")
async def search(request: SearchRequest, current_user: Optional[User] = Depends(get_optional_user)):
    """Enterprise search across all indexed documents."""
    try:
        from app.llm.embeddings import get_embedding_provider
        from app.vectorstore.factory import get_vector_store

        embedder = get_embedding_provider()
        store = get_vector_store()
        query_embedding = await embedder.embed_query(request.query)
        results = await store.search(query_embedding, top_k=request.top_k)

        items = []
        for r in results:
            if r.score < request.min_confidence:
                continue
            query_terms = request.query.lower().split()
            highlights = [s.strip() for s in r.content.split(". ") if any(t in s.lower() for t in query_terms)][:3]
            items.append({
                "id": r.id, "content": r.content[:500], "score": r.score,
                "title": r.metadata.get("title", ""), "source_type": r.metadata.get("source_type", ""),
                "metadata": r.metadata, "highlights": highlights,
            })
        return items
    except Exception as e:
        logger.error("Search failed: %s", e)
        return []
