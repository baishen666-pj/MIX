from __future__ import annotations

import asyncio
import json
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

import logging

log = logging.getLogger("mix.dynamic_tools")


@dataclass
class DynamicToolDef:
    name: str
    description: str
    parameters: dict
    handler_code: str
    examples: list[dict] = field(default_factory=list)
    constraints: dict = field(default_factory=dict)
    danger_level: str = "safe"
    created_at: str = ""
    created_by: str = ""

    def to_openai_definition(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


class DynamicToolRegistry:
    def __init__(self, tools_dir: Path | None = None) -> None:
        self._tools: dict[str, DynamicToolDef] = {}
        self._handlers: dict[str, Callable] = {}
        self._tools_dir = tools_dir

    async def register(self, definition: DynamicToolDef) -> None:
        handler = self._compile_handler(definition.handler_code)
        self._tools[definition.name] = definition
        self._handlers[definition.name] = handler
        log.info("Registered dynamic tool: %s (%s)", definition.name, definition.danger_level)

    async def unregister(self, name: str) -> bool:
        if name in self._tools:
            del self._tools[name]
            self._handlers.pop(name, None)
            log.info("Unregistered dynamic tool: %s", name)
            return True
        return False

    def list_dynamic_tools(self) -> list[DynamicToolDef]:
        return list(self._tools.values())

    def list_dynamic_tools_names(self) -> list[str]:
        return list(self._tools.keys())
        return list(self._tools.values())

    def get_definition(self, name: str) -> DynamicToolDef | None:
        return self._tools.get(name)

    def has_tool(self, name: str) -> bool:
        return name in self._tools

    async def execute(self, name: str, **kwargs: Any) -> dict:
        handler = self._handlers.get(name)
        if handler is None:
            return {"error": f"Dynamic tool '{name}' not found"}
        try:
            result = await handler(**kwargs)
            return {"output": result, "success": True}
        except Exception as e:
            log.exception("Dynamic tool %s failed", name)
            return {"output": "", "error": str(e), "success": False}

    def get_definitions(self) -> list[dict]:
        return [d.to_openai_definition() for d in self._tools.values()]

    def _compile_handler(self, code: str) -> Callable:
        async def _handler(**kwargs: Any) -> str:
            proc = await asyncio.create_subprocess_exec(
                "python3", "-c", code,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdin_data = json.dumps(kwargs).encode()
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(input=stdin_data), timeout=30
            )
            if proc.returncode != 0:
                raise RuntimeError(stderr.decode())
            return stdout.decode()

        return _handler
