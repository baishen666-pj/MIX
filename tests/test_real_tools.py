from __future__ import annotations

import pytest

from engine.tools.calculator import execute as calc_execute
from engine.tools.code_execution import execute as code_execute, list_languages
from engine.tools.registry import ToolRegistry


@pytest.mark.asyncio
async def test_calculator_basic():
    result = await calc_execute("2 + 3 * 4")
    assert result.success
    assert result.output == "14"


@pytest.mark.asyncio
async def test_calculator_float():
    result = await calc_execute("10 / 3")
    assert result.success
    assert "3.333" in result.output or "3.33" in result.output


@pytest.mark.asyncio
async def test_calculator_sqrt():
    result = await calc_execute("sqrt(144)")
    assert result.success
    assert result.output == "12.0"


@pytest.mark.asyncio
async def test_calculator_constants():
    result = await calc_execute("pi")
    assert result.success
    assert "3.14" in result.output


@pytest.mark.asyncio
async def test_calculator_error():
    result = await calc_execute("import os")
    assert not result.success


@pytest.mark.asyncio
async def test_calculator_unsafe():
    result = await calc_execute("__import__('os').system('echo hacked')")
    assert not result.success


@pytest.mark.asyncio
async def test_code_execute_python():
    result = await code_execute("python", "print(2 + 2)")
    assert result.success
    assert "4" in result.output


@pytest.mark.asyncio
async def test_code_execute_javascript():
    result = await code_execute("javascript", "console.log(2 + 2)")
    assert result.success
    assert "4" in result.output


@pytest.mark.asyncio
async def test_code_execute_unsupported():
    result = await code_execute("rust", "fn main() {}")
    assert not result.success
    assert "Unsupported" in result.error


@pytest.mark.asyncio
async def test_code_execute_error():
    result = await code_execute("python", "raise ValueError('test')")
    assert not result.success
    assert "ValueError" in result.error


def test_list_languages():
    langs = list_languages()
    assert "python" in langs
    assert "javascript" in langs


def test_registry_has_new_tools():
    registry = ToolRegistry()
    tools = registry.list_tools()
    assert "calculator" in tools
    assert "scraper" in tools
    assert "code_execute" in tools
    assert "image_generate" in tools


def test_registry_definitions_include_new():
    registry = ToolRegistry()
    defs = registry.get_definitions()
    names = [d["function"]["name"] for d in defs]
    assert "calculator" in names
    assert "scraper" in names
    assert "code_execute" in names
    assert "image_generate" in names


@pytest.mark.asyncio
async def test_calculator_complex():
    result = await calc_execute("sin(pi/2) + cos(0)")
    assert result.success
    assert "2" in result.output
