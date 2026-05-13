"""Additional coverage tests for engine.tools.bash.

Targets uncovered lines 38-39: the generic except branch (not TimeoutError).
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from engine.tools.bash import execute


class TestBashGenericException:
    """Cover lines 38-39: non-timeout exception during command execution."""

    @pytest.mark.asyncio
    async def test_create_subprocess_raises_os_error(self) -> None:
        with patch("engine.tools.bash.asyncio.create_subprocess_shell", side_effect=OSError("no shell")):
            result = await execute(command="echo hi")
        assert not result.success
        assert "no shell" in result.error

    @pytest.mark.asyncio
    async def test_communicate_raises_error(self) -> None:
        mock_proc = AsyncMock()
        mock_proc.communicate = AsyncMock(side_effect=RuntimeError("pipe broken"))

        async def _fake_create(*args, **kwargs):
            return mock_proc

        with patch("engine.tools.bash.asyncio.create_subprocess_shell", side_effect=_fake_create):
            with patch("engine.tools.bash.asyncio.wait_for", side_effect=RuntimeError("pipe broken")):
                result = await execute(command="echo hi")
        assert not result.success
        assert "pipe broken" in result.error


class TestBashTimeoutKillsProcess:
    """Verify process.kill() is called on timeout (lines 34-36)."""

    @pytest.mark.asyncio
    async def test_timeout_kills_process(self) -> None:
        mock_proc = AsyncMock()
        mock_proc.communicate = AsyncMock(side_effect=TimeoutError())
        mock_proc.kill = AsyncMock()
        mock_proc.wait = AsyncMock()

        async def _fake_create(*args, **kwargs):
            return mock_proc

        with patch("engine.tools.bash.asyncio.create_subprocess_shell", side_effect=_fake_create):
            with patch("engine.tools.bash.asyncio.wait_for", side_effect=TimeoutError()):
                result = await execute(command="sleep 100", timeout=1)

        assert not result.success
        assert "timed out" in result.error.lower()
        mock_proc.kill.assert_called_once()
        mock_proc.wait.assert_called_once()

    @pytest.mark.asyncio
    async def test_timeout_with_none_proc(self) -> None:
        """Cover edge case where proc is None when timeout occurs."""
        with patch("engine.tools.bash.asyncio.create_subprocess_shell", side_effect=TimeoutError()):
            with patch("engine.tools.bash.asyncio.wait_for", side_effect=TimeoutError()):
                result = await execute(command="bad", timeout=1)
        assert not result.success
        assert "timed out" in result.error.lower()
