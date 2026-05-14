"""Additional coverage for engine.tools.registry.

Targets uncovered lines:
- Lines 88-91: unregister_tool for MCP tools
- Lines 99-100: dynamic tool execution path
- Lines 113-117: file_sandbox validation error path
- Lines 121-123: approval rejection path
- Lines 135-136: handler exception during execute
- Lines 141: history recording after execute
- Lines 162-163: _execute_sandboxed exception path
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from engine.tools.registry import ToolRegistry
from engine.tools.types import ToolResult

# --- MCP tool registration and unregistration (lines 88-91) ---


@pytest.mark.asyncio
async def test_unregister_mcp_tool():
    """Unregistering an MCP tool returns True and removes it."""
    registry = ToolRegistry()
    mock_handler = AsyncMock(return_value=ToolResult(output="mcp result"))
    registry.register_mcp_tool("mcp_weather", mock_handler)

    assert "mcp_weather" in registry.list_tools()
    removed = registry.unregister_tool("mcp_weather")
    assert removed is True
    assert "mcp_weather" not in registry.list_tools()


@pytest.mark.asyncio
async def test_unregister_nonexistent_tool():
    """Unregistering a tool that does not exist returns False."""
    registry = ToolRegistry()
    removed = registry.unregister_tool("no_such_tool")
    assert removed is False


@pytest.mark.asyncio
async def test_unregister_builtin_tool():
    """Unregistering a built-in tool (from _tools dict) returns True."""
    registry = ToolRegistry()
    assert "bash" in registry.list_tools()
    removed = registry.unregister_tool("bash")
    assert removed is True
    assert "bash" not in registry.list_tools()


# --- MCP tool appears in get_definitions ---


@pytest.mark.asyncio
async def test_mcp_tool_in_definitions():
    """MCP tools appear in get_definitions output."""
    registry = ToolRegistry()
    mock_handler = AsyncMock(return_value=ToolResult(output="ok"))
    registry.register_mcp_tool("mcp_search", mock_handler)

    defs = registry.get_definitions()
    mcp_names = [d["function"]["name"] for d in defs]
    assert "mcp_search" in mcp_names


# --- Dynamic tool execution path (lines 98-104) ---


@pytest.mark.asyncio
async def test_execute_dynamic_tool():
    """When handler is not in _tools or _mcp_tools, falls back to dynamic registry."""
    registry = ToolRegistry()
    mock_dynamic = MagicMock()
    mock_dynamic.has_tool = MagicMock(return_value=True)
    mock_dynamic.execute = AsyncMock(return_value={"output": "dynamic result", "error": None, "success": True})
    registry.set_dynamic_registry(mock_dynamic)

    result = await registry.execute("dynamic_tool", x=1)
    assert result.success is True
    assert result.output == "dynamic result"
    mock_dynamic.execute.assert_awaited_once_with("dynamic_tool", x=1)


# --- File sandbox validation error (lines 113-117) ---


@pytest.mark.asyncio
async def test_execute_file_sandbox_blocks_path():
    """File sandbox validation failure returns PermissionError ToolResult."""
    registry = ToolRegistry()
    mock_sandbox = MagicMock()
    mock_sandbox.validate_path = MagicMock(side_effect=PermissionError("Path '/etc/passwd' is outside allowed dirs"))
    registry._file_sandbox = mock_sandbox

    result = await registry.execute("file_read", path="/etc/passwd")
    assert result.success is False
    assert "outside allowed" in result.error


# --- Approval rejection path (lines 120-127) ---


@pytest.mark.asyncio
async def test_execute_approval_rejected():
    """When approval manager rejects a moderate tool, execution is blocked."""
    registry = ToolRegistry()

    mock_approval = MagicMock()
    mock_req = MagicMock()
    mock_req.status.value = "rejected"
    mock_approval.request_approval = AsyncMock(return_value=mock_req)
    registry.set_approval_manager(mock_approval)

    # file_write is moderate danger level
    result = await registry.execute("file_write", path="/tmp/x", content="data")
    assert result.success is False
    assert "blocked" in result.error
    assert "rejected" in result.error


# --- Handler exception during execute (lines 135-136) ---


@pytest.mark.asyncio
async def test_execute_handler_raises_exception():
    """Exception from tool handler is caught and returned as error ToolResult."""
    registry = ToolRegistry()

    async def bad_handler(**kwargs):
        raise RuntimeError("tool crashed")

    registry.register_tool("crash_tool", bad_handler)
    result = await registry.execute("crash_tool")
    assert result.success is False
    assert "tool crashed" in result.error


# --- History recording (line 141) ---


@pytest.mark.asyncio
async def test_execute_records_history():
    """Successful execution records in tool history."""
    registry = ToolRegistry()

    async def echo_handler(**kwargs):
        return ToolResult(output="echo")

    registry.register_tool("echo_tool", echo_handler)

    mock_history = MagicMock()
    mock_history.record = AsyncMock()
    registry.set_history(mock_history)

    result = await registry.execute("echo_tool", message="hi")
    assert result.success is True
    mock_history.record.assert_awaited_once()
    call_kwargs = mock_history.record.call_args[1]
    assert call_kwargs["tool_name"] == "echo_tool"
    assert call_kwargs["result"].output == "echo"


# --- _execute_sandboxed exception path (lines 162-163) ---


@pytest.mark.asyncio
async def test_execute_sandboxed_exception():
    """Sandbox execution exception returns error ToolResult."""
    registry = ToolRegistry()

    mock_sandbox = MagicMock()
    mock_sandbox.execute = AsyncMock(side_effect=RuntimeError("sandbox failure"))
    registry._sandbox = mock_sandbox

    result = await registry.execute("bash", command="rm -rf /")
    assert result.success is False
    assert "sandbox failure" in result.error


# --- _execute_sandboxed success path (lines 155-160) ---


@pytest.mark.asyncio
async def test_execute_sandboxed_success():
    """Sandbox execution success returns stdout in ToolResult."""
    registry = ToolRegistry()

    mock_sandbox = MagicMock()
    mock_sandbox.execute = AsyncMock(return_value={"exit_code": 0, "stdout": "sandboxed output", "stderr": ""})
    registry._sandbox = mock_sandbox

    result = await registry.execute("bash", command="echo hello")
    assert result.success is True
    assert result.output == "sandboxed output"


@pytest.mark.asyncio
async def test_execute_sandboxed_nonzero_exit():
    """Sandbox execution with non-zero exit returns stderr as error."""
    registry = ToolRegistry()

    mock_sandbox = MagicMock()
    mock_sandbox.execute = AsyncMock(return_value={"exit_code": 1, "stdout": "", "stderr": "command not found"})
    registry._sandbox = mock_sandbox

    result = await registry.execute("bash", command="bad_command")
    assert result.success is False
    assert result.error == "command not found"


# --- set_sandbox setter ---


@pytest.mark.asyncio
async def test_set_sandbox():
    """set_sandbox updates internal sandbox reference."""
    registry = ToolRegistry()
    mock_sandbox = MagicMock()
    registry.set_sandbox(mock_sandbox)
    assert registry._sandbox is mock_sandbox


# --- Dynamic tool names appear in list_tools ---


@pytest.mark.asyncio
async def test_list_tools_includes_dynamic():
    """list_tools includes dynamic tool names when dynamic registry is set."""
    registry = ToolRegistry()
    mock_dynamic = MagicMock()
    mock_dynamic.list_dynamic_tools_names = MagicMock(return_value=["dyn_a", "dyn_b"])
    registry.set_dynamic_registry(mock_dynamic)

    tools = registry.list_tools()
    assert "dyn_a" in tools
    assert "dyn_b" in tools


# --- Dynamic tool definitions in get_definitions ---


@pytest.mark.asyncio
async def test_get_definitions_includes_dynamic():
    """get_definitions includes dynamic tool definitions."""
    registry = ToolRegistry()
    mock_dynamic = MagicMock()
    mock_dynamic.get_definitions = MagicMock(
        return_value=[
            {
                "type": "function",
                "function": {
                    "name": "dyn_tool",
                    "description": "A dynamic tool",
                    "parameters": {"type": "object", "properties": {}},
                },
            }
        ]
    )
    registry.set_dynamic_registry(mock_dynamic)

    defs = registry.get_definitions()
    names = [d["function"]["name"] for d in defs]
    assert "dyn_tool" in names


# --- Execute with approval approved for moderate tool ---


@pytest.mark.asyncio
async def test_execute_approval_approved():
    """When approval is granted, moderate tool executes normally."""
    registry = ToolRegistry()

    async def mock_file_write(**kwargs):
        return ToolResult(output="written")

    registry.register_tool("file_write", mock_file_write)

    mock_approval = MagicMock()
    mock_req = MagicMock()
    mock_req.status.value = "approved"
    mock_approval.request_approval = AsyncMock(return_value=mock_req)
    registry.set_approval_manager(mock_approval)

    result = await registry.execute("file_write", path="/tmp/x", content="data")
    assert result.success is True
    assert result.output == "written"


# --- get_danger_level default ---


def test_get_danger_level_unknown():
    """Unknown tool name defaults to 'safe' danger level."""
    registry = ToolRegistry()
    assert registry.get_danger_level("nonexistent") == "safe"


def test_get_danger_level_known():
    """Known tool returns correct danger level."""
    registry = ToolRegistry()
    assert registry.get_danger_level("bash") == "dangerous"
    assert registry.get_danger_level("file_read") == "safe"
    assert registry.get_danger_level("file_write") == "moderate"
