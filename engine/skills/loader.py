from __future__ import annotations

import asyncio
import json
import tempfile
from pathlib import Path

from engine.skills.registry import SkillManifest


class SkillLoader:
    async def execute(self, manifest: SkillManifest, args: dict | None = None) -> dict:
        args = args or {}
        handler = manifest.handler
        code = manifest.handler_code

        if not code:
            return {"error": f"No handler code found for skill '{manifest.name}'"}

        try:
            if handler == "python":
                return await self._run_python(code, args)
            elif handler == "shell":
                return await self._run_shell(code, args)
            else:
                return {"error": f"Unsupported handler type: {handler}"}
        except Exception as e:
            return {"error": str(e)}

    async def _run_python(self, code: str, args: dict) -> dict:
        wrapped = f"""
import json, sys, asyncio
args = json.loads(sys.argv[1])
{code}
import inspect
if 'run' not in dir():
    print(json.dumps({{"error": "no run() function"}}))
elif inspect.iscoroutinefunction(run):
    result = asyncio.run(run(args))
    print(json.dumps(result))
else:
    result = run(args)
    print(json.dumps(result))
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as f:
            f.write(wrapped)
            f.flush()
            path = f.name

        try:
            proc = await asyncio.create_subprocess_exec(
                "python", path, json.dumps(args),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
            if proc.returncode != 0:
                return {"error": stderr.decode()}
            return json.loads(stdout.decode())
        finally:
            Path(path).unlink(missing_ok=True)

    async def _run_shell(self, code: str, args: dict) -> dict:
        proc = await asyncio.create_subprocess_shell(
            code,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        return {
            "output": stdout.decode(),
            "error": stderr.decode() if stderr else None,
            "exit_code": proc.returncode,
        }
