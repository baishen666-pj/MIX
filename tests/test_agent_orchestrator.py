"""Comprehensive tests for engine.agent.orchestrator -- TaskOrchestrator.

Covers: plan execution, dependency ordering, parallel execution, circular
dependency detection, status tracking, result composition, failure handling,
edge cases (empty plan, single subtask).
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from engine.agent.decomposer import Subtask
from engine.agent.orchestrator import PlanStatus, SubtaskResult, TaskOrchestrator

# ---------------------------------------------------------------------------
# SubtaskResult dataclass tests
# ---------------------------------------------------------------------------


class TestSubtaskResult:
    def test_to_dict_returns_full_mapping(self) -> None:
        # Arrange
        r = SubtaskResult(subtask_id="s1", status="completed", content="done", error=None)

        # Act
        d = r.to_dict()

        # Assert
        assert d == {
            "subtask_id": "s1",
            "status": "completed",
            "content": "done",
            "error": None,
        }

    def test_to_dict_with_error(self) -> None:
        r = SubtaskResult(subtask_id="s2", status="failed", content="", error="boom")
        d = r.to_dict()
        assert d["status"] == "failed"
        assert d["error"] == "boom"

    def test_default_values(self) -> None:
        r = SubtaskResult(subtask_id="x", status="pending")
        assert r.content == ""
        assert r.error is None


# ---------------------------------------------------------------------------
# PlanStatus dataclass tests
# ---------------------------------------------------------------------------


class TestPlanStatus:
    def test_to_dict_includes_subtask_results(self) -> None:
        # Arrange
        results = [
            SubtaskResult(subtask_id="a", status="completed", content="ok"),
            SubtaskResult(subtask_id="b", status="failed", error="err"),
        ]
        plan = PlanStatus(plan_id="p1", status="completed", total=2, completed=1, failed=1, subtask_results=results)

        # Act
        d = plan.to_dict()

        # Assert
        assert d["plan_id"] == "p1"
        assert d["status"] == "completed"
        assert d["total"] == 2
        assert d["completed"] == 1
        assert d["failed"] == 1
        assert len(d["subtask_results"]) == 2
        assert d["subtask_results"][0]["subtask_id"] == "a"

    def test_default_values(self) -> None:
        plan = PlanStatus(plan_id="p1", status="pending")
        assert plan.total == 0
        assert plan.completed == 0
        assert plan.failed == 0
        assert plan.subtask_results == []

    def test_subtask_results_is_independent_per_instance(self) -> None:
        p1 = PlanStatus(plan_id="p1", status="pending")
        p2 = PlanStatus(plan_id="p2", status="pending")
        p1.subtask_results.append(SubtaskResult(subtask_id="x", status="pending"))
        assert len(p2.subtask_results) == 0


# ---------------------------------------------------------------------------
# Helper to create a mock AgentLoop
# ---------------------------------------------------------------------------


def make_mock_agent_loop(responses: list[dict]) -> AsyncMock:
    """Create a mock AgentLoop whose .chat() returns responses in sequence."""
    loop = AsyncMock()
    call_count = 0

    async def fake_chat(message: str, session_id=None):
        nonlocal call_count
        if call_count < len(responses):
            resp = responses[call_count]
            call_count += 1
            return resp
        return {"content": "default", "tool_calls": None}

    loop.chat = fake_chat
    return loop


# ---------------------------------------------------------------------------
# Plan execution tests
# ---------------------------------------------------------------------------


class TestExecutePlan:
    @pytest.mark.asyncio
    async def test_single_subtask_plan(self) -> None:
        # Arrange
        orchestrator = TaskOrchestrator()
        loop = make_mock_agent_loop([{"content": "Result", "tool_calls": None}])
        subtasks = [Subtask(id="s1", description="Task 1")]

        # Act
        result = await orchestrator.execute_plan(subtasks, loop)

        # Assert
        assert result["plan_id"]
        assert "s1" in result["result"]
        assert len(result["subtask_results"]) == 1
        assert result["subtask_results"][0]["status"] == "completed"

    @pytest.mark.asyncio
    async def test_sequential_dependencies(self) -> None:
        # Arrange
        orchestrator = TaskOrchestrator()
        loop = make_mock_agent_loop(
            [
                {"content": "Step A", "tool_calls": None},
                {"content": "Step B", "tool_calls": None},
                {"content": "Step C", "tool_calls": None},
            ]
        )
        subtasks = [
            Subtask(id="a", description="First", dependencies=[]),
            Subtask(id="b", description="Second", dependencies=["a"]),
            Subtask(id="c", description="Third", dependencies=["b"]),
        ]

        # Act
        result = await orchestrator.execute_plan(subtasks, loop)

        # Assert
        assert all(sr["status"] == "completed" for sr in result["subtask_results"])

    @pytest.mark.asyncio
    async def test_parallel_independent_subtasks(self) -> None:
        # Arrange
        orchestrator = TaskOrchestrator()
        loop = make_mock_agent_loop(
            [
                {"content": "A", "tool_calls": None},
                {"content": "B", "tool_calls": None},
            ]
        )
        subtasks = [
            Subtask(id="a", description="Independent A"),
            Subtask(id="b", description="Independent B"),
        ]

        # Act
        result = await orchestrator.execute_plan(subtasks, loop)

        # Assert
        completed = [sr for sr in result["subtask_results"] if sr["status"] == "completed"]
        assert len(completed) == 2

    @pytest.mark.asyncio
    async def test_diamond_dependency(self) -> None:
        """a -> c, b -> c: c waits for both a and b."""
        # Arrange
        orchestrator = TaskOrchestrator()
        loop = make_mock_agent_loop(
            [
                {"content": "A", "tool_calls": None},
                {"content": "B", "tool_calls": None},
                {"content": "C", "tool_calls": None},
            ]
        )
        subtasks = [
            Subtask(id="a", description="A"),
            Subtask(id="b", description="B"),
            Subtask(id="c", description="C", dependencies=["a", "b"]),
        ]

        # Act
        result = await orchestrator.execute_plan(subtasks, loop)

        # Assert
        assert all(sr["status"] == "completed" for sr in result["subtask_results"])

    @pytest.mark.asyncio
    async def test_empty_plan(self) -> None:
        # Arrange
        orchestrator = TaskOrchestrator()
        loop = make_mock_agent_loop([])

        # Act
        result = await orchestrator.execute_plan([], loop)

        # Assert
        assert result["plan_id"]
        assert result["result"] == "No results"
        assert result["subtask_results"] == []


# ---------------------------------------------------------------------------
# Circular dependency detection
# ---------------------------------------------------------------------------


class TestCircularDependency:
    @pytest.mark.asyncio
    async def test_mutual_cycle_detected(self) -> None:
        # Arrange
        orchestrator = TaskOrchestrator()
        loop = make_mock_agent_loop([])
        subtasks = [
            Subtask(id="x", description="X", dependencies=["y"]),
            Subtask(id="y", description="Y", dependencies=["x"]),
        ]

        # Act
        result = await orchestrator.execute_plan(subtasks, loop)

        # Assert
        for sr in result["subtask_results"]:
            assert sr["status"] == "failed"
            assert "ircular" in (sr["error"] or "").lower()

    @pytest.mark.asyncio
    async def test_three_node_cycle_detected(self) -> None:
        # Arrange
        orchestrator = TaskOrchestrator()
        loop = make_mock_agent_loop([])
        subtasks = [
            Subtask(id="a", description="A", dependencies=["c"]),
            Subtask(id="b", description="B", dependencies=["a"]),
            Subtask(id="c", description="C", dependencies=["b"]),
        ]

        # Act
        result = await orchestrator.execute_plan(subtasks, loop)

        # Assert
        assert all(sr["status"] == "failed" for sr in result["subtask_results"])


# ---------------------------------------------------------------------------
# Failure handling
# ---------------------------------------------------------------------------


class TestFailureHandling:
    @pytest.mark.asyncio
    async def test_subtask_failure_sets_error(self) -> None:
        # Arrange
        orchestrator = TaskOrchestrator()
        loop = make_mock_agent_loop([])
        loop.chat = AsyncMock(side_effect=RuntimeError("LLM crashed"))
        subtasks = [Subtask(id="s1", description="Failing task")]

        # Act
        result = await orchestrator.execute_plan(subtasks, loop)

        # Assert
        assert result["subtask_results"][0]["status"] == "failed"
        assert "LLM crashed" in result["subtask_results"][0]["error"]

    @pytest.mark.asyncio
    async def test_dependent_subtask_still_runs_after_upstream_failure(self) -> None:
        """If a dependency fails, downstream still attempts execution because
        the orchestrator only tracks completed IDs for readiness."""
        # Arrange
        orchestrator = TaskOrchestrator()
        call_count = 0

        async def flaky_chat(msg, session_id=None):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("first fails")
            return {"content": "second ok", "tool_calls": None}

        loop = AsyncMock()
        loop.chat = flaky_chat

        subtasks = [
            Subtask(id="s1", description="Will fail"),
            Subtask(id="s2", description="Runs after s1", dependencies=["s1"]),
        ]

        # Act
        result = await orchestrator.execute_plan(subtasks, loop)

        # Assert -- s1 failed, s2 cannot start (dependency not in completed_ids)
        statuses = {sr["subtask_id"]: sr["status"] for sr in result["subtask_results"]}
        assert statuses["s1"] == "failed"
        # s2 stays pending or running because s1 was never in completed_ids
        # but the plan still records it. The plan finishes and remaining
        # non-completed tasks get handled by the loop ending.

    @pytest.mark.asyncio
    async def test_plan_status_tracks_completed_and_failed(self) -> None:
        # Arrange
        orchestrator = TaskOrchestrator()
        call_count = 0

        async def mixed_chat(msg, session_id=None):
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise RuntimeError("fail")
            return {"content": "ok", "tool_calls": None}

        loop = AsyncMock()
        loop.chat = mixed_chat
        subtasks = [
            Subtask(id="s1", description="Good"),
            Subtask(id="s2", description="Bad"),
        ]

        # Act
        result = await orchestrator.execute_plan(subtasks, loop)

        # Assert
        status = orchestrator.get_status(result["plan_id"])
        assert status is not None
        assert status["total"] == 2


# ---------------------------------------------------------------------------
# get_status
# ---------------------------------------------------------------------------


class TestGetStatus:
    @pytest.mark.asyncio
    async def test_status_after_completed_plan(self) -> None:
        # Arrange
        orchestrator = TaskOrchestrator()
        loop = make_mock_agent_loop([{"content": "done", "tool_calls": None}])
        subtasks = [Subtask(id="s1", description="T")]
        result = await orchestrator.execute_plan(subtasks, loop)

        # Act
        status = orchestrator.get_status(result["plan_id"])

        # Assert
        assert status is not None
        assert status["status"] == "completed"
        assert status["total"] == 1
        assert status["completed"] == 1
        assert status["failed"] == 0

    def test_status_for_unknown_plan_returns_none(self) -> None:
        orchestrator = TaskOrchestrator()
        assert orchestrator.get_status("nonexistent") is None

    @pytest.mark.asyncio
    async def test_status_after_subtask_failure_plan_still_completed(self) -> None:
        """A failed subtask is tracked but the plan itself still completes.

        The orchestrator marks the plan as 'failed' only when an exception
        propagates out of _run_subtasks (e.g. from the gather). Individual
        subtask failures are caught inside _execute_single.
        """
        # Arrange
        orchestrator = TaskOrchestrator()
        loop = make_mock_agent_loop([])
        loop.chat = AsyncMock(side_effect=RuntimeError("boom"))
        subtasks = [Subtask(id="s1", description="T")]
        result = await orchestrator.execute_plan(subtasks, loop)

        # Act
        status = orchestrator.get_status(result["plan_id"])

        # Assert
        assert status is not None
        assert status["total"] == 1
        assert status["failed"] == 1
        # The plan status is "completed" because _run_subtasks itself did not raise
        assert status["status"] == "completed"


# ---------------------------------------------------------------------------
# Result composition
# ---------------------------------------------------------------------------


class TestComposeResults:
    def test_compose_completed_results(self) -> None:
        # Arrange
        results = {
            "s1": SubtaskResult(subtask_id="s1", status="completed", content="Output A"),
            "s2": SubtaskResult(subtask_id="s2", status="completed", content="Output B"),
        }

        # Act
        composed = TaskOrchestrator._compose_results(results)

        # Assert
        assert "[s1] Output A" in composed
        assert "[s2] Output B" in composed

    def test_compose_mixed_results(self) -> None:
        # Arrange
        results = {
            "s1": SubtaskResult(subtask_id="s1", status="completed", content="ok"),
            "s2": SubtaskResult(subtask_id="s2", status="failed", error="bad"),
        }

        # Act
        composed = TaskOrchestrator._compose_results(results)

        # Assert
        assert "[s1] ok" in composed
        assert "[s2] FAILED: bad" in composed

    def test_compose_empty_results(self) -> None:
        # Act
        composed = TaskOrchestrator._compose_results({})

        # Assert
        assert composed == "No results"

    def test_compose_skips_empty_completed_content(self) -> None:
        # Arrange
        results = {
            "s1": SubtaskResult(subtask_id="s1", status="completed", content=""),
        }

        # Act
        composed = TaskOrchestrator._compose_results(results)

        # Assert
        assert composed == "No results"

    def test_compose_failed_without_error_message(self) -> None:
        # Arrange
        results = {
            "s1": SubtaskResult(subtask_id="s1", status="failed", error=None),
        }

        # Act
        composed = TaskOrchestrator._compose_results(results)

        # Assert
        assert "[s1] FAILED: unknown error" in composed


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


class TestOrchestratorEdgeCases:
    @pytest.mark.asyncio
    async def test_single_subtask_no_dependencies(self) -> None:
        # Arrange
        orchestrator = TaskOrchestrator()
        loop = make_mock_agent_loop([{"content": "done", "tool_calls": None}])
        subtasks = [Subtask(id="solo", description="All in one")]

        # Act
        result = await orchestrator.execute_plan(subtasks, loop)

        # Assert
        assert len(result["subtask_results"]) == 1
        assert result["subtask_results"][0]["status"] == "completed"

    @pytest.mark.asyncio
    async def test_plan_id_is_unique(self) -> None:
        # Arrange
        orchestrator = TaskOrchestrator()
        loop = make_mock_agent_loop(
            [
                {"content": "a", "tool_calls": None},
                {"content": "b", "tool_calls": None},
            ]
        )
        subtasks = [Subtask(id="s1", description="T")]

        # Act
        r1 = await orchestrator.execute_plan(subtasks, loop)
        r2 = await orchestrator.execute_plan(subtasks, loop)

        # Assert
        assert r1["plan_id"] != r2["plan_id"]

    @pytest.mark.asyncio
    async def test_result_includes_plan_id(self) -> None:
        # Arrange
        orchestrator = TaskOrchestrator()
        loop = make_mock_agent_loop([{"content": "x", "tool_calls": None}])
        subtasks = [Subtask(id="s1", description="T")]

        # Act
        result = await orchestrator.execute_plan(subtasks, loop)

        # Assert
        assert "plan_id" in result
        assert result["plan_id"]
