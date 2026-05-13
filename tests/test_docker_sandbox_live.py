"""Live Docker sandbox integration tests.

These tests require Docker to be running and will be skipped otherwise.
Run with: python -m pytest tests/test_docker_sandbox_live.py -v
"""
import asyncio
import os
import sys
import pytest

def docker_available():
    """Check if Docker is available and running."""
    try:
        import subprocess
        result = subprocess.run(["docker", "info"], capture_output=True, timeout=5)
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False

requires_docker = pytest.mark.skipif(
    not docker_available(),
    reason="Docker not available"
)

from engine.sandbox.docker import DockerBackend


@requires_docker
@pytest.mark.asyncio
async def test_container_created_and_removed():
    """Verify container is created during execution and removed after."""
    backend = DockerBackend()
    result = await backend.execute("python3 -c 'print(42)'")
    assert result["exit_code"] == 0
    assert "42" in result["stdout"]

    # Check no orphan containers
    proc = await asyncio.create_subprocess_exec(
        "docker", "ps", "-a", "--filter", "label=mix-sandbox",
        stdout=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    # No containers should remain
    lines = stdout.decode().strip().split("\n")
    assert len(lines) <= 1  # Only header line


@requires_docker
@pytest.mark.asyncio
async def test_network_isolation():
    """Verify code cannot access the network."""
    backend = DockerBackend()
    code = """
import urllib.request
try:
    urllib.request.urlopen('http://example.com', timeout=2)
    print('NETWORK_ACCESSIBLE')
except Exception:
    print('NETWORK_BLOCKED')
"""
    result = await backend.execute(f"python3 -c {repr(code)}")
    assert "NETWORK_BLOCKED" in result["stdout"] or result["exit_code"] != 0


@requires_docker
@pytest.mark.asyncio
async def test_memory_limit():
    """Verify memory limit is enforced."""
    backend = DockerBackend(memory="64m")
    code = "x = 'A' * (100 * 1024 * 1024); print('survived')"
    result = await backend.execute(f"python3 -c {repr(code)}", timeout=10)
    assert result["exit_code"] != 0 or "survived" not in result.get("stdout", "")


@requires_docker
@pytest.mark.asyncio
async def test_timeout_kills_container():
    """Verify timeout kills the container."""
    backend = DockerBackend(timeout=3)
    result = await backend.execute("python3 -c 'import time; time.sleep(60)'")
    assert result.get("timed_out") is True


@requires_docker
@pytest.mark.asyncio
async def test_read_only_filesystem():
    """Verify filesystem is read-only."""
    backend = DockerBackend()
    result = await backend.execute("python3 -c 'open(\"/tmp/test\", \"w\").write(\"x\"); print(\"writable\")'")
    # tmpfs /tmp should be writable, but other paths should not
    result2 = await backend.execute("python3 -c 'open(\"/home/test\", \"w\").write(\"x\")'")
    assert result2["exit_code"] != 0


@requires_docker
@pytest.mark.asyncio
async def test_output_truncation():
    """Verify large output is truncated."""
    backend = DockerBackend()
    code = "print('A' * 50000)"
    result = await backend.execute(f"python3 -c {repr(code)}")
    assert len(result.get("stdout", "")) <= 10000


@requires_docker
@pytest.mark.asyncio
async def test_concurrent_executions():
    """Verify multiple concurrent executions work."""
    backend = DockerBackend()
    tasks = [backend.execute("python3 -c 'print(1)'") for _ in range(5)]
    results = await asyncio.gather(*tasks)
    assert all(r["exit_code"] == 0 for r in results)
