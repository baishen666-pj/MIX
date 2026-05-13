"""Comprehensive tests for engine.tools.code_execution module.

Covers: execute(), list_languages(), subprocess timeout, error output, stdin.
Does not duplicate tests in test_real_tools.py.
"""

from __future__ import annotations

import pytest

from engine.tools.code_execution import (
    CODE_EXECUTION_DEFINITION,
    SUPPORTED_LANGUAGES,
    _is_sandbox_available,
    execute,
    list_languages,
)

sandbox_available = _is_sandbox_available()
requires_sandbox = pytest.mark.skipif(
    not sandbox_available,
    reason="Docker sandbox not available",
)


# --- Constants ---


class TestSupportedLanguages:
    def test_supported_languages_dict(self):
        assert "python" in SUPPORTED_LANGUAGES
        assert "javascript" in SUPPORTED_LANGUAGES
        assert "command_template" in SUPPORTED_LANGUAGES["python"]

    def test_list_languages_returns_list(self):
        langs = list_languages()
        assert isinstance(langs, list)
        assert "python" in langs
        assert "javascript" in langs


class TestDefinition:
    def test_code_execution_definition(self):
        assert CODE_EXECUTION_DEFINITION["type"] == "function"
        func = CODE_EXECUTION_DEFINITION["function"]
        assert func["name"] == "code_execute"
        assert "language" in func["parameters"]["properties"]
        assert "code" in func["parameters"]["properties"]


# --- Python Execution ---


class TestPythonExecution:
    @requires_sandbox
    @pytest.mark.asyncio
    async def test_simple_print(self):
        result = await execute("python", "print(42)")
        assert result.success
        assert "42" in result.output

    @requires_sandbox
    @pytest.mark.asyncio
    async def test_multiline_code(self):
        code = "x = 10\ny = 20\nprint(x + y)"
        result = await execute("python", code)
        assert result.success
        assert "30" in result.output

    @requires_sandbox
    @pytest.mark.asyncio
    async def test_syntax_error(self):
        result = await execute("python", "def (")
        assert not result.success

    @requires_sandbox
    @pytest.mark.asyncio
    async def test_runtime_error(self):
        result = await execute("python", "1 / 0")
        assert not result.success
        assert "ZeroDivisionError" in result.error

    @requires_sandbox
    @pytest.mark.asyncio
    async def test_import_allowed(self):
        result = await execute("python", "import json; print(json.dumps({'a': 1}))")
        assert result.success
        assert '{"a": 1}' in result.output

    @requires_sandbox
    @pytest.mark.asyncio
    async def test_stdin_input(self):
        code = "name = input()\nprint(f'Hello {name}')"
        result = await execute("python", code, stdin="World")
        assert result.success
        assert "Hello World" in result.output

    @requires_sandbox
    @pytest.mark.asyncio
    async def test_empty_stdin(self):
        result = await execute("python", "print('no stdin needed')")
        assert result.success

    @requires_sandbox
    @pytest.mark.asyncio
    async def test_unicode_output(self):
        result = await execute("python", "print('Hello World')")
        assert result.success

    @requires_sandbox
    @pytest.mark.asyncio
    async def test_large_output_truncated(self):
        code = "print('x' * 20000)"
        result = await execute("python", code)
        assert result.success
        assert len(result.output) <= 10000

    @requires_sandbox
    @pytest.mark.asyncio
    async def test_stderr_on_failure(self):
        result = await execute("python", "import sys; print('err', file=sys.stderr); sys.exit(1)")
        assert not result.success
        assert result.error is not None


# --- JavaScript Execution ---


class TestJavaScriptExecution:
    @requires_sandbox
    @pytest.mark.asyncio
    async def test_simple_console_log(self):
        result = await execute("javascript", "console.log('hello')")
        assert result.success
        assert "hello" in result.output

    @requires_sandbox
    @pytest.mark.asyncio
    async def test_math_operations(self):
        result = await execute("javascript", "console.log(2 ** 10)")
        assert result.success
        assert "1024" in result.output

    @requires_sandbox
    @pytest.mark.asyncio
    async def test_syntax_error(self):
        result = await execute("javascript", "function (")
        assert not result.success


# --- Language Support ---


class TestLanguageSupport:
    @pytest.mark.asyncio
    async def test_unsupported_language(self):
        result = await execute("rust", "fn main() {}")
        assert not result.success
        assert "Unsupported" in result.error

    @requires_sandbox
    @pytest.mark.asyncio
    async def test_case_insensitive_language(self):
        result = await execute("Python", "print('case test')")
        assert result.success
        assert "case test" in result.output

    @requires_sandbox
    @pytest.mark.asyncio
    async def test_javascript_case_insensitive(self):
        result = await execute("JavaScript", "console.log('case')")
        assert result.success


# --- Timeout ---


class TestTimeout:
    @requires_sandbox
    @pytest.mark.asyncio
    async def test_timeout_short_code(self):
        result = await execute("python", "import time; time.sleep(10)", timeout=1)
        assert not result.success
        assert "timed out" in result.error.lower()

    @requires_sandbox
    @pytest.mark.asyncio
    async def test_fast_code_within_timeout(self):
        result = await execute("python", "print('fast')", timeout=30)
        assert result.success


# --- Edge Cases ---


class TestEdgeCases:
    @requires_sandbox
    @pytest.mark.asyncio
    async def test_empty_code(self):
        result = await execute("python", "")
        assert result.success

    @requires_sandbox
    @pytest.mark.asyncio
    async def test_whitespace_only_code(self):
        result = await execute("python", "   \n   \n   ")
        assert result.success

    @requires_sandbox
    @pytest.mark.asyncio
    async def test_exit_code_nonzero(self):
        result = await execute("python", "raise SystemExit(42)")
        assert not result.success

    @requires_sandbox
    @pytest.mark.asyncio
    async def test_kwargs_ignored(self):
        result = await execute("python", "print('kwargs')", extra_arg="ignored")
        assert result.success
