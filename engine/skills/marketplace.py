"""Marketplace index — offline-capable plugin catalog backed by a local JSON file."""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path

log = logging.getLogger("mix.marketplace")

CATEGORIES: list[str] = [
    "productivity",
    "automation",
    "data",
    "communication",
    "utilities",
    "developer",
    "ai",
]


@dataclass
class MarketplaceEntry:
    id: str
    name: str
    description: str
    version: str
    author: str
    category: str
    tags: list[str]
    source_url: str
    handler: str
    triggers: list[str]
    long_description: str = ""
    license: str = "MIT"
    screenshots: list[str] = field(default_factory=list)
    dependencies: list[str] = field(default_factory=list)
    min_mix_version: str = ""
    readme_url: str = ""


class MarketplaceIndex:
    """Load and query a local JSON catalog of available plugins."""

    def __init__(self, index_path: Path | None = None, remote_url: str | None = None) -> None:
        self._path = index_path or Path("data/marketplace_index.json")
        self._remote_url = remote_url
        self._entries: dict[str, MarketplaceEntry] = {}
        self._last_remote_fetch: float = 0.0
        self._remote_cache_ttl: int = 3600

    # -- loading -------------------------------------------------------------

    def _parse_entries(self, raw: dict | list) -> int:
        entries = raw.get("entries", []) if isinstance(raw, dict) else []
        self._entries.clear()
        for item in entries:
            try:
                entry = MarketplaceEntry(
                    id=item["id"],
                    name=item["name"],
                    description=item["description"],
                    version=item.get("version", "0.1.0"),
                    author=item.get("author", ""),
                    category=item.get("category", "utilities"),
                    tags=item.get("tags", []),
                    source_url=item.get("source_url", ""),
                    handler=item.get("handler", "python"),
                    triggers=item.get("triggers", []),
                    long_description=item.get("long_description", ""),
                    license=item.get("license", "MIT"),
                    screenshots=item.get("screenshots", []),
                    dependencies=item.get("dependencies", []),
                    min_mix_version=item.get("min_mix_version", ""),
                    readme_url=item.get("readme_url", ""),
                )
                self._entries[entry.id] = entry
            except (KeyError, TypeError):
                continue
        log.info("Marketplace: loaded %d entries", len(self._entries))
        return len(self._entries)

    def load(self) -> int:
        if not self._path.exists():
            log.warning("Marketplace index not found: %s", self._path)
            return 0
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            log.error("Failed to parse marketplace index: %s", exc)
            return 0
        return self._parse_entries(raw)

    async def fetch_remote(self) -> int:
        """Fetch marketplace index from remote URL, fall back to local cache."""
        if not self._remote_url:
            return self.load()
        try:
            import httpx

            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(self._remote_url)
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            log.warning("Remote marketplace fetch failed: %s, falling back to local", exc)
            return self.load()
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        except OSError as exc:
            log.warning("Failed to cache remote index: %s", exc)
        count = self._parse_entries(data)
        self._last_remote_fetch = time.time()
        return count

    async def refresh(self) -> int:
        return await self.fetch_remote()

    # -- queries -------------------------------------------------------------

    def get_entry(self, entry_id: str) -> dict | None:
        entry = self._entries.get(entry_id)
        return _entry_to_dict(entry) if entry else None

    def list_entries(
        self,
        query: str = "",
        category: str = "",
        tags: list[str] | None = None,
    ) -> list[dict]:
        results: list[dict] = []
        q = query.lower()
        tag_set = set(tags) if tags else None
        for entry in self._entries.values():
            if category and entry.category != category:
                continue
            if tag_set and not tag_set.intersection(entry.tags):
                continue
            if q and q not in entry.name.lower() and q not in entry.description.lower():
                continue
            results.append(_entry_to_dict(entry))
        return results

    def categories(self) -> list[str]:
        seen = {e.category for e in self._entries.values() if e.category}
        return sorted(seen)


def _entry_to_dict(entry: MarketplaceEntry) -> dict:
    return {
        "id": entry.id,
        "name": entry.name,
        "description": entry.description,
        "long_description": entry.long_description,
        "version": entry.version,
        "author": entry.author,
        "category": entry.category,
        "tags": entry.tags,
        "source_url": entry.source_url,
        "license": entry.license,
        "screenshots": entry.screenshots,
        "dependencies": entry.dependencies,
        "handler": entry.handler,
        "triggers": entry.triggers,
        "min_mix_version": entry.min_mix_version,
        "readme_url": entry.readme_url,
    }
