from __future__ import annotations

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Awaitable, Callable

log = logging.getLogger("mix.cron")


@dataclass
class CronJob:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    cron: str = ""  # "*/5 * * * *" format (minute hour dom month dow)
    message: str = ""
    channel: str = "webchat"
    enabled: bool = True
    last_run: str = ""
    next_run: str = ""
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def parse_cron(expr: str) -> dict:
    parts = expr.strip().split()
    if len(parts) != 5:
        raise ValueError(f"Invalid cron expression: {expr}")
    return {
        "minute": parts[0],
        "hour": parts[1],
        "dom": parts[2],
        "month": parts[3],
        "dow": parts[4],
    }


def should_run(cron_expr: str, now: datetime) -> bool:
    parts = parse_cron(cron_expr)
    checks = [
        (parts["minute"], now.minute, 60),
        (parts["hour"], now.hour, 24),
        (parts["dom"], now.day, 32),
        (parts["month"], now.month, 13),
        (parts["dow"], now.weekday(), 7),
    ]
    for field_val, actual, _ in checks:
        if field_val == "*":
            continue
        if "/" in field_val:
            _, step = field_val.split("/")
            if actual % int(step) != 0:
                return False
        elif "," in field_val:
            if actual not in [int(v) for v in field_val.split(",")]:
                return False
        elif int(field_val) != actual:
            return False
    return True


class CronScheduler:
    def __init__(self, persist_path: Path | None = None) -> None:
        self._jobs: dict[str, CronJob] = {}
        self._running = False
        self._task: asyncio.Task | None = None
        self._handler: Callable[[CronJob], Awaitable[None]] | None = None
        self._persist_path = persist_path or Path.home() / ".mix" / "data" / "cron_jobs.json"

    def set_handler(self, handler: Callable[[CronJob], Awaitable[None]]) -> None:
        self._handler = handler

    def add_job(self, name: str, cron: str, message: str, channel: str = "webchat") -> CronJob:
        job = CronJob(name=name, cron=cron, message=message, channel=channel)
        self._jobs[job.id] = job
        self._save_jobs()
        return job

    def remove_job(self, job_id: str) -> bool:
        if job_id in self._jobs:
            del self._jobs[job_id]
            self._save_jobs()
            return True
        return False

    def list_jobs(self) -> list[dict]:
        return [
            {
                "id": j.id,
                "name": j.name,
                "cron": j.cron,
                "message": j.message,
                "channel": j.channel,
                "enabled": j.enabled,
                "last_run": j.last_run,
                "created_at": j.created_at,
            }
            for j in self._jobs.values()
        ]

    def _save_jobs(self) -> None:
        try:
            self._persist_path.parent.mkdir(parents=True, exist_ok=True)
            data = {}
            for jid, j in self._jobs.items():
                data[jid] = {
                    "name": j.name,
                    "cron": j.cron,
                    "message": j.message,
                    "channel": j.channel,
                    "enabled": j.enabled,
                    "last_run": j.last_run,
                }
            self._persist_path.write_text(json.dumps(data, indent=2))
        except Exception:
            log.exception("Failed to persist cron jobs")

    def _load_jobs(self) -> None:
        if not self._persist_path.exists():
            return
        try:
            data = json.loads(self._persist_path.read_text())
            for jid, jd in data.items():
                self._jobs[jid] = CronJob(
                    id=jid,
                    name=jd["name"],
                    cron=jd["cron"],
                    message=jd["message"],
                    channel=jd.get("channel", "webchat"),
                    enabled=jd.get("enabled", True),
                    last_run=jd.get("last_run", ""),
                )
        except Exception:
            log.exception("Failed to load cron jobs")

    def start(self) -> None:
        if self._running:
            return
        self._load_jobs()
        self._running = True
        self._task = asyncio.create_task(self._run_loop())

    def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None

    async def _run_loop(self) -> None:
        while self._running:
            now = datetime.now(timezone.utc)
            for job in self._jobs.values():
                if not job.enabled:
                    continue
                if should_run(job.cron, now):
                    job.last_run = now.isoformat()
                    if self._handler:
                        try:
                            await self._handler(job)
                        except Exception:
                            log.exception("Cron job %s (%s) failed", job.name, job.id)
            await asyncio.sleep(60)
