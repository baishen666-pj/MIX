"""Agent CRUD, roles, collaboration, decompose, and orchestrate endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from engine.api.schemas import (
    AgentCreateRequest,
    AgentResponse,
    AgentUpdateRequest,
    CollaborateRequest,
    DecomposeRequest,
    OrchestrateRequest,
)

log = logging.getLogger(__name__)

router = APIRouter()


@router.get("/agents")
async def agents_list():
    from engine.api import routes as _pkg

    if _pkg._agent_router is None:
        return {"agents": [{"name": "main", "channels": [], "model": "default"}]}
    return {"agents": _pkg._agent_router.list_agents()}


@router.post("/agents")
async def agents_create(req: AgentCreateRequest):
    from engine.api import routes as _pkg

    if _pkg._agent_router is None:
        raise HTTPException(503, "Agent router not initialized")
    try:
        agent = _pkg._agent_router.register_agent(
            name=req.name,
            channels=req.channels or [],
            allowed_users=req.allowed_users or [],
            role=req.role,
            system_prompt_override=req.system_prompt_override,
        )
        return AgentResponse(
            name=agent.name,
            role=agent.role,
            channels=agent.channels,
            allowed_users=agent.allowed_users,
            model=agent.config.llm.model,
            system_prompt=agent.system_prompt[:200],
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception:
        log.exception("Failed to create agent '%s'", req.name)
        raise HTTPException(500, "Internal server error")


@router.get("/agents/roles")
async def agents_roles():
    from engine.agent.roles import list_roles

    roles = list_roles()
    return {
        "roles": [
            {
                "name": r.name,
                "system_prompt": r.system_prompt[:200],
                "allowed_tools": r.allowed_tools,
                "default_model_tier": r.default_model_tier,
                "max_iterations": r.max_iterations,
            }
            for r in roles
        ]
    }


@router.get("/agents/{name}")
async def agents_get(name: str):
    from engine.api import routes as _pkg

    if _pkg._agent_router is None:
        raise HTTPException(503, "Agent router not initialized")
    agent = _pkg._agent_router.get_agent(name)
    if agent is None:
        raise HTTPException(404, f"Agent '{name}' not found")
    return AgentResponse(
        name=agent.name,
        role=agent.role,
        channels=agent.channels,
        allowed_users=agent.allowed_users,
        model=agent.config.llm.model,
        system_prompt=agent.system_prompt[:200],
    )


@router.put("/agents/{name}")
async def agents_update(name: str, req: AgentUpdateRequest):
    from engine.api import routes as _pkg

    if _pkg._agent_router is None:
        raise HTTPException(503, "Agent router not initialized")
    updates = {}
    if req.channels is not None:
        updates["channels"] = req.channels
    if req.allowed_users is not None:
        updates["allowed_users"] = req.allowed_users
    if req.system_prompt is not None:
        updates["system_prompt"] = req.system_prompt
    if req.role is not None:
        updates["role"] = req.role
    updated = _pkg._agent_router.update_agent(name, **updates)
    if not updated:
        raise HTTPException(404, f"Agent '{name}' not found")
    return {"status": "ok"}


@router.delete("/agents/{name}")
async def agents_delete(name: str):
    from engine.api import routes as _pkg

    if _pkg._agent_router is None:
        raise HTTPException(503, "Agent router not initialized")
    deleted = _pkg._agent_router.delete_agent(name)
    if not deleted:
        raise HTTPException(404, f"Agent '{name}' not found")
    return {"status": "ok", "deleted": name}


# --- Collaboration --------------------------------------------------------


@router.post("/agents/collaborate")
async def agents_collaborate(req: CollaborateRequest):
    from engine.api import routes as _pkg

    if _pkg._collaboration is None:
        raise HTTPException(503, "Collaboration engine not initialized")
    from engine.agent.collaboration import CollaborationPattern

    try:
        pattern = CollaborationPattern(req.pattern)
    except ValueError:
        raise HTTPException(400, f"Invalid pattern: {req.pattern}. Use: sequential, parallel, debate, round_robin")
    plan = _pkg._collaboration.create_plan(
        pattern=pattern,
        task=req.task,
        agent_roles=req.agents,
        max_rounds=req.max_rounds,
    )
    result = await _pkg._collaboration.execute_plan(plan)
    return {"plan_id": plan.id, "status": plan.status, "result": result}


@router.get("/agents/collaborate/{plan_id}")
async def collaboration_status(plan_id: str):
    from engine.api import routes as _pkg

    if _pkg._collaboration is None:
        raise HTTPException(503, "Collaboration engine not initialized")
    status = _pkg._collaboration.get_plan_status(plan_id)
    if status is None:
        raise HTTPException(404, f"Plan '{plan_id}' not found")
    return status


@router.get("/agents/collaborations")
async def collaborations_list():
    from engine.api import routes as _pkg

    if _pkg._collaboration is None:
        return {"plans": []}
    return {"plans": _pkg._collaboration.get_active_plans()}


# --- Decompose / Orchestrate ---------------------------------------------


@router.post("/agents/decompose")
async def agents_decompose(req: DecomposeRequest):
    from engine.api import routes as _pkg

    if _pkg._decomposer is None:
        raise HTTPException(503, "Task decomposer not initialized")
    subtasks = await _pkg._decomposer.decompose(req.task, max_subtasks=req.max_subtasks)
    return {"subtasks": [s.to_dict() for s in subtasks]}


@router.post("/agents/orchestrate")
async def agents_orchestrate(req: OrchestrateRequest):
    from engine.api import routes as _pkg

    if _pkg._decomposer is None or _pkg._orchestrator is None or _pkg._agent_loop is None:
        raise HTTPException(503, "Orchestration pipeline not initialized")
    subtasks = await _pkg._decomposer.decompose(req.task)
    result = await _pkg._orchestrator.execute_plan(subtasks, _pkg._agent_loop)
    return result
