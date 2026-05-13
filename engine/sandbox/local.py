from __future__ import annotations

import asyncio
from typing import Any


class LocalBackend:
    """Execute commands directly on the host with NO isolation or sandboxing.

    WARNING: This backend provides no security boundary. Commands run with the
    full privileges of the host process. Use DockerBackend for untrusted input.
    """

    name = "local"

    async def execute(self, command: str, timeout: int = 30, cwd: str | None = None) -> dict[str, Any]:
        proc = None
        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=cwd,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            return {
                "stdout": stdout.decode(errors="replace"),
                "stderr": stderr.decode(errors="replace"),
                "exit_code": proc.returncode,
                "timed_out": False,
            }
        except asyncio.TimeoutError:
            if proc is not None:
                proc.kill()
                await proc.wait()
            return {
                "stdout": "",
                "stderr": f"Command timed out after {timeout}s",
                "exit_code": -1,
                "timed_out": True,
            }
        except Exception as e:
            return {
                "stdout": "",
                "stderr": str(e),
                "exit_code": -1,
                "timed_out": False,
            }
