from pathlib import Path

import pytest

from engine.learning.loop import LearningLoop
from engine.learning.nudge import CronScheduler, parse_cron, should_run
from engine.memory.store import MemoryStore
from engine.skills.registry import SkillRegistry


@pytest.fixture
async def learning(tmp_path: Path) -> LearningLoop:
    memory = MemoryStore(tmp_path / "test.db")
    await memory.connect()
    skills = SkillRegistry(skills_dir=tmp_path)
    loop = LearningLoop(memory, skills)
    yield loop
    await memory.close()


@pytest.mark.asyncio
async def test_record_interaction(learning: LearningLoop) -> None:
    await learning.record_interaction("user", "hello world", session_id="test-session")
    await learning.record_interaction("assistant", "hi there", session_id="test-session")
    assert learning._interaction_count == 2


@pytest.mark.asyncio
async def test_get_pending_insights(learning: LearningLoop) -> None:
    insights = learning.get_pending_insights()
    assert insights == []


@pytest.mark.asyncio
async def test_dismiss_insight(learning: LearningLoop) -> None:
    dismissed = learning.dismiss_insight("nonexistent-id")
    assert dismissed is False


def test_cron_parse() -> None:
    result = parse_cron("*/5 * * * *")
    assert result["minute"] == "*/5"
    assert result["hour"] == "*"


def test_cron_parse_invalid() -> None:
    with pytest.raises(ValueError):
        parse_cron("invalid")


def test_should_run_wildcard() -> None:
    from datetime import datetime, timezone

    now = datetime(2026, 1, 15, 9, 30, tzinfo=timezone.utc)
    assert should_run("* * * * *", now) is True


def test_should_run_specific_minute() -> None:
    from datetime import datetime, timezone

    now = datetime(2026, 1, 15, 9, 30, tzinfo=timezone.utc)
    assert should_run("30 * * * *", now) is True
    assert should_run("31 * * * *", now) is False


def test_should_run_step() -> None:
    from datetime import datetime, timezone

    now = datetime(2026, 1, 15, 9, 30, tzinfo=timezone.utc)
    assert should_run("*/5 * * * *", now) is True
    assert should_run("*/7 * * * *", now) is False


def test_cron_scheduler_add_remove() -> None:
    scheduler = CronScheduler()
    job = scheduler.add_job("test", "0 9 * * *", "hello")
    assert len(scheduler.list_jobs()) == 1
    assert scheduler.list_jobs()[0]["name"] == "test"

    removed = scheduler.remove_job(job.id)
    assert removed is True
    assert len(scheduler.list_jobs()) == 0

    removed2 = scheduler.remove_job("nonexistent")
    assert removed2 is False
