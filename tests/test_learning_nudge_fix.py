from pathlib import Path

import pytest

from engine.learning.loop import LearningLoop
from engine.memory.store import MemoryStore
from engine.memory.types import MemoryEntry, MemoryType
from engine.skills.registry import SkillRegistry


@pytest.mark.asyncio
async def test_get_recent_returns_ordered(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    store = MemoryStore(db)
    await store.connect()

    for i in range(5):
        entry = MemoryEntry(
            type=MemoryType.CONTEXT,
            content=f"[user] message {i}",
            source="test",
        )
        await store.store(entry)

    recent = await store.get_recent(limit=3)
    assert len(recent) == 3
    contents = [r.content for r in recent]
    assert "[user] message 4" in contents[0]
    assert "[user] message 3" in contents[1]
    assert "[user] message 2" in contents[2]

    await store.close()


@pytest.mark.asyncio
async def test_get_recent_empty(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    store = MemoryStore(db)
    await store.connect()

    recent = await store.get_recent(limit=5)
    assert recent == []

    await store.close()


@pytest.mark.asyncio
async def test_nudge_uses_get_recent(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    store = MemoryStore(db)
    await store.connect()

    for i in range(5):
        entry = MemoryEntry(
            type=MemoryType.CONTEXT,
            content=f"[user] search query {i}",
            source="test",
        )
        await store.store(entry)

    skills = SkillRegistry(skills_dir=tmp_path / "skills")
    skills.load_all()
    learning = LearningLoop(store, skills)
    learning.nudge_interval = 3

    for i in range(3):
        await learning.record_interaction(f"search query {i}", "session-1")

    insights = learning.get_pending_insights()
    assert len(insights) > 0

    await store.close()


@pytest.mark.asyncio
async def test_get_recent_with_limit(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    store = MemoryStore(db)
    await store.connect()

    for i in range(10):
        entry = MemoryEntry(
            type=MemoryType.CONTEXT,
            content=f"entry {i}",
            source="test",
        )
        await store.store(entry)

    recent = await store.get_recent(limit=2)
    assert len(recent) == 2

    await store.close()
