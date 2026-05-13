from __future__ import annotations

import pytest
import aiosqlite

from engine.rag.collections import CollectionManager
from engine.rag.chunking import Chunker, ChunkingStrategy, Chunk
from engine.rag.reranker import SimpleReranker
from engine.rag.citations import CitationTracker, CitedResponse, Citation
from engine.rag.pipeline import RAGPipeline, RAGQuery


@pytest.fixture
async def db(tmp_path):
    conn = await aiosqlite.connect(str(tmp_path / "test.db"))
    yield conn
    await conn.close()


@pytest.fixture
async def collections(db):
    mgr = CollectionManager(db)
    await mgr.initialize()
    return mgr


@pytest.mark.asyncio
async def test_create_collection(collections: CollectionManager):
    coll = await collections.create_collection("test_docs", description="Test collection")
    assert coll.name == "test_docs"
    assert coll.id


@pytest.mark.asyncio
async def test_list_collections(collections: CollectionManager):
    await collections.create_collection("coll1")
    await collections.create_collection("coll2")
    colls = await collections.list_collections()
    assert len(colls) == 2


@pytest.mark.asyncio
async def test_delete_collection(collections: CollectionManager):
    coll = await collections.create_collection("to_delete")
    deleted = await collections.delete_collection(coll.id)
    assert deleted is True
    assert await collections.get_collection(coll.id) is None


@pytest.mark.asyncio
async def test_add_and_list_documents(collections: CollectionManager):
    coll = await collections.create_collection("docs")
    doc = await collections.add_document(coll.id, "test.txt", "text/plain", "hello world", chunk_count=2)
    assert doc.filename == "test.txt"
    docs = await collections.list_documents(coll.id)
    assert len(docs) == 1


@pytest.mark.asyncio
async def test_delete_document(collections: CollectionManager):
    coll = await collections.create_collection("docs")
    doc = await collections.add_document(coll.id, "test.txt", "text/plain", "content")
    deleted = await collections.delete_document(doc.id)
    assert deleted is True
    docs = await collections.list_documents(coll.id)
    assert len(docs) == 0


def test_fixed_chunking():
    chunker = Chunker(ChunkingStrategy.FIXED)
    text = "a" * 1000
    chunks = chunker.chunk(text, chunk_size=200, overlap=20)
    assert len(chunks) > 1
    assert chunks[0].content == "a" * 200
    assert chunks[0].start_char == 0


def test_recursive_chunking():
    chunker = Chunker(ChunkingStrategy.RECURSIVE)
    text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
    chunks = chunker.chunk(text, chunk_size=50, overlap=5)
    assert len(chunks) >= 1
    for chunk in chunks:
        assert len(chunk.content) <= 100


def test_chunk_metadata():
    chunker = Chunker()
    chunks = chunker.chunk("hello world", metadata={"source": "test"}, chunk_size=10)
    assert chunks[0].metadata["source"] == "test"


@pytest.mark.asyncio
async def test_simple_reranker():
    reranker = SimpleReranker()
    docs = ["Python is a language", "The cat sat down", "Python programming tutorial"]
    results = await reranker.rerank("Python programming", docs, top_k=2)
    assert len(results) == 2
    assert results[0].content == "Python programming tutorial"
    assert results[0].relevance_score > 0


@pytest.mark.asyncio
async def test_reranker_empty():
    reranker = SimpleReranker()
    results = await reranker.rerank("test", [], top_k=5)
    assert len(results) == 0


@pytest.mark.asyncio
async def test_citation_tracker():
    tracker = CitationTracker(None)
    chunks_with_scores = [
        ("content 1", 0.9, {"document_id": "d1", "filename": "a.txt", "collection_id": "c1"}),
        ("content 2", 0.7, {"document_id": "d2", "filename": "b.txt", "collection_id": "c1"}),
    ]
    citations = await tracker.build_citations(chunks_with_scores)
    assert len(citations) == 2
    assert citations[0].document_name == "a.txt"
    assert citations[0].relevance_score == 0.9


def test_format_response_with_citations():
    tracker = CitationTracker(None)
    response = CitedResponse(
        answer="The answer is 42",
        citations=[
            Citation(document_id="d1", document_name="guide.txt",
                     collection_id="c1", collection_name="docs",
                     chunk_index=0, content="42 is the answer",
                     relevance_score=0.95, section="Chapter 1"),
        ],
        confidence=0.9,
    )
    formatted = tracker.format_response_with_citations(response)
    assert "guide.txt" in formatted
    assert "Chapter 1" in formatted


def test_chunk_defaults():
    chunk = Chunk(content="test", index=0, start_char=0, end_char=4)
    assert chunk.metadata == {}
