"""
Reranker: cross-encoder and fallback TF-IDF scoring for chunk reranking.
"""
import logging
import math
from typing import List, Dict, Optional
from collections import Counter

logger = logging.getLogger(__name__)


class Reranker:
    """
    Reranks retrieved chunks for relevance using:
    1. Cross-encoder model (sentence-transformers) if available
    2. Fallback: TF-IDF cosine similarity scoring
    """

    def __init__(self, cross_encoder_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        self._model_name = cross_encoder_model
        self._model = None
        self._model_available: Optional[bool] = None

    def _load_cross_encoder(self):
        """Attempt to load the cross-encoder model."""
        if self._model_available is not None:
            return self._model_available

        try:
            from app.llm.embeddings import is_model_cached
            if not is_model_cached(self._model_name):
                logger.warning("Cross-encoder model %s is not cached locally. Using TF-IDF fallback.", self._model_name)
                self._model_available = False
                return False

            from sentence_transformers import CrossEncoder
            self._model = CrossEncoder(self._model_name)
            self._model_available = True
            logger.info("Cross-encoder model loaded: %s", self._model_name)
        except (ImportError, Exception) as e:
            logger.warning("Cross-encoder unavailable (%s), using TF-IDF fallback", e)
            self._model_available = False

        return self._model_available

    def rerank(
        self,
        query: str,
        chunks: List[Dict],
        top_k: int = 10,
    ) -> List[Dict]:
        """
        Rerank chunks by relevance to query.
        Returns top_k chunks sorted by rerank_score (descending).
        """
        if not chunks:
            return []

        if self._load_cross_encoder() and self._model is not None:
            return self._rerank_cross_encoder(query, chunks, top_k)
        else:
            return self._rerank_tfidf(query, chunks, top_k)

    def _rerank_cross_encoder(
        self,
        query: str,
        chunks: List[Dict],
        top_k: int,
    ) -> List[Dict]:
        """Rerank using cross-encoder similarity scores."""
        try:
            pairs = [(query, c.get("content", "")) for c in chunks]
            scores = self._model.predict(pairs)

            for i, score in enumerate(scores):
                chunks[i]["rerank_score"] = float(score)

            chunks.sort(key=lambda x: x.get("rerank_score", 0), reverse=True)
            return chunks[:top_k]
        except Exception as e:
            logger.error("Cross-encoder reranking failed: %s, falling back to TF-IDF", e)
            return self._rerank_tfidf(query, chunks, top_k)

    def _rerank_tfidf(
        self,
        query: str,
        chunks: List[Dict],
        top_k: int,
    ) -> List[Dict]:
        """Rerank using TF-IDF cosine similarity as a lightweight fallback."""
        query_terms = query.lower().split()
        query_tf = Counter(query_terms)

        # IDF across all chunks
        num_docs = len(chunks)
        doc_freq: Dict[str, int] = Counter()
        chunk_tfs = []

        for chunk in chunks:
            terms = chunk.get("content", "").lower().split()
            tf = Counter(terms)
            chunk_tfs.append(tf)
            for term in set(terms):
                doc_freq[term] += 1

        for i, chunk in enumerate(chunks):
            # Compute TF-IDF cosine similarity
            score = 0.0
            query_norm = 0.0
            doc_norm = 0.0

            all_terms = set(query_tf.keys()) | set(chunk_tfs[i].keys())
            for term in all_terms:
                idf = math.log((num_docs + 1) / (doc_freq.get(term, 0) + 1)) + 1
                q_tfidf = query_tf.get(term, 0) * idf
                d_tfidf = chunk_tfs[i].get(term, 0) * idf
                score += q_tfidf * d_tfidf
                query_norm += q_tfidf ** 2
                doc_norm += d_tfidf ** 2

            if query_norm > 0 and doc_norm > 0:
                cosine = score / (math.sqrt(query_norm) * math.sqrt(doc_norm))
            else:
                cosine = 0.0

            # Blend: 60% original vector score + 40% TF-IDF
            original_score = chunk.get("score", 0)
            chunk["rerank_score"] = 0.6 * original_score + 0.4 * cosine

        chunks.sort(key=lambda x: x.get("rerank_score", 0), reverse=True)
        return chunks[:top_k]
