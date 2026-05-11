import pytest
from pathlib import Path

from engine.tools.registry import ToolRegistry
from engine.tools.bash import execute as bash_execute
from engine.tools.file import file_read, file_write, file_list
from engine.sandbox.local import LocalBackend


@pytest.mark.asyncio
async def test_bash_echo() -> None:
    result = await bash_execute(command="echo hello")
    assert result.success
    assert "hello" in result.output


@pytest.mark.asyncio
async def test_bash_failure() -> None:
    result = await bash_execute(command="exit 1")
    assert not result.success


@pytest.mark.asyncio
async def test_bash_timeout() -> None:
    result = await bash_execute(command="sleep 10", timeout=1)
    assert not result.success
    assert "timed out" in (result.error or "")


@pytest.mark.asyncio
async def test_file_read_write(tmp_path: Path) -> None:
    test_file = tmp_path / "test.txt"
    write_result = await file_write(path=str(test_file), content="hello world")
    assert write_result.success

    read_result = await file_read(path=str(test_file))
    assert read_result.success
    assert read_result.output == "hello world"


@pytest.mark.asyncio
async def test_file_read_nonexistent() -> None:
    result = await file_read(path="/nonexistent/file.txt")
    assert not result.success
    assert "not found" in (result.error or "")


@pytest.mark.asyncio
async def test_file_list(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_text("a")
    (tmp_path / "b.py").write_text("b")

    result = await file_list(path=str(tmp_path))
    assert result.success
    assert "a.txt" in result.output
    assert "b.py" in result.output


@pytest.mark.asyncio
async def test_file_list_with_pattern(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_text("a")
    (tmp_path / "b.py").write_text("b")

    result = await file_list(path=str(tmp_path), pattern="*.py")
    assert result.success
    assert "b.py" in result.output
    assert "a.txt" not in result.output


@pytest.mark.asyncio
async def test_tool_registry() -> None:
    registry = ToolRegistry()
    assert "bash" in registry.list_tools()
    assert "file_read" in registry.list_tools()

    defs = registry.get_definitions()
    assert len(defs) >= 4


@pytest.mark.asyncio
async def test_tool_registry_unknown() -> None:
    registry = ToolRegistry()
    result = await registry.execute("nonexistent_tool")
    assert not result.success
    assert "Unknown tool" in (result.error or "")


@pytest.mark.asyncio
async def test_local_sandbox() -> None:
    backend = LocalBackend()
    result = await backend.execute("echo sandboxed")
    assert result["exit_code"] == 0
    assert "sandboxed" in result["stdout"]
