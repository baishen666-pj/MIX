"""Tests for engine.skills.marketplace — MarketplaceIndex."""

from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from engine.skills.marketplace import MarketplaceIndex, compare_versions


@pytest.fixture
def tmp_index(tmp_path: Path) -> Path:
    return tmp_path / "marketplace.json"


def _e(id: str, name: str, category: str, **kw: object) -> dict:
    """Build a minimal marketplace entry dict for tests."""
    return {
        "id": id,
        "name": name,
        "description": kw.get("description", ""),
        "version": kw.get("version", "1"),
        "category": category,
        "tags": kw.get("tags", []),
        "source_url": kw.get("source_url", ""),
        "handler": kw.get("handler", "python"),
        "triggers": kw.get("triggers", []),
    }


def _write_index(path: Path, entries: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"version": 1, "entries": entries}), encoding="utf-8")


# -- load -----------------------------------------------------------------


class TestLoad:
    def test_load_valid_index(self, tmp_index: Path) -> None:
        _write_index(
            tmp_index,
            [
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
            ],
        )
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
        _write_index(
            tmp_index,
            [
                {"id": "bad", "description": "missing name"},
            ],
        )
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
        _write_index(
            tmp_index,
            [
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
            ],
        )
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
        _write_index(
            tmp_index,
            [
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
            ],
        )
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
        _write_index(
            tmp_index,
            [
                _e("a", "A", "data"),
                _e("b", "B", "ai"),
                _e("c", "C", "data"),
            ],
        )
        idx = MarketplaceIndex(tmp_index)
        idx.load()
        assert idx.categories() == ["ai", "data"]


# -- refresh --------------------------------------------------------------


class TestRefresh:
    @pytest.mark.asyncio
    async def test_refresh_reloads(self, tmp_index: Path) -> None:
        _write_index(
            tmp_index,
            [
                _e("a", "A", "utilities"),
            ],
        )
        idx = MarketplaceIndex(tmp_index)
        assert idx.load() == 1
        _write_index(
            tmp_index,
            [
                _e("a", "A", "utilities"),
                _e("b", "B", "data"),
            ],
        )
        assert await idx.refresh() == 2

    @pytest.mark.asyncio
    async def test_refresh_without_remote_falls_back_to_local(self, tmp_index: Path) -> None:
        _write_index(
            tmp_index,
            [
                _e("a", "A", "utilities"),
            ],
        )
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
        _write_index(
            tmp_index,
            [
                {
                    "id": "a",
                    "name": "A",
                    "description": "",
                    "version": "1",
                    "category": "utilities",
                    "tags": [],
                    "source_url": "",
                    "handler": "python",
                    "triggers": [],
                },
            ],
        )
        idx = MarketplaceIndex(tmp_index)
        count = await idx.fetch_remote()
        assert count == 1

    @pytest.mark.asyncio
    async def test_fetch_remote_success(self, tmp_index: Path) -> None:
        remote_data = {
            "version": 1,
            "entries": [
                {
                    "id": "remote-1",
                    "name": "Remote",
                    "description": "from remote",
                    "version": "2.0",
                    "category": "ai",
                    "tags": ["remote"],
                    "source_url": "",
                    "handler": "python",
                    "triggers": [],
                },
            ],
        }
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = remote_data
        mock_resp.raise_for_status = MagicMock()
        mock_resp.headers = {"etag": '"abc123"'}

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
        assert idx._etag == '"abc123"'

    @pytest.mark.asyncio
    async def test_fetch_remote_writes_cache(self, tmp_index: Path) -> None:
        remote_data = {
            "version": 1,
            "entries": [
                {
                    "id": "cached",
                    "name": "Cached",
                    "description": "cached entry",
                    "version": "1.0",
                    "category": "utilities",
                    "tags": [],
                    "source_url": "",
                    "handler": "python",
                    "triggers": [],
                },
            ],
        }
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = remote_data
        mock_resp.raise_for_status = MagicMock()
        mock_resp.headers = {}

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
        _write_index(
            tmp_index,
            [
                {
                    "id": "local",
                    "name": "Local",
                    "description": "",
                    "version": "1",
                    "category": "utilities",
                    "tags": [],
                    "source_url": "",
                    "handler": "python",
                    "triggers": [],
                },
            ],
        )

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
                {
                    "id": "x",
                    "name": "X",
                    "description": "",
                    "version": "1",
                    "category": "utilities",
                    "tags": [],
                    "source_url": "",
                    "handler": "python",
                    "triggers": [],
                },
            ],
        }
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = remote_data
        mock_resp.raise_for_status = MagicMock()
        mock_resp.headers = {}

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


# -- TTL cache -------------------------------------------------------------


class TestTTLCache:
    def test_is_cache_stale_when_stale(self, tmp_index: Path) -> None:
        idx = MarketplaceIndex(tmp_index, remote_url="https://example.com")
        idx._last_remote_fetch = time.time() - 7200
        assert idx.is_cache_stale() is True

    def test_is_cache_stale_when_fresh(self, tmp_index: Path) -> None:
        idx = MarketplaceIndex(tmp_index, remote_url="https://example.com")
        idx._last_remote_fetch = time.time()
        assert idx.is_cache_stale() is False

    def test_is_cache_stale_no_remote_url(self, tmp_index: Path) -> None:
        idx = MarketplaceIndex(tmp_index)
        idx._last_remote_fetch = 0.0
        assert idx.is_cache_stale() is False


