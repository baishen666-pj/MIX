from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from engine.tools.registry import ToolRegistry
from engine.tools.types import ToolResult

log = logging.getLogger("mix.tool_chain")


@dataclass
class ToolChainStep:
    tool_name: str
    input_mapping: dict[str, str] = field(default_factory=dict)
    fixed_args: dict[str, Any] = field(default_factory=dict)


@dataclass
class ToolChain:
    name: str
    description: str
    steps: list[ToolChainStep]
    output_key: str = ""


class ToolChainExecutor:
    def __init__(self, registry: ToolRegistry) -> None:
        self._registry = registry
        self._chains: dict[str, ToolChain] = {}

    def register_chain(self, chain: ToolChain) -> None:
        self._chains[chain.name] = chain
        log.info("Registered tool chain: %s (%d steps)", chain.name, len(chain.steps))

    def unregister_chain(self, name: str) -> bool:
        if name in self._chains:
            del self._chains[name]
            return True
        return False

    def list_chains(self) -> list[dict[str, Any]]:
        return [
            {
                "name": c.name,
                "description": c.description,
                "steps": [{"tool": s.tool_name, "fixed_args": s.fixed_args} for s in c.steps],
            }
            for c in self._chains.values()
        ]

    async def execute_chain(self, chain: ToolChain, initial_args: dict) -> ToolResult:
        step_outputs: list[dict[str, Any]] = [initial_args]
        last_result: ToolResult | None = None

        for i, step in enumerate(chain.steps):
            args = dict(step.fixed_args)
            for target_key, source_key in step.input_mapping.items():
                for prev_output in reversed(step_outputs):
                    if source_key in prev_output:
                        args[target_key] = prev_output[source_key]
                        break

            try:
                result = await self._registry.execute(step.tool_name, **args)
                output_dict: dict[str, Any] = {"output": result.output, "success": result.success}
                if result.metadata:
                    output_dict.update(result.metadata)
                step_outputs.append(output_dict)
                last_result = result

                if not result.success:
                    return ToolResult(
                        output=f"Chain failed at step {i} ({step.tool_name}): {result.error}",
                        error=result.error,
                        success=False,
                    )
            except Exception as e:
                return ToolResult(
                    output=f"Chain error at step {i} ({step.tool_name}): {e}",
                    error=str(e),
                    success=False,
                )

        if last_result is None:
            return ToolResult(output="Chain produced no results", error="No steps executed", success=False)

        if chain.output_key:
            for output in reversed(step_outputs):
                if chain.output_key in output:
                    return ToolResult(output=str(output[chain.output_key]), success=True)

        return last_result

    def validate_chain(self, chain: ToolChain) -> list[str]:
        errors: list[str] = []
        available_tools = self._registry.list_tools()

        for i, step in enumerate(chain.steps):
            if step.tool_name not in available_tools:
                errors.append(f"Step {i}: tool '{step.tool_name}' not found")

        if not chain.steps:
            errors.append("Chain must have at least one step")

        return errors
