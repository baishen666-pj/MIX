from __future__ import annotations

from pathlib import Path
from typing import Any

from engine.tools.types import ToolResult


async def file_read(path: str, offset: int | None = None, limit: int | None = None, line_numbers: bool = True, **_: Any) -> ToolResult:
    try:
        p = Path(path)
        if not p.exists():
            return ToolResult(output="", error=f"File not found: {path}", success=False)
        if not p.is_file():
            return ToolResult(output="", error=f"Not a file: {path}", success=False)

        all_lines = p.read_text(encoding="utf-8", errors="replace").splitlines(keepends=True)

        start = offset if offset is not None else 0
        end = start + limit if limit is not None else len(all_lines)
        selected = all_lines[start:end]

        if line_numbers:
            numbered = []
            for i, line in enumerate(selected, start=start + 1):
                line_content = line.rstrip("\n")
                numbered.append(f"{i:>6}\t{line_content}")
            return ToolResult(output="\n".join(numbered))

        return ToolResult(output="".join(selected))
    except Exception as e:
        return ToolResult(output="", error=str(e), success=False)


async def file_write(path: str, content: str, **_: Any) -> ToolResult:
    try:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return ToolResult(output=f"Wrote {len(content)} bytes to {path}")
    except Exception as e:
        return ToolResult(output="", error=str(e), success=False)


async def file_list(path: str = ".", pattern: str | None = None, recursive: bool = False, **_: Any) -> ToolResult:
    try:
        p = Path(path)
        if not p.exists():
            return ToolResult(output="", error=f"Directory not found: {path}", success=False)
        if not p.is_dir():
            return ToolResult(output="", error=f"Not a directory: {path}", success=False)

        if pattern:
            matches = p.rglob(pattern) if recursive else p.glob(pattern)
        else:
            matches = p.rglob("*") if recursive else p.iterdir()

        entries = sorted(matches, key=lambda x: (not x.is_dir(), str(x)))
        lines = []
        for entry in entries:
            prefix = "d" if entry.is_dir() else "f"
            size = entry.stat().st_size if entry.is_file() else 0
            lines.append(f"{prefix} {size:>10}  {entry.relative_to(p)}")

        return ToolResult(output="\n".join(lines) or "(empty)")
    except Exception as e:
        return ToolResult(output="", error=str(e), success=False)
