from __future__ import annotations

import tempfile
from pathlib import Path
from typing import AsyncIterator


async def synthesize(
    text: str,
    voice: str = "alloy",
    model: str = "tts-1",
    output_dir: str | None = None,
    api_key: str | None = None,
) -> str:
    import os

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key or os.environ.get("OPENAI_API_KEY"))

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


async def synthesize_stream(
    text: str,
    voice: str = "alloy",
    model: str = "tts-1",
    api_key: str | None = None,
    chunk_size: int = 4096,
) -> AsyncIterator[bytes]:
    import os

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key or os.environ.get("OPENAI_API_KEY"))

    response = await client.audio.speech.create(
        model=model,
        voice=voice,
        input=text,
    )

    async for chunk in response.iter_bytes(chunk_size=chunk_size):  # type: ignore[attr-defined]
        yield chunk
