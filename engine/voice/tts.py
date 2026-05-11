from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path


async def synthesize(
    text: str,
    voice: str = "alloy",
    model: str = "tts-1",
    output_dir: str | None = None,
) -> str:
    from openai import AsyncOpenAI

    client = AsyncOpenAI()

    out_dir = Path(output_dir) if output_dir else Path(tempfile.gettempdir()) / "mix_tts"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{hash(text) & 0xFFFFFFFF:x}.mp3"

    if out_path.exists():
        return str(out_path)

    response = await client.audio.speech.create(
        model=model,
        voice=voice,
        input=text,
    )
    response.stream_to_file(str(out_path))
    return str(out_path)
