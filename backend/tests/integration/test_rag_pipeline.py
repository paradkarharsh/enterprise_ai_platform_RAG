"""
Integration tests for the upgraded RAG Ingestion Pipeline.
"""
import os
import tempfile
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from sqlalchemy import select

from app.db.models import Document, Chunk, DocumentStatus, SourceType
from app.db.postgres import async_session, init_db
from app.ingestion.pipeline import parse_document
from app.api.routes.upload import SOURCE_TYPE_MAP, process_document_task

import pytest_asyncio

@pytest_asyncio.fixture(autouse=True, scope="function")
async def setup_database():
    """Ensure database schema is created before running tests."""
    await init_db()

@pytest.mark.asyncio
async def test_markdown_extension_mappings():
    """Verify that md and markdown extensions map to SourceType.MARKDOWN."""
    assert SOURCE_TYPE_MAP.get(".md") == SourceType.MARKDOWN
    assert SOURCE_TYPE_MAP.get(".markdown") == SourceType.MARKDOWN


@pytest.mark.asyncio
async def test_markdown_parser():
    """Verify that markdown parsing reads content and extracts proper metadata."""
    content = "# Manthan AI\n\nEnterprise Knowledge Intelligence Platform."
    
    with tempfile.NamedTemporaryFile(suffix=".md", mode="w", delete=False, encoding="utf-8") as f:
        f.write(content)
        temp_path = f.name

    try:
        parsed = await parse_document(temp_path)
        assert parsed.title == os.path.basename(temp_path)
        assert parsed.content == content
        assert parsed.page_count == 1
        assert parsed.metadata["source_type"] == "markdown"
    finally:
        os.remove(temp_path)


@pytest.mark.asyncio
async def test_background_ingestion_task():
    """Verify that process_document_task correctly updates DB status, stage, and progress."""
    # Create temporary markdown file
    content = "# RAG Pipeline Test\nThis is a sample document for testing async progress updates."
    with tempfile.NamedTemporaryFile(suffix=".md", mode="w", delete=False, encoding="utf-8") as f:
        f.write(content)
        temp_path = f.name

    async with async_session() as session:
        # Create a document in pending state
        doc = Document(
            title="test_ingest.md",
            source_type=SourceType.MARKDOWN,
            file_path=temp_path,
            status=DocumentStatus.PENDING,
            progress=0,
            processing_stage="queued"
        )
        session.add(doc)
        await session.commit()
        doc_id = doc.id

    try:
        # Mock VectorStore, Embeddings, and GraphEngine to run without external dependencies
        mock_embedder = MagicMock()
        mock_embedder.embed_texts = AsyncMock(return_value=[[0.1, 0.2, 0.3]] * 10)
        
        mock_store = MagicMock()
        mock_store.add = AsyncMock()

        mock_kg = MagicMock()
        mock_kg.add_entity = AsyncMock()
        mock_kg.add_relationship = AsyncMock()

        with patch("app.llm.embeddings.get_embedding_provider", return_value=mock_embedder), \
             patch("app.vectorstore.factory.get_vector_store", return_value=mock_store), \
             patch("app.knowledge_graph.extractor.extract_entities_and_relationships", return_value=([], [])), \
             patch("app.knowledge_graph.engine.get_kg_engine", return_value=mock_kg):
             
            # Execute background task
            await process_document_task(doc_id, temp_path)

        # Check DB states
        async with async_session() as session:
            result = await session.execute(select(Document).where(Document.id == doc_id))
            updated_doc = result.scalar_one()
            
            # Assert successful processing
            assert updated_doc.status == DocumentStatus.INDEXED
            assert updated_doc.progress == 100
            assert updated_doc.processing_stage == "completed"
            assert updated_doc.chunk_count > 0

            # Verify chunk objects were saved in DB
            chunks_result = await session.execute(select(Chunk).where(Chunk.document_id == doc_id))
            chunks = chunks_result.scalars().all()
            assert len(chunks) == updated_doc.chunk_count

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
