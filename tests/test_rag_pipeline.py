"""Comprehensive tests for engine.rag.pipeline module.

Covers RAGPipeline.query and RAGPipeline.ingest with mocked
external dependencies (MemoryStore, LLM provider).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest

from engine.memory.types import MemoryEntry, MemoryType
from engine.rag.chunking import Chunker, ChunkingStrategy
from engine.rag.pipeline import RAGPipeline, RAGQuery, RAGResponse

# ---------------------------------------------------------------------------
# Fakes and helpers
# ---------------------------------------------------------------------------


class FakeMemoryStore:
    """Minimal fake MemoryStore with configurable search results."""

    def __init__(self, results: list[MemoryEntry] | None = None) -> None:
        self._results = results or []
        self.stored: list[MemoryEntry] = []

    async def search(self, query: str, limit: int = 10) -> list[MemoryEntry]:
        return self._results[:limit]

    async def store(self, entry: MemoryEntry) -> None:
        self.stored.append(entry)


class FakeProvider:
    """Fake LLM provider that returns canned responses."""

    def __init__(self, response: str = "Generated answer") -> None:
        self._response = response
        self.calls: list[dict] = []

    async def complete(self, messages: list[dict]) -> dict:
        self.calls.append({"messages": messages})
        return {"content": self._response}


class FakeCollectionManager:
    """Fake CollectionManager that tracks add_document calls."""

    @dataclass
    class FakeDoc:
        id: str = "fake_doc_id"
        filename: str = ""
        collection_id: str = ""

    def __init__(self) -> None:
        self.added_documents: list[dict] = []

    async def add_document(
        self,
        collection_id: str,
        filename: str,
        mime_type: str,
        content: str,
        chunk_count: int = 0,
        metadata: dict | None = None,
    ) -> Any:
        self.added_documents.append(
            {
                "collection_id": collection_id,
                "filename": filename,
                "mime_type": mime_type,
                "content": content,
                "chunk_count": chunk_count,
                "metadata": metadata,
            }
        )
        return self.FakeDoc(filename=filename, collection_id=collection_id)


def _make_entry(content: str, metadata: dict | None = None) -> MemoryEntry:
    """Helper to create a MemoryEntry with optional metadata."""
    entry = MemoryEntry(
        type=MemoryType.CONTEXT,
        content=content,
        source="test",
    )
    if metadata:
        entry.metadata = metadata
    return entry


# ---------------------------------------------------------------------------
# RAGQuery dataclass
# ---------------------------------------------------------------------------


class TestRAGQuery:
    """Tests for the RAGQuery dataclass."""

    def test_defaults(self):
        q = RAGQuery(query="test")
        assert q.collection_ids is None
        assert q.top_k == 10
        assert q.rerank is True
        assert q.rerank_top_k == 5
        assert q.include_citations is True

    def test_custom_values(self):
        q = RAGQuery(
            query="search",
            collection_ids=["c1", "c2"],
            top_k=20,
            rerank=False,
            rerank_top_k=3,
            include_citations=False,
        )
        assert q.collection_ids == ["c1", "c2"]
        assert q.top_k == 20
        assert q.rerank is False


# ---------------------------------------------------------------------------
# RAGResponse dataclass
# ---------------------------------------------------------------------------


class TestRAGResponse:
    """Tests for the RAGResponse dataclass."""

    def test_fields(self):
        resp = RAGResponse(
            answer="answer text",
            citations=[{"doc": "d1"}],
            retrieved_chunks=5,
            reranked_chunks=3,
            latency_ms=42.5,
        )
        assert resp.answer == "answer text"
        assert len(resp.citations) == 1
        assert resp.retrieved_chunks == 5
        assert resp.reranked_chunks == 3
        assert resp.latency_ms == 42.5


# ---------------------------------------------------------------------------
# RAGPipeline.query
# ---------------------------------------------------------------------------


class TestPipelineQuery:
    @pytest.mark.asyncio
    async def test_query_with_no_results_returns_no_context(self):
        memory = FakeMemoryStore(results=[])
        collections = FakeCollectionManager()
        pipeline = RAGPipeline(memory=memory, collections=collections)

        response = await pipeline.query(RAGQuery(query="nothing"))

        assert response.retrieved_chunks == 0
        assert response.reranked_chunks == 0
        assert response.citations == []
        assert "No relevant documents found" in response.answer

    @pytest.mark.asyncio
    async def test_query_without_provider_returns_context_as_answer(self):
        entry = _make_entry("Python is a great language", {"document_id": "d1"})
        memory = FakeMemoryStore(results=[entry])
        collections = FakeCollectionManager()
        pipeline = RAGPipeline(memory=memory, collections=collections)

        response = await pipeline.query(RAGQuery(query="Python"))

        assert "Python is a great language" in response.answer
        assert response.retrieved_chunks == 1

    @pytest.mark.asyncio
    async def test_query_with_provider_returns_generated_answer(self):
        entry = _make_entry("Context text here", {"document_id": "d1"})
        memory = FakeMemoryStore(results=[entry])
        collections = FakeCollectionManager()
        provider = FakeProvider(response="The generated answer.")

        pipeline = RAGPipeline(
            memory=memory,
            collections=collections,
            provider=provider,
        )

        response = await pipeline.query(RAGQuery(query="test"))

        assert response.answer == "The generated answer."
        assert len(provider.calls) == 1

    @pytest.mark.asyncio
    async def test_query_reranks_results(self):
        entries = [
            _make_entry("Python programming tutorial", {"document_id": "d1"}),
            _make_entry("Java programming guide", {"document_id": "d2"}),
            _make_entry("Python web development", {"document_id": "d3"}),
        ]
        memory = FakeMemoryStore(results=entries)
        collections = FakeCollectionManager()

        pipeline = RAGPipeline(memory=memory, collections=collections)

        response = await pipeline.query(
            RAGQuery(query="Python", rerank=True, rerank_top_k=2),
        )

        assert response.retrieved_chunks == 3
        assert response.reranked_chunks == 2

    @pytest.mark.asyncio
    async def test_query_skip_rerank(self):
        entries = [
            _make_entry("Python tutorial", {"document_id": "d1"}),
        ]
        memory = FakeMemoryStore(results=entries)
        collections = FakeCollectionManager()

        pipeline = RAGPipeline(memory=memory, collections=collections)

        response = await pipeline.query(RAGQuery(query="Python", rerank=False))

        assert response.retrieved_chunks == 1
        assert response.reranked_chunks == 1  # Same as retrieved when no rerank

    @pytest.mark.asyncio
    async def test_query_with_citations(self):
        entries = [
            _make_entry(
                "Relevant content",
                {
                    "document_id": "doc1",
                    "filename": "source.txt",
                    "collection_id": "coll1",
                    "collection_name": "knowledge",
                    "chunk_index": 0,
                },
            ),
        ]
        memory = FakeMemoryStore(results=entries)
        collections = FakeCollectionManager()

        pipeline = RAGPipeline(memory=memory, collections=collections)

        response = await pipeline.query(RAGQuery(query="test", include_citations=True))

        assert len(response.citations) == 1
        assert response.citations[0]["document_id"] == "doc1"
        assert response.citations[0]["document_name"] == "source.txt"

    @pytest.mark.asyncio
    async def test_query_without_citations(self):
        entries = [_make_entry("content", {"document_id": "d1"})]
        memory = FakeMemoryStore(results=entries)
        collections = FakeCollectionManager()

        pipeline = RAGPipeline(memory=memory, collections=collections)

        response = await pipeline.query(RAGQuery(query="test", include_citations=False))

        assert response.citations == []

    @pytest.mark.asyncio
    async def test_query_latency_is_positive(self):
        memory = FakeMemoryStore(results=[])
        collections = FakeCollectionManager()
        pipeline = RAGPipeline(memory=memory, collections=collections)

        response = await pipeline.query(RAGQuery(query="test"))

        assert response.latency_ms >= 0

    @pytest.mark.asyncio
    async def test_query_provider_receives_context_and_query(self):
        entry = _make_entry("Facts about cats")
        memory = FakeMemoryStore(results=[entry])
        collections = FakeCollectionManager()
        provider = FakeProvider(response="answer")

        pipeline = RAGPipeline(memory=memory, collections=collections, provider=provider)

        await pipeline.query(RAGQuery(query="Tell me about cats"))

        messages = provider.calls[0]["messages"]
        prompt = messages[0]["content"]
        assert "Facts about cats" in prompt
        assert "Tell me about cats" in prompt

    @pytest.mark.asyncio
    async def test_query_citation_content_truncated_to_200(self):
        long_content = "x" * 500
        entry = _make_entry(
            long_content,
            {
                "document_id": "d1",
                "filename": "big.txt",
                "collection_id": "c1",
            },
        )
        memory = FakeMemoryStore(results=[entry])
        collections = FakeCollectionManager()
        pipeline = RAGPipeline(memory=memory, collections=collections)

        response = await pipeline.query(RAGQuery(query="test"))

        assert len(response.citations) == 1
        assert len(response.citations[0]["content"]) <= 200

    @pytest.mark.asyncio
    async def test_query_multiple_results_context_numbered(self):
        entries = [
            _make_entry("First result"),
            _make_entry("Second result"),
        ]
        memory = FakeMemoryStore(results=entries)
        collections = FakeCollectionManager()
        pipeline = RAGPipeline(memory=memory, collections=collections)

        response = await pipeline.query(RAGQuery(query="test"))

        assert "[1]" in response.answer
        assert "[2]" in response.answer


# ---------------------------------------------------------------------------
# RAGPipeline.ingest
# ---------------------------------------------------------------------------


class TestPipelineIngest:
    @pytest.mark.asyncio
    async def test_ingest_creates_chunks_and_stores_them(self):
        memory = FakeMemoryStore()
        collections = FakeCollectionManager()
        pipeline = RAGPipeline(memory=memory, collections=collections)

        result = await pipeline.ingest(
            collection_id="coll1",
            content="A " * 600,
            filename="test.txt",
            chunk_size=200,
            overlap=50,
        )

        assert result["collection_id"] == "coll1"
        assert result["chunks_created"] > 0
        assert result["document_id"] == "fake_doc_id"
        assert len(memory.stored) == result["chunks_created"]

    @pytest.mark.asyncio
    async def test_ingest_registers_document_in_collections(self):
        memory = FakeMemoryStore()
        collections = FakeCollectionManager()
        pipeline = RAGPipeline(memory=memory, collections=collections)

        await pipeline.ingest(
            collection_id="c1",
            content="Hello world",
            filename="doc.txt",
            mime_type="text/plain",
            chunk_size=500,
        )

        assert len(collections.added_documents) == 1
        doc = collections.added_documents[0]
        assert doc["filename"] == "doc.txt"
        assert doc["collection_id"] == "c1"
        assert doc["mime_type"] == "text/plain"

    @pytest.mark.asyncio
    async def test_ingest_with_metadata(self):
        memory = FakeMemoryStore()
        collections = FakeCollectionManager()
        pipeline = RAGPipeline(memory=memory, collections=collections)

        meta = {"author": "alice", "department": "engineering"}
        await pipeline.ingest(
            collection_id="c1",
            content="Some content to ingest",
            filename="meta.txt",
            metadata=meta,
            chunk_size=500,
        )

        assert len(memory.stored) >= 1

    @pytest.mark.asyncio
    async def test_ingest_short_text_produces_single_chunk(self):
        memory = FakeMemoryStore()
        collections = FakeCollectionManager()
        pipeline = RAGPipeline(memory=memory, collections=collections)

        result = await pipeline.ingest(
            collection_id="c1",
            content="Short",
            filename="short.txt",
            chunk_size=500,
        )

        assert result["chunks_created"] == 1
        assert len(memory.stored) == 1

    @pytest.mark.asyncio
    async def test_ingest_empty_text_produces_chunks(self):
        """Empty text with RECURSIVE strategy returns a single empty chunk."""
        memory = FakeMemoryStore()
        collections = FakeCollectionManager()
        pipeline = RAGPipeline(memory=memory, collections=collections)

        result = await pipeline.ingest(
            collection_id="c1",
            content="",
            filename="empty.txt",
            chunk_size=500,
        )

        # RECURSIVE returns [(0, "")] for empty text
        assert result["chunks_created"] >= 1

    @pytest.mark.asyncio
    async def test_ingest_uses_custom_chunker(self):
        memory = FakeMemoryStore()
        collections = FakeCollectionManager()
        chunker = Chunker(ChunkingStrategy.FIXED)
        pipeline = RAGPipeline(
            memory=memory,
            collections=collections,
            chunker=chunker,
        )

        text = "a" * 1000
        result = await pipeline.ingest(
            collection_id="c1",
            content=text,
            filename="fixed.txt",
            chunk_size=200,
            overlap=0,
        )

        assert result["chunks_created"] == 5

    @pytest.mark.asyncio
    async def test_ingest_stores_memory_entries_with_context_type(self):
        memory = FakeMemoryStore()
        collections = FakeCollectionManager()
        pipeline = RAGPipeline(memory=memory, collections=collections)

        await pipeline.ingest(
            collection_id="c1",
            content="Some text to chunk",
            filename="test.txt",
            chunk_size=10,
        )

        for entry in memory.stored:
            assert entry.type == MemoryType.CONTEXT
