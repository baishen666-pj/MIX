"""Skill execution and listing endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from engine.api.schemas import SkillExecuteRequest

router = APIRouter()


@router.post("/skills/execute")
async def skill_execute(req: SkillExecuteRequest):
    from engine.api import routes as _pkg

    if _pkg._skill_registry is None or _pkg._skill_loader is None:
        raise HTTPException(503, "Skills system not initialized")
    manifest = _pkg._skill_registry.get(req.skill_name)
    if manifest is None:
        raise HTTPException(404, f"Skill '{req.skill_name}' not found")
    result = await _pkg._skill_loader.execute(manifest, args=req.args)
    return {"status": "ok", "skill": req.skill_name, "result": result}


@router.get("/skills")
async def skills_list():
    from engine.api import routes as _pkg

    if _pkg._skill_registry is None:
        return {"skills": []}
    return {"skills": _pkg._skill_registry.list_skills()}
