from __future__ import annotations

import ast
import math
import operator
from typing import Any, Callable

from engine.tools.types import ToolResult

_SAFE_OPERATORS: dict[type[ast.AST], Callable[..., Any]] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

_SAFE_NAMES = {
    "abs": abs,
    "round": round,
    "min": min,
    "max": max,
    "sum": sum,
    "pow": pow,
    "sqrt": math.sqrt,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "log": math.log,
    "log10": math.log10,
    "exp": math.exp,
    "pi": math.pi,
    "e": math.e,
    "ceil": math.ceil,
    "floor": math.floor,
    "factorial": math.factorial,
    "gcd": math.gcd,
}


async def execute(expression: str, **kwargs) -> ToolResult:
    try:
        tree = ast.parse(expression, mode="eval")
        result = _eval_node(tree.body)
        return ToolResult(output=str(result), success=True)
    except Exception as e:
        return ToolResult(output="", error=f"Calculation error: {e}", success=False)


def _eval_node(node: ast.AST):
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Num):
        return node.n
    if isinstance(node, ast.Name):
        if node.id in _SAFE_NAMES:
            return _SAFE_NAMES[node.id]
        raise ValueError(f"Unknown name: {node.id}")
    if isinstance(node, ast.BinOp):
        op_type = type(node.op)
        if op_type in _SAFE_OPERATORS:
            left = _eval_node(node.left)
            right = _eval_node(node.right)
            return _SAFE_OPERATORS[op_type](left, right)
        raise ValueError(f"Unsupported operator: {op_type.__name__}")
    if isinstance(node, ast.UnaryOp):
        op_type = type(node.op)  # type: ignore[assignment]
        if op_type in _SAFE_OPERATORS:
            operand = _eval_node(node.operand)
            return _SAFE_OPERATORS[op_type](operand)
        raise ValueError(f"Unsupported unary operator: {op_type.__name__}")
    if isinstance(node, ast.Call):
        func = _eval_node(node.func)
        args = [_eval_node(a) for a in node.args]
        return func(*args)
    if isinstance(node, ast.Attribute):
        raise ValueError("Attribute access not allowed")
    raise ValueError(f"Unsupported expression: {type(node).__name__}")


CALCULATOR_DEFINITION = {
    "type": "function",
    "function": {
        "name": "calculator",
        "description": "Evaluate mathematical expressions. Supports arithmetic, trig, log, and more.",
        "parameters": {
            "type": "object",
            "properties": {
                "expression": {
                    "type": "string",
                    "description": "Math expression to evaluate (e.g. '2 + 3 * 4', 'sqrt(144)', 'sin(pi/2)')",
                },
            },
            "required": ["expression"],
        },
    },
}
