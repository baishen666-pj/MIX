from __future__ import annotations

import asyncio
from typing import Any


class DockerBackend:
    name = "docker"

    def __init__(
        self,
        image: str = "python:3.11-slim",
        memory: str = "512m",
        cpus: str = "1",
        pids_limit: int = 64,
        timeout: int = 60,
        max_output_bytes: int = 10_000,
    ) -> None:
        self.image = image
        self.memory = memory
        self.cpus = cpus
        self.pids_limit = pids_limit
        self.default_timeout = timeout
        self.max_output_bytes = max_output_bytes

    async def execute(self, command: str, timeout: int = 30, cwd: str | None = None) -> dict[str, Any]:
        docker_cmd = [
            "docker",
            "run",
            "--rm",
            "--network",
            "none",
            "--memory",
            self.memory,
            "--cpus",
            self.cpus,
            "--pids-limit",
            str(self.pids_limit),
            "--read-only",
            "--tmpfs",
            "/tmp:size=100m",
            "--cap-drop",
            "ALL",
            "--security-opt",
            "no-new-privileges",
            "--user",
            "1000:1000",
            self.image,
            "sh",
            "-c",
            command,
        ]

        try:
            proc = await asyncio.create_subprocess_exec(
                *docker_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout or self.default_timeout)
            stdout_str = stdout.decode(errors="replace")
            stderr_str = stderr.decode(errors="replace")
            if len(stdout_str) > self.max_output_bytes:
                stdout_str = stdout_str[: self.max_output_bytes] + "\n... [truncated]"
            if len(stderr_str) > self.max_output_bytes:
                stderr_str = stderr_str[: self.max_output_bytes] + "\n... [truncated]"
            return {
                "stdout": stdout_str,
                "stderr": stderr_str,
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
