"""Health, config, and metrics endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from engine.api.schemas import HealthResponse

log = logging.getLogger(__name__)

router = APIRouter()


# --- Health ---------------------------------------------------------------


@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        version="0.1.0",
        engine="mix-python",
    )


# --- Config ---------------------------------------------------------------


@router.get("/config")
async def config_get():
    from engine.api.routes import _config

    if _config is None:
        raise HTTPException(503, "Config not initialized")
    return _config._to_dict()


@router.put("/config")
async def config_update(req: dict):
    from engine.api import routes as _pkg

    if _pkg._config is None:
        raise HTTPException(503, "Config not initialized")
    from engine.config import MixConfig

    updated = MixConfig._from_dict(req)
    updated.save()
    _pkg._config = updated
    return {"status": "ok"}


# --- Metrics --------------------------------------------------------------


@router.get("/metrics")
async def metrics_endpoint():
    from engine.api import routes as _pkg

    if _pkg._metrics is None:
        raise HTTPException(503, "Metrics not initialized")
    data = await _pkg._metrics.get_metrics()
    if _pkg._agent_router is not None:
        agents = _pkg._agent_router.list_agents()
        channels = list({ch for a in agents for ch in a.get("channels", [])})
        data["channels"] = channels
    else:
        data["channels"] = []
    return data


@router.get("/metrics/prometheus")
async def metrics_prometheus():
    from engine.api import routes as _pkg

    if _pkg._metrics is None:
        from fastapi.responses import PlainTextResponse

        return PlainTextResponse("# Metrics not initialized\n")
    text = await _pkg._metrics.prometheus_format()
    from fastapi.responses import PlainTextResponse

    return PlainTextResponse(text, media_type="text/plain; version=0.0.4; charset=utf-8")
