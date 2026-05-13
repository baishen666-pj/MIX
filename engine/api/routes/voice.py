"""Voice TTS and STT endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, File, HTTPException, UploadFile

from engine.api.schemas import STTResponse, TTSRequest

log = logging.getLogger(__name__)

router = APIRouter()


@router.post("/voice/tts")
async def voice_tts(req: TTSRequest):
    from engine.api import routes as _pkg

    if not req.text:
        raise HTTPException(400, "text is required")
    try:
        if req.stream:
            from engine.voice.tts import synthesize_stream

            from starlette.responses import StreamingResponse

            return StreamingResponse(
                synthesize_stream(req.text, voice=req.voice, model=req.model, api_key=_pkg._api_key),
                media_type="audio/mpeg",
                headers={"Content-Disposition": "inline; filename=tts.mp3"},
            )
        from engine.voice.tts import synthesize

        audio_path = await synthesize(req.text, voice=req.voice, model=req.model, api_key=_pkg._api_key)
        return {"status": "ok", "path": audio_path}
    except Exception:
        log.exception("TTS synthesis failed")
        raise HTTPException(500, "Internal server error")


@router.post("/voice/stt")
async def voice_stt(file: UploadFile = File(...)):
    from engine.api import routes as _pkg

    try:
        from engine.voice.stt import transcribe

        audio_bytes = await file.read()
        text = await transcribe(audio_bytes=audio_bytes, api_key=_pkg._api_key)
        return STTResponse(text=text)
    except Exception:
        log.exception("STT transcription failed")
        raise HTTPException(500, "Internal server error")


@router.post("/voice/stt/path")
async def voice_stt_path(body: dict):
    from engine.api import routes as _pkg

    audio_path = body.get("path", "")
    if not audio_path:
        raise HTTPException(400, "path is required")
    try:
        from engine.voice.stt import transcribe

        text = await transcribe(audio_path=audio_path, api_key=_pkg._api_key)
        return STTResponse(text=text)
    except Exception:
        log.exception("STT transcription failed for path '%s'", audio_path)
        raise HTTPException(500, "Internal server error")
