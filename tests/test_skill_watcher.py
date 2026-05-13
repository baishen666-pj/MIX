"""Tests for engine.skills.watcher — SkillWatcher start/stop/change handling."""

from __future__ import annotations

import asyncio
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from engine.skills.watcher import SkillWatcher
from engine.skills.registry import SkillRegistry


class TestSkillWatcher:

    def test_init(self, tmp_path: Path) -> None:
        registry = MagicMock(spec=SkillRegistry)
        watcher = SkillWatcher(tmp_path, registry)
        assert watcher._running is False
        assert watcher._task is None

    @pytest.mark.asyncio
    async def test_start_sets_running(self, tmp_path: Path) -> None:
        registry = MagicMock(spec=SkillRegistry)
        watcher = SkillWatcher(tmp_path, registry)

        with patch.object(watcher, "_watch_loop", new_callable=AsyncMock):
            await watcher.start()
            assert watcher._running is True
            assert watcher._task is not None
            await watcher.stop()

    @pytest.mark.asyncio
    async def test_start_idempotent(self, tmp_path: Path) -> None:
        registry = MagicMock(spec=SkillRegistry)
        watcher = SkillWatcher(tmp_path, registry)

        with patch.object(watcher, "_watch_loop", new_callable=AsyncMock):
            await watcher.start()
            task1 = watcher._task
            await watcher.start()
            task2 = watcher._task
            assert task1 is task2
            await watcher.stop()

    @pytest.mark.asyncio
    async def test_stop_cleans_up(self, tmp_path: Path) -> None:
        registry = MagicMock(spec=SkillRegistry)
        watcher = SkillWatcher(tmp_path, registry)

        with patch.object(watcher, "_watch_loop", new_callable=AsyncMock):
            await watcher.start()
            assert watcher._running is True
            await watcher.stop()
            assert watcher._running is False
            assert watcher._task is None

    @pytest.mark.asyncio
    async def test_stop_without_start(self, tmp_path: Path) -> None:
        registry = MagicMock(spec=SkillRegistry)
        watcher = SkillWatcher(tmp_path, registry)
        await watcher.stop()
        assert watcher._running is False

    def test_handle_change_added(self, tmp_path: Path) -> None:
        registry = MagicMock(spec=SkillRegistry)
        registry._parse_skill_md.return_value = MagicMock(name="my_skill")
        registry.get.return_value = None

        watcher = SkillWatcher(tmp_path, registry)
        skill_dir = tmp_path / "my_skill"
        skill_dir.mkdir()
        skill_md = skill_dir / "SKILL.md"

        # Create a simple mock change type
        change = MagicMock()
        change.modified = False
        change.added = True
        change.changed = False
        change.deleted = False

        watcher._handle_change(change, skill_md)
        registry.register.assert_called_once()

    def test_handle_change_modified(self, tmp_path: Path) -> None:
        registry = MagicMock(spec=SkillRegistry)
        registry._parse_skill_md.return_value = MagicMock(name="my_skill")
        registry.get.return_value = MagicMock()

        watcher = SkillWatcher(tmp_path, registry)
        skill_dir = tmp_path / "my_skill"
        skill_dir.mkdir()
        skill_md = skill_dir / "SKILL.md"

        change = MagicMock()
        change.modified = True
        change.added = False
        change.changed = False
        change.deleted = False

        watcher._handle_change(change, skill_md)
        registry.register.assert_called_once()

    def test_handle_change_deleted(self, tmp_path: Path) -> None:
        registry = MagicMock(spec=SkillRegistry)
        skill_dir = tmp_path / "my_skill"
        skill_dir.mkdir()
        skill_md = skill_dir / "SKILL.md"

        mock_skill = MagicMock()
        mock_skill.skill_path = str(skill_dir)
        registry.skills = {"my_skill": mock_skill}

        watcher = SkillWatcher(tmp_path, registry)

        change = MagicMock()
        change.modified = False
        change.added = False
        change.changed = False
        change.deleted = True

        watcher._handle_change(change, skill_md)
        registry.unregister.assert_called_once_with("my_skill")

    @pytest.mark.asyncio
    async def test_watch_loop_with_watchfiles(self, tmp_path: Path) -> None:
        registry = MagicMock(spec=SkillRegistry)
        watcher = SkillWatcher(tmp_path, registry)

        async def fake_awatch(path):
            yield []  # one iteration then return
            return

        with patch("watchfiles.awatch", side_effect=fake_awatch):
            await watcher._watch_loop()
        # Should complete without error

    @pytest.mark.asyncio
    async def test_watch_loop_exception_handling(self, tmp_path: Path) -> None:
        registry = MagicMock(spec=SkillRegistry)
        watcher = SkillWatcher(tmp_path, registry)

        async def failing_awatch(path):
            raise RuntimeError("watch error")
            yield  # make it an async generator

        with patch("watchfiles.awatch", side_effect=failing_awatch):
            await watcher._watch_loop()
        # Should not raise, error is logged
