from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from engine.agent.bus import AgentBus
from engine.agent.roles import get_role, AgentRole
from engine.agent.router import AgentRouter
from engine.memory.store import MemoryStore

import logging

log = logging.getLogger("mix.collaboration")


class CollaborationPattern(str, Enum):
    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"
    DEBATE = "debate"
    ROUND_ROBIN = "round_robin"


@dataclass
class CollaborationStep:
    id: str
    agent_role: str
    instruction_template: str
    dependencies: list[str] = field(default_factory=list)
    status: str = "pending"
    result: str | None = None
    error: str | None = None


@dataclass
class CollaborationPlan:
    id: str
    pattern: CollaborationPattern
    task: str
    steps: list[CollaborationStep] = field(default_factory=list)
    max_rounds: int = 3
    status: str = "created"
    result: dict[str, Any] | None = None


class CollaborationEngine:
    def __init__(self, bus: AgentBus, router: AgentRouter, memory: MemoryStore) -> None:
        self._bus = bus
        self._router = router
        self._memory = memory
        self._active_plans: dict[str, CollaborationPlan] = {}

    def create_plan(
        self,
        pattern: CollaborationPattern,
        task: str,
        agent_roles: list[str] | None = None,
        max_rounds: int = 3,
    ) -> CollaborationPlan:
        plan_id = uuid.uuid4().hex[:12]
        roles = agent_roles or self._default_roles(pattern)
        steps = self._build_steps(pattern, roles, task)
        plan = CollaborationPlan(
            id=plan_id,
            pattern=pattern,
            task=task,
            steps=steps,
            max_rounds=max_rounds,
        )
        self._active_plans[plan_id] = plan
        log.info("Created collaboration plan %s (%s, %d steps)", plan_id, pattern.value, len(steps))
        return plan

    async def execute_plan(self, plan: CollaborationPlan) -> dict[str, Any]:
        plan.status = "running"
        dispatch = {
            CollaborationPattern.SEQUENTIAL: self._execute_sequential,
            CollaborationPattern.PARALLEL: self._execute_parallel,
            CollaborationPattern.DEBATE: self._execute_debate,
            CollaborationPattern.ROUND_ROBIN: self._execute_round_robin,
        }
        handler = dispatch.get(plan.pattern)
        if handler is None:
            plan.status = "failed"
            plan.result = {"error": f"Unknown pattern: {plan.pattern}"}
            return plan.result

        try:
            result = await handler(plan)
            plan.status = "completed"
            plan.result = result
            return result
        except Exception as e:
            log.exception("Plan %s failed", plan.id)
            plan.status = "failed"
            plan.result = {"error": str(e)}
            return plan.result

    async def _execute_sequential(self, plan: CollaborationPlan) -> dict[str, Any]:
        previous_output = plan.task
        step_results: list[dict[str, Any]] = []

        for step in plan.steps:
            step.status = "running"
            instruction = step.instruction_template.format(
                input=previous_output,
                task=plan.task,
            )
            try:
                agent = self._resolve_agent(step.agent_role)
                response = await agent.loop.chat(instruction)
                step.result = response["content"]
                step.status = "completed"
                step_results.append({
                    "step_id": step.id,
                    "role": step.agent_role,
                    "output": response["content"],
                })
                previous_output = response["content"]
                await self._bus.publish(
                    f"collaboration.{plan.id}.step_completed",
                    {"step_id": step.id, "role": step.agent_role},
                    sender="collaboration_engine",
                )
            except Exception as e:
                step.error = str(e)
                step.status = "failed"
                step_results.append({
                    "step_id": step.id,
                    "role": step.agent_role,
                    "error": str(e),
                })
                break

        return {
            "pattern": "sequential",
            "steps": step_results,
            "final_output": previous_output,
        }

    async def _execute_parallel(self, plan: CollaborationPlan) -> dict[str, Any]:
        async def run_step(step: CollaborationStep) -> dict[str, Any]:
            step.status = "running"
            instruction = step.instruction_template.format(
                input=plan.task,
                task=plan.task,
            )
            try:
                agent = self._resolve_agent(step.agent_role)
                response = await agent.loop.chat(instruction)
                step.result = response["content"]
                step.status = "completed"
                return {"step_id": step.id, "role": step.agent_role, "output": response["content"]}
            except Exception as e:
                step.error = str(e)
                step.status = "failed"
                return {"step_id": step.id, "role": step.agent_role, "error": str(e)}

        results = await asyncio.gather(*[run_step(s) for s in plan.steps])

        coordinator = self._resolve_agent("coordinator")
        synthesis_prompt = (
            f"Synthesize the following parallel research results into a coherent answer.\n"
            f"Original task: {plan.task}\n\n"
        )
        for r in results:
            synthesis_prompt += f"## {r['role']}\n{r.get('output', r.get('error', 'No output'))}\n\n"

        synthesis = await coordinator.loop.chat(synthesis_prompt)
        return {
            "pattern": "parallel",
            "steps": list(results),
            "final_output": synthesis["content"],
        }

    async def _execute_debate(self, plan: CollaborationPlan) -> dict[str, Any]:
        if len(plan.steps) < 2:
            return {"error": "Debate requires at least 2 agents"}

        rounds: list[dict[str, Any]] = []
        proponent = plan.steps[0]
        opponent = plan.steps[1]
        judge = plan.steps[2] if len(plan.steps) > 2 else None

        current_topic = plan.task
        for round_num in range(plan.max_rounds):
            proponent.status = "running"
            opponent.status = "running"

            pro_prompt = proponent.instruction_template.format(input=current_topic, task=plan.task)
            pro_agent = self._resolve_agent(proponent.agent_role)
            pro_response = await pro_agent.loop.chat(pro_prompt)
            proponent.result = pro_response["content"]

            con_prompt = opponent.instruction_template.format(
                input=f"Counter this argument:\n{pro_response['content']}",
                task=plan.task,
            )
            con_agent = self._resolve_agent(opponent.agent_role)
            con_response = await con_agent.loop.chat(con_prompt)
            opponent.result = con_response["content"]

            rounds.append({
                "round": round_num + 1,
                "proponent": {"role": proponent.agent_role, "argument": pro_response["content"]},
                "opponent": {"role": opponent.agent_role, "argument": con_response["content"]},
            })
            current_topic = con_response["content"]

        proponent.status = "completed"
        opponent.status = "completed"

        verdict = None
        if judge:
            judge.status = "running"
            verdict_prompt = (
                f"Evaluate the following debate and provide a balanced verdict.\n"
                f"Original topic: {plan.task}\n\n"
            )
            for r in rounds:
                verdict_prompt += (
                    f"Round {r['round']}:\n"
                    f"  Proponent ({r['proponent']['role']}): {r['proponent']['argument'][:500]}\n"
                    f"  Opponent ({r['opponent']['role']}): {r['opponent']['argument'][:500]}\n\n"
                )
            judge_agent = self._resolve_agent(judge.agent_role)
            verdict_response = await judge_agent.loop.chat(verdict_prompt)
            verdict = verdict_response["content"]
            judge.result = verdict
            judge.status = "completed"

        return {
            "pattern": "debate",
            "rounds": rounds,
            "verdict": verdict,
            "final_output": verdict or rounds[-1]["opponent"]["argument"] if rounds else "",
        }

    async def _execute_round_robin(self, plan: CollaborationPlan) -> dict[str, Any]:
        current_content = plan.task
        iterations: list[dict[str, Any]] = []

        for round_num in range(plan.max_rounds):
            for step in plan.steps:
                if step.status == "failed":
                    continue
                step.status = "running"
                instruction = step.instruction_template.format(
                    input=current_content,
                    task=plan.task,
                )
                try:
                    agent = self._resolve_agent(step.agent_role)
                    response = await agent.loop.chat(instruction)
                    step.result = response["content"]
                    step.status = "completed"
                    current_content = response["content"]
                    iterations.append({
                        "round": round_num + 1,
                        "step_id": step.id,
                        "role": step.agent_role,
                        "output": response["content"][:500],
                    })
                except Exception as e:
                    step.error = str(e)
                    step.status = "failed"

        return {
            "pattern": "round_robin",
            "iterations": iterations,
            "final_output": current_content,
        }

    def get_active_plans(self) -> list[dict[str, Any]]:
        return [
            {
                "id": p.id,
                "pattern": p.pattern.value,
                "task": p.task[:200],
                "status": p.status,
                "steps": [
                    {"id": s.id, "role": s.agent_role, "status": s.status}
                    for s in p.steps
                ],
            }
            for p in self._active_plans.values()
        ]

    def get_plan_status(self, plan_id: str) -> dict[str, Any] | None:
        plan = self._active_plans.get(plan_id)
        if plan is None:
            return None
        return {
            "id": plan.id,
            "pattern": plan.pattern.value,
            "task": plan.task,
            "status": plan.status,
            "steps": [
                {
                    "id": s.id,
                    "role": s.agent_role,
                    "status": s.status,
                    "result": s.result[:500] if s.result else None,
                    "error": s.error,
                }
                for s in plan.steps
            ],
            "result": plan.result,
        }

    def _resolve_agent(self, role_name: str):
        role = get_role(role_name)
        agent = self._router.get_agent(role_name)
        if agent is not None:
            return agent
        agent = self._router.register_agent(
            name=role_name,
            channels=[],
            allowed_users=[],
        )
        return agent

    def _default_roles(self, pattern: CollaborationPattern) -> list[str]:
        defaults = {
            CollaborationPattern.SEQUENTIAL: ["researcher", "coder", "reviewer"],
            CollaborationPattern.PARALLEL: ["researcher", "researcher", "researcher"],
            CollaborationPattern.DEBATE: ["coder", "reviewer", "coordinator"],
            CollaborationPattern.ROUND_ROBIN: ["coder", "reviewer"],
        }
        return defaults.get(pattern, ["general"])

    def _build_steps(
        self,
        pattern: CollaborationPattern,
        roles: list[str],
        task: str,
    ) -> list[CollaborationStep]:
        templates = {
            CollaborationPattern.SEQUENTIAL: (
                "Based on the following input, perform your role as {role}:\n\n{input}"
            ),
            CollaborationPattern.PARALLEL: (
                "Research and provide findings on: {task}"
            ),
            CollaborationPattern.DEBATE: (
                "Argue in favor of: {input}"
            ),
            CollaborationPattern.ROUND_ROBIN: (
                "Improve and refine the following:\n\n{input}"
            ),
        }
        template = templates.get(pattern, "Process: {input}")
        steps = []
        for i, role_name in enumerate(roles):
            step_template = template.replace("{role}", role_name)
            deps = [] if pattern == CollaborationPattern.PARALLEL else ([f"step-{i}"] if i > 0 else [])
            steps.append(CollaborationStep(
                id=f"step-{i}",
                agent_role=role_name,
                instruction_template=step_template,
                dependencies=deps,
            ))
        return steps
