from __future__ import annotations

import ast
import asyncio
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

log = logging.getLogger("mix.dynamic_tools")

_BLOCKED_IMPORTS = frozenset(
    {
        "os",
        "sys",
        "subprocess",
        "socket",
        "shutil",
        "pathlib",
        "ctypes",
        "multiprocessing",
        "importlib",
        "pickle",
        "shelve",
        "marshal",
        "code",
        "codeop",
        "compileall",
        "pty",
        "fcntl",
        "resource",
        "signal",
    }
)

_BLOCKED_ATTRS = frozenset(
    {
        "__import__",
        "__builtins__",
        "__code__",
        "__globals__",
        "__locals__",
        "__class__",
        "__subclasses__",
        "__bases__",
        "__mro__",
    }
)


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

    @staticmethod
    def _analyze_danger_level(handler_code: str) -> str:
        """Server-side danger level analysis based on code patterns."""
        code_lower = handler_code.lower()
        dangerous_patterns = [
            "subprocess",
            "os.system",
            "os.exec",
            "eval(",
            "exec(",
            "open(",
            "socket",
            "http",
            "request",
            "fetch",
            "file",
            "write",
            "delete",
            "remove",
            "rmdir",
            "import",
            "__",
            "compile(",
        ]
        moderate_patterns = [
            "requests",
            "urllib",
            "httpx",
            "aiohttp",
            "json.loads",
            "json.dumps",
            "read",
            "write",
        ]
        danger_score = sum(1 for p in dangerous_patterns if p in code_lower)
        moderate_score = sum(1 for p in moderate_patterns if p in code_lower)

        if danger_score >= 2:
            return "dangerous"
        if danger_score >= 1 or moderate_score >= 2:
            return "moderate"
        return "safe"

    async def register(self, definition: DynamicToolDef) -> None:
        actual_level = self._analyze_danger_level(definition.handler_code)
        definition.danger_level = actual_level
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
        self._validate_code(code)

        async def _handler(**kwargs: Any) -> str:
            proc = None
            try:
                proc = await asyncio.create_subprocess_exec(
                    "python3",
                    "-c",
                    code,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdin_data = json.dumps(kwargs).encode()
                stdout, stderr = await asyncio.wait_for(proc.communicate(input=stdin_data), timeout=30)
                if proc.returncode != 0:
                    raise RuntimeError(stderr.decode())
                return stdout.decode()
            except asyncio.TimeoutError:
                if proc is not None:
                    proc.kill()
                    await proc.wait()
                raise RuntimeError("Dynamic tool execution timed out after 30s")

        return _handler

    def _validate_code(self, code: str) -> None:
        """Reject dynamic tool code that imports dangerous modules or uses unsafe builtins."""
        try:
            tree = ast.parse(code)
        except SyntaxError as exc:
            raise ValueError(f"Invalid Python syntax in handler code: {exc}") from exc

        _blocked_builtins = frozenset({"__import__", "eval", "exec", "compile", "open", "breakpoint", "input"})

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                names = [alias.name.split(".")[0] for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                names = [node.module.split(".")[0]] if node.module else []
            else:
                names = []

            blocked = _BLOCKED_IMPORTS.intersection(names)
            if blocked:
                raise ValueError(f"Handler code imports blocked module(s): {', '.join(sorted(blocked))}")

            if isinstance(node, ast.Call):
                func = node.func
                if isinstance(func, ast.Name) and func.id in _blocked_builtins:
                    raise ValueError(f"Handler code uses blocked builtin: {func.id}")
                if (
                    isinstance(func, ast.Attribute)
                    and isinstance(func.value, ast.Name)
                    and func.value.id == "builtins"
                    and func.attr in _blocked_builtins
                ):
                    raise ValueError(f"Handler code uses blocked builtin: builtins.{func.attr}")

            if isinstance(node, ast.Attribute) and node.attr in _BLOCKED_ATTRS:
                raise ValueError(f"Handler code accesses blocked attribute: {node.attr}")

            if isinstance(node, ast.Name) and node.id in _BLOCKED_ATTRS:
                raise ValueError(f"Handler code references blocked name: {node.id}")

            if isinstance(node, ast.Subscript) and isinstance(node.value, ast.Name):
                if node.value.id in ("globals", "locals", "vars"):
                    raise ValueError(f"Handler code uses blocked function as subscript: {node.value.id}")
