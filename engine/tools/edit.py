from __future__ import annotations

from pathlib import Path
from typing import Any

from engine.tools.types import ToolResult


async def file_edit(
    path: str,
    old_string: str,
    new_string: str,
    replace_all: bool = False,
    **_: Any,
) -> ToolResult:
    if not old_string:
        return ToolResult(output="", error="old_string must be non-empty", success=False)

    try:
        p = Path(path)
        if not p.exists():
            return ToolResult(output="", error=f"File not found: {path}", success=False)
        if not p.is_file():
            return ToolResult(output="", error=f"Not a file: {path}", success=False)

        content = p.read_text(encoding="utf-8", errors="replace")
        count = content.count(old_string)

        if count == 0:
            return ToolResult(output="", error=f"old_string not found in {path}", success=False)
        if count > 1 and not replace_all:
            return ToolResult(
                output="",
                error=f"old_string appears {count} times in {path}. "
                f"Use replace_all=true to replace all occurrences, "
                f"or provide more context to make the match unique.",
                success=False,
            )

        new_content = (
            content.replace(old_string, new_string) if replace_all else content.replace(old_string, new_string, 1)
        )
        p.write_text(new_content, encoding="utf-8")

        replaced = count if replace_all else 1
        lines_added = new_string.count("\n") + 1
        lines_removed = old_string.count("\n") + 1
        return ToolResult(
            output=f"Replaced {replaced} occurrence(s) in {path} "
            f"(~{lines_removed} lines removed, ~{lines_added} lines added)",
            metadata={"replaced": replaced, "path": path},
        )
    except Exception as e:
        return ToolResult(output="", error=str(e), success=False)


async def file_edit_lines(
    path: str,
    start_line: int,
    end_line: int,
    content: str,
    **_: Any,
) -> ToolResult:
    try:
        p = Path(path)
        if not p.exists():
            return ToolResult(output="", error=f"File not found: {path}", success=False)
        if not p.is_file():
            return ToolResult(output="", error=f"Not a file: {path}", success=False)
        if start_line < 1:
            return ToolResult(output="", error="start_line must be >= 1", success=False)
        if end_line < start_line:
            return ToolResult(output="", error="end_line must be >= start_line", success=False)

        lines = p.read_text(encoding="utf-8", errors="replace").splitlines(keepends=True)

        if start_line > len(lines):
            return ToolResult(
                output="", error=f"start_line {start_line} exceeds file length {len(lines)}", success=False
            )

        actual_end = min(end_line, len(lines))
        removed = lines[start_line - 1 : actual_end]
        new_lines = content.splitlines(keepends=True)
        if content and not content.endswith("\n"):
            new_lines[-1] += "\n"

        lines[start_line - 1 : actual_end] = new_lines
        p.write_text("".join(lines), encoding="utf-8")

        return ToolResult(
            output=f"Replaced lines {start_line}-{actual_end} in {path}",
            metadata={"start": start_line, "end": actual_end, "path": path},
        )
    except Exception as e:
        return ToolResult(output="", error=str(e), success=False)
