"""Comprehensive tests for engine.tools.search module.

All HTTP requests are mocked. Tests cover result parsing,
empty results, error handling, and parameter forwarding.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from engine.tools.search import web_search


def _mock_response(data: dict):
    mock_response = MagicMock()
    mock_response.json.return_value = data

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.get = AsyncMock(return_value=mock_response)
    return mock_client


class TestSuccessfulSearch:
    @pytest.mark.asyncio
    async def test_with_abstract(self):
        data = {
            "Abstract": "Python is a programming language.",
            "AbstractURL": "https://en.wikipedia.org/wiki/Python",
            "RelatedTopics": [],
        }
        with patch("httpx.AsyncClient", return_value=_mock_response(data)):
            result = await web_search("python programming")
            assert result.success
            assert "Summary" in result.output
            assert "Python is a programming language" in result.output
            assert "https://en.wikipedia.org/wiki/Python" in result.output

    @pytest.mark.asyncio
    async def test_with_related_topics(self):
        data = {
            "Abstract": "",
            "RelatedTopics": [
                {"Text": "Python - programming language", "FirstURL": "https://python.org"},
                {"Text": "Python - genus of snake", "FirstURL": "https://en.wikipedia.org/wiki/Python_(genus)"},
            ],
        }
        with patch("httpx.AsyncClient", return_value=_mock_response(data)):
            result = await web_search("python")
            assert result.success
            assert "programming language" in result.output
            assert "genus of snake" in result.output

    @pytest.mark.asyncio
    async def test_limit_truncates_topics(self):
        topics = [{"Text": f"Topic {i}", "FirstURL": f"https://example.com/{i}"} for i in range(10)]
        data = {"Abstract": "", "RelatedTopics": topics}
        with patch("httpx.AsyncClient", return_value=_mock_response(data)):
            result = await web_search("test", limit=3)
            assert result.success
            lines = [l for l in result.output.split("\n") if l.startswith("- ")]
            assert len(lines) <= 3

    @pytest.mark.asyncio
    async def test_topics_without_text_skipped(self):
        data = {
            "Abstract": "",
            "RelatedTopics": [
                {"Text": "Valid topic", "FirstURL": "https://example.com"},
                {"Name": "No Text field"},
            ],
        }
        with patch("httpx.AsyncClient", return_value=_mock_response(data)):
            result = await web_search("test")
            assert result.success
            assert "Valid topic" in result.output


class TestEmptyResults:
    @pytest.mark.asyncio
    async def test_no_results(self):
        data = {"Abstract": "", "RelatedTopics": []}
        with patch("httpx.AsyncClient", return_value=_mock_response(data)):
            result = await web_search("obscure query xyz123")
            assert "No results" in result.output

    @pytest.mark.asyncio
    async def test_abstract_only_no_topics(self):
        data = {"Abstract": "Some summary", "AbstractURL": "https://example.com", "RelatedTopics": []}
        with patch("httpx.AsyncClient", return_value=_mock_response(data)):
            result = await web_search("test")
            assert result.success
            assert "Some summary" in result.output


class TestErrorHandling:
    @pytest.mark.asyncio
    async def test_network_error(self):
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(side_effect=ConnectionError("Network unreachable"))

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await web_search("test")
            assert not result.success
            assert "Network unreachable" in result.error

    @pytest.mark.asyncio
    async def test_http_error(self):
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(side_effect=Exception("500 Server Error"))

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await web_search("test")
            assert not result.success


class TestQueryParameters:
    @pytest.mark.asyncio
    async def test_sends_query_params(self):
        mock = _mock_response({"Abstract": "", "RelatedTopics": []})
        with patch("httpx.AsyncClient", return_value=mock):
            await web_search("test query")
            call_kwargs = mock.get.call_args
            params = call_kwargs.kwargs["params"]
            assert params["q"] == "test query"
            assert params["format"] == "json"
            assert params["no_html"] == 1

    @pytest.mark.asyncio
    async def test_extra_kwargs_ignored(self):
        data = {"Abstract": "test", "RelatedTopics": []}
        with patch("httpx.AsyncClient", return_value=_mock_response(data)):
            result = await web_search("test", limit=5, extra="ignored")
            assert result.success
