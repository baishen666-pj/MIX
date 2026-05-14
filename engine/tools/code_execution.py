from __future__ import annotations

import logging
import shlex

from engine.tools.types import ToolResult

log = logging.getLogger("mix.tools.code_execution")

SUPPORTED_LANGUAGES = {
    "python": {"image": "python:3.11-slim", "command_template": "python3 -c"},
    "javascript": {"image": "node:20-slim", "command_template": "node -e"},
}

_SANDBOX_AVAILABLE: bool | None = None


def _check_docker_available() -> bool:
    """Synchronous probe: check if the docker CLI is reachable."""
    import shutil
    import subprocess

    if shutil.which("docker") is None:
        return False
    try:
        result = subprocess.run(
            ["docker", "info"],
            capture_output=True,
            timeout=5,
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, OSError):
        return False


def _is_sandbox_available() -> bool:
    global _SANDBOX_AVAILABLE
    if _SANDBOX_AVAILABLE is None:
        _SANDBOX_AVAILABLE = _check_docker_available()
        if not _SANDBOX_AVAILABLE:
            log.warning(
                "DockerBackend not available. Code execution requires Docker for "
                "sandboxing. Untrusted code execution is DISABLED."
            )
    return _SANDBOX_AVAILABLE


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

    if _is_sandbox_available():
        try:
            result = await _run_in_docker(lang_config["image"], code, timeout, stdin)
            return result
        except Exception as e:
            return ToolResult(output="", error=str(e), success=False)

    log.error("Rejecting code execution: no sandbox backend available")
    return ToolResult(
        output="",
        error=(
            "Code execution is disabled: no sandbox is available. "
            "Install and start Docker to enable sandboxed code execution."
        ),
        success=False,
    )


async def _run_in_docker(image: str, code: str, timeout: int, stdin: str) -> ToolResult:
    import os

    from engine.sandbox.docker import DockerBackend

    backend = DockerBackend(
        image=image,
        memory=os.environ.get("SANDBOX_MEMORY", "512m"),
        cpus=os.environ.get("SANDBOX_CPUS", "1"),
        pids_limit=int(os.environ.get("SANDBOX_PIDS_LIMIT", "64")),
        timeout=int(os.environ.get("SANDBOX_TIMEOUT", str(timeout))),
    )
    if "python" in image:
        shell_cmd = f"printf %s {shlex.quote(stdin)} | python3 -c {shlex.quote(code)}"
    else:
        shell_cmd = f"printf %s {shlex.quote(stdin)} | node -e {shlex.quote(code)}"

    result = await backend.execute(shell_cmd, timeout=timeout)
    stdout = result["stdout"][:10000]
    stderr = result["stderr"][:5000] if result["exit_code"] != 0 else ""
    return ToolResult(
        output=stdout,
        error=stderr if result["exit_code"] != 0 else None,
        success=result["exit_code"] == 0,
    )


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
