from pathlib import Path

import pytest

from engine.memory.store import MemoryStore
from engine.memory.types import MemoryEntry, MemoryType


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "test.db"


@pytest.fixture
async def store(db_path: Path) -> MemoryStore:
    s = MemoryStore(db_path)
    await s.connect()
    yield s
    await s.close()


@pytest.mark.asyncio
async def test_store_and_get(store: MemoryStore) -> None:
    entry = MemoryEntry(type=MemoryType.FACT, content="user likes coffee", tags=["preference"])
    await store.store(entry)

    result = await store.get(entry.id)
    assert result is not None
    assert result.content == "user likes coffee"
    assert result.type == MemoryType.FACT
    assert result.access_count == 1


@pytest.mark.asyncio
async def test_search(store: MemoryStore) -> None:
    await store.store(MemoryEntry(type=MemoryType.FACT, content="Python is a programming language"))
    await store.store(MemoryEntry(type=MemoryType.FACT, content="TypeScript adds types to JavaScript"))
    await store.store(MemoryEntry(type=MemoryType.CONTEXT, content="The user prefers dark mode"))

    results = await store.search("Python", limit=5)
    assert len(results) >= 1
    assert any("Python" in r.content for r in results)


@pytest.mark.asyncio
async def test_delete(store: MemoryStore) -> None:
    entry = MemoryEntry(type=MemoryType.FACT, content="to be deleted")
    await store.store(entry)

    deleted = await store.delete(entry.id)
    assert deleted is True

    result = await store.get(entry.id)
    assert result is None


@pytest.mark.asyncio
async def test_delete_nonexistent(store: MemoryStore) -> None:
    deleted = await store.delete("nonexistent-id")
    assert deleted is False


@pytest.mark.asyncio
async def test_touch_updates_access(store: MemoryStore) -> None:
    entry = MemoryEntry(type=MemoryType.FACT, content="access tracking")
    await store.store(entry)

    result = await store.get(entry.id)
    assert result is not None
    assert result.access_count == 1

    result2 = await store.get(entry.id)
    assert result2 is not None
    assert result2.access_count == 2
