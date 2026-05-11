from __future__ import annotations

from typing import Any

from engine.tools.types import ToolResult


async def web_search(query: str, limit: int = 5, **_: Any) -> ToolResult:
    try:
        import httpx

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.duckduckgo.com/",
                params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
            )
            data = resp.json()

            results = []
            abstract = data.get("Abstract", "")
            if abstract:
                results.append(f"[Summary] {abstract}")
                results.append(f"Source: {data.get('AbstractURL', '')}")

            related = data.get("RelatedTopics", [])
            for topic in related[:limit]:
                if isinstance(topic, dict) and "Text" in topic:
                    results.append(f"- {topic['Text']}")
                    if topic.get("FirstURL"):
                        results.append(f"  {topic['FirstURL']}")

            if not results:
                return ToolResult(output="No results found.")

            return ToolResult(output="\n".join(results))
    except ImportError:
        return ToolResult(output="", error="httpx not installed", success=False)
    except Exception as e:
        return ToolResult(output="", error=str(e), success=False)
