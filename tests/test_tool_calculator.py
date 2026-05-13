"""Comprehensive tests for engine.tools.calculator module.

Covers AST-based safe evaluation, operators, functions, constants, security.
Does not duplicate tests already in test_real_tools.py.
"""

from __future__ import annotations

import ast
import math

import pytest

from engine.tools.calculator import CALCULATOR_DEFINITION, _eval_node, execute

# --- Module-level constant ---


class TestDefinition:
    def test_definition_structure(self):
        assert CALCULATOR_DEFINITION["type"] == "function"
        func = CALCULATOR_DEFINITION["function"]
        assert func["name"] == "calculator"
        assert "expression" in func["parameters"]["properties"]
        assert func["parameters"]["required"] == ["expression"]


# --- Core evaluation ---


class TestArithmetic:
    @pytest.mark.asyncio
    async def test_addition(self):
        result = await execute("2 + 3")
        assert result.success
        assert result.output == "5"

    @pytest.mark.asyncio
    async def test_subtraction(self):
        result = await execute("10 - 4")
        assert result.success
        assert result.output == "6"

    @pytest.mark.asyncio
    async def test_multiplication(self):
        result = await execute("6 * 7")
        assert result.success
        assert result.output == "42"

    @pytest.mark.asyncio
    async def test_division(self):
        result = await execute("15 / 4")
        assert result.success
        assert result.output == "3.75"

    @pytest.mark.asyncio
    async def test_floor_division(self):
        result = await execute("15 // 4")
        assert result.success
        assert result.output == "3"

    @pytest.mark.asyncio
    async def test_modulo(self):
        result = await execute("17 % 5")
        assert result.success
        assert result.output == "2"

    @pytest.mark.asyncio
    async def test_power(self):
        result = await execute("2 ** 10")
        assert result.success
        assert result.output == "1024"

    @pytest.mark.asyncio
    async def test_negative_number(self):
        result = await execute("-5")
        assert result.success
        assert result.output == "-5"

    @pytest.mark.asyncio
    async def test_unary_positive(self):
        result = await execute("+42")
        assert result.success
        assert result.output == "42"

    @pytest.mark.asyncio
    async def test_float_literals(self):
        result = await execute("3.14 * 2")
        assert result.success
        assert "6.28" in result.output

    @pytest.mark.asyncio
    async def test_operator_precedence(self):
        result = await execute("2 + 3 * 4")
        assert result.success
        assert result.output == "14"

    @pytest.mark.asyncio
    async def test_parentheses(self):
        result = await execute("(2 + 3) * 4")
        assert result.success
        assert result.output == "20"


class TestFunctions:
    @pytest.mark.asyncio
    async def test_abs(self):
        result = await execute("abs(-10)")
        assert result.success
        assert result.output == "10"

    @pytest.mark.asyncio
    async def test_round(self):
        result = await execute("round(3.7)")
        assert result.success
        assert result.output == "4"

    @pytest.mark.asyncio
    async def test_min(self):
        result = await execute("min(3, 1, 4)")
        assert result.success
        assert result.output == "1"

    @pytest.mark.asyncio
    async def test_max(self):
        result = await execute("max(3, 1, 4)")
        assert result.success
        assert result.output == "4"

    @pytest.mark.asyncio
    async def test_sum_not_variadic(self):
        # Python's sum() takes an iterable, not variadic args in this AST evaluator
        result = await execute("sum(1, 2, 3)")
        assert not result.success

    @pytest.mark.asyncio
    async def test_pow_function(self):
        result = await execute("pow(2, 8)")
        assert result.success
        assert result.output == "256"

    @pytest.mark.asyncio
    async def test_ceil(self):
        result = await execute("ceil(3.2)")
        assert result.success
        assert result.output == "4"

    @pytest.mark.asyncio
    async def test_floor(self):
        result = await execute("floor(3.8)")
        assert result.success
        assert result.output == "3"

    @pytest.mark.asyncio
    async def test_factorial(self):
        result = await execute("factorial(5)")
        assert result.success
        assert result.output == "120"

    @pytest.mark.asyncio
    async def test_gcd(self):
        result = await execute("gcd(12, 8)")
        assert result.success
        assert result.output == "4"

    @pytest.mark.asyncio
    async def test_log(self):
        result = await execute("log(e)")
        assert result.success
        assert "1" in result.output

    @pytest.mark.asyncio
    async def test_log10(self):
        result = await execute("log10(100)")
        assert result.success
        assert result.output == "2.0"

    @pytest.mark.asyncio
    async def test_exp(self):
        result = await execute("exp(0)")
        assert result.success
        assert result.output == "1.0"


class TestConstants:
    @pytest.mark.asyncio
    async def test_pi(self):
        result = await execute("pi")
        assert result.success
        assert abs(float(result.output) - math.pi) < 1e-10

    @pytest.mark.asyncio
    async def test_e(self):
        result = await execute("e")
        assert result.success
        assert abs(float(result.output) - math.e) < 1e-10


class TestErrors:
    @pytest.mark.asyncio
    async def test_empty_expression(self):
        result = await execute("")
        assert not result.success

    @pytest.mark.asyncio
    async def test_invalid_syntax(self):
        result = await execute("2 + * 3")
        assert not result.success

    @pytest.mark.asyncio
    async def test_unknown_name(self):
        result = await execute("unknown_var")
        assert not result.success
        assert "Unknown name" in result.error

    @pytest.mark.asyncio
    async def test_division_by_zero(self):
        result = await execute("1 / 0")
        assert not result.success

    @pytest.mark.asyncio
    async def test_import_blocked(self):
        result = await execute("import os")
        assert not result.success

    @pytest.mark.asyncio
    async def test_dunder_import_blocked(self):
        result = await execute("__import__('os').system('echo pwned')")
        assert not result.success

    @pytest.mark.asyncio
    async def test_attribute_access_blocked(self):
        result = await execute("().__class__")
        assert not result.success
        assert "Attribute access not allowed" in result.error

    @pytest.mark.asyncio
    async def test_unsupported_expression_type(self):
        node = ast.Subscript(value=ast.Constant(1), slice=ast.Constant(0))
        with pytest.raises(ValueError, match="Unsupported expression"):
            _eval_node(node)


class TestEdgeCases:
    @pytest.mark.asyncio
    async def test_very_large_number(self):
        result = await execute("10 ** 100")
        assert result.success

    @pytest.mark.asyncio
    async def test_negative_exponent(self):
        result = await execute("2 ** -1")
        assert result.success
        assert result.output == "0.5"

    @pytest.mark.asyncio
    async def test_nested_function_calls(self):
        result = await execute("abs(floor(-3.7))")
        assert result.success
        assert result.output == "4"

    @pytest.mark.asyncio
    async def test_complex_expression(self):
        result = await execute("sqrt(3**2 + 4**2)")
        assert result.success
        assert result.output == "5.0"
