"""
Search API route: enterprise semantic, keyword, and hybrid search.
"""
import logging
import time
import re
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db
from app.auth.jwt import get_optional_user
from app.db.models import User, QueryLog
from app.retrieval.retriever import HybridRetriever

logger = logging.getLogger(__name__)
router = APIRouter()


class SearchRequest(BaseModel):
    query: str
    search_type: str = "hybrid"
    source_types: Optional[List[str]] = None
    top_k: int = 20
    min_confidence: float = 0.0


@router.post("")
async def search(
    request: SearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Enterprise search across all indexed documents using HybridRetriever."""
    start_time = time.time()
    try:
        retriever = HybridRetriever()

        results = await retriever.retrieve(
            query=request.query,
            sub_queries=None,
            top_k=request.top_k,
            filters={"source_type": request.source_types} if request.source_types else None,
        )

        # Apply keyword boost
        if results:
            results = await retriever.keyword_search(request.query, results)

        items = []
        query_terms = request.query.lower().split()
        for r in results:
            if r.score < request.min_confidence:
                continue
            
            # Robust highlighting - split by multiple delimiters
            sentences = re.split(r'[.!?]\s+', r.content)
            highlights = []
            for s in sentences:
                s = s.strip()
                if s and any(t in s.lower() for t in query_terms):
                    highlights.append(s)
                    if len(highlights) >= 3:
                        break
            
            # Fallback: if no sentence matches, use first 200 chars with matched terms bolded
            if not highlights:
                content_lower = r.content.lower()
                for term in query_terms:
                    if term in content_lower:
                        idx = content_lower.index(term)
                        start = max(0, idx - 50)
                        end = min(len(r.content), idx + 150)
                        highlights.append(r.content[start:end] + "...")
                        break

            items.append({
                "id": r.id, "content": r.content[:500], "score": r.score,
                "title": r.metadata.get("title", ""), "source_type": r.metadata.get("source_type", ""),
                "metadata": r.metadata, "highlights": highlights,
            })

        latency = int((time.time() - start_time) * 1000)

        # Log to QueryLog
        avg_conf = sum(r.score for r in results[:5]) / len(results[:5]) if results else 0.0
        query_log = QueryLog(
            user_id=current_user.id if current_user else None,
            query_text=request.query,
            query_type="search",
            intent="search",
            model_used="embedding-model",
            retrieval_strategy=request.search_type,
            results_count=len(items),
            latency_ms=latency,
            confidence_score=avg_conf,
            hallucination_score=0.0,
            token_input=0,
            token_output=0,
            cost_usd=0.0,
        )
        db.add(query_log)
        await db.flush()

        return items
    except Exception as e:
        logger.error("Search failed: %s", e)
        return []
