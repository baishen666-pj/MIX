"""Additional coverage for engine.tools.dynamic.

Targets uncovered lines:
- Line 88: successful execute return
- Line 114: subprocess returning stdout
- Lines 116-119: TimeoutError killing process
- Lines 127-128: SyntaxError in handler code
- Line 134: ImportFrom without module (relative import)
- Line 140: blocked module import detection
- Line 151: blocked builtin detection (__import__, eval, exec, compile, open)
- Line 165: builtins.attr blocked builtin detection
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from engine.tools.dynamic import DynamicToolDef, DynamicToolRegistry


@pytest.fixture
def registry() -> DynamicToolRegistry:
    return DynamicToolRegistry()


def _safe_def(name: str = "safe_tool") -> DynamicToolDef:
    """Create a DynamicToolDef with trivially safe handler code."""
    return DynamicToolDef(
        name=name,
        description="A safe tool",
        parameters={"type": "object", "properties": {}},
        handler_code="import json\nprint(json.dumps({'ok': True}))",
        danger_level="safe",
    )


# --- Successful execute (line 88) ---


@pytest.mark.asyncio
async def test_execute_success_with_mocked_handler(registry: DynamicToolRegistry):
    """Execute returns output + success=True when handler succeeds."""
    defn = _safe_def("success_tool")
    await registry.register(defn)

    # Replace compiled handler with a controlled mock
    async def mock_handler(**kwargs):
        return "mock output"

    registry._handlers["success_tool"] = mock_handler

    result = await registry.execute("success_tool", x=1)
    assert result["success"] is True
    assert result["output"] == "mock output"


# --- Subprocess stdout path (line 114) ---
# This is hard to test directly without python3 available, so we mock.


@pytest.mark.asyncio
async def test_compile_handler_subprocess_success(registry: DynamicToolRegistry):
    """Compiled handler calls subprocess and returns stdout on success."""
    defn = _safe_def("subprocess_tool")
    await registry.register(defn)

    # Simulate a successful subprocess
    mock_proc = AsyncMock()
    mock_proc.communicate = AsyncMock(return_value=(b"subprocess output", b""))
    mock_proc.returncode = 0
    mock_proc.kill = MagicMock()
    mock_proc.wait = AsyncMock()

    with patch("engine.tools.dynamic.asyncio.create_subprocess_exec", return_value=mock_proc):
        result = await registry.execute("subprocess_tool")
        assert result["success"] is True
        assert result["output"] == "subprocess output"


# --- Subprocess non-zero return code (line 113) ---


@pytest.mark.asyncio
async def test_compile_handler_subprocess_error(registry: DynamicToolRegistry):
    """Compiled handler raises RuntimeError when subprocess returns non-zero."""
    defn = _safe_def("error_tool")
    await registry.register(defn)

    mock_proc = AsyncMock()
    mock_proc.communicate = AsyncMock(return_value=(b"", b"SyntaxError: invalid syntax"))
    mock_proc.returncode = 1
    mock_proc.kill = MagicMock()
    mock_proc.wait = AsyncMock()

    with patch("engine.tools.dynamic.asyncio.create_subprocess_exec", return_value=mock_proc):
        result = await registry.execute("error_tool")
        assert result["success"] is False
        assert "SyntaxError" in result["error"]


# --- Timeout handling (lines 115-119) ---


@pytest.mark.asyncio
async def test_compile_handler_timeout(registry: DynamicToolRegistry):
    """Compiled handler kills process on TimeoutError and returns error."""
    defn = _safe_def("timeout_tool")
    await registry.register(defn)

    mock_proc = AsyncMock()
    mock_proc.communicate = AsyncMock(side_effect=asyncio.TimeoutError())
    mock_proc.kill = MagicMock()
    mock_proc.wait = AsyncMock()

    with patch("engine.tools.dynamic.asyncio.create_subprocess_exec", return_value=mock_proc):
        result = await registry.execute("timeout_tool")
        assert result["success"] is False
        assert "timed out" in result["error"]
        mock_proc.kill.assert_called_once()
        mock_proc.wait.assert_awaited_once()


# --- SyntaxError in handler code (line 127-128) ---


@pytest.mark.asyncio
async def test_validate_code_syntax_error():
    """Handler code with invalid Python syntax raises ValueError."""
    registry = DynamicToolRegistry()
    with pytest.raises(ValueError, match="Invalid Python syntax"):
        registry._validate_code("def broken(:\n    pass")


# --- Blocked module imports (line 140) ---


@pytest.mark.asyncio
async def test_validate_code_blocked_os_import():
    """Importing 'os' raises ValueError."""
    registry = DynamicToolRegistry()
    with pytest.raises(ValueError, match="blocked module"):
        registry._validate_code("import os")


@pytest.mark.asyncio
async def test_validate_code_blocked_subprocess_import():
    """Importing 'subprocess' raises ValueError."""
    registry = DynamicToolRegistry()
    with pytest.raises(ValueError, match="blocked module"):
        registry._validate_code("import subprocess")


@pytest.mark.asyncio
async def test_validate_code_blocked_sys_import():
    """Importing 'sys' raises ValueError."""
    registry = DynamicToolRegistry()
    with pytest.raises(ValueError, match="blocked module"):
        registry._validate_code("import sys")


@pytest.mark.asyncio
async def test_validate_code_blocked_from_import():
    """from os.path import ... raises ValueError."""
    registry = DynamicToolRegistry()
    with pytest.raises(ValueError, match="blocked module"):
        registry._validate_code("from os.path import join")


@pytest.mark.asyncio
async def test_validate_code_blocked_socket_import():
    """Importing 'socket' raises ValueError."""
    registry = DynamicToolRegistry()
    with pytest.raises(ValueError, match="blocked module"):
        registry._validate_code("import socket")


@pytest.mark.asyncio
async def test_validate_code_blocked_shutil_import():
    """Importing 'shutil' raises ValueError."""
    registry = DynamicToolRegistry()
    with pytest.raises(ValueError, match="blocked module"):
        registry._validate_code("import shutil")


@pytest.mark.asyncio
async def test_validate_code_blocked_pathlib_import():
    """Importing 'pathlib' raises ValueError."""
    registry = DynamicToolRegistry()
    with pytest.raises(ValueError, match="blocked module"):
        registry._validate_code("import pathlib")


@pytest.mark.asyncio
async def test_validate_code_blocked_ctypes_import():
    """Importing 'ctypes' raises ValueError."""
    registry = DynamicToolRegistry()
    with pytest.raises(ValueError, match="blocked module"):
        registry._validate_code("import ctypes")


@pytest.mark.asyncio
async def test_validate_code_blocked_multiprocessing_import():
    """Importing 'multiprocessing' raises ValueError."""
    registry = DynamicToolRegistry()
    with pytest.raises(ValueError, match="blocked module"):
        registry._validate_code("import multiprocessing")


# --- Blocked builtins (line 151) ---


@pytest.mark.asyncio
async def test_validate_code_blocked_eval():
    """Using eval() raises ValueError."""
    registry = DynamicToolRegistry()
    with pytest.raises(ValueError, match="blocked builtin"):
        registry._validate_code("eval('1+1')")


@pytest.mark.asyncio
async def test_validate_code_blocked_exec():
    """Using exec() raises ValueError."""
    registry = DynamicToolRegistry()
    with pytest.raises(ValueError, match="blocked builtin"):
        registry._validate_code("exec('print(1)')")


@pytest.mark.asyncio
async def test_validate_code_blocked_import_builtin():
    """Using __import__() raises ValueError."""
    registry = DynamicToolRegistry()
    with pytest.raises(ValueError, match="blocked builtin"):
        registry._validate_code("__import__('os')")


@pytest.mark.asyncio
async def test_validate_code_blocked_compile():
    """Using compile() raises ValueError."""
    registry = DynamicToolRegistry()
    with pytest.raises(ValueError, match="blocked builtin"):
        registry._validate_code("compile('1+1', '<string>', 'eval')")


@pytest.mark.asyncio
async def test_validate_code_blocked_open():
    """Using open() raises ValueError."""
    registry = DynamicToolRegistry()
    with pytest.raises(ValueError, match="blocked builtin"):
        registry._validate_code("open('/etc/passwd')")


# --- Blocked builtins via builtins module (line 165) ---


@pytest.mark.asyncio
async def test_validate_code_blocked_builtins_eval():
    """Using builtins.eval raises ValueError."""
    registry = DynamicToolRegistry()
    with pytest.raises(ValueError, match="blocked builtin"):
        registry._validate_code("import builtins\nbuiltins.eval('1')")


@pytest.mark.asyncio
async def test_validate_code_blocked_builtins_exec():
    """Using builtins.exec raises ValueError."""
    registry = DynamicToolRegistry()
    with pytest.raises(ValueError, match="blocked builtin"):
        registry._validate_code("import builtins\nbuiltins.exec('1')")


@pytest.mark.asyncio
async def test_validate_code_blocked_builtins_open():
    """Using builtins.open raises ValueError."""
    registry = DynamicToolRegistry()
    with pytest.raises(ValueError, match="blocked builtin"):
        registry._validate_code("import builtins\nbuiltins.open('x')")


@pytest.mark.asyncio
async def test_validate_code_blocked_builtins_import():
    """Using builtins.__import__ raises ValueError."""
    registry = DynamicToolRegistry()
    with pytest.raises(ValueError, match="blocked builtin"):
        registry._validate_code("import builtins\nbuiltins.__import__('os')")


@pytest.mark.asyncio
async def test_validate_code_blocked_builtins_compile():
    """Using builtins.compile raises ValueError."""
    registry = DynamicToolRegistry()
    with pytest.raises(ValueError, match="blocked builtin"):
        registry._validate_code("import builtins\nbuiltins.compile('1','','eval')")


# --- Valid code passes validation ---


@pytest.mark.asyncio
async def test_validate_code_allows_safe_imports():
    """Code importing allowed modules passes validation."""
    registry = DynamicToolRegistry()
    # Should not raise
    registry._validate_code("import json\nimport math\nprint('ok')")


# --- ImportFrom without module (line 134, relative import edge case) ---


@pytest.mark.asyncio
async def test_validate_code_relative_import_no_module():
    """Relative import with no module attribute does not crash."""
    registry = DynamicToolRegistry()
    # from . import something  -- node.module is None
    # This should not raise a ValueError for blocked modules
    # But may raise SyntaxError depending on context; let's use a valid parse
    code = "from . import something"
    try:
        registry._validate_code(code)
    except ValueError as e:
        # If it raises ValueError, it should not be about blocked modules
        assert "blocked module" not in str(e)
    except SyntaxError:
        pass  # Expected: relative import with no package context


# --- Register with invalid code raises ValueError ---


@pytest.mark.asyncio
async def test_register_invalid_code_raises(registry: DynamicToolRegistry):
    """Registering a tool with blocked code raises ValueError."""
    defn = DynamicToolDef(
        name="bad_tool",
        description="Bad tool",
        parameters={"type": "object", "properties": {}},
        handler_code="import os; os.system('rm -rf /')",
    )
    with pytest.raises(ValueError, match="blocked module"):
        await registry.register(defn)


# --- Execute with missing args (handler receives empty kwargs) ---


@pytest.mark.asyncio
async def test_execute_with_no_args(registry: DynamicToolRegistry):
    """Execute passes all kwargs to handler, even empty ones."""
    defn = _safe_def("no_args_tool")
    await registry.register(defn)

    async def mock_handler(**kwargs):
        return "no args received"

    registry._handlers["no_args_tool"] = mock_handler

    result = await registry.execute("no_args_tool")
    assert result["success"] is True
    assert result["output"] == "no args received"
