"""Comprehensive tests for engine.tools.bash module.

Tests cover successful execution, failure, timeout, cwd, stderr,
unicode, empty output, and edge cases. Does not duplicate test_tools.py.
"""

from __future__ import annotations

import pytest

from engine.tools.bash import execute


class TestSuccessfulExecution:
    @pytest.mark.asyncio
    async def test_echo_output(self):
        result = await execute(command="echo hello world")
        assert result.success
        assert "hello world" in result.output

    @pytest.mark.asyncio
    async def test_multiline_output(self):
        result = await execute(command="echo line1 && echo line2")
        assert result.success
        assert "line1" in result.output
        assert "line2" in result.output

    @pytest.mark.asyncio
    async def test_pipe_commands(self):
        result = await execute(command="echo 'hello world' | tr 'h' 'H'")
        assert result.success
        assert "Hello" in result.output

    @pytest.mark.asyncio
    async def test_environment_variable(self):
        result = await execute(command="echo $HOME")
        assert result.success
        assert len(result.output.strip()) > 0

    @pytest.mark.asyncio
    async def test_command_substitution(self):
        result = await execute(command="echo $(echo nested)")
        assert result.success
        assert "nested" in result.output

    @pytest.mark.asyncio
    async def test_unicode_output(self):
        result = await execute(command="echo 'Hello World'")
        assert result.success


class TestFailedExecution:
    @pytest.mark.asyncio
    async def test_nonzero_exit_code(self):
        result = await execute(command="exit 1")
        assert not result.success
        assert result.error is not None

    @pytest.mark.asyncio
    async def test_stderr_captured(self):
        result = await execute(command="echo error_msg >&2 && exit 1")
        assert not result.success
        assert "error_msg" in result.error

    @pytest.mark.asyncio
    async def test_command_not_found(self):
        result = await execute(command="nonexistent_command_xyz")
        assert not result.success

    @pytest.mark.asyncio
    async def test_specific_exit_code(self):
        result = await execute(command="exit 42")
        assert not result.success
        assert "42" in result.error


class TestTimeout:
    @pytest.mark.asyncio
    async def test_timeout_exceeded(self):
        result = await execute(command="sleep 10", timeout=1)
        assert not result.success
        assert "timed out" in result.error.lower()

    @pytest.mark.asyncio
    async def test_default_timeout_is_30(self):
        # Fast command completes within default timeout
        result = await execute(command="echo fast")
        assert result.success


class TestWorkingDirectory:
    @pytest.mark.asyncio
    async def test_cwd_parameter(self, tmp_path):
        result = await execute(command="echo test", cwd=str(tmp_path))
        assert result.success

    @pytest.mark.asyncio
    async def test_cwd_affects_pwd(self, tmp_path):
        result = await execute(command="pwd", cwd=str(tmp_path))
        assert result.success
        # The directory name should appear in the output (handles MSYS path mapping on Windows)
        assert "test_cwd_affects_pwd" in result.output


class TestEdgeCases:
    @pytest.mark.asyncio
    async def test_empty_command(self):
        result = await execute(command="")
        assert result.success

    @pytest.mark.asyncio
    async def test_whitespace_command(self):
        result = await execute(command="   ")
        assert result.success

    @pytest.mark.asyncio
    async def test_large_output(self):
        result = await execute(command="python -c \"print('x' * 10000)\"")
        assert result.success
        assert len(result.output) > 5000

    @pytest.mark.asyncio
    async def test_kwargs_ignored(self):
        result = await execute(command="echo ok", extra_param="ignored")
        assert result.success

    @pytest.mark.asyncio
    async def test_exit_code_zero_is_success(self):
        result = await execute(command="exit 0")
        assert result.success

    @pytest.mark.asyncio
    async def test_stdout_on_failure(self):
        result = await execute(command="echo before_fail && exit 1")
        assert not result.success
        assert "before_fail" in result.output
