import pytest
from pathlib import Path

from engine.tools.sandbox import FileSandbox


def test_sandbox_allows_cwd():
    sandbox = FileSandbox()
    resolved = sandbox.validate_path(".")
    assert resolved == Path(".").resolve()


def test_sandbox_allows_subdirectory(tmp_path):
    sandbox = FileSandbox([str(tmp_path)])
    subdir = tmp_path / "sub"
    subdir.mkdir()
    resolved = sandbox.validate_path(str(subdir / "file.txt"))
    assert resolved.is_relative_to(tmp_path.resolve())


def test_sandbox_blocks_outside(tmp_path):
    sandbox = FileSandbox([str(tmp_path)])
    with pytest.raises(PermissionError, match="outside allowed"):
        sandbox.validate_path("/etc/passwd")


def test_sandbox_blocks_parent(tmp_path):
    sandbox = FileSandbox([str(tmp_path)])
    with pytest.raises(PermissionError, match="outside allowed"):
        sandbox.validate_path(str(tmp_path.parent))


def test_sandbox_allowed_dirs_property():
    sandbox = FileSandbox(["/tmp", "/var"])
    dirs = sandbox.allowed_dirs
    assert len(dirs) == 2
    assert all(isinstance(d, Path) for d in dirs)


def test_sandbox_validate_read_and_write(tmp_path):
    sandbox = FileSandbox([str(tmp_path)])
    path = sandbox.validate_read(str(tmp_path / "read.txt"))
    assert path.is_relative_to(tmp_path.resolve())
    path = sandbox.validate_write(str(tmp_path / "write.txt"))
    assert path.is_relative_to(tmp_path.resolve())
