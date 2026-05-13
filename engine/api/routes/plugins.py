"""Plugin install, uninstall, update, reload, and available-list endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.post("/plugins/reload")
async def plugins_reload():
    from engine.api import routes as _pkg

    if _pkg._skill_registry is None:
        raise HTTPException(503, "Skill registry not initialized")
    count = _pkg._skill_registry.load_all()
    return {"status": "ok", "skills_loaded": count}


@router.post("/plugins/install")
async def plugins_install(req: dict):
    from engine.api import routes as _pkg

    if _pkg._skill_registry is None:
        raise HTTPException(503, "Skill registry not initialized")
    source = req.get("source", "")
    version = req.get("version")
    if not source:
        raise HTTPException(400, "Missing 'source' field")
    manifest = _pkg._skill_registry.install(source, version=version)
    if manifest is None:
        raise HTTPException(400, f"Failed to install from '{source}'")
    return {"status": "ok", "skill": {"name": manifest.name, "version": manifest.version}}


@router.post("/plugins/uninstall")
async def plugins_uninstall(req: dict):
    from engine.api import routes as _pkg

    if _pkg._skill_registry is None:
        raise HTTPException(503, "Skill registry not initialized")
    name = req.get("name", "")
    if not name:
        raise HTTPException(400, "Missing 'name' field")
    removed = _pkg._skill_registry.uninstall(name)
    if not removed:
        raise HTTPException(404, f"Skill '{name}' not found")
    return {"status": "ok", "removed": name}


@router.post("/plugins/update")
async def plugins_update(req: dict):
    from engine.api import routes as _pkg

    if _pkg._skill_registry is None:
        raise HTTPException(503, "Skill registry not initialized")
    name = req.get("name", "")
    if not name:
        raise HTTPException(400, "Missing 'name' field")
    manifest = _pkg._skill_registry.update(name)
    if manifest is None:
        raise HTTPException(404, f"Skill '{name}' not found or has no source URL")
    return {"status": "ok", "skill": {"name": manifest.name, "version": manifest.version}}


@router.get("/plugins/available")
async def plugins_available(q: str = ""):
    from engine.api import routes as _pkg

    if _pkg._skill_registry is None:
        return {"plugins": []}
    return {"plugins": _pkg._skill_registry.list_available(query=q)}
