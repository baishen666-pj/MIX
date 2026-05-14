from __future__ import annotations

import json
import logging
import re
from urllib.parse import urljoin

import httpx

from engine.tools.types import ToolResult
from engine.tools.url_utils import validate_url

log = logging.getLogger("mix.scraper")


async def execute(
    url: str,
    selectors: dict[str, str] | None = None,
    extract_links: bool = False,
    extract_images: bool = False,
    format: str = "text",
    **kwargs,
) -> ToolResult:
    try:
        validate_url(url)
    except ValueError as e:
        return ToolResult(output="", error=str(e), success=False)

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "MIX/1.0"})
            resp.raise_for_status()
            html = resp.text
    except Exception as e:
        return ToolResult(output="", error=f"Fetch failed: {e}", success=False)

    result: dict = {"url": url, "status": resp.status_code}

    if format == "text" or not selectors:
        text = _extract_text(html)
        result["text"] = text[:5000]
        result["truncated"] = len(text) > 5000

    if selectors:
        result["extracted"] = {}
        for key, css in selectors.items():
            matches = _extract_by_selector(html, css)
            result["extracted"][key] = matches[:20]

    if extract_links:
        result["links"] = _extract_links(html, url)[:50]

    if extract_images:
        result["images"] = _extract_images(html, url)[:30]

    try:
        jsonld = _extract_jsonld(html)
        if jsonld:
            result["structured_data"] = jsonld
    except json.JSONDecodeError:
        log.warning("Failed to parse JSON-LD block")

    return ToolResult(output=json.dumps(result, ensure_ascii=False), success=True)


def _extract_text(html: str) -> str:
    text = html
    text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _extract_by_selector(html: str, css: str) -> list[str]:
    tag_match = re.match(r"(\w+)", css)
    if not tag_match:
        return []
    tag = tag_match.group(1)
    pattern = rf"<{tag}[^>]*>(.*?)</{tag}>"
    matches = re.findall(pattern, html, re.DOTALL | re.IGNORECASE)
    return [re.sub(r"<[^>]+>", "", m).strip() for m in matches]


def _extract_links(html: str, base_url: str) -> list[str]:
    hrefs = re.findall(r'href=["\']([^"\']+)["\']', html, re.IGNORECASE)
    links = []
    for href in hrefs:
        if href.startswith("http"):
            links.append(href)
        elif href.startswith("/"):
            links.append(urljoin(base_url, href))
    return links


def _extract_images(html: str, base_url: str) -> list[str]:
    srcs = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', html, re.IGNORECASE)
    return [s if s.startswith("http") else f"{base_url.rstrip('/')}/{s.lstrip('/')}" for s in srcs]


def _extract_jsonld(html: str) -> list[dict]:
    scripts = re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        re.DOTALL | re.IGNORECASE,
    )
    results = []
    for script in scripts:
        try:
            results.append(json.loads(script))
        except json.JSONDecodeError:
            pass
    return results


SCRAPER_DEFINITION = {
    "type": "function",
    "function": {
        "name": "scraper",
        "description": "Scrape web pages and extract structured data using CSS selectors or JSON-LD",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "URL to scrape"},
                "selectors": {
                    "type": "object",
                    "description": 'CSS selectors to extract data, e.g. {"titles": "h2", "prices": ".price"}',
                },
                "extract_links": {"type": "boolean", "description": "Extract all links from the page"},
                "extract_images": {"type": "boolean", "description": "Extract all image URLs"},
                "format": {"type": "string", "enum": ["text", "json"], "description": "Output format"},
            },
            "required": ["url"],
        },
    },
}
