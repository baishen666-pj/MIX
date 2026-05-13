from pathlib import Path

import pytest

from engine.learning.nudge import CronScheduler


@pytest.mark.asyncio
async def test_cron_save_and_load_roundtrip(tmp_path: Path) -> None:
    persist = tmp_path / "cron_jobs.json"
    scheduler = CronScheduler(persist_path=persist)

    scheduler.add_job("test job", "*/5 * * * *", "hello", "webchat")
    scheduler.add_job("daily", "0 9 * * *", "good morning", "telegram")

    scheduler2 = CronScheduler(persist_path=persist)
    scheduler2._load_jobs()

    jobs = scheduler2.list_jobs()
    assert len(jobs) == 2
    names = {j["name"] for j in jobs}
    assert names == {"test job", "daily"}


@pytest.mark.asyncio
async def test_cron_persist_after_remove(tmp_path: Path) -> None:
    persist = tmp_path / "cron_jobs.json"
    scheduler = CronScheduler(persist_path=persist)

    job = scheduler.add_job("to remove", "*/5 * * * *", "msg")
    scheduler.remove_job(job.id)

    scheduler2 = CronScheduler(persist_path=persist)
    scheduler2._load_jobs()

    assert len(scheduler2.list_jobs()) == 0


@pytest.mark.asyncio
async def test_cron_missing_file(tmp_path: Path) -> None:
    persist = tmp_path / "nonexistent" / "cron_jobs.json"
    scheduler = CronScheduler(persist_path=persist)
    scheduler._load_jobs()
    assert len(scheduler.list_jobs()) == 0


@pytest.mark.asyncio
async def test_cron_corrupt_file(tmp_path: Path) -> None:
    persist = tmp_path / "cron_jobs.json"
    persist.write_text("not valid json{{{")

    scheduler = CronScheduler(persist_path=persist)
    scheduler._load_jobs()
    assert len(scheduler.list_jobs()) == 0


@pytest.mark.asyncio
async def test_cron_start_loads_jobs(tmp_path: Path) -> None:
    persist = tmp_path / "cron_jobs.json"
    scheduler1 = CronScheduler(persist_path=persist)
    scheduler1.add_job("loaded", "0 * * * *", "hourly")

    scheduler2 = CronScheduler(persist_path=persist)
    scheduler2._load_jobs()

    assert any(j["name"] == "loaded" for j in scheduler2.list_jobs())
