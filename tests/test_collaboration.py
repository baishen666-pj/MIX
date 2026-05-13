from __future__ import annotations

import asyncio

import pytest

from engine.agent.bus import AgentBus
from engine.agent.collaboration import (
    CollaborationEngine,
    CollaborationPattern,
    CollaborationStep,
)
from engine.agent.router import AgentRouter
from engine.config import MixConfig
from engine.memory.store import MemoryStore


@pytest.fixture
def config(tmp_path):
    return MixConfig.load(tmp_path / "test_config.json")


@pytest.fixture
def memory(tmp_path):
    store = MemoryStore(str(tmp_path / "test.db"))
    return store


@pytest.fixture
def router(config, memory):
    return AgentRouter(config, memory)


@pytest.fixture
def bus():
    return AgentBus()


@pytest.fixture
def engine(bus, router, memory):
    return CollaborationEngine(bus, router, memory)


def test_create_plan_sequential(engine):
    plan = engine.create_plan(
        CollaborationPattern.SEQUENTIAL,
        "Write a Python web scraper",
    )
    assert plan.pattern == CollaborationPattern.SEQUENTIAL
    assert plan.status == "created"
    assert len(plan.steps) == 3  # researcher, coder, reviewer
    assert plan.steps[0].agent_role == "researcher"
    assert plan.steps[1].agent_role == "coder"
    assert plan.steps[2].agent_role == "reviewer"


def test_create_plan_parallel(engine):
    plan = engine.create_plan(
        CollaborationPattern.PARALLEL,
        "Research multiple topics",
    )
    assert plan.pattern == CollaborationPattern.PARALLEL
    assert len(plan.steps) == 3


def test_create_plan_debate(engine):
    plan = engine.create_plan(
        CollaborationPattern.DEBATE,
        "Should we use microservices?",
    )
    assert plan.pattern == CollaborationPattern.DEBATE
    assert len(plan.steps) == 3


def test_create_plan_round_robin(engine):
    plan = engine.create_plan(
        CollaborationPattern.ROUND_ROBIN,
        "Refine this document",
        max_rounds=2,
    )
    assert plan.pattern == CollaborationPattern.ROUND_ROBIN
    assert plan.max_rounds == 2


def test_create_plan_custom_roles(engine):
    plan = engine.create_plan(
        CollaborationPattern.SEQUENTIAL,
        "Custom task",
        agent_roles=["researcher", "coder"],
    )
    assert len(plan.steps) == 2
    assert plan.steps[0].agent_role == "researcher"
    assert plan.steps[1].agent_role == "coder"


def test_get_plan_status(engine):
    plan = engine.create_plan(CollaborationPattern.SEQUENTIAL, "Test task")
    status = engine.get_plan_status(plan.id)
    assert status is not None
    assert status["id"] == plan.id
    assert status["pattern"] == "sequential"
    assert status["status"] == "created"


def test_get_plan_status_not_found(engine):
    status = engine.get_plan_status("nonexistent")
    assert status is None


def test_get_active_plans(engine):
    engine.create_plan(CollaborationPattern.SEQUENTIAL, "Task 1")
    engine.create_plan(CollaborationPattern.PARALLEL, "Task 2")
    plans = engine.get_active_plans()
    assert len(plans) == 2


def test_sequential_steps_have_dependencies(engine):
    plan = engine.create_plan(CollaborationPattern.SEQUENTIAL, "Test")
    assert plan.steps[0].dependencies == []
    assert len(plan.steps[1].dependencies) > 0


def test_parallel_steps_no_dependencies(engine):
    plan = engine.create_plan(CollaborationPattern.PARALLEL, "Test")
    for step in plan.steps:
        assert step.dependencies == []


def test_step_defaults():
    step = CollaborationStep(
        id="step-0",
        agent_role="researcher",
        instruction_template="Process: {input}",
    )
    assert step.status == "pending"
    assert step.result is None
    assert step.dependencies == []


async def test_bus_request_response(bus: AgentBus):
    received: list = []

    async def handler(msg):
        received.append(msg)
        await bus.respond(msg.id, {"answer": 42}, sender="responder")

    bus.subscribe("test.channel", handler)
    await asyncio.sleep(0.05)

    response = await bus.request(
        "test.channel",
        {"question": "life"},
        sender="asker",
        timeout=5.0,
    )
    assert response.payload == {"answer": 42}
    assert len(received) == 1


async def test_bus_request_timeout(bus: AgentBus):
    with pytest.raises(TimeoutError):
        await bus.request(
            "no.listeners",
            {"data": 1},
            sender="asker",
            timeout=0.1,
        )


def test_router_register_with_role(router: AgentRouter):
    agent = router.register_agent(
        name="researcher",
        role="researcher",
    )
    assert agent.role == "researcher"
    assert "research" in agent.system_prompt.lower()


def test_router_update_agent(router: AgentRouter):
    router.register_agent(name="test_agent", role="general")
    updated = router.update_agent(
        "test_agent",
        channels=["telegram"],
        system_prompt="Custom prompt",
    )
    assert updated is True
    agent = router.get_agent("test_agent")
    assert agent.channels == ["telegram"]
    assert agent.system_prompt == "Custom prompt"


def test_router_update_nonexistent(router: AgentRouter):
    updated = router.update_agent("nonexistent", channels=["irc"])
    assert updated is False


def test_router_delete_agent(router: AgentRouter):
    router.register_agent(name="to_delete", role="general")
    deleted = router.delete_agent("to_delete")
    assert deleted is True
    assert router.get_agent("to_delete") is None


def test_router_delete_nonexistent(router: AgentRouter):
    deleted = router.delete_agent("nonexistent")
    assert deleted is False


def test_list_agents_includes_role(router: AgentRouter):
    router.register_agent(name="my_researcher", role="researcher")
    agents = router.list_agents()
    researcher = next(a for a in agents if a["name"] == "my_researcher")
    assert researcher["role"] == "researcher"
