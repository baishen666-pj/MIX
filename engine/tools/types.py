from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass
class ToolResult:
    output: str
    error: str | None = None
    success: bool = True
    metadata: dict | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "output": self.output,
            "error": self.error,
            "success": self.success,
            "metadata": self.metadata,
        }


class Tool(Protocol):
    name: str
    description: str

    async def execute(self, **kwargs: Any) -> ToolResult: ...


TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "bash",
            "description": "Execute a shell command and return its output",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "The shell command to run"},
                    "timeout": {"type": "integer", "description": "Timeout in seconds (default 30)", "default": 30},
                    "cwd": {"type": "string", "description": "Working directory"},
                },
                "required": ["command"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "file_read",
            "description": "Read a file's contents with line numbers",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path to read"},
                    "offset": {"type": "integer", "description": "Line offset (0-based)"},
                    "limit": {"type": "integer", "description": "Max lines to read"},
                    "line_numbers": {"type": "boolean", "description": "Show line numbers (default: true)", "default": True},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "file_write",
            "description": "Write content to a file (creates or overwrites)",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path to write"},
                    "content": {"type": "string", "description": "Content to write"},
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "file_list",
            "description": "List files in a directory",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory path (default: .)", "default": "."},
                    "pattern": {"type": "string", "description": "Glob pattern filter (e.g. *.py)"},
                    "recursive": {"type": "boolean", "description": "Search recursively", "default": False},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web for information",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "limit": {"type": "integer", "description": "Max results (default 5)", "default": 5},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "file_edit",
            "description": "Make precise edits to a file by replacing specific text. old_string must match exactly.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path to edit"},
                    "old_string": {"type": "string", "description": "The exact text to replace"},
                    "new_string": {"type": "string", "description": "The replacement text"},
                    "replace_all": {"type": "boolean", "description": "Replace all occurrences (default: false)", "default": False},
                },
                "required": ["path", "old_string", "new_string"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "file_edit_lines",
            "description": "Replace a range of lines in a file by line number (1-based)",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path to edit"},
                    "start_line": {"type": "integer", "description": "First line to replace (1-based)"},
                    "end_line": {"type": "integer", "description": "Last line to replace (1-based, inclusive)"},
                    "content": {"type": "string", "description": "New content for the line range"},
                },
                "required": ["path", "start_line", "end_line", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "grep",
            "description": "Search file contents using regex patterns across a directory tree",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Regex pattern to search for"},
                    "path": {"type": "string", "description": "Directory or file to search in", "default": "."},
                    "glob": {"type": "string", "description": "File pattern filter (e.g. *.py)"},
                    "output_mode": {"type": "string", "enum": ["content", "files_with_matches", "count"], "description": "Output format", "default": "content"},
                    "ignore_case": {"type": "boolean", "description": "Case-insensitive search", "default": False},
                    "context": {"type": "integer", "description": "Lines of context around matches", "default": 0},
                    "max_results": {"type": "integer", "description": "Max results (default 250)", "default": 250},
                },
                "required": ["pattern"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "glob",
            "description": "Find files matching a glob pattern, sorted by modification time",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Glob pattern (e.g. **/*.py)"},
                    "path": {"type": "string", "description": "Base directory to search in", "default": "."},
                },
                "required": ["pattern"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_fetch",
            "description": "Fetch and extract text content from a URL",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "URL to fetch"},
                    "format": {"type": "string", "enum": ["text", "json"], "description": "Response format", "default": "text"},
                    "timeout": {"type": "integer", "description": "Timeout in seconds (default 20)", "default": 20},
                },
                "required": ["url"],
            },
        },
    },
]
