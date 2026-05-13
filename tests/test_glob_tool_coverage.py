"""Additional coverage tests for engine.tools.glob.

Targets uncovered lines 32-33: the generic except branch in glob_search.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

from engine.tools.glob import glob_search


class TestGlobExceptions:
    """Cover lines 32-33: exception handler in glob_search."""

    @pytest.mark.asyncio
    async def test_glob_stat_permission_error(self, tmp_path: Path) -> None:
        (tmp_path / "a.txt").write_text("a", encoding="utf-8")

        with patch.object(Path, "rglob", side_effect=PermissionError("denied")):
            result = await glob_search("*.txt", str(tmp_path))
        assert not result.success
        assert "denied" in result.error

    @pytest.mark.asyncio
    async def test_glob_unexpected_exception(self, tmp_path: Path) -> None:
        (tmp_path / "b.txt").write_text("b", encoding="utf-8")

        with patch.object(Path, "rglob", side_effect=RuntimeError("unexpected failure")):
            result = await glob_search("*.txt", str(tmp_path))
        assert not result.success
        assert "unexpected failure" in result.error


class TestGlobEdgeCases:
    """Additional edge cases for glob_search."""

    @pytest.mark.asyncio
    async def test_glob_empty_pattern(self, tmp_path: Path) -> None:
        (tmp_path / "file.txt").write_text("data", encoding="utf-8")
        result = await glob_search("", str(tmp_path))
        # Empty pattern returns nothing (no files match empty string)
        assert result.success

    @pytest.mark.asyncio
    async def test_glob_nonexistent_directory(self) -> None:
        result = await glob_search("*", "/nonexistent/dir/xyz")
        assert not result.success
        assert "not found" in result.error.lower()

    @pytest.mark.asyncio
    async def test_glob_recursive_double_star(self, tmp_path: Path) -> None:
        sub = tmp_path / "deep" / "nested"
        sub.mkdir(parents=True)
        (sub / "found.py").write_text("code", encoding="utf-8")
        (tmp_path / "top.py").write_text("top", encoding="utf-8")

        result = await glob_search("**/*.py", str(tmp_path))
        assert result.success
        assert "found.py" in result.output
        assert "top.py" in result.output

    @pytest.mark.asyncio
    async def test_glob_no_matches_message(self, tmp_path: Path) -> None:
        (tmp_path / "readme.md").write_text("doc", encoding="utf-8")
        result = await glob_search("*.rs", str(tmp_path))
        assert result.success
        assert "No files matched" in result.output
        assert result.metadata is not None
        assert result.metadata["count"] == 0
