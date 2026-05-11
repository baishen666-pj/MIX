from __future__ import annotations

import asyncio
from typing import Any

from engine.sandbox.types import SandboxBackend


class DockerBackend:
    name = "docker"

    def __init__(self, image: str = "python:3.11-slim", timeout: int = 60) -> None:
        self.image = image
        self.default_timeout = timeout

    async def execute(self, command: str, timeout: int = 30, cwd: str | None = None) -> dict[str, Any]:
        docker_cmd = [
            "docker", "run", "--rm",
            "--network", "none",
            "--memory", "512m",
            "--cpus", "1",
            "--pids-limit", "64",
            self.image,
            "sh", "-c", command,
        ]

        try:
            proc = await asyncio.create_subprocess_exec(
                *docker_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=timeout or self.default_timeout
            )
            return {
                "stdout": stdout.decode(errors="replace"),
                "stderr": stderr.decode(errors="replace"),
                "exit_code": proc.returncode,
                "timed_out": False,
            }
        except asyncio.TimeoutError:
            proc.kill()
            return {
                "stdout": "",
                "stderr": f"Container timed out after {timeout}s",
                "exit_code": -1,
                "timed_out": True,
            }
        except FileNotFoundError:
            return {
                "stdout": "",
                "stderr": "Docker not found. Is Docker installed and running?",
                "exit_code": -1,
                "timed_out": False,
            }
        except Exception as e:
            return {
                "stdout": "",
                "stderr": str(e),
                "exit_code": -1,
                "timed_out": False,
            }
