"""Model routing and tiers endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from engine.api.routes import _state as state
from engine.api.schemas import ModelRouteRequest, ModelRouteResponse

router = APIRouter()


@router.post("/model/route", response_model=ModelRouteResponse)
async def model_route(req: ModelRouteRequest):
    from engine.agent.model_router import classify_complexity, route_model

    tier = route_model(req.message, override_tier=req.tier)
    tier_name = req.tier or classify_complexity(req.message)
    return ModelRouteResponse(
        tier=tier_name,
        provider=tier.provider,
        model=tier.model,
        context_window=tier.context_window,
        max_output_tokens=tier.max_output_tokens,
    )


@router.get("/model/tiers")
async def model_tiers():
    from engine.agent.model_router import MODEL_TIERS

    return {
        "tiers": {
            name: {
                "provider": t.provider,
                "model": t.model,
                "context_window": t.context_window,
                "max_output_tokens": t.max_output_tokens,
            }
            for name, t in MODEL_TIERS.items()
        }
    }
