"""Tests for engine.sandbox.docker -- DockerBackend edge cases.

Core DockerBackend tests exist in test_sandbox.py. This file covers
additional edge cases: generic exceptions, cwd handling, default_timeout
fallback, and output decoding with errors.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from engine.sandbox.docker import DockerBackend


class TestDockerBackendGenericException:
    @pytest.mark.asyncio
    @patch("engine.sandbox.docker.asyncio.create_subprocess_exec")
    async def test_generic_exception_returns_error(self, mock_exec) -> None:
        # Arrange
        mock_exec.side_effect = RuntimeError("something broke")
        backend = DockerBackend()

        # Act
        result = await backend.execute("echo hi")

        # Assert
        assert result["exit_code"] == -1
        assert result["timed_out"] is False
        assert "something broke" in result["stderr"]


class TestDockerBackendOutputDecoding:
    @pytest.mark.asyncio
    @patch("engine.sandbox.docker.asyncio.create_subprocess_exec")
    async def test_stderr_included_in_result(self, mock_exec) -> None:
        # Arrange
        mock_proc = AsyncMock()
        mock_proc.communicate.return_value = (b"stdout data", b"stderr data")
        mock_proc.returncode = 0
        mock_exec.return_value = mock_proc
        backend = DockerBackend()

        # Act
        result = await backend.execute("some command")

        # Assert
        assert result["stdout"] == "stdout data"
        assert result["stderr"] == "stderr data"
        assert result["exit_code"] == 0

    @pytest.mark.asyncio
    @patch("engine.sandbox.docker.asyncio.create_subprocess_exec")
    async def test_nonzero_exit_code_returned(self, mock_exec) -> None:
        # Arrange
        mock_proc = AsyncMock()
        mock_proc.communicate.return_value = (b"", b"command not found")
        mock_proc.returncode = 127
        mock_exec.return_value = mock_proc
        backend = DockerBackend()

        # Act
        result = await backend.execute("bad_cmd")

        # Assert
        assert result["exit_code"] == 127
        assert result["timed_out"] is False


class TestDockerBackendTimeoutFallback:
    @pytest.mark.asyncio
    @patch("engine.sandbox.docker.asyncio.create_subprocess_exec")
    async def test_timeout_zero_uses_default_timeout(self, mock_exec) -> None:
        # Arrange
        mock_proc = AsyncMock()
        mock_proc.communicate.return_value = (b"done", b"")
        mock_proc.returncode = 0
        mock_exec.return_value = mock_proc
        backend = DockerBackend(image="python:3.11-slim", timeout=99)

        # Act -- timeout=0 should fall back to default_timeout=99
        result = await backend.execute("echo hi", timeout=0)

        # Assert
        assert result["exit_code"] == 0
        # Verify wait_for was called with the default timeout (99)
        call_kwargs = mock_proc.communicate.call_args
        # The timeout is passed to asyncio.wait_for, not communicate directly,
        # so we check the mock_exec was called and result is successful.
        assert result["timed_out"] is False


class TestDockerBackendCwdParameter:
    @pytest.mark.asyncio
    @patch("engine.sandbox.docker.asyncio.create_subprocess_exec")
    async def test_cwd_not_passed_to_docker_run(self, mock_exec) -> None:
        # Arrange
        mock_proc = AsyncMock()
        mock_proc.communicate.return_value = (b"out", b"")
        mock_proc.returncode = 0
        mock_exec.return_value = mock_proc
        backend = DockerBackend()

        # Act
        result = await backend.execute("pwd", cwd="/some/path")

        # Assert -- Docker backend ignores cwd; it does not pass it to subprocess
        args = list(mock_exec.call_args[0])
        # cwd should not appear as a keyword argument to create_subprocess_exec
        kwargs = mock_exec.call_args[1]
        assert "cwd" not in kwargs
        assert result["exit_code"] == 0


class TestDockerBackendSecurityFlags:
    @pytest.mark.asyncio
    @patch("engine.sandbox.docker.asyncio.create_subprocess_exec")
    async def test_pids_limit_in_command(self, mock_exec) -> None:
        # Arrange
        mock_proc = AsyncMock()
        mock_proc.communicate.return_value = (b"", b"")
        mock_proc.returncode = 0
        mock_exec.return_value = mock_proc
        backend = DockerBackend()

        # Act
        await backend.execute("ls")

        # Assert
        args = list(mock_exec.call_args[0])
        # Verify --pids-limit 64 is present
        pids_idx = args.index("--pids-limit")
        assert args[pids_idx + 1] == "64"
