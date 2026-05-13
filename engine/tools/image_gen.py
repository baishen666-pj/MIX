from __future__ import annotations

import base64
import os
import uuid

import httpx

from engine.tools.types import ToolResult


async def execute(
    prompt: str,
    size: str = "1024x1024",
    n: int = 1,
    style: str = "vivid",
    **kwargs,
) -> ToolResult:
    api_key = kwargs.get("api_key", "") or os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return ToolResult(output="", error="OPENAI_API_KEY not configured", success=False)

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.openai.com/v1/images/generations",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "dall-e-3",
                    "prompt": prompt,
                    "size": size,
                    "n": n,
                    "style": style,
                    "response_format": "url",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        images = []
        for img in data.get("data", []):
            images.append({
                "url": img.get("url", ""),
                "revised_prompt": img.get("revised_prompt", ""),
            })

        return ToolResult(
            output=f"Generated {len(images)} image(s)",
            success=True,
            metadata={"images": images},
        )
    except Exception as e:
        return ToolResult(output="", error=f"Image generation failed: {e}", success=False)


IMAGE_GEN_DEFINITION = {
    "type": "function",
    "function": {
        "name": "image_generate",
        "description": "Generate images from text descriptions using DALL-E",
        "parameters": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "Description of the image to generate"},
                "size": {
                    "type": "string",
                    "enum": ["1024x1024", "1792x1024", "1024x1792"],
                    "default": "1024x1024",
                },
                "n": {"type": "integer", "description": "Number of images (1-4)", "default": 1},
                "style": {"type": "string", "enum": ["vivid", "natural"], "default": "vivid"},
            },
            "required": ["prompt"],
        },
    },
}
