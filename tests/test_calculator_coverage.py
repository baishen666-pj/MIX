"""Additional coverage tests for engine.tools.calculator.

Targets uncovered lines 57, 68, 74:
- Line 57: ast.Num (legacy Python 3.7 node fallback)
- Line 68: unsupported binary operator (e.g. MatMult)
- Line 74: unsupported unary operator
"""

from __future__ import annotations

import ast
import math

import pytest

from engine.tools.calculator import _eval_node, execute


class TestLegacyAstNum:
    """Cover line 57: ast.Num fallback for older AST nodes."""

    def test_ast_num_node(self) -> None:
        node = ast.Num(n=42)
        assert _eval_node(node) == 42

    def test_ast_num_negative(self) -> None:
        node = ast.Num(n=-7)
        assert _eval_node(node) == -7

    def test_ast_num_float(self) -> None:
        node = ast.Num(n=3.14)
        result = _eval_node(node)
        assert abs(result - 3.14) < 1e-10


class TestUnsupportedBinaryOperator:
    """Cover line 68: unsupported operator raises ValueError."""

    def test_mat_mult_raises(self) -> None:
        node = ast.BinOp(left=ast.Constant(1), op=ast.MatMult(), right=ast.Constant(2))
        with pytest.raises(ValueError, match="Unsupported operator"):
            _eval_node(node)

    def test_bit_and_raises(self) -> None:
        node = ast.BinOp(left=ast.Constant(1), op=ast.BitAnd(), right=ast.Constant(2))
        with pytest.raises(ValueError, match="Unsupported operator"):
            _eval_node(node)

    def test_bit_or_raises(self) -> None:
        node = ast.BinOp(left=ast.Constant(1), op=ast.BitOr(), right=ast.Constant(2))
        with pytest.raises(ValueError, match="Unsupported operator"):
            _eval_node(node)

    def test_lshift_raises(self) -> None:
        node = ast.BinOp(left=ast.Constant(1), op=ast.LShift(), right=ast.Constant(2))
        with pytest.raises(ValueError, match="Unsupported operator"):
            _eval_node(node)


class TestUnsupportedUnaryOperator:
    """Cover line 74: unsupported unary operator raises ValueError."""

    def test_unary_invert_raises(self) -> None:
        node = ast.UnaryOp(op=ast.Invert(), operand=ast.Constant(5))
        with pytest.raises(ValueError, match="Unsupported unary operator"):
            _eval_node(node)

    def test_unary_not_raises(self) -> None:
        node = ast.UnaryOp(op=ast.Not(), operand=ast.Constant(True))
        with pytest.raises(ValueError, match="Unsupported unary operator"):
            _eval_node(node)


class TestTrigAndConstantsIntegration:
    """Integration tests for trig functions and constants."""

    @pytest.mark.asyncio
    async def test_sin_pi_over_2(self) -> None:
        result = await execute("sin(pi / 2)")
        assert result.success
        assert abs(float(result.output) - 1.0) < 1e-10

    @pytest.mark.asyncio
    async def test_cos_zero(self) -> None:
        result = await execute("cos(0)")
        assert result.success
        assert abs(float(result.output) - 1.0) < 1e-10

    @pytest.mark.asyncio
    async def test_tan_pi_over_4(self) -> None:
        result = await execute("tan(pi / 4)")
        assert result.success
        assert abs(float(result.output) - 1.0) < 1e-10

    @pytest.mark.asyncio
    async def test_sqrt_with_constant(self) -> None:
        result = await execute("sqrt(pi ** 2)")
        assert result.success
        assert abs(float(result.output) - math.pi) < 1e-10

    @pytest.mark.asyncio
    async def test_nested_trig(self) -> None:
        result = await execute("sin(cos(0))")
        assert result.success
        assert abs(float(result.output) - math.sin(1.0)) < 1e-10

    @pytest.mark.asyncio
    async def test_division_by_zero(self) -> None:
        result = await execute("1 / 0")
        assert not result.success
        assert "Calculation error" in result.error

    @pytest.mark.asyncio
    async def test_floor_division_by_zero(self) -> None:
        result = await execute("1 // 0")
        assert not result.success

    @pytest.mark.asyncio
    async def test_invalid_expression(self) -> None:
        result = await execute("def foo(): pass")
        assert not result.success
