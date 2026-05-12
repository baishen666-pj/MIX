from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable


HookCallback = Callable[..., Awaitable[Any]]


@dataclass
class PluginContext:
    config: Any = None
    memory: Any = None
    tools: Any = None
    skill_registry: Any = None
    _hooks: dict[str, list[HookCallback]] = field(default_factory=dict)

    def on(self, event: str, callback: HookCallback) -> None:
        if event not in self._hooks:
            self._hooks[event] = []
        self._hooks[event].append(callback)

    async def emit(self, event: str, *args: Any, **kwargs: Any) -> list[Any]:
        results = []
        for cb in self._hooks.get(event, []):
            result = await cb(*args, **kwargs)
            results.append(result)
        return results

    def has_hooks(self, event: str) -> bool:
        return bool(self._hooks.get(event))

    def clear(self) -> None:
        self._hooks.clear()


VALID_HOOKS = {"on_load", "on_unload", "on_message", "before_chat", "after_chat"}
VALID_PERMISSIONS = {"read", "write", "execute"}
