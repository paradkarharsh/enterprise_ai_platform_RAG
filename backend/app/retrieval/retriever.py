"""
Hybrid Retriever: combines dense vector search with keyword matching.
"""
import logging
from typing import List, Optional, Dict, Any
from app.vectorstore.factory import BaseVectorStore, SearchResult, get_vector_store
from app.llm.embeddings import BaseEmbeddingProvider, get_embedding_provider

logger = logging.getLogger(__name__)


class HybridRetriever:
    """
    Retriever that combines dense (vector) search with optional sub-query expansion.
    Provides deduplication and configurable top-k.
    """

    def __init__(
        self,
        embedder: Optional[BaseEmbeddingProvider] = None,
        store: Optional[BaseVectorStore] = None,
    ):
        self._embedder = embedder
        self._store = store

    @property
    def embedder(self) -> BaseEmbeddingProvider:
        if self._embedder is None:
            self._embedder = get_embedding_provider()
        return self._embedder

    @property
    def store(self) -> BaseVectorStore:
        if self._store is None:
            self._store = get_vector_store()
        return self._store

    async def retrieve(
        self,
        query: str,
        sub_queries: Optional[List[str]] = None,
        top_k: int = 20,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[SearchResult]:
        """
        Perform hybrid retrieval:
        1. Embed the main query and search the vector store.
        2. Optionally expand with sub-queries for broader recall.
        3. Deduplicate results by chunk ID.
        """
        all_results: List[SearchResult] = []

        # Primary dense retrieval
        try:
            query_embedding = await self.embedder.embed_query(query)
            primary_results = await self.store.search(
                query_embedding, top_k=top_k, filters=filters
            )
            all_results.extend(primary_results)
            logger.debug("Primary retrieval returned %d results", len(primary_results))
        except Exception as e:
            logger.error("Primary retrieval failed: %s", e)

        # Sub-query expansion
        if sub_queries:
            for sq in sub_queries[:3]:  # Limit sub-queries
                try:
                    sq_embedding = await self.embedder.embed_query(sq)
                    sq_results = await self.store.search(
                        sq_embedding, top_k=min(5, top_k // 2)
                    )
                    all_results.extend(sq_results)
                    logger.debug("Sub-query '%s' returned %d results", sq[:50], len(sq_results))
                except Exception as e:
                    logger.warning("Sub-query retrieval failed for '%s': %s", sq[:50], e)

        # Deduplicate by chunk ID, keeping the highest score
        seen: Dict[str, SearchResult] = {}
        for r in all_results:
            if r.id not in seen or r.score > seen[r.id].score:
                seen[r.id] = r

        unique_results = sorted(seen.values(), key=lambda x: x.score, reverse=True)

        # Fallback to SQLite DB keyword search if no results found in vector store
        if not unique_results:
            logger.info("Vector store returned no results. Performing SQLite DB keyword search fallback.")
            try:
                from app.db.postgres import async_session
                from app.db.models import Chunk
                from sqlalchemy import select, or_

                # Split query into terms
                terms = [t.strip() for t in query.lower().split() if len(t.strip()) > 2]
                if not terms:
                    terms = [query.lower().strip()]

                async with async_session() as session:
                    # Construct query to search chunk content
                    stmt = select(Chunk)
                    if terms:
                        conditions = [Chunk.content.like(f"%{term}%") for term in terms if term]
                        if conditions:
                            stmt = stmt.where(or_(*conditions))

                    # Handle document_id filter if present in filters
                    if filters and "document_id" in filters:
                        doc_id = filters["document_id"]
                        stmt = stmt.where(Chunk.document_id == doc_id)

                    stmt = stmt.limit(top_k)
                    res = await session.execute(stmt)
                    db_chunks = res.scalars().all()

                    for chunk in db_chunks:
                        # Score calculation based on token overlap
                        content_lower = chunk.content.lower()
                        overlap = sum(1 for term in terms if term in content_lower)
                        score = overlap / max(len(terms), 1)
                        unique_results.append(SearchResult(
                            id=str(chunk.id),
                            content=chunk.content,
                            score=0.5 + 0.5 * score,  # Map to 0.5 - 1.0
                            metadata=chunk.meta or {},
                        ))

                    unique_results.sort(key=lambda x: x.score, reverse=True)
            except Exception as fallback_err:
                logger.error("SQLite DB keyword search fallback failed: %s", fallback_err)

        return unique_results[:top_k]

    async def keyword_search(
        self,
        query: str,
        chunks: List[SearchResult],
    ) -> List[SearchResult]:
        """
        Basic keyword boost: re-score results based on term overlap.
        This supplements dense search with BM25-style relevance.
        """
        query_terms = set(query.lower().split())
        scored = []
        for chunk in chunks:
            content_terms = set(chunk.content.lower().split())
            overlap = len(query_terms & content_terms)
            keyword_score = overlap / max(len(query_terms), 1)
            # Blend: 70% dense score + 30% keyword score
            blended_score = 0.7 * chunk.score + 0.3 * keyword_score
            scored.append(SearchResult(
                id=chunk.id,
                content=chunk.content,
                score=blended_score,
                metadata=chunk.metadata,
            ))
        scored.sort(key=lambda x: x.score, reverse=True)
        return scored
