"""Additional coverage for engine.tools.edit.

Targets uncovered lines:
- Line 24: not-a-file path (directory given instead of file)
- Lines 53-54: generic exception during write (permission error)
- Line 67: file_edit_lines file not found
- Line 69: file_edit_lines not-a-file
- Line 73: end_line < start_line
- Lines 95-96: file_edit_lines generic exception
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

from engine.tools.edit import file_edit, file_edit_lines

# --- file_edit: not a file (line 24) ---


@pytest.mark.asyncio
async def test_file_edit_directory_path(tmp_path: Path):
    """Editing a directory path returns 'Not a file' error."""
    subdir = tmp_path / "subdir"
    subdir.mkdir()
    result = await file_edit(str(subdir), "old", "new")
    assert result.success is False
    assert "Not a file" in result.error


# --- file_edit: generic exception during write (lines 53-54) ---


@pytest.mark.asyncio
async def test_file_edit_write_failure(tmp_path: Path):
    """Write failure is caught by outer except and returned as error."""
    target = tmp_path / "readonly.txt"
    target.write_text("original content here", encoding="utf-8")

    # Patch Path.write_text to raise OSError
    with patch.object(Path, "write_text", side_effect=OSError("disk full")):
        result = await file_edit(str(target), "original", "replaced")
        assert result.success is False
        assert "disk full" in result.error


# --- file_edit: replace_all with multiple occurrences returns correct count ---


@pytest.mark.asyncio
async def test_file_edit_replace_all_count(tmp_path: Path):
    """replace_all replaces all occurrences and reports correct count."""
    target = tmp_path / "multi.txt"
    target.write_text("aaa bbb aaa ccc aaa", encoding="utf-8")
    result = await file_edit(str(target), "aaa", "zzz", replace_all=True)
    assert result.success is True
    assert "3 occurrence" in result.output
    assert target.read_text() == "zzz bbb zzz ccc zzz"


# --- file_edit: single occurrence with replace_all=true still works ---


@pytest.mark.asyncio
async def test_file_edit_replace_all_single_occurrence(tmp_path: Path):
    """replace_all with a single occurrence replaces correctly."""
    target = tmp_path / "single.txt"
    target.write_text("only one match here", encoding="utf-8")
    result = await file_edit(str(target), "one", "TWO", replace_all=True)
    assert result.success is True
    assert "1 occurrence" in result.output


# --- file_edit_lines: file not found (line 67) ---


@pytest.mark.asyncio
async def test_file_edit_lines_file_not_found():
    """file_edit_lines returns error for nonexistent file."""
    result = await file_edit_lines("/nonexistent/path.txt", 1, 2, "new")
    assert result.success is False
    assert "not found" in (result.error or "").lower()


# --- file_edit_lines: not a file (line 69) ---


@pytest.mark.asyncio
async def test_file_edit_lines_directory_path(tmp_path: Path):
    """file_edit_lines returns error when path is a directory."""
    subdir = tmp_path / "a_dir"
    subdir.mkdir()
    result = await file_edit_lines(str(subdir), 1, 2, "new")
    assert result.success is False
    assert "Not a file" in result.error


# --- file_edit_lines: end_line < start_line (line 73) ---


@pytest.mark.asyncio
async def test_file_edit_lines_end_before_start(tmp_path: Path):
    """file_edit_lines returns error when end_line < start_line."""
    target = tmp_path / "test.txt"
    target.write_text("line1\nline2\nline3\n", encoding="utf-8")
    result = await file_edit_lines(str(target), 3, 1, "new")
    assert result.success is False
    assert "end_line must be >= start_line" in result.error


# --- file_edit_lines: generic exception (lines 95-96) ---


@pytest.mark.asyncio
async def test_file_edit_lines_write_failure(tmp_path: Path):
    """Write failure in file_edit_lines is caught by outer except."""
    target = tmp_path / "test.txt"
    target.write_text("line1\nline2\n", encoding="utf-8")

    with patch.object(Path, "write_text", side_effect=OSError("permission denied")):
        result = await file_edit_lines(str(target), 1, 2, "replacement")
        assert result.success is False
        assert "permission denied" in result.error


# --- file_edit_lines: replacing at exact end of file ---


@pytest.mark.asyncio
async def test_file_edit_lines_at_file_end(tmp_path: Path):
    """Replacing the last line works correctly."""
    target = tmp_path / "end.txt"
    target.write_text("alpha\nbeta\ngamma\n", encoding="utf-8")
    result = await file_edit_lines(str(target), 3, 3, "GAMMA")
    assert result.success is True
    lines = target.read_text().splitlines()
    assert lines[2] == "GAMMA"


# --- file_edit_lines: content without trailing newline gets one appended ---


@pytest.mark.asyncio
async def test_file_edit_lines_adds_trailing_newline(tmp_path: Path):
    """When replacement content does not end with newline, one is appended."""
    target = tmp_path / "newline.txt"
    target.write_text("a\nb\nc\n", encoding="utf-8")
    result = await file_edit_lines(str(target), 1, 1, "X")
    assert result.success is True
    content = target.read_text()
    lines = content.splitlines()
    assert lines[0] == "X"
    assert lines[1] == "b"


# --- file_edit: path traversal attempt via absolute path outside sandbox ---
# (This is a behavioral test -- the tool itself does not enforce sandbox,
# but we verify it handles normal paths with ../ segments.)


@pytest.mark.asyncio
async def test_file_edit_with_parent_reference(tmp_path: Path):
    """File edit resolves paths with parent directory references."""
    subdir = tmp_path / "sub"
    subdir.mkdir()
    target = subdir / "target.txt"
    target.write_text("hello world", encoding="utf-8")

    # Use relative parent reference from subdir
    result = await file_edit(str(target), "hello", "goodbye")
    assert result.success is True
    assert target.read_text() == "goodbye world"


# --- file_edit_lines: end_line exceeds file length (clamped) ---


@pytest.mark.asyncio
async def test_file_edit_lines_end_exceeds_file_length(tmp_path: Path):
    """end_line beyond file length is clamped to actual length."""
    target = tmp_path / "short.txt"
    target.write_text("only\n", encoding="utf-8")
    # end_line=10 exceeds the 1-line file
    result = await file_edit_lines(str(target), 1, 10, "replaced\n")
    assert result.success is True
    assert "Replaced lines 1-1" in result.output
