"""
Embedding providers: BGE Large, E5 Large, OpenAI Embeddings.
"""
import logging
from typing import List, Optional
from abc import ABC, abstractmethod
import numpy as np
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class BaseEmbeddingProvider(ABC):
    """Abstract base for embedding providers."""

    @abstractmethod
    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        pass

    @abstractmethod
    async def embed_query(self, query: str) -> List[float]:
        pass

    @abstractmethod
    def dimension(self) -> int:
        pass


class OpenAIEmbeddings(BaseEmbeddingProvider):
    """OpenAI embedding models."""

    def __init__(self, model: str = "text-embedding-3-small"):
        self.model = model
        self.api_key = settings.OPENAI_API_KEY
        self._dimension = 1536

    def dimension(self) -> int:
        return self._dimension

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=self.api_key)
        response = await client.embeddings.create(model=self.model, input=texts)
        return [item.embedding for item in response.data]

    async def embed_query(self, query: str) -> List[float]:
        result = await self.embed_texts([query])
        return result[0]


def is_model_cached(model_name: str) -> bool:
    """Check if the Hugging Face model is cached locally."""
    try:
        from huggingface_hub.constants import HF_HUB_CACHE
        import os
        repo_id = model_name.replace("/", "--")
        cache_dir = os.path.join(HF_HUB_CACHE, f"models--{repo_id}")
        if not os.path.isdir(cache_dir):
            return False
        snapshots_dir = os.path.join(cache_dir, "snapshots")
        if not os.path.isdir(snapshots_dir):
            return False
        for snapshot in os.listdir(snapshots_dir):
            snapshot_path = os.path.join(snapshots_dir, snapshot)
            if os.path.isdir(snapshot_path):
                if os.path.exists(os.path.join(snapshot_path, "model.safetensors")) or \
                   os.path.exists(os.path.join(snapshot_path, "pytorch_model.bin")):
                    return True
        return False
    except Exception:
        return False


class HuggingFaceEmbeddings(BaseEmbeddingProvider):
    """Local HuggingFace embedding models (BGE, E5)."""

    def __init__(self, model_name: str = "BAAI/bge-large-en-v1.5"):
        self.model_name = model_name
        self._model = None
        self._dimension = 1024  # BGE large default

    def _load_model(self):
        if self._model is None:
            if not is_model_cached(self.model_name):
                logger.warning("Model %s is not fully cached locally. Raising exception to avoid blocking uvicorn on download.", self.model_name)
                raise RuntimeError(f"Model {self.model_name} is not cached locally.")
            try:
                from sentence_transformers import SentenceTransformer
                self._model = SentenceTransformer(self.model_name)
                self._dimension = self._model.get_sentence_embedding_dimension()
                logger.info("Loaded embedding model: %s (dim=%d)", self.model_name, self._dimension)
            except Exception as e:
                logger.error("Failed to load embedding model: %s", e)
                raise

    def dimension(self) -> int:
        return self._dimension

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        self._load_model()
        embeddings = self._model.encode(texts, normalize_embeddings=True)
        return embeddings.tolist()

    async def embed_query(self, query: str) -> List[float]:
        self._load_model()
        # BGE models benefit from instruction prefix for queries
        if "bge" in self.model_name.lower():
            query = f"Represent this sentence for searching relevant passages: {query}"
        elif "e5" in self.model_name.lower():
            query = f"query: {query}"
        embedding = self._model.encode([query], normalize_embeddings=True)
        return embedding[0].tolist()


class MockEmbeddings(BaseEmbeddingProvider):
    """Mock embedding provider for offline testing and demos."""

    def __init__(self, dimension: int = 1024):
        self._dimension = dimension

    def dimension(self) -> int:
        return self._dimension

    def _embed_text_sync(self, text: str) -> List[float]:
        # Deterministic generation using hash
        import hashlib
        import numpy as np
        h = hashlib.sha256(text.encode("utf-8")).digest()
        seed = int.from_bytes(h[:4], byteorder="big")
        rng = np.random.default_rng(seed)
        vec = rng.normal(size=self._dimension)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        return [self._embed_text_sync(t) for t in texts]

    async def embed_query(self, query: str) -> List[float]:
        return self._embed_text_sync(query)


# ─────────────────────────────────────────────
# Factory
# ─────────────────────────────────────────────

EMBEDDING_PROVIDERS = {
    "openai": lambda: OpenAIEmbeddings(),
    "bge-large": lambda: HuggingFaceEmbeddings("BAAI/bge-large-en-v1.5"),
    "e5-large": lambda: HuggingFaceEmbeddings("intfloat/e5-large-v2"),
    "mock": lambda: MockEmbeddings(settings.EMBEDDING_DIMENSION),
}


def get_embedding_provider(provider: Optional[str] = None) -> BaseEmbeddingProvider:
    """Get an embedding provider instance."""
    name = provider or settings.DEFAULT_EMBEDDING_PROVIDER
    if name in EMBEDDING_PROVIDERS:
        try:
            if name in ["bge-large", "e5-large"]:
                model_name = "BAAI/bge-large-en-v1.5" if name == "bge-large" else "intfloat/e5-large-v2"
                if not is_model_cached(model_name):
                    logger.warning("Hugging Face model %s is not cached locally. Falling back to MockEmbeddings.", model_name)
                    return MockEmbeddings(settings.EMBEDDING_DIMENSION)
            return EMBEDDING_PROVIDERS[name]()
        except Exception as e:
            logger.warning("Failed to initialize embedding provider '%s': %s. Falling back to mock.", name, e)
            return MockEmbeddings(settings.EMBEDDING_DIMENSION)
    # Default fallback to mock (no API key or downloads required)
    logger.warning("Embedding provider '%s' not found, falling back to mock", name)
    return MockEmbeddings(settings.EMBEDDING_DIMENSION)
