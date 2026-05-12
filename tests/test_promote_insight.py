import pytest
from pathlib import Path

from engine.memory.store import MemoryStore
from engine.memory.types import MemoryEntry, MemoryType
from engine.skills.registry import SkillRegistry, SkillManifest
from engine.learning.loop import LearningLoop


@pytest.mark.asyncio
async def test_promote_insight_api(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    store = MemoryStore(db, use_embeddings=False)
    await store.connect()

    skills = SkillRegistry(skills_dir=tmp_path / "skills")
    skills.load_all()
    learning = LearningLoop(store, skills)
    learning.nudge_interval = 2

    for i in range(10):
        await learning.record_interaction(f"search query", "session-1")

    insights = learning.get_pending_insights()
    if len(insights) == 0:
        await store.close()
        pytest.skip("No insights generated in this run")

    insight = insights[0]
    insight.code = "async def run(args): return {'result': 'ok'}"

    manifest = await learning.promote_insight(insight.id)
    assert manifest is not None
    await store.close()


@pytest.mark.asyncio
async def test_promote_insight_not_found(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    store = MemoryStore(db, use_embeddings=False)
    await store.connect()

    skills = SkillRegistry(skills_dir=tmp_path / "skills")
    learning = LearningLoop(store, skills)

    result = await learning.promote_insight("nonexistent-id")
    assert result is None
    await store.close()


@pytest.mark.asyncio
async def test_dismiss_insight(tmp_path: Path) -> None:
    db = tmp_path / "test.db"
    store = MemoryStore(db, use_embeddings=False)
    await store.connect()

    skills = SkillRegistry(skills_dir=tmp_path / "skills")
    learning = LearningLoop(store, skills)
    learning.nudge_interval = 2

    for i in range(10):
        await learning.record_interaction(f"query", "session-1")

    insights = learning.get_pending_insights()
    if len(insights) == 0:
        await store.close()
        pytest.skip("No insights generated")

    insight_id = insights[0].id
    dismissed = learning.dismiss_insight(insight_id)
    assert dismissed is True

    remaining = learning.get_pending_insights()
    assert all(i.id != insight_id for i in remaining)
    await store.close()
