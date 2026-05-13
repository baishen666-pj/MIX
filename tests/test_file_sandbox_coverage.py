"""Edge-case tests for engine.tools.sandbox.FileSandbox.

Supplements tests/test_file_sandbox.py with path traversal, multi-dir,
Path object inputs, exact match, and error message coverage.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from engine.tools.sandbox import FileSandbox


class TestPathTraversal:
    def test_blocks_dotdot_traversal(self, tmp_path: Path):
        sandbox = FileSandbox([str(tmp_path)])
        with pytest.raises(PermissionError, match="outside allowed"):
            sandbox.validate_path(str(tmp_path / ".." / "etc" / "passwd"))

    def test_blocks_absolute_path_outside(self, tmp_path: Path):
        sandbox = FileSandbox([str(tmp_path)])
        with pytest.raises(PermissionError):
            sandbox.validate_path("/usr/bin/python")

    def test_blocks_relative_escape_from_subdir(self, tmp_path: Path):
        sub = tmp_path / "sub"
        sub.mkdir()
        sandbox = FileSandbox([str(sub)])
        with pytest.raises(PermissionError):
            sandbox.validate_path(str(sub / ".." / "secret.txt"))


class TestMultipleAllowedDirs:
    def test_allows_path_in_second_dir(self, tmp_path: Path):
        dir1, dir2 = tmp_path / "a", tmp_path / "b"
        dir1.mkdir()
        dir2.mkdir()
        sandbox = FileSandbox([str(dir1), str(dir2)])
        resolved = sandbox.validate_path(str(dir2 / "file.txt"))
        assert resolved.is_relative_to(dir2.resolve())

    def test_blocks_path_in_neither_dir(self, tmp_path: Path):
        dir1 = tmp_path / "a"
        dir1.mkdir()
        sandbox = FileSandbox([str(dir1)])
        with pytest.raises(PermissionError):
            sandbox.validate_path(str(tmp_path / "b" / "file.txt"))


class TestExactMatch:
    def test_allows_exact_allowed_dir(self, tmp_path: Path):
        sandbox = FileSandbox([str(tmp_path)])
        resolved = sandbox.validate_path(str(tmp_path))
        assert resolved == tmp_path.resolve()


class TestPathTypes:
    def test_accepts_path_object_allowed_dirs(self, tmp_path: Path):
        sandbox = FileSandbox([tmp_path])
        resolved = sandbox.validate_path(tmp_path / "file.txt")
        assert resolved.is_relative_to(tmp_path.resolve())

    def test_accepts_path_object_input(self, tmp_path: Path):
        sandbox = FileSandbox([str(tmp_path)])
        resolved = sandbox.validate_path(tmp_path / "file.txt")
        assert resolved.is_relative_to(tmp_path.resolve())

    def test_allowed_dirs_returns_path_objects(self, tmp_path: Path):
        sandbox = FileSandbox([str(tmp_path)])
        assert all(isinstance(d, Path) for d in sandbox.allowed_dirs)

    def test_allowed_dirs_returns_copy(self, tmp_path: Path):
        sandbox = FileSandbox([str(tmp_path)])
        assert sandbox.allowed_dirs is not sandbox.allowed_dirs


class TestValidateReadAndWrite:
    def test_validate_read_delegates(self, tmp_path: Path):
        sandbox = FileSandbox([str(tmp_path)])
        resolved = sandbox.validate_read(str(tmp_path / "read.txt"))
        assert resolved.is_relative_to(tmp_path.resolve())

    def test_validate_write_delegates(self, tmp_path: Path):
        sandbox = FileSandbox([str(tmp_path)])
        resolved = sandbox.validate_write(str(tmp_path / "write.txt"))
        assert resolved.is_relative_to(tmp_path.resolve())


class TestErrorMessages:
    def test_error_includes_path(self, tmp_path: Path):
        sandbox = FileSandbox([str(tmp_path)])
        with pytest.raises(PermissionError, match="outside allowed"):
            sandbox.validate_path("/forbidden/path")

    def test_error_includes_allowed_dirs(self, tmp_path: Path):
        import re
        sandbox = FileSandbox([str(tmp_path)])
        pattern = re.escape(str(tmp_path.resolve()))
        with pytest.raises(PermissionError, match=pattern):
            sandbox.validate_path("/forbidden/path")
