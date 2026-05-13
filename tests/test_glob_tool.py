import pytest
from pathlib import Path

from engine.tools.glob import glob_search


@pytest.fixture
def file_tree(tmp_path):
    (tmp_path / "app.py").write_text("", encoding="utf-8")
    (tmp_path / "utils.py").write_text("", encoding="utf-8")
    (tmp_path / "readme.md").write_text("", encoding="utf-8")
    sub = tmp_path / "src"
    sub.mkdir()
    (sub / "index.ts").write_text("", encoding="utf-8")
    (sub / "main.ts").write_text("", encoding="utf-8")
    deep = sub / "components"
    deep.mkdir()
    (deep / "Button.tsx").write_text("", encoding="utf-8")
    return tmp_path


@pytest.mark.asyncio
async def test_glob_python_files(file_tree):
    result = await glob_search("*.py", str(file_tree))
    assert result.success
    assert "app.py" in result.output
    assert "utils.py" in result.output
    assert ".ts" not in result.output


@pytest.mark.asyncio
async def test_glob_recursive(file_tree):
    result = await glob_search("**/*.ts", str(file_tree))
    assert result.success
    assert "index.ts" in result.output
    assert "main.ts" in result.output


@pytest.mark.asyncio
async def test_glob_nested(file_tree):
    result = await glob_search("**/*.tsx", str(file_tree))
    assert result.success
    assert "Button.tsx" in result.output


@pytest.mark.asyncio
async def test_glob_no_match(file_tree):
    result = await glob_search("*.rs", str(file_tree))
    assert result.success
    assert "No files matched" in result.output


@pytest.mark.asyncio
async def test_glob_path_not_found():
    result = await glob_search("*", "/nonexistent/path")
    assert not result.success


@pytest.mark.asyncio
async def test_glob_directories_marked(file_tree):
    result = await glob_search("**/components", str(file_tree))
    assert result.success
    lines = result.output.strip().split("\n")
    assert any(line.startswith("d") for line in lines)
