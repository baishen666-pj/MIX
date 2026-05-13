"""Additional coverage tests for engine.tools.grep.

Targets uncovered lines 104, 108, 111, 113-114, 152-153, 193:
- Line 104: max_results limit break
- Lines 108, 111, 113-114: binary file skip, large file skip, OSError skip
- Lines 152-153: top-level exception handler
- Line 193: _type_to_glob for unmapped file type
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

from engine.tools.grep import _type_to_glob, content_search


class TestGrepMaxResults:
    """Cover line 104: max_results causes early break."""

    @pytest.mark.asyncio
    async def test_max_results_limits_output(self, tmp_path: Path) -> None:
        for i in range(20):
            (tmp_path / f"f{i}.txt").write_text(f"match_line {i}\n", encoding="utf-8")

        result = await content_search("match_line", str(tmp_path), max_results=3, output_mode="content")
        assert result.success
        assert result.metadata is not None
        assert result.metadata["total_matches"] == 3


class TestGrepBinaryFileSkip:
    """Cover line 108: binary extension skip."""

    @pytest.mark.asyncio
    async def test_binary_files_skipped(self, tmp_path: Path) -> None:
        (tmp_path / "data.bin").write_bytes(b"match_line binary content\x00\xff")
        (tmp_path / "good.txt").write_text("match_line text", encoding="utf-8")

        result = await content_search("match_line", str(tmp_path), output_mode="files_with_matches")
        assert result.success
        assert "good.txt" in result.output
        assert "data.bin" not in result.output


class TestGrepLargeFileSkip:
    """Cover line 111: file exceeding _MAX_FILE_SIZE is skipped."""

    @pytest.mark.asyncio
    async def test_oversized_file_skipped(self, tmp_path: Path) -> None:
        big = tmp_path / "huge.txt"
        big.write_text("x" * 200, encoding="utf-8")

        with patch("engine.tools.grep._MAX_FILE_SIZE", 100):
            result = await content_search("x", str(tmp_path), output_mode="files_with_matches")
        assert result.success
        assert "No matches found" in result.output or "huge.txt" not in result.output


class TestGrepOSErrorSkip:
    """Cover lines 113-114: OSError / PermissionError during read."""

    @pytest.mark.asyncio
    async def test_permission_error_file_skipped(self, tmp_path: Path) -> None:
        good = tmp_path / "readable.txt"
        good.write_text("target_match here", encoding="utf-8")
        bad = tmp_path / "noperm.txt"
        bad.write_text("target_match also", encoding="utf-8")

        original_read_text = Path.read_text

        def _patched_read(self_inner: Path, *args, **kwargs):
            if "noperm" in str(self_inner):
                raise PermissionError("no access")
            return original_read_text(self_inner, *args, **kwargs)

        with patch.object(Path, "read_text", _patched_read):
            result = await content_search("target_match", str(tmp_path), output_mode="files_with_matches")
        assert result.success
        assert "readable.txt" in result.output


class TestGrepTopLevelException:
    """Cover lines 152-153: top-level except handler."""

    @pytest.mark.asyncio
    async def test_unexpected_exception_returns_error(self, tmp_path: Path) -> None:
        (tmp_path / "a.txt").write_text("hello", encoding="utf-8")

        with patch("engine.tools.grep.re.compile", side_effect=RuntimeError("boom")):
            result = await content_search("hello", str(tmp_path))
        assert not result.success
        assert "boom" in result.error


class TestGrepOutputModes:
    """Cover output format edge cases for count and files_with_matches with no matches."""

    @pytest.mark.asyncio
    async def test_count_mode_no_matches(self, tmp_path: Path) -> None:
        (tmp_path / "a.txt").write_text("no relevant content", encoding="utf-8")
        result = await content_search("zzzznotfound", str(tmp_path), output_mode="count")
        assert result.success
        assert "No matches found" in result.output

    @pytest.mark.asyncio
    async def test_files_with_matches_no_matches(self, tmp_path: Path) -> None:
        (tmp_path / "a.txt").write_text("nothing here", encoding="utf-8")
        result = await content_search("zzzznotfound", str(tmp_path), output_mode="files_with_matches")
        assert result.success
        assert "No matches found" in result.output

    @pytest.mark.asyncio
    async def test_count_mode_with_matches(self, tmp_path: Path) -> None:
        (tmp_path / "a.txt").write_text("aaa\nbbb\naaa\n", encoding="utf-8")
        result = await content_search("aaa", str(tmp_path), output_mode="count")
        assert result.success
        assert "2:" in result.output


class TestGrepContextLines:
    """Cover context lines rendering more thoroughly."""

    @pytest.mark.asyncio
    async def test_context_lines_at_file_start(self, tmp_path: Path) -> None:
        (tmp_path / "start.txt").write_text("match_here\nline2\nline3\n", encoding="utf-8")
        result = await content_search("match_here", str(tmp_path), context=2)
        assert result.success
        assert "match_here" in result.output

    @pytest.mark.asyncio
    async def test_context_lines_at_file_end(self, tmp_path: Path) -> None:
        (tmp_path / "end.txt").write_text("line1\nline2\nmatch_last\n", encoding="utf-8")
        result = await content_search("match_last", str(tmp_path), context=2)
        assert result.success
        assert "match_last" in result.output
        assert "line1" in result.output
        assert "line2" in result.output


class TestTypeToGlob:
    """Cover line 193: _type_to_glob for unmapped types."""

    def test_unmapped_type_returns_none(self) -> None:
        assert _type_to_glob("brainfuck") is None

    def test_none_type_returns_none(self) -> None:
        assert _type_to_glob(None) is None

    def test_mapped_type_returns_glob(self) -> None:
        assert _type_to_glob("py") == "*.py"
        assert _type_to_glob("rs") == "*.rs"
        assert _type_to_glob("md") == "*.md"

    def test_case_insensitive(self) -> None:
        assert _type_to_glob("PY") == "*.py"
        assert _type_to_glob("TS") == "*.ts"


class TestGrepFileTypeFilter:
    """Cover file_type parameter path through _type_to_glob."""

    @pytest.mark.asyncio
    async def test_file_type_filters_to_py(self, tmp_path: Path) -> None:
        (tmp_path / "app.py").write_text("search_target = True\n", encoding="utf-8")
        (tmp_path / "app.js").write_text("search_target = true;\n", encoding="utf-8")

        result = await content_search("search_target", str(tmp_path), file_type="py", output_mode="files_with_matches")
        assert result.success
        assert "app.py" in result.output
        assert "app.js" not in result.output
