"""Tests for engine.sandbox.local and engine.sandbox.docker backends."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from engine.sandbox.local import LocalBackend
from engine.sandbox.docker import DockerBackend


class TestLocalBackend:

    def test_name(self) -> None:
        backend = LocalBackend()
        assert backend.name == "local"

    @pytest.mark.asyncio
    async def test_execute_success(self) -> None:
        backend = LocalBackend()
        result = await backend.execute("echo hello")

        assert result["exit_code"] == 0
        assert "hello" in result["stdout"]
        assert result["timed_out"] is False

    @pytest.mark.asyncio
    async def test_execute_stderr(self) -> None:
        backend = LocalBackend()
        result = await backend.execute("echo error >&2")

        assert "error" in result["stderr"]

    @pytest.mark.asyncio
    async def test_execute_nonzero_exit(self) -> None:
        backend = LocalBackend()
        result = await backend.execute("exit 42")

        assert result["exit_code"] == 42

    @pytest.mark.asyncio
    async def test_execute_timeout(self) -> None:
        backend = LocalBackend()
        result = await backend.execute("sleep 10", timeout=1)

        assert result["timed_out"] is True
        assert result["exit_code"] == -1

    @pytest.mark.asyncio
    async def test_execute_with_cwd(self, tmp_path) -> None:
        backend = LocalBackend()
        result = await backend.execute("pwd", cwd=str(tmp_path))

        assert result["exit_code"] == 0
        # On Windows with bash, path may have different format
        assert str(tmp_path) in result["stdout"] or tmp_path.name in result["stdout"]

    @pytest.mark.asyncio
    async def test_execute_invalid_command(self) -> None:
        backend = LocalBackend()
        result = await backend.execute("nonexistent_command_xyz_12345")

        assert result["exit_code"] != 0

    @pytest.mark.asyncio
    async def test_execute_output_encoding(self) -> None:
        backend = LocalBackend()
        result = await backend.execute("echo test")

        assert isinstance(result["stdout"], str)
        assert isinstance(result["stderr"], str)


class TestDockerBackend:

    def test_name(self) -> None:
        backend = DockerBackend()
        assert backend.name == "docker"

    def test_default_config(self) -> None:
        backend = DockerBackend()
        assert backend.image == "python:3.11-slim"
        assert backend.default_timeout == 60

    def test_custom_config(self) -> None:
        backend = DockerBackend(image="node:18", timeout=120)
        assert backend.image == "node:18"
        assert backend.default_timeout == 120

    @pytest.mark.asyncio
    @patch("engine.sandbox.docker.asyncio.create_subprocess_exec")
    async def test_execute_success(self, mock_exec) -> None:
        mock_proc = AsyncMock()
        mock_proc.communicate.return_value = (b"output", b"")
        mock_proc.returncode = 0
        mock_exec.return_value = mock_proc

        backend = DockerBackend()
        result = await backend.execute("python -c 'print(42)'")

        assert result["exit_code"] == 0
        assert result["timed_out"] is False
        # Verify docker command structure
        call_args = mock_exec.call_args
        args = list(call_args[0]) if call_args[0] else []
        assert "docker" in args
        assert "run" in args
        assert "--rm" in args

    @pytest.mark.asyncio
    @patch("engine.sandbox.docker.asyncio.create_subprocess_exec")
    async def test_execute_timeout(self, mock_exec) -> None:
        mock_proc = AsyncMock()
        mock_proc.communicate.side_effect = TimeoutError()
        mock_proc.kill = MagicMock()
        mock_exec.return_value = mock_proc

        backend = DockerBackend()
        result = await backend.execute("sleep 999", timeout=1)

        assert result["timed_out"] is True
        assert result["exit_code"] == -1
        mock_proc.kill.assert_called_once()

    @pytest.mark.asyncio
    @patch("engine.sandbox.docker.asyncio.create_subprocess_exec")
    async def test_execute_docker_not_found(self, mock_exec) -> None:
        mock_exec.side_effect = FileNotFoundError()

        backend = DockerBackend()
        result = await backend.execute("echo hi")

        assert result["exit_code"] == -1
        assert "Docker not found" in result["stderr"]

    @pytest.mark.asyncio
    @patch("engine.sandbox.docker.asyncio.create_subprocess_exec")
    async def test_execute_security_constraints(self, mock_exec) -> None:
        mock_proc = AsyncMock()
        mock_proc.communicate.return_value = (b"", b"")
        mock_proc.returncode = 0
        mock_exec.return_value = mock_proc

        backend = DockerBackend()
        await backend.execute("ls")

        args = list(mock_exec.call_args[0])
        assert "--network" in args
        assert "none" in args
        assert "--memory" in args
        assert "512m" in args
        assert "--cpus" in args
        assert "1" in args
        assert "--pids-limit" in args
