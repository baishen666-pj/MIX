"""Tests for session search and export functionality."""

from __future__ import annotations

from pathlib import Path

import pytest

from engine.memory.store import MemoryStore


@pytest.mark.asyncio
async def test_search_sessions_by_content(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    store = MemoryStore(db, use_embeddings=False)
    await store.connect()

    await store.save_session("sess-1", {"messages": [{"role": "user", "content": "hello world"}]})
    await store.save_session("sess-2", {"messages": [{"role": "user", "content": "python coding"}]})
    await store.save_session("sess-3", {"messages": [{"role": "user", "content": "hello python"}]})
    await store.flush()

    results = await store.search_sessions("hello")
    ids = {r["id"] for r in results}
    assert "sess-1" in ids
    assert "sess-2" not in ids
    assert "sess-3" in ids

    await store.close()


@pytest.mark.asyncio
async def test_search_sessions_empty_query(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    store = MemoryStore(db, use_embeddings=False)
    await store.connect()

    await store.save_session("sess-1", {"messages": []})
    await store.flush()

    results = await store.search_sessions("nonexistent")
    assert results == []

    await store.close()


@pytest.mark.asyncio
async def test_search_sessions_with_pagination(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    store = MemoryStore(db, use_embeddings=False)
    await store.connect()

    for i in range(5):
        await store.save_session(f"sess-{i}", {"messages": [{"role": "user", "content": f"topic {i}"}]})
    await store.flush()

    page1 = await store.search_sessions("topic", limit=2, offset=0)
    assert len(page1) == 2

    page2 = await store.search_sessions("topic", limit=2, offset=2)
    assert len(page2) == 2

    await store.close()


@pytest.mark.asyncio
async def test_export_session_json(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    store = MemoryStore(db, use_embeddings=False)
    await store.connect()

    await store.save_session("sess-1", {"messages": [{"role": "user", "content": "hello"}]})
    await store.flush()

    exported = await store.export_session("sess-1", format="json")
    assert exported is not None
    assert isinstance(exported, dict)
    assert exported["id"] == "sess-1"
    assert exported["data"]["messages"][0]["content"] == "hello"

    await store.close()


@pytest.mark.asyncio
async def test_export_session_markdown(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    store = MemoryStore(db, use_embeddings=False)
    await store.connect()

    await store.save_session(
        "sess-1", {"messages": [{"role": "user", "content": "hello"}, {"role": "assistant", "content": "hi there"}]}
    )
    await store.flush()

    exported = await store.export_session("sess-1", format="markdown")
    assert exported is not None
    assert isinstance(exported, str)
    assert "**user**: hello" in exported
    assert "**assistant**: hi there" in exported
    assert "# Session sess-1" in exported

    await store.close()


@pytest.mark.asyncio
async def test_export_session_not_found(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    store = MemoryStore(db, use_embeddings=False)
    await store.connect()

    result = await store.export_session("nonexistent")
    assert result is None

    await store.close()
