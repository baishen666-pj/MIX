"""Tests for multi-agent communication: AgentBus, TaskDecomposer, TaskOrchestrator, and API endpoints."""

from __future__ import annotations

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from engine.agent.bus import AgentBus, BusMessage
from engine.agent.decomposer import TaskDecomposer, Subtask
from engine.agent.orchestrator import TaskOrchestrator, SubtaskResult, PlanStatus
from engine.agent.loop import AgentLoop
from engine.config import MixConfig, ProviderConfig, EngineConfig, MemoryConfig


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_config() -> MixConfig:
    return MixConfig(
        engine=EngineConfig(),
        llm=ProviderConfig(provider="openai", model="gpt-4o", api_key="test"),
        memory=MemoryConfig(),
    )


class MockProvider:
    """Minimal mock LLM provider for tests."""

    def __init__(self, responses: list[dict] | None = None) -> None:
        self._responses = list(responses or [])
        self._call_count = 0

    async def complete(self, **kwargs) -> dict:
        if self._call_count < len(self._responses):
            resp = self._responses[self._call_count]
            self._call_count += 1
            return resp
        return {"content": "fallback", "tool_calls": None}

    async def stream(self, **kwargs):
        yield {"delta": "fallback", "done": True}


# ---------------------------------------------------------------------------
# AgentBus tests
# ---------------------------------------------------------------------------

class TestAgentBus:

    @pytest.mark.asyncio
    async def test_publish_subscribe_exact_channel(self) -> None:
        bus = AgentBus()
        received: list[BusMessage] = []

        async def handler(msg: BusMessage) -> None:
            received.append(msg)

        bus.subscribe("agent.chat", handler)
        await bus.publish("agent.chat", {"text": "hello"}, sender="bot1")

        # Allow dispatch task to run
        await asyncio.sleep(0.05)

        assert len(received) == 1
        assert received[0].payload["text"] == "hello"
        assert received[0].sender == "bot1"

    @pytest.mark.asyncio
    async def test_wildcard_subscription(self) -> None:
        bus = AgentBus()
        received: list[BusMessage] = []

        async def handler(msg: BusMessage) -> None:
            received.append(msg)

        bus.subscribe("agent.*", handler)
        await bus.publish("agent.chat", {"text": "hi"})
        await bus.publish("agent.tool", {"name": "bash"})
        await bus.publish("system.error", {"msg": "oops"})

        await asyncio.sleep(0.05)

        # Only agent.* channels should be delivered
        assert len(received) == 2
        channels = {m.channel for m in received}
        assert channels == {"agent.chat", "agent.tool"}

    @pytest.mark.asyncio
    async def test_unsubscribe(self) -> None:
        bus = AgentBus()
        received: list[BusMessage] = []

        async def handler(msg: BusMessage) -> None:
            received.append(msg)

        bus.subscribe("test.ch", handler)
        await bus.publish("test.ch", {"n": 1})
        await asyncio.sleep(0.05)

        bus.unsubscribe("test.ch", handler)
        await bus.publish("test.ch", {"n": 2})
        await asyncio.sleep(0.05)

        assert len(received) == 1

    @pytest.mark.asyncio
    async def test_list_channels(self) -> None:
        bus = AgentBus()

        async def noop(msg: BusMessage) -> None:
            pass

        bus.subscribe("alpha", noop)
        bus.subscribe("beta", noop)
        bus.subscribe("gamma", noop)

        channels = bus.list_channels()
        assert channels == ["alpha", "beta", "gamma"]

    @pytest.mark.asyncio
    async def test_subscriber_count(self) -> None:
        bus = AgentBus()

        async def noop(msg: BusMessage) -> None:
            pass

        bus.subscribe("ch", noop)
        bus.subscribe("ch", noop)
        assert bus.subscriber_count("ch") == 2
        assert bus.subscriber_count("other") == 0

    @pytest.mark.asyncio
    async def test_no_subscribers_no_error(self) -> None:
        bus = AgentBus()
        # Publishing to a channel with no subscribers should not raise
        await bus.publish("orphan", {"data": 42})

    @pytest.mark.asyncio
    async def test_handler_exception_does_not_block(self) -> None:
        bus = AgentBus()
        received: list[BusMessage] = []

        async def bad_handler(msg: BusMessage) -> None:
            raise RuntimeError("boom")

        async def good_handler(msg: BusMessage) -> None:
            received.append(msg)

        bus.subscribe("ch", bad_handler)
        bus.subscribe("ch", good_handler)

        await bus.publish("ch", {"val": 1})
        await asyncio.sleep(0.05)

        assert len(received) == 1


# ---------------------------------------------------------------------------
# TaskDecomposer tests
# ---------------------------------------------------------------------------

