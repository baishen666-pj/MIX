from pathlib import Path

import pytest

from engine.memory.store import MemoryStore


@pytest.mark.asyncio
async def test_sessions_crud(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    store = MemoryStore(db, use_embeddings=False)
    await store.connect()

    await store.save_session("sess-1", {"messages": 5})
    await store.save_session("sess-2", {"messages": 10})
    await store.flush()

    sessions = await store.list_sessions()
    assert len(sessions) == 2

    data = await store.load_session("sess-1")
    assert data == {"messages": 5}

    deleted = await store.delete_session("sess-1")
    assert deleted is True
    await store.flush()

    sessions = await store.list_sessions()
    assert len(sessions) == 1

    deleted = await store.delete_session("nonexistent")
    assert deleted is False
    await store.close()
