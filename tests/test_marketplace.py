"""Tests for engine.skills.marketplace — MarketplaceIndex."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from engine.skills.marketplace import CATEGORIES, MarketplaceEntry, MarketplaceIndex


@pytest.fixture
def tmp_index(tmp_path: Path) -> Path:
    return tmp_path / "marketplace.json"


def _write_index(path: Path, entries: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"version": 1, "entries": entries}), encoding="utf-8")


# -- load -----------------------------------------------------------------


class TestLoad:
    def test_load_valid_index(self, tmp_index: Path) -> None:
        _write_index(tmp_index, [
            {
                "id": "test-skill",
                "name": "Test Skill",
                "description": "A test",
                "version": "1.0.0",
                "author": "Tester",
                "category": "utilities",
                "tags": ["test"],
                "source_url": "https://example.com/test",
                "handler": "python",
                "triggers": ["/test"],
            },
        ])
        idx = MarketplaceIndex(tmp_index)
        assert idx.load() == 1

    def test_load_missing_file_returns_zero(self, tmp_index: Path) -> None:
        idx = MarketplaceIndex(tmp_index)
        assert idx.load() == 0

    def test_load_invalid_json_returns_zero(self, tmp_index: Path) -> None:
        tmp_index.parent.mkdir(parents=True, exist_ok=True)
        tmp_index.write_text("not json", encoding="utf-8")
        idx = MarketplaceIndex(tmp_index)
        assert idx.load() == 0

    def test_load_missing_required_field_skips_entry(self, tmp_index: Path) -> None:
        _write_index(tmp_index, [
            {"id": "bad", "description": "missing name"},
        ])
        idx = MarketplaceIndex(tmp_index)
        assert idx.load() == 0

    def test_load_non_dict_root_returns_zero(self, tmp_index: Path) -> None:
        tmp_index.parent.mkdir(parents=True, exist_ok=True)
        tmp_index.write_text("[]", encoding="utf-8")
        idx = MarketplaceIndex(tmp_index)
        assert idx.load() == 0


# -- list_entries ---------------------------------------------------------


class TestListEntries:
    @pytest.fixture()
    def loaded(self, tmp_index: Path) -> MarketplaceIndex:
        _write_index(tmp_index, [
            {
                "id": "weather",
                "name": "Weather Fetcher",
                "description": "Get weather",
                "version": "1.0",
                "author": "A",
                "category": "utilities",
                "tags": ["weather", "api"],
                "source_url": "",
                "handler": "python",
                "triggers": ["/weather"],
            },
            {
                "id": "calc",
                "name": "Calculator",
                "description": "Do math",
                "version": "1.0",
                "author": "B",
                "category": "developer",
                "tags": ["math"],
                "source_url": "",
                "handler": "python",
                "triggers": ["/calc"],
            },
        ])
        idx = MarketplaceIndex(tmp_index)
        idx.load()
        return idx

    def test_list_all(self, loaded: MarketplaceIndex) -> None:
        assert len(loaded.list_entries()) == 2

    def test_list_by_category(self, loaded: MarketplaceIndex) -> None:
        results = loaded.list_entries(category="utilities")
        assert len(results) == 1
        assert results[0]["id"] == "weather"

    def test_list_by_tag(self, loaded: MarketplaceIndex) -> None:
        results = loaded.list_entries(tags=["api"])
        assert len(results) == 1
        assert results[0]["id"] == "weather"

    def test_list_by_query(self, loaded: MarketplaceIndex) -> None:
        results = loaded.list_entries(query="math")
        assert len(results) == 1
        assert results[0]["id"] == "calc"

    def test_list_combined_filters(self, loaded: MarketplaceIndex) -> None:
        results = loaded.list_entries(query="weather", category="developer")
        assert len(results) == 0

    def test_list_empty_results(self, loaded: MarketplaceIndex) -> None:
        assert loaded.list_entries(query="nonexistent") == []


# -- get_entry ------------------------------------------------------------


class TestGetEntry:
    def test_get_existing(self, tmp_index: Path) -> None:
        _write_index(tmp_index, [
            {
                "id": "my-skill",
                "name": "My Skill",
                "description": "x",
                "version": "1.0",
                "author": "",
                "category": "utilities",
                "tags": [],
                "source_url": "",
                "handler": "python",
                "triggers": [],
            },
        ])
        idx = MarketplaceIndex(tmp_index)
        idx.load()
        entry = idx.get_entry("my-skill")
        assert entry is not None
        assert entry["name"] == "My Skill"

    def test_get_nonexistent(self, tmp_index: Path) -> None:
        idx = MarketplaceIndex(tmp_index)
        assert idx.get_entry("nope") is None


# -- categories -----------------------------------------------------------


class TestCategories:
    def test_returns_sorted_unique(self, tmp_index: Path) -> None:
        _write_index(tmp_index, [
            {"id": "a", "name": "A", "description": "", "version": "1", "category": "data", "tags": [], "source_url": "", "handler": "python", "triggers": []},
            {"id": "b", "name": "B", "description": "", "version": "1", "category": "ai", "tags": [], "source_url": "", "handler": "python", "triggers": []},
            {"id": "c", "name": "C", "description": "", "version": "1", "category": "data", "tags": [], "source_url": "", "handler": "python", "triggers": []},
        ])
        idx = MarketplaceIndex(tmp_index)
        idx.load()
        assert idx.categories() == ["ai", "data"]


# -- refresh --------------------------------------------------------------


class TestRefresh:
    @pytest.mark.asyncio
    async def test_refresh_reloads(self, tmp_index: Path) -> None:
        _write_index(tmp_index, [
            {"id": "a", "name": "A", "description": "", "version": "1", "category": "utilities", "tags": [], "source_url": "", "handler": "python", "triggers": []},
        ])
        idx = MarketplaceIndex(tmp_index)
        assert idx.load() == 1
        _write_index(tmp_index, [
            {"id": "a", "name": "A", "description": "", "version": "1", "category": "utilities", "tags": [], "source_url": "", "handler": "python", "triggers": []},
            {"id": "b", "name": "B", "description": "", "version": "1", "category": "data", "tags": [], "source_url": "", "handler": "python", "triggers": []},
        ])
        assert await idx.refresh() == 2

    @pytest.mark.asyncio
    async def test_refresh_without_remote_falls_back_to_local(self, tmp_index: Path) -> None:
        _write_index(tmp_index, [
            {"id": "a", "name": "A", "description": "", "version": "1", "category": "utilities", "tags": [], "source_url": "", "handler": "python", "triggers": []},
        ])
        idx = MarketplaceIndex(tmp_index)
        assert await idx.refresh() == 1


# -- seed file ------------------------------------------------------------


class TestSeedIndex:
    def test_seed_loads(self) -> None:
        seed = Path("data/marketplace_index.json")
        if not seed.exists():
            pytest.skip("Seed file not found")
        idx = MarketplaceIndex(seed)
        count = idx.load()
        assert count >= 7
        entries = idx.list_entries()
        ids = {e["id"] for e in entries}
        assert "weather-fetcher" in ids
        assert "calculator" in ids


# -- fetch_remote -----------------------------------------------------------


class TestFetchRemote:
    @pytest.mark.asyncio
    async def test_fetch_remote_without_url_falls_back(self, tmp_index: Path) -> None:
        _write_index(tmp_index, [
            {"id": "a", "name": "A", "description": "", "version": "1",
             "category": "utilities", "tags": [], "source_url": "", "handler": "python", "triggers": []},
        ])
        idx = MarketplaceIndex(tmp_index)
        count = await idx.fetch_remote()
        assert count == 1

    @pytest.mark.asyncio
    async def test_fetch_remote_success(self, tmp_index: Path) -> None:
        remote_data = {
            "version": 1,
            "entries": [
                {"id": "remote-1", "name": "Remote", "description": "from remote",
                 "version": "2.0", "category": "ai", "tags": ["remote"],
                 "source_url": "", "handler": "python", "triggers": []},
            ],
        }
        mock_resp = MagicMock()
        mock_resp.json.return_value = remote_data
        mock_resp.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_client):
            idx = MarketplaceIndex(tmp_index, remote_url="https://example.com/index.json")
            count = await idx.fetch_remote()
        assert count == 1
        assert idx.get_entry("remote-1") is not None
        assert idx._last_remote_fetch > 0

    @pytest.mark.asyncio
    async def test_fetch_remote_writes_cache(self, tmp_index: Path) -> None:
        remote_data = {
            "version": 1,
            "entries": [
                {"id": "cached", "name": "Cached", "description": "cached entry",
                 "version": "1.0", "category": "utilities", "tags": [],
                 "source_url": "", "handler": "python", "triggers": []},
            ],
        }
        mock_resp = MagicMock()
        mock_resp.json.return_value = remote_data
        mock_resp.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_client):
            idx = MarketplaceIndex(tmp_index, remote_url="https://example.com/index.json")
            await idx.fetch_remote()

        assert tmp_index.exists()
        cached = json.loads(tmp_index.read_text(encoding="utf-8"))
        assert len(cached["entries"]) == 1

    @pytest.mark.asyncio
    async def test_fetch_remote_failure_falls_back(self, tmp_index: Path) -> None:
        _write_index(tmp_index, [
            {"id": "local", "name": "Local", "description": "", "version": "1",
             "category": "utilities", "tags": [], "source_url": "", "handler": "python", "triggers": []},
        ])

        mock_client = AsyncMock()
        mock_client.get.side_effect = Exception("network error")
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_client):
            idx = MarketplaceIndex(tmp_index, remote_url="https://example.com/index.json")
            count = await idx.fetch_remote()
        assert count == 1
        assert idx.get_entry("local") is not None

    @pytest.mark.asyncio
    async def test_fetch_remote_cache_write_failure_does_not_crash(self, tmp_index: Path) -> None:
        remote_data = {
            "version": 1,
            "entries": [
                {"id": "x", "name": "X", "description": "", "version": "1",
                 "category": "utilities", "tags": [], "source_url": "", "handler": "python", "triggers": []},
            ],
        }
        mock_resp = MagicMock()
        mock_resp.json.return_value = remote_data
        mock_resp.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_client):
            idx = MarketplaceIndex(tmp_index, remote_url="https://example.com/index.json")
            # Make write_text raise OSError
            with patch.object(Path, "write_text", side_effect=OSError("disk full")):
                count = await idx.fetch_remote()
        assert count == 1