class TestTaskDecomposer:

    @pytest.mark.asyncio
    async def test_fallback_without_provider(self) -> None:
        decomposer = TaskDecomposer(provider=None)
        subtasks = await decomposer.decompose("Build a REST API")

        assert len(subtasks) == 1
        assert subtasks[0].id == "sub1"
        assert subtasks[0].description == "Build a REST API"
        assert subtasks[0].agent_hint == "general"
        assert subtasks[0].dependencies == []

    @pytest.mark.asyncio
    async def test_fallback_on_llm_failure(self) -> None:
        failing_provider = MockProvider()
        # Force an exception by making complete raise
        failing_provider.complete = AsyncMock(side_effect=RuntimeError("API down"))

        decomposer = TaskDecomposer(provider=failing_provider)
        subtasks = await decomposer.decompose("Do something complex")

        assert len(subtasks) == 1
        assert subtasks[0].description == "Do something complex"

    @pytest.mark.asyncio
    async def test_llm_decomposition(self) -> None:
        llm_response = {
            "content": json.dumps([
                {"id": "sub1", "description": "Research topic", "agent_hint": "researcher", "dependencies": []},
                {"id": "sub2", "description": "Write code", "agent_hint": "coder", "dependencies": ["sub1"]},
                {"id": "sub3", "description": "Test code", "agent_hint": "tester", "dependencies": ["sub2"]},
            ]),
            "tool_calls": None,
        }
        provider = MockProvider([llm_response])
        decomposer = TaskDecomposer(provider=provider)

        subtasks = await decomposer.decompose("Build a feature", max_subtasks=5)

        assert len(subtasks) == 3
        assert subtasks[0].id == "sub1"
        assert subtasks[0].agent_hint == "researcher"
        assert subtasks[1].dependencies == ["sub1"]
        assert subtasks[2].dependencies == ["sub2"]

    @pytest.mark.asyncio
    async def test_llm_respects_max_subtasks(self) -> None:
        items = [
            {"id": f"sub{i}", "description": f"Task {i}", "agent_hint": "general", "dependencies": []}
            for i in range(10)
        ]
        llm_response = {"content": json.dumps(items), "tool_calls": None}
        provider = MockProvider([llm_response])
        decomposer = TaskDecomposer(provider=provider)

        subtasks = await decomposer.decompose("Big task", max_subtasks=3)
        assert len(subtasks) == 3

    @pytest.mark.asyncio
    async def test_subtask_to_dict(self) -> None:
        s = Subtask(id="s1", description="desc", agent_hint="coder", dependencies=["s0"])
        d = s.to_dict()
        assert d == {
            "id": "s1",
            "description": "desc",
            "agent_hint": "coder",
            "dependencies": ["s0"],
        }

    @pytest.mark.asyncio
    async def test_llm_with_markdown_fences(self) -> None:
        llm_response = {
            "content": "```json\n" + json.dumps([
                {"id": "sub1", "description": "Do it", "agent_hint": "general", "dependencies": []},
            ]) + "\n```",
            "tool_calls": None,
        }
        provider = MockProvider([llm_response])
        decomposer = TaskDecomposer(provider=provider)

        subtasks = await decomposer.decompose("Task with fences")
        assert len(subtasks) == 1
        assert subtasks[0].description == "Do it"


# ---------------------------------------------------------------------------
# TaskOrchestrator tests
# ---------------------------------------------------------------------------

