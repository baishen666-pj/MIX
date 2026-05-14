from __future__ import annotations

import pytest

from engine.tools.approval import ApprovalManager, ApprovalStatus
from engine.tools.composition import ToolChain, ToolChainExecutor, ToolChainStep
from engine.tools.dynamic import DynamicToolDef, DynamicToolRegistry
from engine.tools.history import ToolHistory
from engine.tools.registry import ToolRegistry
from engine.tools.types import ToolResult

# --- Dynamic Tools ---


@pytest.fixture
def dynamic():
    return DynamicToolRegistry()


@pytest.mark.asyncio
async def test_register_dynamic_tool(dynamic: DynamicToolRegistry):
    defn = DynamicToolDef(
        name="echo_test",
        description="Echo input",
        parameters={"type": "object", "properties": {"text": {"type": "string"}}},
        handler_code="import json; print(json.dumps({'echo': 'ok'}))",
        danger_level="safe",
    )
    await dynamic.register(defn)
    assert dynamic.has_tool("echo_test")
    tools = dynamic.list_dynamic_tools()
    assert len(tools) == 1
    assert tools[0].name == "echo_test"


@pytest.mark.asyncio
async def test_unregister_dynamic_tool(dynamic: DynamicToolRegistry):
    defn = DynamicToolDef(
        name="temp_tool",
        description="Temp",
        parameters={"type": "object", "properties": {}},
        handler_code="print('ok')",
    )
    await dynamic.register(defn)
    assert dynamic.has_tool("temp_tool")
    removed = await dynamic.unregister("temp_tool")
    assert removed is True
    assert not dynamic.has_tool("temp_tool")


@pytest.mark.asyncio
async def test_unregister_nonexistent(dynamic: DynamicToolRegistry):
    removed = await dynamic.unregister("nonexistent")
    assert removed is False


def test_to_openai_definition():
    defn = DynamicToolDef(
        name="test_tool",
        description="A test",
        parameters={"type": "object", "properties": {"x": {"type": "integer"}}},
        handler_code="print(x)",
    )
    result = defn.to_openai_definition()
    assert result["type"] == "function"
    assert result["function"]["name"] == "test_tool"
    assert "x" in result["function"]["parameters"]["properties"]


# --- Tool Chain ---


@pytest.fixture
def registry():
    return ToolRegistry()


@pytest.mark.asyncio
async def test_chain_execution(registry: ToolRegistry):
    chain = ToolChain(
        name="read_and_list",
        description="List then read",
        steps=[
            ToolChainStep(tool_name="file_list", fixed_args={"path": "."}),
        ],
    )
    executor = ToolChainExecutor(registry)
    result = await executor.execute_chain(chain, initial_args={})
    assert result.success


def test_validate_chain(registry: ToolRegistry):
    chain = ToolChain(
        name="bad_chain",
        description="Uses nonexistent tool",
        steps=[ToolChainStep(tool_name="nonexistent_tool")],
    )
    executor = ToolChainExecutor(registry)
    errors = executor.validate_chain(chain)
    assert len(errors) > 0
    assert "nonexistent_tool" in errors[0]


def test_validate_empty_chain(registry: ToolRegistry):
    chain = ToolChain(name="empty", description="No steps", steps=[])
    executor = ToolChainExecutor(registry)
    errors = executor.validate_chain(chain)
    assert len(errors) > 0


def test_chain_list(registry: ToolRegistry):
    executor = ToolChainExecutor(registry)
    chain = ToolChain(
        name="test_chain",
        description="Test",
        steps=[ToolChainStep(tool_name="file_list")],
    )
    executor.register_chain(chain)
    chains = executor.list_chains()
    assert len(chains) == 1
    assert chains[0]["name"] == "test_chain"


# --- Approval ---


@pytest.fixture
def approval():
    return ApprovalManager(auto_approve_safe=True, ttl_seconds=5)


@pytest.mark.asyncio
async def test_auto_approve_safe(approval: ApprovalManager):
    req = await approval.request_approval("file_read", {"path": "/tmp"}, "safe")
    assert req.status == ApprovalStatus.APPROVED
    assert req.resolved_by == "auto"


@pytest.mark.asyncio
async def test_dangerous_requires_approval(approval: ApprovalManager):
    req = await approval.request_approval("bash", {"command": "rm -rf /"}, "dangerous")
    assert req.status == ApprovalStatus.PENDING


@pytest.mark.asyncio
async def test_approve_request(approval: ApprovalManager):
    req = await approval.request_approval("bash", {"command": "ls"}, "dangerous")
    assert req.status == ApprovalStatus.PENDING
    approved = await approval.approve(req.id, "admin")
    assert approved is True
    assert req.status == ApprovalStatus.APPROVED


@pytest.mark.asyncio
async def test_reject_request(approval: ApprovalManager):
    req = await approval.request_approval("bash", {"command": "ls"}, "dangerous")
    rejected = await approval.reject(req.id, "admin", reason="Unsafe command")
    assert rejected is True
    assert req.status == ApprovalStatus.REJECTED
    assert req.reason == "Unsafe command"


@pytest.mark.asyncio
async def test_approve_nonexistent(approval: ApprovalManager):
    result = await approval.approve("nonexistent")
    assert result is False


@pytest.mark.asyncio
async def test_get_pending(approval: ApprovalManager):
    await approval.request_approval("bash", {"command": "a"}, "dangerous")
    await approval.request_approval("bash", {"command": "b"}, "dangerous")
    pending = approval.get_pending()
    assert len(pending) == 2


@pytest.mark.asyncio
async def test_no_auto_approve_dangerous():
    mgr = ApprovalManager(auto_approve_safe=False)
    req = await mgr.request_approval("file_read", {"path": "/tmp"}, "safe")
    assert req.status == ApprovalStatus.PENDING


# --- History ---


@pytest.fixture
def history():
    return ToolHistory(max_records=100)


@pytest.mark.asyncio
async def test_record_and_query(history: ToolHistory):
    result = ToolResult(output="hello", success=True)
    await history.record("file_read", {"path": "/tmp"}, result, "sess1", 15.5)
    records = await history.query()
    assert len(records) == 1
    assert records[0].tool_name == "file_read"
    assert records[0].success is True


@pytest.mark.asyncio
async def test_query_by_tool_name(history: ToolHistory):
    await history.record("bash", {"command": "ls"}, ToolResult(output="", success=True), "", 10)
    await history.record("file_read", {"path": "."}, ToolResult(output="", success=True), "", 5)
    records = await history.query(tool_name="bash")
    assert len(records) == 1
    assert records[0].tool_name == "bash"


@pytest.mark.asyncio
async def test_get_stats(history: ToolHistory):
    await history.record("bash", {"command": "ls"}, ToolResult(output="", success=True), "", 10)
    await history.record("bash", {"command": "bad"}, ToolResult(output="", error="fail", success=False), "", 20)
    stats = await history.get_stats()
    assert stats["total"] == 2
    assert stats["success_rate"] == 50.0
    assert "bash" in stats["tools"]


@pytest.mark.asyncio
async def test_max_records():
    h = ToolHistory(max_records=3)
    for i in range(5):
        await h.record("tool", {"i": i}, ToolResult(output="", success=True), "", 1)
    records = await h.query()
    assert len(records) == 3
