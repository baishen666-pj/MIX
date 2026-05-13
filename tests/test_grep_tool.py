import pytest

from engine.tools.grep import content_search


@pytest.fixture
def search_tree(tmp_path):
    (tmp_path / "app.py").write_text(
        "def hello():\n    return 'world'\n\ndef goodbye():\n    return 'bye'\n", encoding="utf-8"
    )
    (tmp_path / "utils.py").write_text("HELLO = 'hello'\nWORLD = 'world'\n", encoding="utf-8")
    (tmp_path / "sub").mkdir()
    (tmp_path / "sub" / "deep.py").write_text("# deep file\nhello_from_deep = True\n", encoding="utf-8")
    (tmp_path / "readme.md").write_text("# Hello World\n\nWelcome to hello project.\n", encoding="utf-8")
    return tmp_path


@pytest.mark.asyncio
async def test_grep_basic(search_tree):
    result = await content_search("hello", str(search_tree))
    assert result.success
    assert "app.py" in result.output or "utils.py" in result.output or "deep.py" in result.output


@pytest.mark.asyncio
async def test_grep_files_with_matches(search_tree):
    result = await content_search("hello", str(search_tree), output_mode="files_with_matches")
    assert result.success
    assert "app.py" in result.output
    assert "utils.py" in result.output


@pytest.mark.asyncio
async def test_grep_count(search_tree):
    result = await content_search("hello", str(search_tree), output_mode="count")
    assert result.success
    assert ":" in result.output


@pytest.mark.asyncio
async def test_grep_glob_filter(search_tree):
    result = await content_search("hello", str(search_tree), glob="*.py", output_mode="files_with_matches")
    assert result.success
    assert "readme.md" not in result.output


@pytest.mark.asyncio
async def test_grep_ignore_case(search_tree):
    result = await content_search("HELLO", str(search_tree), ignore_case=True, output_mode="files_with_matches")
    assert result.success
    files = result.output.strip().split("\n")
    assert len(files) >= 2


@pytest.mark.asyncio
async def test_grep_no_matches(search_tree):
    result = await content_search("zzzznonexistent", str(search_tree))
    assert result.success
    assert "No matches" in result.output


@pytest.mark.asyncio
async def test_grep_invalid_regex():
    result = await content_search("[invalid", ".")
    assert not result.success
    assert "Invalid regex" in result.error


@pytest.mark.asyncio
async def test_grep_single_file(search_tree):
    result = await content_search("def", str(search_tree / "app.py"))
    assert result.success
    assert "def hello" in result.output
    assert "utils" not in result.output


@pytest.mark.asyncio
async def test_grep_context(search_tree):
    result = await content_search("hello_from_deep", str(search_tree), context=1)
    assert result.success
    assert "deep file" in result.output


@pytest.mark.asyncio
async def test_grep_path_not_found():
    result = await content_search("hello", "/nonexistent/path")
    assert not result.success
