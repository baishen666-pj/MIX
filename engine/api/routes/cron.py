"""Cron schedule, list, and delete endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from engine.api.schemas import CronScheduleRequest

router = APIRouter()


@router.post("/cron/schedule")
async def cron_schedule(req: CronScheduleRequest):
    from engine.api import routes as _pkg

    if _pkg._cron is None:
        raise HTTPException(503, "Cron scheduler not initialized")
    job = _pkg._cron.add_job(name=req.name, cron=req.cron, message=req.message, channel=req.channel)
    return {"status": "ok", "job": {"id": job.id, "name": job.name, "cron": job.cron}}


@router.get("/cron/jobs")
async def cron_list():
    from engine.api import routes as _pkg

    if _pkg._cron is None:
        return {"jobs": []}
    return {"jobs": _pkg._cron.list_jobs()}


@router.delete("/cron/jobs/{job_id}")
async def cron_delete(job_id: str):
    from engine.api import routes as _pkg

    if _pkg._cron is None:
        raise HTTPException(503, "Cron scheduler not initialized")
    deleted = _pkg._cron.remove_job(job_id)
    return {"deleted": deleted}
