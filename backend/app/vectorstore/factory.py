"""
Vector Store Factory - Unified interface for ChromaDB, FAISS, Pinecone, Weaviate.
"""
import logging
from typing import Optional, List, Dict, Any
from abc import ABC, abstractmethod
from pydantic import BaseModel
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class SearchResult(BaseModel):
    """Standardized search result from any vector store."""
    id: str
    content: str
    score: float
    metadata: Dict[str, Any] = {}


class BaseVectorStore(ABC):
    """Abstract vector store interface."""

    @abstractmethod
    async def add(self, ids: List[str], texts: List[str], embeddings: List[List[float]], metadatas: Optional[List[dict]] = None):
        pass

    @abstractmethod
    async def search(self, query_embedding: List[float], top_k: int = 10, filters: Optional[dict] = None) -> List[SearchResult]:
        pass

    @abstractmethod
    async def delete(self, ids: List[str]):
        pass

    @abstractmethod
    async def count(self) -> int:
        pass


class ChromaStore(BaseVectorStore):
    """ChromaDB vector store."""

    def __init__(self, collection_name: str = None):
        self.collection_name = collection_name or settings.CHROMA_COLLECTION
        self._client = None
        self._collection = None

    def _get_collection(self):
        if self._collection is None:
            import chromadb
            # Use PersistentClient for local embedded execution instead of HttpClient
            self._client = chromadb.PersistentClient(path="./data/chroma")
            self._collection = self._client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"}
            )
        return self._collection

    async def add(self, ids, texts, embeddings, metadatas=None):
        collection = self._get_collection()
        collection.add(ids=ids, documents=texts, embeddings=embeddings, metadatas=metadatas or [{}] * len(ids))

    async def search(self, query_embedding, top_k=10, filters=None) -> List[SearchResult]:
        collection = self._get_collection()
        where = filters if filters else None
        results = collection.query(query_embeddings=[query_embedding], n_results=top_k, where=where)

        search_results = []
        if results and results["ids"]:
            for i, id_ in enumerate(results["ids"][0]):
                search_results.append(SearchResult(
                    id=id_,
                    content=results["documents"][0][i] if results["documents"] else "",
                    score=1 - (results["distances"][0][i] if results["distances"] else 0),
                    metadata=results["metadatas"][0][i] if results["metadatas"] else {},
                ))
        return search_results

    async def delete(self, ids):
        collection = self._get_collection()
        collection.delete(ids=ids)

    async def count(self) -> int:
        collection = self._get_collection()
        return collection.count()


class FAISSStore(BaseVectorStore):
    """FAISS local vector store."""

    def __init__(self, dimension: int = None, index_path: str = None):
        self.dimension = dimension or settings.EMBEDDING_DIMENSION
        self.index_path = index_path or settings.FAISS_INDEX_PATH
        self._index = None
        self._id_map: Dict[int, str] = {}
        self._text_map: Dict[str, str] = {}
        self._meta_map: Dict[str, dict] = {}
        self._counter = 0

    def _get_index(self):
        if self._index is None:
            import faiss
            self._index = faiss.IndexFlatIP(self.dimension)  # Inner product (cosine after normalization)
        return self._index

    async def add(self, ids, texts, embeddings, metadatas=None):
        import numpy as np
        index = self._get_index()

        vectors = np.array(embeddings, dtype=np.float32)
        # Normalize for cosine similarity
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        vectors = vectors / (norms + 1e-10)

        start_id = self._counter
        index.add(vectors)

        for i, id_ in enumerate(ids):
            self._id_map[start_id + i] = id_
            self._text_map[id_] = texts[i]
            if metadatas:
                self._meta_map[id_] = metadatas[i]
        self._counter += len(ids)

    async def search(self, query_embedding, top_k=10, filters=None) -> List[SearchResult]:
        import numpy as np
        index = self._get_index()

        query = np.array([query_embedding], dtype=np.float32)
        norms = np.linalg.norm(query, axis=1, keepdims=True)
        query = query / (norms + 1e-10)

        scores, indices = index.search(query, min(top_k, index.ntotal))

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx == -1:
                continue
            id_ = self._id_map.get(int(idx), str(idx))
            results.append(SearchResult(
                id=id_,
                content=self._text_map.get(id_, ""),
                score=float(score),
                metadata=self._meta_map.get(id_, {}),
            ))
        return results

    async def delete(self, ids):
        logger.warning("FAISS delete is a no-op; rebuild index to remove documents")

    async def count(self) -> int:
        index = self._get_index()
        return index.ntotal


