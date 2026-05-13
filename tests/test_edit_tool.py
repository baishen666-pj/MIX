import pytest

from engine.tools.edit import file_edit, file_edit_lines


@pytest.fixture
def tmp_file(tmp_path):
    p = tmp_path / "test.py"
    p.write_text("def hello():\n    return 'world'\n", encoding="utf-8")
    return p


@pytest.mark.asyncio
async def test_file_edit_exact_match(tmp_file):
    result = await file_edit(str(tmp_file), "world", "universe")
    assert result.success
    assert tmp_file.read_text() == "def hello():\n    return 'universe'\n"


@pytest.mark.asyncio
async def test_file_edit_multiline(tmp_file):
    old = "def hello():\n    return 'world'"
    new = "def hello():\n    return 'hello'"
    result = await file_edit(str(tmp_file), old, new)
    assert result.success
    assert "hello" in tmp_file.read_text()


@pytest.mark.asyncio
async def test_file_edit_not_found(tmp_file):
    result = await file_edit(str(tmp_file), "nonexistent", "x")
    assert not result.success
    assert "not found" in result.error


@pytest.mark.asyncio
async def test_file_edit_multiple_match_no_replace_all(tmp_file):
    p = tmp_file.parent / "multi.txt"
    p.write_text("foo bar foo baz foo", encoding="utf-8")
    result = await file_edit(str(p), "foo", "qux")
    assert not result.success
    assert "3 times" in result.error


@pytest.mark.asyncio
async def test_file_edit_replace_all(tmp_file):
    p = tmp_file.parent / "multi.txt"
    p.write_text("foo bar foo baz foo", encoding="utf-8")
    result = await file_edit(str(p), "foo", "qux", replace_all=True)
    assert result.success
    assert tmp_file.parent.joinpath("multi.txt").read_text() == "qux bar qux baz qux"


@pytest.mark.asyncio
async def test_file_edit_empty_old_string(tmp_file):
    result = await file_edit(str(tmp_file), "", "x")
    assert not result.success
    assert "non-empty" in result.error


@pytest.mark.asyncio
async def test_file_edit_file_not_found():
    result = await file_edit("/nonexistent/file.txt", "a", "b")
    assert not result.success


@pytest.mark.asyncio
async def test_file_edit_lines_basic(tmp_file):
    result = await file_edit_lines(str(tmp_file), 1, 1, "def goodbye():")
    assert result.success
    lines = tmp_file.read_text().splitlines()
    assert lines[0] == "def goodbye():"


@pytest.mark.asyncio
async def test_file_edit_lines_multi(tmp_file):
    result = await file_edit_lines(str(tmp_file), 1, 2, "x = 1\ny = 2")
    assert result.success
    content = tmp_file.read_text()
    assert "x = 1" in content
    assert "y = 2" in content


@pytest.mark.asyncio
async def test_file_edit_lines_invalid_range(tmp_file):
    result = await file_edit_lines(str(tmp_file), 0, 1, "x")
    assert not result.success


@pytest.mark.asyncio
async def test_file_edit_lines_beyond_file(tmp_file):
    result = await file_edit_lines(str(tmp_file), 100, 110, "x")
    assert not result.success
