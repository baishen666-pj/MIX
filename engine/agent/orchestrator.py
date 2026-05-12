from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from typing import Any

from engine.agent.decomposer import Subtask
from engine.agent.loop import AgentLoop

log = logging.getLogger("mix.orchestrator")


@dataclass
class SubtaskResult:
    subtask_id: str
    status: str  # "completed" | "failed" | "pending" | "running"
    content: str = ""
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "subtask_id": self.subtask_id,
            "status": self.status,
            "content": self.content,
            "error": self.error,
        }


@dataclass
class PlanStatus:
    plan_id: str
    status: str  # "pending" | "running" | "completed" | "failed"
    total: int = 0
    completed: int = 0
    failed: int = 0
    subtask_results: list[SubtaskResult] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "plan_id": self.plan_id,
            "status": self.status,
            "total": self.total,
            "completed": self.completed,
            "failed": self.failed,
            "subtask_results": [r.to_dict() for r in self.subtask_results],
        }


class TaskOrchestrator:
    """Execute a decomposed plan respecting dependency ordering.

    Independent subtasks run in parallel via ``asyncio.gather``.
    """

    def __init__(self) -> None:
        self._plans: dict[str, PlanStatus] = {}

    def get_status(self, plan_id: str) -> dict[str, Any] | None:
        """Return the current status of *plan_id*, or ``None`` if unknown."""
        plan = self._plans.get(plan_id)
        if plan is None:
            return None
        return plan.to_dict()

    async def execute_plan(
        self,
        subtasks: list[Subtask],
        agent_loop: AgentLoop,
    ) -> dict[str, Any]:
        """Execute *subtasks* respecting dependencies.

        Returns the aggregated result dict with ``plan_id``, the final
        composed ``result``, and individual ``subtask_results``.
        """
        plan_id = str(uuid.uuid4())
        results: dict[str, SubtaskResult] = {
            s.id: SubtaskResult(subtask_id=s.id, status="pending")
            for s in subtasks
        }
        plan = PlanStatus(
            plan_id=plan_id,
            status="running",
            total=len(subtasks),
            subtask_results=list(results.values()),
        )
        self._plans[plan_id] = plan

        try:
            await self._run_subtasks(subtasks, agent_loop, results, plan)
            plan.status = "completed"
        except Exception:
            log.exception("Plan %s failed", plan_id)
            plan.status = "failed"
            for r in results.values():
                if r.status == "running":
                    r.status = "failed"
                    r.error = "Plan execution aborted"

        plan.completed = sum(1 for r in results.values() if r.status == "completed")
        plan.failed = sum(1 for r in results.values() if r.status == "failed")

        composed = self._compose_results(results)
        return {
            "plan_id": plan_id,
            "result": composed,
            "subtask_results": [r.to_dict() for r in results.values()],
        }

    async def _run_subtasks(
        self,
        subtasks: list[Subtask],
        agent_loop: AgentLoop,
        results: dict[str, SubtaskResult],
        plan: PlanStatus,
    ) -> None:
        """Execute subtasks using topological ordering with parallelism."""
        remaining = {s.id for s in subtasks}
        subtask_map = {s.id: s for s in subtasks}
        completed_ids: set[str] = set()

        while remaining:
            # Find subtasks whose dependencies are all satisfied
            ready = [
                sid for sid in remaining
                if all(dep in completed_ids for dep in subtask_map[sid].dependencies)
            ]

            if not ready:
                # Circular dependency — mark remaining as failed
                for sid in remaining:
                    results[sid].status = "failed"
                    results[sid].error = "Circular dependency detected"
                return

            # Run all ready subtasks in parallel
            coros = [
                self._execute_single(subtask_map[sid], agent_loop, results)
                for sid in ready
            ]
            await asyncio.gather(*coros)

            for sid in ready:
                remaining.discard(sid)
                if results[sid].status == "completed":
                    completed_ids.add(sid)

    async def _execute_single(
        self,
        subtask: Subtask,
        agent_loop: AgentLoop,
        results: dict[str, SubtaskResult],
    ) -> None:
        """Execute a single subtask via *agent_loop*."""
        result = results[subtask.id]
        result.status = "running"

        try:
            response = await agent_loop.chat(subtask.description)
            result.content = response.get("content", "")
            result.status = "completed"
        except Exception as exc:
            log.exception("Subtask %s failed", subtask.id)
            result.status = "failed"
            result.error = str(exc)

    @staticmethod
    def _compose_results(results: dict[str, SubtaskResult]) -> str:
        """Build a composed text from individual subtask results."""
        parts: list[str] = []
        for subtask_id, r in results.items():
            if r.status == "completed" and r.content:
                parts.append(f"[{subtask_id}] {r.content}")
            elif r.status == "failed":
                parts.append(f"[{subtask_id}] FAILED: {r.error or 'unknown error'}")
        return "\n".join(parts) if parts else "No results"
