"""Tests for engine.sandbox.local -- LocalBackend edge cases.

Core LocalBackend tests exist in test_sandbox.py. This file covers
additional edge cases: generic exception handling and the SandboxManager.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from engine.sandbox.local import LocalBackend
from engine.sandbox.types import SandboxManager


class TestLocalBackendGenericException:
    @pytest.mark.asyncio
    @patch("engine.sandbox.local.asyncio.create_subprocess_shell")
    async def test_generic_exception_returns_error(self, mock_shell) -> None:
        # Arrange
        mock_shell.side_effect = OSError("spawn failure")
        backend = LocalBackend()

        # Act
        result = await backend.execute("anything")

        # Assert
        assert result["exit_code"] == -1
        assert result["timed_out"] is False
        assert "spawn failure" in result["stderr"]
        assert result["stdout"] == ""


class TestSandboxManager:
    def test_register_and_get_default_backend(self) -> None:
        # Arrange
        manager = SandboxManager(default_backend="local")
        backend = LocalBackend()

        # Act
        manager.register(backend)
        result = manager.get()

        # Assert
        assert result is backend

    def test_get_named_backend(self) -> None:
        # Arrange
        manager = SandboxManager(default_backend="local")
        local = LocalBackend()
        manager.register(local)

        # Act
        result = manager.get("local")

        # Assert
        assert result is local

    def test_get_missing_backend_raises(self) -> None:
        # Arrange
        manager = SandboxManager(default_backend="docker")

        # Act / Assert
        with pytest.raises(ValueError, match="not found"):
            manager.get("docker")

    def test_get_explicit_none_uses_default(self) -> None:
        # Arrange
        manager = SandboxManager(default_backend="local")
        local = LocalBackend()
        manager.register(local)

        # Act
        result = manager.get(None)

        # Assert
        assert result is local

    def test_register_overwrites(self) -> None:
        # Arrange
        manager = SandboxManager()
        backend1 = LocalBackend()
        backend2 = LocalBackend()
        manager.register(backend1)

        # Act
        manager.register(backend2)
        result = manager.get("local")

        # Assert
        assert result is backend2
