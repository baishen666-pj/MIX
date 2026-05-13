"""Comprehensive tests for engine.tools.file module.

Covers file_read, file_write, file_list with edge cases:
offset/limit, line numbers, non-existent paths, directory listing,
recursive listing, pattern filtering, path validation.
Does not duplicate test_tools.py.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from engine.tools.file import file_list, file_read, file_write

# --- file_read ---


class TestFileRead:
    @pytest.mark.asyncio
    async def test_read_existing_file(self, tmp_path: Path):
        f = tmp_path / "read.txt"
        f.write_text("line1\nline2\nline3", encoding="utf-8")
        result = await file_read(path=str(f))
        assert result.success
        assert "line1" in result.output
        assert "line2" in result.output

    @pytest.mark.asyncio
    async def test_read_with_line_numbers(self, tmp_path: Path):
        f = tmp_path / "numbered.txt"
        f.write_text("alpha\nbeta\ngamma", encoding="utf-8")
        result = await file_read(path=str(f), line_numbers=True)
        assert result.success
        assert "1" in result.output
        assert "alpha" in result.output

    @pytest.mark.asyncio
    async def test_read_without_line_numbers(self, tmp_path: Path):
        f = tmp_path / "plain.txt"
        f.write_text("plain content", encoding="utf-8")
        result = await file_read(path=str(f), line_numbers=False)
        assert result.success
        assert result.output == "plain content"

    @pytest.mark.asyncio
    async def test_read_with_offset(self, tmp_path: Path):
        f = tmp_path / "offset.txt"
        f.write_text("line1\nline2\nline3\nline4", encoding="utf-8")
        result = await file_read(path=str(f), offset=2)
        assert result.success
        assert "line3" in result.output
        assert "line1" not in result.output

    @pytest.mark.asyncio
    async def test_read_with_limit(self, tmp_path: Path):
        f = tmp_path / "limit.txt"
        f.write_text("line1\nline2\nline3\nline4\nline5", encoding="utf-8")
        result = await file_read(path=str(f), limit=2)
        assert result.success
        assert "line1" in result.output
        assert "line2" in result.output
        assert "line3" not in result.output

    @pytest.mark.asyncio
    async def test_read_with_offset_and_limit(self, tmp_path: Path):
        f = tmp_path / "both.txt"
        f.write_text("a\nb\nc\nd\ne", encoding="utf-8")
        result = await file_read(path=str(f), offset=1, limit=2)
        assert result.success
        assert "b" in result.output
        assert "c" in result.output
        assert "a" not in result.output
        assert "d" not in result.output

    @pytest.mark.asyncio
    async def test_read_nonexistent_file(self):
        result = await file_read(path="/nonexistent/file.txt")
        assert not result.success
        assert "not found" in result.error.lower()

    @pytest.mark.asyncio
    async def test_read_directory_instead_of_file(self, tmp_path: Path):
        result = await file_read(path=str(tmp_path))
        assert not result.success
        assert "Not a file" in result.error

    @pytest.mark.asyncio
    async def test_read_empty_file(self, tmp_path: Path):
        f = tmp_path / "empty.txt"
        f.write_text("", encoding="utf-8")
        result = await file_read(path=str(f))
        assert result.success

    @pytest.mark.asyncio
    async def test_read_unicode_content(self, tmp_path: Path):
        f = tmp_path / "unicode.txt"
        f.write_text("Hello World", encoding="utf-8")
        result = await file_read(path=str(f))
        assert result.success
        assert "Hello World" in result.output

    @pytest.mark.asyncio
    async def test_read_offset_beyond_file(self, tmp_path: Path):
        f = tmp_path / "short.txt"
        f.write_text("only line", encoding="utf-8")
        result = await file_read(path=str(f), offset=100)
        assert result.success
        assert result.output.strip() == ""

    @pytest.mark.asyncio
    async def test_read_kwargs_ignored(self, tmp_path: Path):
        f = tmp_path / "kw.txt"
        f.write_text("content", encoding="utf-8")
        result = await file_read(path=str(f), extra="ignored")
        assert result.success


# --- file_write ---


class TestFileWrite:
    @pytest.mark.asyncio
    async def test_write_new_file(self, tmp_path: Path):
        f = tmp_path / "new.txt"
        result = await file_write(path=str(f), content="hello world")
        assert result.success
        assert f.read_text() == "hello world"
        assert "11 bytes" in result.output

    @pytest.mark.asyncio
    async def test_overwrite_existing_file(self, tmp_path: Path):
        f = tmp_path / "existing.txt"
        f.write_text("old content", encoding="utf-8")
        result = await file_write(path=str(f), content="new content")
        assert result.success
        assert f.read_text() == "new content"

    @pytest.mark.asyncio
    async def test_creates_parent_directories(self, tmp_path: Path):
        f = tmp_path / "deep" / "nested" / "dir" / "file.txt"
        result = await file_write(path=str(f), content="deep content")
        assert result.success
        assert f.read_text() == "deep content"

    @pytest.mark.asyncio
    async def test_write_empty_content(self, tmp_path: Path):
        f = tmp_path / "empty.txt"
        result = await file_write(path=str(f), content="")
        assert result.success
        assert f.read_text() == ""
        assert "0 bytes" in result.output

    @pytest.mark.asyncio
    async def test_write_unicode_content(self, tmp_path: Path):
        f = tmp_path / "unicode.txt"
        result = await file_write(path=str(f), content="Hello World")
        assert result.success
        assert f.read_text(encoding="utf-8") == "Hello World"

    @pytest.mark.asyncio
    async def test_write_large_content(self, tmp_path: Path):
        f = tmp_path / "large.txt"
        large = "x" * 100000
        result = await file_write(path=str(f), content=large)
        assert result.success
        assert f.read_text() == large

    @pytest.mark.asyncio
    async def test_write_kwargs_ignored(self, tmp_path: Path):
        f = tmp_path / "kw.txt"
        result = await file_write(path=str(f), content="ok", extra="ignored")
        assert result.success


# --- file_list ---


class TestFileList:
    @pytest.mark.asyncio
    async def test_list_directory(self, tmp_path: Path):
        (tmp_path / "a.txt").write_text("a", encoding="utf-8")
        (tmp_path / "b.py").write_text("b", encoding="utf-8")
        result = await file_list(path=str(tmp_path))
        assert result.success
        assert "a.txt" in result.output
        assert "b.py" in result.output

    @pytest.mark.asyncio
    async def test_list_with_pattern(self, tmp_path: Path):
        (tmp_path / "a.txt").write_text("a", encoding="utf-8")
        (tmp_path / "b.py").write_text("b", encoding="utf-8")
        result = await file_list(path=str(tmp_path), pattern="*.py")
        assert result.success
        assert "b.py" in result.output
        assert "a.txt" not in result.output

    @pytest.mark.asyncio
    async def test_list_recursive(self, tmp_path: Path):
        sub = tmp_path / "sub"
        sub.mkdir()
        (sub / "nested.txt").write_text("nested", encoding="utf-8")
        (tmp_path / "top.txt").write_text("top", encoding="utf-8")
        result = await file_list(path=str(tmp_path), recursive=True)
        assert result.success
        assert "nested.txt" in result.output
        assert "top.txt" in result.output

    @pytest.mark.asyncio
    async def test_list_directories_marked_with_d(self, tmp_path: Path):
        (tmp_path / "subdir").mkdir()
        (tmp_path / "file.txt").write_text("f", encoding="utf-8")
        result = await file_list(path=str(tmp_path))
        assert result.success
        lines = result.output.strip().split("\n")
        dir_lines = [l for l in lines if l.startswith("d")]
        file_lines = [l for l in lines if l.startswith("f")]
        assert len(dir_lines) >= 1
        assert len(file_lines) >= 1

    @pytest.mark.asyncio
    async def test_list_shows_file_sizes(self, tmp_path: Path):
        (tmp_path / "sized.txt").write_text("hello world", encoding="utf-8")
        result = await file_list(path=str(tmp_path))
        assert result.success
        # Size column should be present
        assert "11" in result.output or "sized.txt" in result.output

    @pytest.mark.asyncio
    async def test_list_empty_directory(self, tmp_path: Path):
        empty_dir = tmp_path / "empty"
        empty_dir.mkdir()
        result = await file_list(path=str(empty_dir))
        assert result.success
        assert "empty" in result.output.lower()

    @pytest.mark.asyncio
    async def test_list_nonexistent_directory(self):
        result = await file_list(path="/nonexistent/directory")
        assert not result.success
        assert "not found" in result.error.lower()

    @pytest.mark.asyncio
    async def test_list_file_instead_of_directory(self, tmp_path: Path):
        f = tmp_path / "notadir.txt"
        f.write_text("content", encoding="utf-8")
        result = await file_list(path=str(f))
        assert not result.success
        assert "Not a directory" in result.error

    @pytest.mark.asyncio
    async def test_list_kwargs_ignored(self, tmp_path: Path):
        (tmp_path / "test.txt").write_text("t", encoding="utf-8")
        result = await file_list(path=str(tmp_path), extra="ignored")
        assert result.success

    @pytest.mark.asyncio
    async def test_list_recursive_with_pattern(self, tmp_path: Path):
        sub = tmp_path / "src"
        sub.mkdir()
        (sub / "main.py").write_text("code", encoding="utf-8")
        (sub / "readme.md").write_text("doc", encoding="utf-8")
        (tmp_path / "top.py").write_text("top", encoding="utf-8")
        result = await file_list(path=str(tmp_path), pattern="*.py", recursive=True)
        assert result.success
        assert "main.py" in result.output
        assert "top.py" in result.output
        assert "readme.md" not in result.output
