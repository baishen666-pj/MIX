"""Plugin install, uninstall, update, reload, available-list, and marketplace endpoints."""

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


# Alias so that GET /api/plugins works through the gateway.
@router.get("/plugins")
async def plugins_list(q: str = ""):
    return await plugins_available(q=q)


# ---------------------------------------------------------------------------
# Marketplace endpoints
# ---------------------------------------------------------------------------


def _installed_names() -> set[str]:
    from engine.api import routes as _pkg

    if _pkg._skill_registry is None:
        return set()
    return {s.name for s in _pkg._skill_registry.skills.values()}


@router.get("/plugins/marketplace")
async def marketplace_list(q: str = "", category: str = "", tags: str = ""):
    from engine.api import routes as _pkg

    if _pkg._marketplace is None:
        return {"entries": [], "categories": []}
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else None
    entries = _pkg._marketplace.list_entries(query=q, category=category, tags=tag_list)
    installed = _installed_names()
    enriched = [{**e, "installed": e["name"] in installed or e["id"] in installed} for e in entries]
    return {"entries": enriched, "categories": _pkg._marketplace.categories()}


@router.get("/plugins/marketplace/{entry_id}")
async def marketplace_detail(entry_id: str):
    from engine.api import routes as _pkg

    if _pkg._marketplace is None:
        raise HTTPException(503, "Marketplace not initialized")
    entry = _pkg._marketplace.get_entry(entry_id)
    if entry is None:
        raise HTTPException(404, f"Entry '{entry_id}' not found")
    installed = _installed_names()
    return {**entry, "installed": entry["name"] in installed or entry["id"] in installed}


@router.post("/plugins/marketplace/refresh")
async def marketplace_refresh():
    from engine.api import routes as _pkg

    if _pkg._marketplace is None:
        raise HTTPException(503, "Marketplace not initialized")
    count = _pkg._marketplace.refresh()
    return {"status": "ok", "entries_loaded": count}


@router.post("/plugins/marketplace/install")
async def marketplace_install(req: dict):
    from engine.api import routes as _pkg

    if _pkg._skill_registry is None:
        raise HTTPException(503, "Skill registry not initialized")
    if _pkg._marketplace is None:
        raise HTTPException(503, "Marketplace not initialized")
    entry_id = req.get("id", "")
    if not entry_id:
        raise HTTPException(400, "Missing 'id' field")
    entry = _pkg._marketplace.get_entry(entry_id)
    if entry is None:
        raise HTTPException(404, f"Entry '{entry_id}' not found")
    source_url = entry.get("source_url", "")
    if not source_url:
        raise HTTPException(400, f"Entry '{entry_id}' has no source URL")
    version = req.get("version")
    manifest = _pkg._skill_registry.install(source_url, version=version)
    if manifest is None:
        raise HTTPException(400, f"Failed to install '{entry_id}'")
    return {"status": "ok", "skill": {"name": manifest.name, "version": manifest.version}}
