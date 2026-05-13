from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path
from typing import AsyncIterator


async def transcribe(
    audio_path: str = "",
    audio_bytes: bytes | None = None,
    model: str = "whisper-1",
    language: str | None = None,
    api_key: str | None = None,
) -> str:
    import os
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key or os.environ.get("OPENAI_API_KEY"))

    if audio_bytes is not None:
        import io
        file_obj = io.BytesIO(audio_bytes)
        file_obj.name = "audio.wav"
        kwargs: dict = {"model": model, "file": file_obj}
    else:
        path = Path(audio_path)
        if not path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        file_obj = open(path, "rb")
        kwargs = {"model": model, "file": file_obj}

    try:
        if language:
            kwargs["language"] = language
        transcript = await client.audio.transcriptions.create(**kwargs)
        return transcript.text
    finally:
        if audio_bytes is None and hasattr(file_obj, "close"):
            file_obj.close()
