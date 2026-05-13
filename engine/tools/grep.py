from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from engine.tools.types import ToolResult

_DEFAULT_MAX_RESULTS = 250
_MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

_BINARY_EXTENSIONS = frozenset(
    {
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".bmp",
        ".ico",
        ".webp",
        ".svg",
        ".mp3",
        ".mp4",
        ".wav",
        ".avi",
        ".mov",
        ".mkv",
        ".flac",
        ".zip",
        ".tar",
        ".gz",
        ".bz2",
        ".xz",
        ".7z",
        ".rar",
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".exe",
        ".dll",
        ".so",
        ".dylib",
        ".o",
        ".obj",
        ".pyc",
        ".pyd",
        ".woff",
        ".woff2",
        ".ttf",
        ".eot",
        ".otf",
        ".sqlite",
        ".db",
        ".bin",
        ".dat",
    }
)


async def content_search(
    pattern: str,
    path: str = ".",
    glob: str | None = None,
    file_type: str | None = None,
    output_mode: str = "content",
    context: int = 0,
    max_results: int = _DEFAULT_MAX_RESULTS,
    ignore_case: bool = False,
    **_: Any,
) -> ToolResult:
    try:
        flags = re.IGNORECASE if ignore_case else 0
        try:
            regex = re.compile(pattern, flags)
        except re.error as e:
            return ToolResult(output="", error=f"Invalid regex: {e}", success=False)

        base = Path(path)
        if not base.exists():
            return ToolResult(output="", error=f"Path not found: {path}", success=False)

        file_glob = glob or _type_to_glob(file_type)

        if base.is_file():
            files = [base]
        else:
            files = sorted(
                base.rglob(file_glob) if file_glob else base.rglob("*"),
                key=lambda p: p.stat().st_mtime if p.exists() else 0,
                reverse=True,
            )

        matches: list[str] = []
        file_matches: list[str] = []
        count_matches: list[str] = []
        total = 0

        for fp in files:
            if total >= max_results:
                break
            if not fp.is_file():
                continue
            if fp.suffix.lower() in _BINARY_EXTENSIONS:
                continue
            try:
                if fp.stat().st_size > _MAX_FILE_SIZE:
                    continue
                text = fp.read_text(encoding="utf-8", errors="replace")
            except (OSError, PermissionError):
                continue

            file_lines = text.splitlines()
            has_match = False
            file_count = 0

            for i, line in enumerate(file_lines):
                if regex.search(line):
                    has_match = True
                    file_count += 1
                    total += 1

                    if output_mode == "content" and total <= max_results:
                        rel = fp.relative_to(base) if base.is_dir() else fp.name
                        if context > 0:
                            start = max(0, i - context)
                            end = min(len(file_lines), i + context + 1)
                            for ci in range(start, end):
                                prefix = ">" if ci == i else " "
                                matches.append(f"{prefix}{ci + 1}  {file_lines[ci]}")
                            matches.append("")
                        else:
                            matches.append(f"{rel}:{i + 1}: {line}")

            if has_match:
                rel = fp.relative_to(base) if base.is_dir() else fp.name
                file_matches.append(str(rel))
                if output_mode == "count":
                    count_matches.append(f"{file_count}:{rel}")

        if output_mode == "files_with_matches":
            output = "\n".join(file_matches) or "No matches found"
        elif output_mode == "count":
            output = "\n".join(count_matches) or "No matches found"
        else:
            output = "\n".join(matches) if matches else "No matches found"

        return ToolResult(output=output, metadata={"total_matches": total, "files_matched": len(file_matches)})
    except Exception as e:
        return ToolResult(output="", error=str(e), success=False)


def _type_to_glob(file_type: str | None) -> str | None:
    mapping = {
        "py": "*.py",
        "js": "*.js",
        "ts": "*.ts",
        "tsx": "*.tsx",
        "jsx": "*.jsx",
        "java": "*.java",
        "go": "*.go",
        "rs": "*.rs",
        "rb": "*.rb",
        "php": "*.php",
        "c": "*.c",
        "cpp": "*.cpp",
        "h": "*.h",
        "hpp": "*.hpp",
        "cs": "*.cs",
        "swift": "*.swift",
        "kt": "*.kt",
        "scala": "*.scala",
        "r": "*.r",
        "sql": "*.sql",
        "sh": "*.sh",
        "bash": "*.sh",
        "html": "*.html",
        "css": "*.css",
        "scss": "*.scss",
        "json": "*.json",
        "yaml": "*.yaml",
        "yml": "*.yml",
        "toml": "*.toml",
        "xml": "*.xml",
        "md": "*.md",
        "txt": "*.txt",
    }
    if not file_type:
        return None
    return mapping.get(file_type.lower())
