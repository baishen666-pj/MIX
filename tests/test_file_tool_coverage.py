"""Additional coverage tests for engine.tools.file.

Targets uncovered lines 33-34, 43-44, 68-69:
- Line 33-34: Exception in file_read (permission denied, encoding error)
- Line 43-44: Exception in file_write (permission denied, read-only FS)
- Line 68-69: Exception in file_list (stat failure, permission denied)
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

from engine.tools.file import file_list, file_read, file_write


class TestFileReadExceptions:
    """Cover lines 33-34: the generic except branch in file_read."""

    @pytest.mark.asyncio
    async def test_read_permission_error(self, tmp_path: Path) -> None:
        f = tmp_path / "noperm.txt"
        f.write_text("secret", encoding="utf-8")

        with patch.object(Path, "read_text", side_effect=PermissionError("access denied")):
            result = await file_read(path=str(f))
        assert not result.success
        assert "access denied" in result.error

    @pytest.mark.asyncio
    async def test_read_unexpected_exception(self, tmp_path: Path) -> None:
        f = tmp_path / "broken.txt"
        f.write_text("data", encoding="utf-8")

        with patch.object(Path, "read_text", side_effect=RuntimeError("unexpected")):
            result = await file_read(path=str(f))
        assert not result.success
        assert "unexpected" in result.error


class TestFileWriteExceptions:
    """Cover lines 43-44: the generic except branch in file_write."""

    @pytest.mark.asyncio
    async def test_write_permission_error(self, tmp_path: Path) -> None:
        f = tmp_path / "readonly.txt"

        with patch.object(Path, "write_text", side_effect=PermissionError("write denied")):
            result = await file_write(path=str(f), content="data")
        assert not result.success
        assert "write denied" in result.error

    @pytest.mark.asyncio
    async def test_write_os_error(self, tmp_path: Path) -> None:
        f = tmp_path / "disk_full.txt"

        with patch.object(Path, "write_text", side_effect=OSError("no space left")):
            result = await file_write(path=str(f), content="data")
        assert not result.success
        assert "no space left" in result.error


class TestFileListExceptions:
    """Cover lines 68-69: the generic except branch in file_list."""

    @pytest.mark.asyncio
    async def test_list_stat_permission_error(self, tmp_path: Path) -> None:
        (tmp_path / "a.txt").write_text("a", encoding="utf-8")

        with patch("engine.tools.file.Path.iterdir", side_effect=PermissionError("denied")):
            result = await file_list(path=str(tmp_path))
        assert not result.success
        assert "denied" in result.error

    @pytest.mark.asyncio
    async def test_list_unexpected_exception(self, tmp_path: Path) -> None:
        (tmp_path / "b.txt").write_text("b", encoding="utf-8")

        with patch("engine.tools.file.Path.iterdir", side_effect=RuntimeError("fail")):
            result = await file_list(path=str(tmp_path))
        assert not result.success
        assert "fail" in result.error


class TestFileReadEdgeCases:
    """Additional edge cases for file_read offset/limit."""

    @pytest.mark.asyncio
    async def test_read_with_zero_limit(self, tmp_path: Path) -> None:
        f = tmp_path / "zero_limit.txt"
        f.write_text("line1\nline2\nline3", encoding="utf-8")
        result = await file_read(path=str(f), limit=0)
        assert result.success
        assert result.output.strip() == ""

    @pytest.mark.asyncio
    async def test_read_large_offset_produces_empty(self, tmp_path: Path) -> None:
        f = tmp_path / "small.txt"
        f.write_text("only", encoding="utf-8")
        result = await file_read(path=str(f), offset=9999, limit=10)
        assert result.success
        assert result.output.strip() == ""

    @pytest.mark.asyncio
    async def test_read_offset_zero_explicit(self, tmp_path: Path) -> None:
        f = tmp_path / "explicit_zero.txt"
        f.write_text("a\nb\nc", encoding="utf-8")
        result = await file_read(path=str(f), offset=0, limit=2)
        assert result.success
        assert "a" in result.output
        assert "b" in result.output
        assert "c" not in result.output
