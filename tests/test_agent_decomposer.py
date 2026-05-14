"""Comprehensive tests for engine.agent.decomposer -- TaskDecomposer.

Covers: fallback decomposition, LLM-based decomposition, markdown fence
stripping, max_subtasks enforcement, JSON error handling, edge cases
with empty/malformed LLM output.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from engine.agent.decomposer import Subtask, TaskDecomposer

# ---------------------------------------------------------------------------
# Subtask dataclass tests
# ---------------------------------------------------------------------------


class TestSubtask:
    def test_to_dict_returns_complete_mapping(self) -> None:
        # Arrange
        s = Subtask(id="s1", description="Do thing", agent_hint="coder", dependencies=["s0"])

        # Act
        d = s.to_dict()

        # Assert
        assert d == {
            "id": "s1",
            "description": "Do thing",
            "agent_hint": "coder",
            "dependencies": ["s0"],
        }

    def test_to_dict_dependencies_is_new_list(self) -> None:
        # Arrange
        deps = ["a", "b"]
        s = Subtask(id="s1", description="t", dependencies=deps)

        # Act
        d = s.to_dict()
        d["dependencies"].append("c")

        # Assert -- original not mutated
        assert deps == ["a", "b"]

    def test_default_agent_hint_is_general(self) -> None:
        s = Subtask(id="x", description="y")
        assert s.agent_hint == "general"

    def test_default_dependencies_is_empty(self) -> None:
        s = Subtask(id="x", description="y")
        assert s.dependencies == []

    def test_default_dependencies_is_independent(self) -> None:
        """Each instance gets its own list, not a shared one."""
        s1 = Subtask(id="a", description="a")
        s2 = Subtask(id="b", description="b")
        s1.dependencies.append("x")
        assert s2.dependencies == []


# ---------------------------------------------------------------------------
# Fallback decomposition (no provider)
# ---------------------------------------------------------------------------


class TestFallbackDecomposition:
    @pytest.mark.asyncio
    async def test_no_provider_returns_single_subtask(self) -> None:
        # Arrange
        decomposer = TaskDecomposer(provider=None)

        # Act
        subtasks = await decomposer.decompose("Build a REST API")

        # Assert
        assert len(subtasks) == 1
        assert subtasks[0].id == "sub1"
        assert subtasks[0].description == "Build a REST API"
        assert subtasks[0].agent_hint == "general"
        assert subtasks[0].dependencies == []

    @pytest.mark.asyncio
    async def test_empty_task_string(self) -> None:
        # Arrange
        decomposer = TaskDecomposer(provider=None)

        # Act
        subtasks = await decomposer.decompose("")

        # Assert
        assert len(subtasks) == 1
        assert subtasks[0].description == ""

    @pytest.mark.asyncio
    async def test_max_subtasks_ignored_in_fallback(self) -> None:
        # Arrange
        decomposer = TaskDecomposer(provider=None)

        # Act -- fallback always produces a single subtask regardless of max
        subtasks = await decomposer.decompose("Task", max_subtasks=10)

        # Assert
        assert len(subtasks) == 1

    @pytest.mark.asyncio
    async def test_fallback_on_llm_exception(self) -> None:
        # Arrange
        failing = MagicMock()
        failing.complete = AsyncMock(side_effect=RuntimeError("API unreachable"))
        decomposer = TaskDecomposer(provider=failing)

        # Act
        subtasks = await decomposer.decompose("Complex task")

        # Assert
        assert len(subtasks) == 1
        assert subtasks[0].description == "Complex task"

    @pytest.mark.asyncio
    async def test_fallback_on_json_parse_error(self) -> None:
        # Arrange
        provider = MagicMock()
        provider.complete = AsyncMock(return_value={"content": "not json at all", "tool_calls": None})
        decomposer = TaskDecomposer(provider=provider)

        # Act
        subtasks = await decomposer.decompose("Task")

        # Assert -- falls back to single subtask
        assert len(subtasks) == 1
        assert subtasks[0].description == "Task"

    @pytest.mark.asyncio
    async def test_fallback_on_non_array_json(self) -> None:
        # Arrange -- LLM returns a JSON object instead of array
        provider = MagicMock()
        provider.complete = AsyncMock(return_value={"content": '{"id": "sub1"}', "tool_calls": None})
        decomposer = TaskDecomposer(provider=provider)

        # Act
        subtasks = await decomposer.decompose("Task")

        # Assert
        assert len(subtasks) == 1
        assert subtasks[0].id == "sub1"


# ---------------------------------------------------------------------------
# LLM-based decomposition
# ---------------------------------------------------------------------------


class FakeProvider:
    """Synchronous mock that returns canned responses."""

    def __init__(self, responses: list[dict]) -> None:
        self._responses = list(responses)
        self._call_count = 0

    async def complete(self, **kwargs) -> dict:
        if self._call_count < len(self._responses):
            resp = self._responses[self._call_count]
            self._call_count += 1
            return resp
        return {"content": "fallback", "tool_calls": None}

    async def stream(self, **kwargs):
        yield {"delta": "fallback", "done": True}


class TestLLMDecomposition:
    @pytest.mark.asyncio
    async def test_basic_decomposition(self) -> None:
        # Arrange
        llm_response = {
            "content": json.dumps(
                [
                    {"id": "sub1", "description": "Research", "agent_hint": "researcher", "dependencies": []},
                    {"id": "sub2", "description": "Code", "agent_hint": "coder", "dependencies": ["sub1"]},
                ]
            ),
            "tool_calls": None,
        }
        decomposer = TaskDecomposer(provider=FakeProvider([llm_response]))

        # Act
        subtasks = await decomposer.decompose("Build feature")

        # Assert
        assert len(subtasks) == 2
        assert subtasks[0].id == "sub1"
        assert subtasks[0].agent_hint == "researcher"
        assert subtasks[1].dependencies == ["sub1"]

    @pytest.mark.asyncio
    async def test_max_subtasks_truncates_result(self) -> None:
        # Arrange
        items = [
            {"id": f"s{i}", "description": f"Task {i}", "agent_hint": "general", "dependencies": []} for i in range(10)
        ]
        llm_response = {"content": json.dumps(items), "tool_calls": None}
        decomposer = TaskDecomposer(provider=FakeProvider([llm_response]))

        # Act
        subtasks = await decomposer.decompose("Big task", max_subtasks=3)

        # Assert
        assert len(subtasks) == 3

    @pytest.mark.asyncio
    async def test_missing_fields_use_defaults(self) -> None:
        # Arrange -- LLM returns items with missing optional fields
        llm_response = {
            "content": json.dumps(
                [
                    {"description": "Just a description"},
                    {"id": "s2"},
                ]
            ),
            "tool_calls": None,
        }
        decomposer = TaskDecomposer(provider=FakeProvider([llm_response]))

        # Act
        subtasks = await decomposer.decompose("Task")

        # Assert
        assert len(subtasks) == 2
        assert subtasks[0].id == "sub1"
        assert subtasks[0].description == "Just a description"
        assert subtasks[0].agent_hint == "general"
        assert subtasks[0].dependencies == []
        assert subtasks[1].id == "s2"
        assert subtasks[1].description == ""

    @pytest.mark.asyncio
    async def test_markdown_fences_stripped(self) -> None:
        # Arrange
        raw_json = json.dumps(
            [
                {"id": "sub1", "description": "Do it", "agent_hint": "general", "dependencies": []},
            ]
        )
        llm_response = {
            "content": f"```json\n{raw_json}\n```",
            "tool_calls": None,
        }
        decomposer = TaskDecomposer(provider=FakeProvider([llm_response]))

        # Act
        subtasks = await decomposer.decompose("Task")

        # Assert
        assert len(subtasks) == 1
        assert subtasks[0].description == "Do it"

    @pytest.mark.asyncio
    async def test_markdown_fence_without_language(self) -> None:
        # Arrange
        raw_json = json.dumps(
            [
                {"id": "sub1", "description": "Work", "agent_hint": "general", "dependencies": []},
            ]
        )
        llm_response = {
            "content": f"```\n{raw_json}\n```",
            "tool_calls": None,
        }
        decomposer = TaskDecomposer(provider=FakeProvider([llm_response]))

        # Act
        subtasks = await decomposer.decompose("Task")

        # Assert
        assert len(subtasks) == 1
        assert subtasks[0].description == "Work"

    @pytest.mark.asyncio
    async def test_llm_receives_correct_prompt(self) -> None:
        # Arrange
        received_kwargs: dict = {}

        class CapturingProvider:
            async def complete(self, **kwargs) -> dict:
                received_kwargs.update(kwargs)
                return {"content": "[]", "tool_calls": None}

            async def stream(self, **kwargs):
                yield {"delta": "", "done": True}

        decomposer = TaskDecomposer(provider=CapturingProvider())

        # Act
        await decomposer.decompose("Test task", max_subtasks=7)

        # Assert
        messages = received_kwargs.get("messages", [])
        assert len(messages) == 2
        assert messages[0]["role"] == "system"
        assert "decomposition" in messages[0]["content"].lower()
        assert messages[1]["role"] == "user"
        assert "Test task" in messages[1]["content"]
        assert "7" in messages[1]["content"]

    @pytest.mark.asyncio
    async def test_empty_array_response(self) -> None:
        # Arrange -- LLM returns valid but empty JSON array
        llm_response = {"content": "[]", "tool_calls": None}
        decomposer = TaskDecomposer(provider=FakeProvider([llm_response]))

        # Act
        subtasks = await decomposer.decompose("Task")

        # Assert
        assert len(subtasks) == 0


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


class TestDecomposerEdgeCases:
    @pytest.mark.asyncio
    async def test_unicode_task_description(self) -> None:
        # Arrange
        decomposer = TaskDecomposer(provider=None)

        # Act
        subtasks = await decomposer.decompose("Build a feature with emojis")

        # Assert
        assert len(subtasks) == 1
        assert subtasks[0].description == "Build a feature with emojis"

    @pytest.mark.asyncio
    async def test_very_long_task_description(self) -> None:
        # Arrange
        long_task = "A" * 10000
        decomposer = TaskDecomposer(provider=None)

        # Act
        subtasks = await decomposer.decompose(long_task)

        # Assert
        assert len(subtasks) == 1
        assert subtasks[0].description == long_task

    @pytest.mark.asyncio
    async def test_max_subtasks_one(self) -> None:
        # Arrange
        items = [{"id": f"s{i}", "description": f"T{i}", "agent_hint": "general", "dependencies": []} for i in range(5)]
        llm_response = {"content": json.dumps(items), "tool_calls": None}
        decomposer = TaskDecomposer(provider=FakeProvider([llm_response]))

        # Act
        subtasks = await decomposer.decompose("Task", max_subtasks=1)

        # Assert
        assert len(subtasks) == 1

    @pytest.mark.asyncio
    async def test_subtask_dependencies_preserved(self) -> None:
        # Arrange
        llm_response = {
            "content": json.dumps(
                [
                    {"id": "a", "description": "A", "dependencies": []},
                    {"id": "b", "description": "B", "dependencies": ["a"]},
                    {"id": "c", "description": "C", "dependencies": ["a", "b"]},
                ]
            ),
            "tool_calls": None,
        }
        decomposer = TaskDecomposer(provider=FakeProvider([llm_response]))

        # Act
        subtasks = await decomposer.decompose("Task")

        # Assert
        assert subtasks[0].dependencies == []
        assert subtasks[1].dependencies == ["a"]
        assert subtasks[2].dependencies == ["a", "b"]