class TestTaskOrchestrator:

    @pytest.mark.asyncio
    async def test_simple_sequential_execution(self) -> None:
        orchestrator = TaskOrchestrator()
        config = make_config()
        loop = AgentLoop(config)
        loop.provider = MockProvider([
            {"content": "Step 1 done", "tool_calls": None},
            {"content": "Step 2 done", "tool_calls": None},
        ])

        subtasks = [
            Subtask(id="s1", description="First step", agent_hint="general", dependencies=[]),
            Subtask(id="s2", description="Second step", agent_hint="general", dependencies=["s1"]),
        ]

        result = await orchestrator.execute_plan(subtasks, loop)

        assert result["plan_id"]
        assert result["result"]
        assert len(result["subtask_results"]) == 2
        for sr in result["subtask_results"]:
            assert sr["status"] == "completed"

    @pytest.mark.asyncio
    async def test_parallel_independent_subtasks(self) -> None:
        orchestrator = TaskOrchestrator()
        config = make_config()
        loop = AgentLoop(config)
        loop.provider = MockProvider([
            {"content": "A done", "tool_calls": None},
            {"content": "B done", "tool_calls": None},
            {"content": "C done", "tool_calls": None},
        ])

        subtasks = [
            Subtask(id="a", description="Task A", dependencies=[]),
            Subtask(id="b", description="Task B", dependencies=[]),
            Subtask(id="c", description="Task C", dependencies=[]),
        ]

        result = await orchestrator.execute_plan(subtasks, loop)

        assert len(result["subtask_results"]) == 3
        completed = [sr for sr in result["subtask_results"] if sr["status"] == "completed"]
        assert len(completed) == 3

    @pytest.mark.asyncio
    async def test_mixed_dependencies(self) -> None:
        """a -> c, b -> c: a and b run in parallel, c waits for both."""
        orchestrator = TaskOrchestrator()
        config = make_config()
        loop = AgentLoop(config)
        loop.provider = MockProvider([
            {"content": "A", "tool_calls": None},
            {"content": "B", "tool_calls": None},
            {"content": "C", "tool_calls": None},
        ])

        subtasks = [
            Subtask(id="a", description="Task A", dependencies=[]),
            Subtask(id="b", description="Task B", dependencies=[]),
            Subtask(id="c", description="Task C", dependencies=["a", "b"]),
        ]

        result = await orchestrator.execute_plan(subtasks, loop)
        assert len(result["subtask_results"]) == 3
        assert all(sr["status"] == "completed" for sr in result["subtask_results"])

    @pytest.mark.asyncio
    async def test_circular_dependency_detection(self) -> None:
        orchestrator = TaskOrchestrator()
        config = make_config()
        loop = AgentLoop(config)
        loop.provider = MockProvider([
            {"content": "X", "tool_calls": None},
        ])

        subtasks = [
            Subtask(id="x", description="Task X", dependencies=["y"]),
            Subtask(id="y", description="Task Y", dependencies=["x"]),
        ]

        result = await orchestrator.execute_plan(subtasks, loop)

        # Both should be marked as failed due to circular dependency
        for sr in result["subtask_results"]:
            assert sr["status"] == "failed"
            assert "ircular" in (sr["error"] or "").lower() or "circular" in (sr["error"] or "").lower()

    @pytest.mark.asyncio
    async def test_get_status(self) -> None:
        orchestrator = TaskOrchestrator()
        config = make_config()
        loop = AgentLoop(config)
        loop.provider = MockProvider([
            {"content": "Done", "tool_calls": None},
        ])

        subtasks = [Subtask(id="s1", description="Task", dependencies=[])]
        result = await orchestrator.execute_plan(subtasks, loop)

        status = orchestrator.get_status(result["plan_id"])
        assert status is not None
        assert status["status"] == "completed"
        assert status["total"] == 1
        assert status["completed"] == 1

    @pytest.mark.asyncio
    async def test_get_status_unknown_plan(self) -> None:
        orchestrator = TaskOrchestrator()
        assert orchestrator.get_status("nonexistent") is None

    @pytest.mark.asyncio
    async def test_subtask_failure_handling(self) -> None:
        orchestrator = TaskOrchestrator()
        config = make_config()
        loop = AgentLoop(config)

        # Make chat raise on second call
        call_count = 0

        async def flaky_chat(message: str, session_id=None):
            nonlocal call_count
            call_count += 1
            if call_count > 1:
                raise RuntimeError("LLM error")
            return {"content": "ok", "tool_calls": None, "id": "x", "session_id": "s", "metadata": {}}

        loop.chat = flaky_chat  # type: ignore[assignment]

        subtasks = [
            Subtask(id="s1", description="Good task", dependencies=[]),
            Subtask(id="s2", description="Bad task", dependencies=["s1"]),
        ]

        result = await orchestrator.execute_plan(subtasks, loop)
        statuses = {sr["subtask_id"]: sr["status"] for sr in result["subtask_results"]}
        assert statuses["s1"] == "completed"
        assert statuses["s2"] == "failed"


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------

class TestAgentAPIEndpoints:

    @pytest.fixture
    def test_client(self):
        from httpx import AsyncClient, ASGITransport
        from engine.main import create_app

        config = make_config()
        app = create_app(config)

        # Patch the decomposer and orchestrator onto the routes module
        from engine.api import routes as routes_mod
        provider = MockProvider([
            {
                "content": json.dumps([
                    {"id": "sub1", "description": "Step 1", "agent_hint": "coder", "dependencies": []},
                    {"id": "sub2", "description": "Step 2", "agent_hint": "general", "dependencies": ["sub1"]},
                ]),
                "tool_calls": None,
            },
        ])
        routes_mod._decomposer = TaskDecomposer(provider=provider)
        routes_mod._orchestrator = TaskOrchestrator()

        return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

    @pytest.mark.asyncio
    async def test_decompose_endpoint(self, test_client) -> None:
        async with test_client as client:
            resp = await client.post(
                "/api/agents/decompose",
                json={"task": "Build an API", "max_subtasks": 5},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "subtasks" in data
            assert len(data["subtasks"]) == 2
            assert data["subtasks"][0]["id"] == "sub1"
            assert data["subtasks"][1]["dependencies"] == ["sub1"]

    @pytest.mark.asyncio
    async def test_orchestrate_endpoint(self, test_client) -> None:
        async with test_client as client:
            resp = await client.post(
                "/api/agents/orchestrate",
                json={"task": "Build and test a feature"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "plan_id" in data
            assert "result" in data
            assert "subtask_results" in data

    @pytest.mark.asyncio
    async def test_decompose_not_initialized(self) -> None:
        from httpx import AsyncClient, ASGITransport
        from engine.main import create_app

        config = make_config()
        app = create_app(config)

        # Ensure decomposer is None
        from engine.api import routes as routes_mod
        routes_mod._decomposer = None

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/agents/decompose",
                json={"task": "test", "max_subtasks": 3},
            )
            assert resp.status_code == 503
