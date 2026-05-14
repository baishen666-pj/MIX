"""Tests for engine.skills.marketplace — MarketplaceIndex."""

from __future__ import annotations

import json
from pathlib import Path

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
    def test_refresh_reloads(self, tmp_index: Path) -> None:
        _write_index(tmp_index, [
            {"id": "a", "name": "A", "description": "", "version": "1", "category": "utilities", "tags": [], "source_url": "", "handler": "python", "triggers": []},
        ])
        idx = MarketplaceIndex(tmp_index)
        assert idx.load() == 1
        _write_index(tmp_index, [
            {"id": "a", "name": "A", "description": "", "version": "1", "category": "utilities", "tags": [], "source_url": "", "handler": "python", "triggers": []},
            {"id": "b", "name": "B", "description": "", "version": "1", "category": "data", "tags": [], "source_url": "", "handler": "python", "triggers": []},
        ])
        assert idx.refresh() == 2


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
