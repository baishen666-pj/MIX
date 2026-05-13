from __future__ import annotations

from pathlib import Path


class FileSandbox:
    def __init__(self, allowed_dirs: list[str | Path] | None = None) -> None:
        if allowed_dirs is None:
            self._allowed = [Path(".").resolve()]
        else:
            self._allowed = [Path(d).resolve() for d in allowed_dirs]

    def validate_path(self, path: str | Path) -> Path:
        resolved = Path(path).resolve()
        if not any(resolved == allowed or resolved.is_relative_to(allowed) for allowed in self._allowed):
            allowed_str = ", ".join(str(d) for d in self._allowed)
            raise PermissionError(f"Path '{path}' is outside allowed directories: {allowed_str}")
        return resolved

    def validate_read(self, path: str | Path) -> Path:
        return self.validate_path(path)

    def validate_write(self, path: str | Path) -> Path:
        return self.validate_path(path)

    @property
    def allowed_dirs(self) -> list[Path]:
        return list(self._allowed)
