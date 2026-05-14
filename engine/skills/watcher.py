from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

from engine.skills.registry import SkillRegistry

log = logging.getLogger("mix.skills.watcher")


class SkillWatcher:
    def __init__(self, skills_dir: Path, registry: SkillRegistry) -> None:
        self._skills_dir = skills_dir
        self._registry = registry
        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._watch_loop())
        log.info("Skill watcher started on %s", self._skills_dir)

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        log.info("Skill watcher stopped")

    async def _watch_loop(self) -> None:
        try:
            from watchfiles import awatch

            async for changes in awatch(self._skills_dir):
                if not self._running:
                    break
                for change_type, path_str in changes:
                    path = Path(path_str)
                    if path.name == "SKILL.md":
                        self._handle_change(change_type, path)
        except ImportError:
            log.debug("watchfiles not installed, hot-reload disabled")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            log.error("Skill watcher error: %s", e)

    def _handle_change(self, change_type: Any, path: Path) -> None:
        skill_dir = path.parent
        if change_type.modified or change_type.added or change_type.changed:
            manifest = self._registry._parse_skill_md(path)
            if manifest:
                old = self._registry.get(manifest.name)
                self._registry.register(manifest)
                action = "Reloaded" if old else "Loaded"
                log.info("%s skill: %s", action, manifest.name)
        elif change_type.deleted:
            for name, skill in list(self._registry.skills.items()):
                if skill.skill_path == str(skill_dir):
                    self._registry.unregister(name)
                    log.info("Unloaded skill: %s", name)
                    break
