from __future__ import annotations

import re
from typing import Any

from engine.tools.types import ToolResult


async def web_fetch(url: str, format: str = "text", timeout: int = 20, **_: Any) -> ToolResult:
    try:
        try:
            import httpx
        except ImportError:
            return ToolResult(output="", error="httpx not installed. Run: pip install httpx", success=False)

        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()

        content_type = resp.headers.get("content-type", "")

        if "json" in content_type or format == "json":
            return ToolResult(output=resp.text, metadata={"url": url, "content_type": content_type})

        if "html" in content_type or format in ("text", "markdown"):
            text = _strip_html(resp.text)
            return ToolResult(output=text, metadata={"url": url, "content_type": content_type})

        return ToolResult(output=resp.text[:50000], metadata={"url": url, "content_type": content_type})
    except Exception as e:
        return ToolResult(output="", error=str(e), success=False)


def _strip_html(html: str) -> str:
    html = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r"<[^>]+>", " ", html)
    html = re.sub(r"&nbsp;", " ", html)
    html = re.sub(r"&amp;", "&", html)
    html = re.sub(r"&lt;", "<", html)
    html = re.sub(r"&gt;", ">", html)
    html = re.sub(r"&quot;", '"', html)
    html = re.sub(r"&#\d+;", "", html)
    html = re.sub(r"\n\s*\n", "\n\n", html)
    html = re.sub(r"[ \t]+", " ", html)
    return html.strip()[:50000]
