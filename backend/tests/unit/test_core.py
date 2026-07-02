"""
Unit tests for the Enterprise AI Knowledge Platform backend.
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.config import Settings, get_settings
from app.auth.jwt import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.auth.rbac import PermissionChecker
from app.ingestion.pipeline import chunk_text, compute_file_hash
from app.llm.factory import get_llm_provider, list_available_providers, LLMMessage
from app.vectorstore.factory import get_vector_store


class TestConfig:
    """Test configuration settings."""

    def test_default_settings(self):
        settings = Settings()
        assert settings.APP_NAME == "Enterprise AI Knowledge Platform"
        assert settings.APP_VERSION == "1.0.0"
        assert settings.API_PREFIX == "/api/v1"

    def test_database_url(self):
        settings = Settings()
        assert "postgresql" in settings.DATABASE_URL
        assert settings.POSTGRES_DB in settings.DATABASE_URL

    def test_redis_url(self):
        settings = Settings()
        assert "redis://" in settings.REDIS_URL

    def test_cached_settings(self):
        s1 = get_settings()
        s2 = get_settings()
        assert s1 is s2


class TestAuth:
    """Test authentication utilities."""

    def test_hash_password(self):
        hashed = hash_password("mypassword123")
        assert hashed != "mypassword123"
        assert hashed.startswith("$2b$")

    def test_verify_password_correct(self):
        hashed = hash_password("mypassword123")
        assert verify_password("mypassword123", hashed) is True

    def test_verify_password_incorrect(self):
        hashed = hash_password("mypassword123")
        assert verify_password("wrongpassword", hashed) is False

    def test_create_access_token(self):
        token = create_access_token("user-123", "viewer")
        assert isinstance(token, str)
        assert len(token) > 50

    def test_create_refresh_token(self):
        token = create_refresh_token("user-123", "viewer")
        assert isinstance(token, str)

    def test_decode_valid_token(self):
        token = create_access_token("user-123", "admin")
        payload = decode_token(token)
        assert payload["sub"] == "user-123"
        assert payload["role"] == "admin"
        assert payload["type"] == "access"

    def test_decode_invalid_token(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            decode_token("invalid-token")
        assert exc_info.value.status_code == 401


class TestRBAC:
    """Test role-based access control."""

    def test_admin_has_all_permissions(self):
        user = MagicMock()
        user.role = "admin"
        from app.db.models import UserRole
        user.role = UserRole.ADMIN
        assert PermissionChecker.has_permission(user, "documents", "create") is True
        assert PermissionChecker.has_permission(user, "documents", "delete") is True
        assert PermissionChecker.has_permission(user, "users", "create") is True

    def test_viewer_limited_permissions(self):
        user = MagicMock()
        from app.db.models import UserRole
        user.role = UserRole.VIEWER
        assert PermissionChecker.has_permission(user, "documents", "read") is True
        assert PermissionChecker.has_permission(user, "documents", "create") is False
        assert PermissionChecker.has_permission(user, "users", "create") is False


class TestChunking:
    """Test document chunking."""

    def test_basic_chunking(self):
        text = "Hello world. " * 200
        chunks = chunk_text(text, chunk_size=100, chunk_overlap=20)
        assert len(chunks) > 1
        for chunk in chunks:
            assert len(chunk.content) > 0
            assert chunk.chunk_index >= 0

    def test_empty_text(self):
        chunks = chunk_text("")
        assert len(chunks) == 0

    def test_chunk_metadata(self):
        text = "Test content for chunking. " * 50
        chunks = chunk_text(text, chunk_size=100, metadata={"doc_id": "test-123"})
        assert len(chunks) > 0
        assert chunks[0].metadata["doc_id"] == "test-123"

    def test_chunk_ids_unique(self):
        text = "Test content. " * 100
        chunks = chunk_text(text, chunk_size=50)
        ids = [c.id for c in chunks]
        assert len(ids) == len(set(ids))


class TestLLMFactory:
    """Test LLM provider factory."""

    def test_list_providers(self):
        providers = list_available_providers()
        assert len(providers) == 5
        names = [p["name"] for p in providers]
        assert "gemini" in names
        assert "openai" in names
        assert "claude" in names
        assert "ollama" in names
        assert "mock" in names

    def test_provider_not_found_raises(self):
        with patch("app.llm.factory.GeminiProvider.is_available", return_value=False), \
             patch("app.llm.factory.OpenAIProvider.is_available", return_value=False), \
             patch("app.llm.factory.ClaudeProvider.is_available", return_value=False), \
             patch("app.llm.factory.OllamaProvider.is_available", return_value=False), \
             patch("app.llm.factory.MockProvider.is_available", return_value=False):
            with pytest.raises(RuntimeError):
                get_llm_provider("nonexistent")



class TestVectorStore:
    """Test vector store factory."""

    def test_faiss_store_creation(self):
        store = get_vector_store("faiss", dimension=128)
        assert store is not None

    @pytest.mark.asyncio
    async def test_faiss_add_and_search(self):
        import numpy as np
        store = get_vector_store("faiss", dimension=4)
        ids = ["1", "2", "3"]
        texts = ["hello world", "test document", "another text"]
        embeddings = np.random.rand(3, 4).tolist()
        await store.add(ids, texts, embeddings)
        assert await store.count() == 3

        results = await store.search(embeddings[0], top_k=2)
        assert len(results) <= 2

    def test_invalid_store_raises(self):
        with pytest.raises(ValueError):
            get_vector_store("nonexistent_db")
