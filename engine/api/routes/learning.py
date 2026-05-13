"""Learning insights, promote, and dismiss endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/learning/insights")
async def learning_insights():
    from engine.api import routes as _pkg

    if _pkg._learning is None:
        return {"insights": []}
    return {"insights": _pkg._learning.get_pending_insights()}


@router.post("/learning/insights/{insight_id}/promote")
async def promote_insight(insight_id: str):
    from engine.api import routes as _pkg

    if _pkg._learning is None:
        raise HTTPException(503, "Learning not initialized")
    manifest = await _pkg._learning.promote_insight(insight_id)
    if manifest is None:
        raise HTTPException(404, "Insight not found or no code to promote")
    return {"status": "ok", "skill": manifest.name}


@router.delete("/learning/insights/{insight_id}")
async def dismiss_insight(insight_id: str):
    from engine.api import routes as _pkg

    if _pkg._learning is None:
        raise HTTPException(503, "Learning not initialized")
    dismissed = _pkg._learning.dismiss_insight(insight_id)
    return {"dismissed": dismissed}
