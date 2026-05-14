from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any

from engine.llm import LLMProvider

log = logging.getLogger("mix.decomposer")

DECOMPOSITION_SYSTEM_PROMPT = """\
You are a task decomposition assistant. Given a complex task, break it into
smaller independent subtasks.  For each subtask return a JSON object with:
- id: a short unique identifier (e.g. "sub1")
- description: what the subtask should accomplish
- agent_hint: the type of agent best suited (e.g. "coder", "researcher", "analyst", "general")
- dependencies: list of subtask ids this subtask depends on (empty list if none)

Return a JSON array of subtask objects.  Keep the total count within the requested limit.
Only output valid JSON — no markdown fences, no commentary.
"""


@dataclass
class Subtask:
    id: str
    description: str
    agent_hint: str = "general"
    dependencies: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "description": self.description,
            "agent_hint": self.agent_hint,
            "dependencies": list(self.dependencies),
        }


class TaskDecomposer:
    """Break complex tasks into smaller subtasks.

    Uses an LLM provider when available; falls back to a single-subtask
    decomposition when the provider is absent or fails.
    """

    def __init__(self, provider: LLMProvider | None = None) -> None:
        self._provider = provider

    async def decompose(self, task: str, max_subtasks: int = 5) -> list[Subtask]:
        """Decompose *task* into at most *max_subtasks* subtasks."""
        if self._provider is not None:
            try:
                return await self._decompose_with_llm(task, max_subtasks)
            except Exception:
                log.exception("LLM decomposition failed, using fallback")

        return self._fallback(task)

    async def _decompose_with_llm(self, task: str, max_subtasks: int) -> list[Subtask]:
        messages = [
            {"role": "system", "content": DECOMPOSITION_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (f"Task: {task}\n\nMaximum subtasks: {max_subtasks}\n\nReturn the JSON array now."),
            },
        ]

        assert self._provider is not None  # guarded by caller
        response = await self._provider.complete(messages=messages, tools=None)
        content: str = response.get("content", "")

        # Strip markdown fences if the model wraps them
        content = content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:])
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

        parsed = json.loads(content)
        if not isinstance(parsed, list):
            raise ValueError("LLM did not return a JSON array")

        subtasks: list[Subtask] = []
        for item in parsed[:max_subtasks]:
            subtasks.append(
                Subtask(
                    id=item.get("id", f"sub{len(subtasks) + 1}"),
                    description=item.get("description", ""),
                    agent_hint=item.get("agent_hint", "general"),
                    dependencies=list(item.get("dependencies", [])),
                )
            )

        return subtasks

    @staticmethod
    def _fallback(task: str) -> list[Subtask]:
        """Create a single subtask wrapping the entire task."""
        return [
            Subtask(
                id="sub1",
                description=task,
                agent_hint="general",
                dependencies=[],
            )
        ]
