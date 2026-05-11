from __future__ import annotations

import asyncio
from typing import Any

from engine.tools.types import ToolResult


async def execute(command: str, timeout: int = 30, cwd: str | None = None, **_: Any) -> ToolResult:
    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        output = stdout.decode(errors="replace")
        error_output = stderr.decode(errors="replace")

        if proc.returncode != 0:
            return ToolResult(
                output=output,
                error=error_output or f"Exit code: {proc.returncode}",
                success=False,
            )
        return ToolResult(output=output)
    except asyncio.TimeoutError:
        return ToolResult(output="", error=f"Command timed out after {timeout}s", success=False)
    except Exception as e:
        return ToolResult(output="", error=str(e), success=False)
