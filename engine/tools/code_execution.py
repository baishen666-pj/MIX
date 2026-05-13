from __future__ import annotations

import asyncio

from engine.tools.types import ToolResult

SUPPORTED_LANGUAGES = {
    "python": {"image": "python:3.11-slim", "command_template": "python3 -c"},
    "javascript": {"image": "node:20-slim", "command_template": "node -e"},
}


async def execute(
    language: str,
    code: str,
    timeout: int = 30,
    stdin: str = "",
    **kwargs,
) -> ToolResult:
    lang = language.lower()
    if lang not in SUPPORTED_LANGUAGES:
        return ToolResult(
            output="",
            error=f"Unsupported language: {lang}. Supported: {', '.join(SUPPORTED_LANGUAGES.keys())}",
            success=False,
        )

    lang_config = SUPPORTED_LANGUAGES[lang]
    try:
        result = await _run_in_subprocess(lang, code, timeout, stdin)
        return result
    except Exception as e:
        return ToolResult(output="", error=str(e), success=False)


async def _run_in_subprocess(language: str, code: str, timeout: int, stdin: str) -> ToolResult:
    if language == "python":
        import sys
        python_cmd = sys.executable or "python"
        cmd = [python_cmd, "-c", code]
    elif language == "javascript":
        cmd = ["node", "-e", code]
    else:
        return ToolResult(output="", error=f"Cannot execute {language} locally", success=False)

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(input=stdin.encode() if stdin else None),
            timeout=timeout,
        )
        success = proc.returncode == 0
        return ToolResult(
            output=stdout.decode(errors="replace")[:10000],
            error=stderr.decode(errors="replace")[:5000] if not success else None,
            success=success,
        )
    except asyncio.TimeoutError:
        proc.kill()
        return ToolResult(output="", error=f"Execution timed out after {timeout}s", success=False)


def list_languages() -> list[str]:
    return list(SUPPORTED_LANGUAGES.keys())


CODE_EXECUTION_DEFINITION = {
    "type": "function",
    "function": {
        "name": "code_execute",
        "description": "Execute code in a sandboxed environment. Supports Python and JavaScript.",
        "parameters": {
            "type": "object",
            "properties": {
                "language": {
                    "type": "string",
                    "enum": ["python", "javascript"],
                    "description": "Programming language",
                },
                "code": {"type": "string", "description": "Code to execute"},
                "timeout": {"type": "integer", "description": "Timeout in seconds (max 60)", "default": 30},
                "stdin": {"type": "string", "description": "Optional stdin input"},
            },
            "required": ["language", "code"],
        },
    },
}