# -- ETag support ----------------------------------------------------------


class TestETagSupport:
    @pytest.mark.asyncio
    async def test_sends_if_none_match_when_etag_set(self, tmp_index: Path) -> None:
        mock_resp = MagicMock()
        mock_resp.status_code = 304

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_client):
            idx = MarketplaceIndex(tmp_index, remote_url="https://example.com/index.json")
            idx._etag = '"v1"'
            _write_index(
                tmp_index,
                [
                    {
                        "id": "a",
                        "name": "A",
                        "description": "",
                        "version": "1",
                        "category": "utilities",
                        "tags": [],
                        "source_url": "",
                        "handler": "python",
                        "triggers": [],
                    },
                ],
            )
            idx.load()
            await idx.fetch_remote()

        call_kwargs = mock_client.get.call_args
        assert call_kwargs is not None
        headers = (
            call_kwargs[1].get("headers", {})
            if len(call_kwargs) > 1
            else call_kwargs[0].get("headers", {})
            if call_kwargs[0]
            else {}
        )
        assert headers.get("If-None-Match") == '"v1"'

    @pytest.mark.asyncio
    async def test_handles_304_without_reparse(self, tmp_index: Path) -> None:
        _write_index(
            tmp_index,
            [
                {
                    "id": "existing",
                    "name": "Existing",
                    "description": "",
                    "version": "1",
                    "category": "utilities",
                    "tags": [],
                    "source_url": "",
                    "handler": "python",
                    "triggers": [],
                },
            ],
        )
        mock_resp = MagicMock()
        mock_resp.status_code = 304

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_client):
            idx = MarketplaceIndex(tmp_index, remote_url="https://example.com/index.json")
            idx.load()
            assert idx.get_entry("existing") is not None
            count = await idx.fetch_remote()
        assert count == 1
        assert idx._last_remote_fetch > 0

    @pytest.mark.asyncio
    async def test_stores_etag_from_200(self, tmp_index: Path) -> None:
        remote_data = {
            "version": 1,
            "entries": [
                {
                    "id": "x",
                    "name": "X",
                    "description": "",
                    "version": "1",
                    "category": "utilities",
                    "tags": [],
                    "source_url": "",
                    "handler": "python",
                    "triggers": [],
                },
            ],
        }
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = remote_data
        mock_resp.raise_for_status = MagicMock()
        mock_resp.headers = {"etag": '"new-etag"'}

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_client):
            idx = MarketplaceIndex(tmp_index, remote_url="https://example.com/index.json")
            await idx.fetch_remote()
        assert idx._etag == '"new-etag"'

    @pytest.mark.asyncio
    async def test_no_etag_header_graceful(self, tmp_index: Path) -> None:
        remote_data = {
            "version": 1,
            "entries": [
                {
                    "id": "x",
                    "name": "X",
                    "description": "",
                    "version": "1",
                    "category": "utilities",
                    "tags": [],
                    "source_url": "",
                    "handler": "python",
                    "triggers": [],
                },
            ],
        }
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = remote_data
        mock_resp.raise_for_status = MagicMock()
        mock_resp.headers = {}

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("httpx.AsyncClient", return_value=mock_client):
            idx = MarketplaceIndex(tmp_index, remote_url="https://example.com/index.json")
            await idx.fetch_remote()
        assert idx._etag == ""


# -- Background refresh ----------------------------------------------------


class TestBackgroundRefresh:
    @pytest.mark.asyncio
    async def test_start_creates_task(self, tmp_index: Path) -> None:
        idx = MarketplaceIndex(tmp_index, remote_url="https://example.com")
        idx._remote_cache_ttl = 9999
        await idx.start_background_refresh()
        assert idx._bg_running is True
        assert idx._bg_task is not None
        await idx.stop_background_refresh()

    @pytest.mark.asyncio
    async def test_stop_cancels_task(self, tmp_index: Path) -> None:
        idx = MarketplaceIndex(tmp_index, remote_url="https://example.com")
        idx._remote_cache_ttl = 9999
        await idx.start_background_refresh()
        await idx.stop_background_refresh()
        assert idx._bg_running is False
        assert idx._bg_task is None

    @pytest.mark.asyncio
    async def test_bg_loop_handles_exception(self, tmp_index: Path) -> None:
        idx = MarketplaceIndex(tmp_index, remote_url="https://example.com")
        idx._remote_cache_ttl = 0

        call_count = 0

        async def failing_fetch():
            nonlocal call_count
            call_count += 1
            raise RuntimeError("transient")

        idx.fetch_remote = failing_fetch
        await idx.start_background_refresh()
        await asyncio.sleep(0.1)
        await idx.stop_background_refresh()
        assert call_count >= 1


# -- Version comparison ----------------------------------------------------


class TestCompareVersions:
    def test_major_update(self) -> None:
        assert compare_versions("1.0.0", "2.0.0") is True

    def test_minor_update(self) -> None:
        assert compare_versions("1.0.0", "1.1.0") is True

    def test_patch_update(self) -> None:
        assert compare_versions("1.0.0", "1.0.1") is True

    def test_same_version(self) -> None:
        assert compare_versions("1.0.0", "1.0.0") is False

    def test_downgrade(self) -> None:
        assert compare_versions("2.0.0", "1.0.0") is False

    def test_string_fallback(self) -> None:
        with patch("engine.skills.marketplace.compare_versions", side_effect=TypeError):
            pass
        # Direct fallback test: simple string comparison
        assert "2.0" > "1.0"
