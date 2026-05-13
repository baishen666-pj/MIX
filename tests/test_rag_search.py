from pathlib import Path

import pytest

from engine.memory.store import MemoryStore
from engine.memory.types import MemoryEntry, MemoryType


@pytest.mark.asyncio
async def test_store_and_search_semantic(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    store = MemoryStore(db, use_embeddings=False)
    await store.connect()

    await store.store(MemoryEntry(type=MemoryType.FACT, content="The cat sat on the mat", source="test"))
    await store.store(MemoryEntry(type=MemoryType.FACT, content="Dogs are loyal animals", source="test"))
    await store.store(MemoryEntry(type=MemoryType.FACT, content="Python is a programming language", source="test"))
    await store.flush()

    results = await store.search("cat mat")
    assert len(results) >= 1
    assert any("cat" in r.content for r in results)
    await store.close()


@pytest.mark.asyncio
async def test_ingest_document(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    store = MemoryStore(db, use_embeddings=False)
    await store.connect()

    text = "A " * 600
    ids = await store.ingest_document(text, chunk_size=200, source="test-doc")
    assert len(ids) >= 3
    await store.flush()

    results = await store.search("A")
    assert len(results) >= 3
    await store.close()


@pytest.mark.asyncio
async def test_search_empty(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    store = MemoryStore(db, use_embeddings=False)
    await store.connect()

    results = await store.search("nonexistent")
    assert results == []
    await store.close()


@pytest.mark.asyncio
async def test_search_cache_hit(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    store = MemoryStore(db, use_embeddings=False)
    await store.connect()

    await store.store(MemoryEntry(type=MemoryType.FACT, content="Cached result", source="test"))
    await store.flush()

    r1 = await store.search("Cached")
    r2 = await store.search("Cached")
    assert r1 == r2
    await store.close()
