from __future__ import annotations

from typing import Any, Protocol


class SandboxBackend(Protocol):
    name: str

    async def execute(self, command: str, timeout: int = 30, cwd: str | None = None) -> dict[str, Any]: ...


class SandboxManager:
    def __init__(self, default_backend: str = "local") -> None:
        self._backends: dict[str, SandboxBackend] = {}
        self._default = default_backend

    def register(self, backend: SandboxBackend) -> None:
        self._backends[backend.name] = backend

    def get(self, name: str | None = None) -> SandboxBackend:
        backend_name = name or self._default
        backend = self._backends.get(backend_name)
        if backend is None:
            raise ValueError(f"Sandbox backend '{backend_name}' not found")
        return backend
