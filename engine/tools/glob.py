from __future__ import annotations

from pathlib import Path
from typing import Any

from engine.tools.types import ToolResult


async def glob_search(pattern: str, path: str = ".", **_: Any) -> ToolResult:
    try:
        base = Path(path)
        if not base.exists():
            return ToolResult(output="", error=f"Path not found: {path}", success=False)

        matches = sorted(
            base.rglob(pattern),
            key=lambda p: p.stat().st_mtime if p.exists() else 0,
            reverse=True,
        )

        lines = []
        for m in matches:
            rel = m.relative_to(base)
            if m.is_dir():
                lines.append(f"d  {rel}/")
            else:
                size = m.stat().st_size
                lines.append(f"f  {size:>10}  {rel}")

        output = "\n".join(lines) if lines else "No files matched the pattern"
        return ToolResult(output=output, metadata={"count": len(lines)})
    except Exception as e:
        return ToolResult(output="", error=str(e), success=False)
