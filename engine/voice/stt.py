from __future__ import annotations

from pathlib import Path


async def transcribe(
    audio_path: str,
    model: str = "whisper-1",
    language: str | None = None,
) -> str:
    from openai import AsyncOpenAI

    client = AsyncOpenAI()

    path = Path(audio_path)
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    with open(path, "rb") as audio_file:
        kwargs: dict = {"model": model, "file": audio_file}
        if language:
            kwargs["language"] = language

        transcript = await client.audio.transcriptions.create(**kwargs)
        return transcript.text