class PineconeStore(BaseVectorStore):
    """Pinecone cloud vector store."""

    def __init__(self):
        self.api_key = settings.PINECONE_API_KEY
        self.index_name = settings.PINECONE_INDEX
        self._index = None

    def _get_index(self):
        if self._index is None:
            from pinecone import Pinecone
            pc = Pinecone(api_key=self.api_key)
            self._index = pc.Index(self.index_name)
        return self._index

    async def add(self, ids, texts, embeddings, metadatas=None):
        index = self._get_index()
        vectors = []
        for i, id_ in enumerate(ids):
            meta = metadatas[i] if metadatas else {}
            meta["text"] = texts[i][:1000]  # Pinecone metadata size limit
            vectors.append({"id": id_, "values": embeddings[i], "metadata": meta})

        # Batch upsert
        batch_size = 100
        for j in range(0, len(vectors), batch_size):
            index.upsert(vectors=vectors[j:j + batch_size])

    async def search(self, query_embedding, top_k=10, filters=None) -> List[SearchResult]:
        index = self._get_index()
        filter_dict = filters if filters else None
        results = index.query(vector=query_embedding, top_k=top_k, include_metadata=True, filter=filter_dict)

        return [
            SearchResult(
                id=match["id"],
                content=match.get("metadata", {}).get("text", ""),
                score=match["score"],
                metadata={k: v for k, v in match.get("metadata", {}).items() if k != "text"},
            )
            for match in results.get("matches", [])
        ]

    async def delete(self, ids):
        index = self._get_index()
        index.delete(ids=ids)

    async def count(self) -> int:
        index = self._get_index()
        stats = index.describe_index_stats()
        return stats.get("total_vector_count", 0)


class WeaviateStore(BaseVectorStore):
    """Weaviate vector store."""

    def __init__(self, class_name: str = "Document"):
        self.url = settings.WEAVIATE_URL
        self.api_key = settings.WEAVIATE_API_KEY
        self.class_name = class_name
        self._client = None

    def _get_client(self):
        if self._client is None:
            import weaviate
            auth = weaviate.auth.AuthApiKey(api_key=self.api_key) if self.api_key else None
            self._client = weaviate.Client(url=self.url, auth_client_secret=auth)
        return self._client

    async def add(self, ids, texts, embeddings, metadatas=None):
        client = self._get_client()
        with client.batch as batch:
            for i, id_ in enumerate(ids):
                properties = {"content": texts[i], "doc_id": id_}
                if metadatas and metadatas[i]:
                    properties.update({k: str(v) for k, v in metadatas[i].items()})
                batch.add_data_object(
                    data_object=properties,
                    class_name=self.class_name,
                    vector=embeddings[i],
                    uuid=id_,
                )

    async def search(self, query_embedding, top_k=10, filters=None) -> List[SearchResult]:
        client = self._get_client()
        result = (
            client.query
            .get(self.class_name, ["content", "doc_id"])
            .with_near_vector({"vector": query_embedding})
            .with_limit(top_k)
            .with_additional(["certainty", "id"])
            .do()
        )

        results = []
        data = result.get("data", {}).get("Get", {}).get(self.class_name, [])
        for item in data:
            results.append(SearchResult(
                id=item.get("doc_id", item["_additional"]["id"]),
                content=item.get("content", ""),
                score=item["_additional"].get("certainty", 0),
                metadata={},
            ))
        return results

    async def delete(self, ids):
        client = self._get_client()
        for id_ in ids:
            client.data_object.delete(uuid=id_, class_name=self.class_name)

    async def count(self) -> int:
        client = self._get_client()
        result = client.query.aggregate(self.class_name).with_meta_count().do()
        return result.get("data", {}).get("Aggregate", {}).get(self.class_name, [{}])[0].get("meta", {}).get("count", 0)


# ─────────────────────────────────────────────
# Factory
# ─────────────────────────────────────────────

VECTOR_STORES = {
    "chroma": ChromaStore,
    "faiss": FAISSStore,
    "pinecone": PineconeStore,
    "weaviate": WeaviateStore,
}


def get_vector_store(store_type: Optional[str] = None, **kwargs) -> BaseVectorStore:
    """Get a vector store instance."""
    name = store_type or settings.DEFAULT_VECTOR_STORE
    if name not in VECTOR_STORES:
        raise ValueError(f"Unknown vector store: {name}. Available: {list(VECTOR_STORES.keys())}")
    return VECTOR_STORES[name](**kwargs)
