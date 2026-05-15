"""Comprehensive tests for engine.tools.scraper module.

All HTTP requests are mocked. Tests cover text extraction, selectors,
links, images, JSON-LD, error handling, and helper functions.
"""

from __future__ import annotations

import json
import socket
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from engine.tools.scraper import (
    SCRAPER_DEFINITION,
    _extract_by_selector,
    _extract_images,
    _extract_jsonld,
    _extract_links,
    _extract_text,
    execute,
)
from engine.tools.url_utils import validate_url as _validate_url

# --- SSRF URL Validation ---


class TestValidateUrl:
    def test_rejects_ftp_scheme(self):
        with pytest.raises(ValueError, match="scheme"):
            _validate_url("ftp://example.com/file")

    def test_rejects_file_scheme(self):
        with pytest.raises(ValueError, match="scheme"):
            _validate_url("file:///etc/passwd")

    def test_rejects_javascript_scheme(self):
        with pytest.raises(ValueError, match="scheme"):
            _validate_url("javascript:alert(1)")

    def test_rejects_no_hostname(self):
        with pytest.raises(ValueError, match="hostname"):
            _validate_url("http:///path")

    def test_rejects_localhost(self):
        with pytest.raises(ValueError, match="private"):
            _validate_url("http://localhost/admin")

    def test_rejects_127_ip(self):
        with pytest.raises(ValueError, match="private"):
            _validate_url("http://127.0.0.1/admin")

    def test_rejects_10_private(self):
        with pytest.raises(ValueError, match="private"):
            _validate_url("http://10.0.0.1/internal")

    def test_rejects_172_private(self):
        with pytest.raises(ValueError, match="private"):
            _validate_url("http://172.16.0.1/internal")

    def test_rejects_192_private(self):
        with pytest.raises(ValueError, match="private"):
            _validate_url("http://192.168.1.1/internal")

    def test_rejects_link_local_metadata(self):
        with pytest.raises(ValueError, match="private"):
            _validate_url("http://169.254.169.254/latest/meta-data/")

    def test_rejects_ipv6_loopback(self):
        with pytest.raises(ValueError, match="private"):
            _validate_url("http://[::1]/admin")

    def test_rejects_ipv6_private(self):
        with pytest.raises(ValueError, match="private"):
            _validate_url("http://[fc00::1]/internal")

    def test_rejects_unresolvable_hostname(self):
        with pytest.raises(ValueError, match="resolve"):
            _validate_url("http://this-domain-definitely-does-not-exist-xyz123.invalid/")

    def test_accepts_valid_public_url(self):
        with patch("engine.tools.url_utils.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))]
            _validate_url("https://example.com/page")


class TestSSRFViaExecute:
    @pytest.mark.asyncio
    async def test_execute_blocks_localhost(self):
        result = await execute(url="http://localhost/secret")
        assert not result.success
        assert "Blocked" in result.error

    @pytest.mark.asyncio
    async def test_execute_blocks_metadata_endpoint(self):
        result = await execute(url="http://169.254.169.254/latest/meta-data/")
        assert not result.success
        assert "Blocked" in result.error

    @pytest.mark.asyncio
    async def test_execute_blocks_ftp(self):
        result = await execute(url="ftp://example.com/file")
        assert not result.success
        assert "Blocked" in result.error


# --- Definition ---


class TestDefinition:
    def test_definition_structure(self):
        assert SCRAPER_DEFINITION["type"] == "function"
        func = SCRAPER_DEFINITION["function"]
        assert func["name"] == "scraper"
        assert "url" in func["parameters"]["properties"]


# --- Helper Functions (unit tests, no mocks needed) ---


class TestExtractText:
    def test_removes_scripts(self):
        html = "<html><body><script>alert('xss')</script><p>Content</p></body></html>"
        text = _extract_text(html)
        assert "alert" not in text
        assert "Content" in text

    def test_removes_styles(self):
        html = "<html><body><style>body{color:red}</style><p>Hello</p></body></html>"
        text = _extract_text(html)
        assert "color" not in text
        assert "Hello" in text

    def test_strips_all_tags(self):
        html = "<div><h1>Title</h1><p>Paragraph</p></div>"
        text = _extract_text(html)
        assert "<" not in text
        assert "Title" in text
        assert "Paragraph" in text

    def test_collapses_whitespace(self):
        html = "<p>Hello    world</p>"
        text = _extract_text(html)
        assert "Hello world" in text

    def test_empty_html(self):
        text = _extract_text("")
        assert text == ""


class TestExtractBySelector:
    def test_extracts_tag_content(self):
        html = "<h2>Title 1</h2><h2>Title 2</h2>"
        results = _extract_by_selector(html, "h2")
        assert len(results) == 2
        assert "Title 1" in results
        assert "Title 2" in results

    def test_no_match_returns_empty(self):
        html = "<p>No headings</p>"
        results = _extract_by_selector(html, "h2")
        assert results == []

    def test_strips_inner_tags(self):
        html = "<p>Text with <b>bold</b> inside</p>"
        results = _extract_by_selector(html, "p")
        assert len(results) == 1
        assert "bold" in results[0]

    def test_invalid_selector(self):
        html = "<p>test</p>"
        results = _extract_by_selector(html, ".class-only")
        assert results == []


class TestExtractLinks:
    def test_absolute_links(self):
        html = '<a href="https://example.com/page">Link</a>'
        links = _extract_links(html, "https://example.com")
        assert "https://example.com/page" in links

    def test_relative_links_resolved(self):
        html = '<a href="/about">About</a>'
        links = _extract_links(html, "https://example.com")
        assert len(links) == 1
        assert links[0].startswith("https://")

    def test_ignores_anchor_only(self):
        html = '<a href="#section">Jump</a>'
        links = _extract_links(html, "https://example.com")
        assert len(links) == 0

    def test_multiple_links(self):
        html = '<a href="https://a.com">A</a><a href="https://b.com">B</a>'
        links = _extract_links(html, "https://example.com")
        assert len(links) == 2

    def test_no_links(self):
        html = "<p>No links here</p>"
        links = _extract_links(html, "https://example.com")
        assert links == []


class TestExtractImages:
    def test_absolute_image_src(self):
        html = '<img src="https://cdn.example.com/img.png">'
        images = _extract_images(html, "https://example.com")
        assert images == ["https://cdn.example.com/img.png"]

    def test_relative_image_resolved(self):
        html = '<img src="images/photo.jpg">'
        images = _extract_images(html, "https://example.com")
        assert len(images) == 1
        assert images[0].startswith("https://example.com")

    def test_no_images(self):
        html = "<p>No images</p>"
        images = _extract_images(html, "https://example.com")
        assert images == []

    def test_multiple_images(self):
        html = '<img src="a.jpg"><img src="b.jpg">'
        images = _extract_images(html, "https://example.com")
        assert len(images) == 2


class TestExtractJsonLd:
    def test_extracts_valid_jsonld(self):
        html = '<script type="application/ld+json">{"@type": "Product", "name": "Widget"}</script>'
        result = _extract_jsonld(html)
        assert len(result) == 1
        assert result[0]["name"] == "Widget"

    def test_ignores_invalid_jsonld(self):
        html = '<script type="application/ld+json">not valid json</script>'
        result = _extract_jsonld(html)
        assert result == []

    def test_no_jsonld(self):
        html = "<p>Regular page</p>"
        result = _extract_jsonld(html)
        assert result == []

    def test_multiple_jsonld_blocks(self):
        html = (
            '<script type="application/ld+json">{"@type": "Product"}</script>'
            '<script type="application/ld+json">{"@type": "Organization"}</script>'
        )
        result = _extract_jsonld(html)
        assert len(result) == 2


# --- Execute Function (mocked HTTP) ---


SAMPLE_HTML = """
<html>
<head><title>Test Page</title></head>
<body>
    <h1>Welcome</h1>
    <p class="desc">A description paragraph.</p>
    <a href="https://example.com/link1">Link 1</a>
    <a href="/link2">Link 2</a>
    <img src="https://cdn.example.com/photo.jpg">
    <script type="application/ld+json">{"@type": "WebPage", "name": "Test"}</script>
</body>
</html>
"""


def _mock_httpx(html: str, status_code: int = 200):
    mock_response = MagicMock()
    mock_response.status_code = status_code
    mock_response.text = html
    mock_response.raise_for_status.return_value = None

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.get = AsyncMock(return_value=mock_response)
    return mock_client


class TestScraperExecute:
    @pytest.mark.asyncio
    async def test_text_extraction(self):
        with patch("engine.tools.scraper.validate_url"), patch("engine.tools.scraper.httpx.AsyncClient", return_value=_mock_httpx(SAMPLE_HTML)):
            result = await execute(url="https://example.com")
            assert result.success
            data = json.loads(result.output)
            assert "text" in data
            assert "Welcome" in data["text"]

    @pytest.mark.asyncio
    async def test_selector_extraction(self):
        with patch("engine.tools.scraper.validate_url"), patch("engine.tools.scraper.httpx.AsyncClient", return_value=_mock_httpx(SAMPLE_HTML)):
            result = await execute(
                url="https://example.com",
                selectors={"headings": "h1"},
            )
            assert result.success
            data = json.loads(result.output)
            assert "extracted" in data
            assert "headings" in data["extracted"]

    @pytest.mark.asyncio
    async def test_extract_links(self):
        with patch("engine.tools.scraper.validate_url"), patch("engine.tools.scraper.httpx.AsyncClient", return_value=_mock_httpx(SAMPLE_HTML)):
            result = await execute(url="https://example.com", extract_links=True)
            assert result.success
            data = json.loads(result.output)
            assert "links" in data
            assert len(data["links"]) > 0

    @pytest.mark.asyncio
    async def test_extract_images(self):
        with patch("engine.tools.scraper.validate_url"), patch("engine.tools.scraper.httpx.AsyncClient", return_value=_mock_httpx(SAMPLE_HTML)):
            result = await execute(url="https://example.com", extract_images=True)
            assert result.success
            data = json.loads(result.output)
            assert "images" in data
            assert len(data["images"]) > 0

    @pytest.mark.asyncio
    async def test_jsonld_extraction(self):
        with patch("engine.tools.scraper.validate_url"), patch("engine.tools.scraper.httpx.AsyncClient", return_value=_mock_httpx(SAMPLE_HTML)):
            result = await execute(url="https://example.com")
            assert result.success
            data = json.loads(result.output)
            assert "structured_data" in data

    @pytest.mark.asyncio
    async def test_text_truncation(self):
        long_html = f"<html><body><p>{'x' * 10000}</p></body></html>"
        with patch("engine.tools.scraper.validate_url"), patch("engine.tools.scraper.httpx.AsyncClient", return_value=_mock_httpx(long_html)):
            result = await execute(url="https://example.com")
            assert result.success
            data = json.loads(result.output)
            assert len(data["text"]) <= 5000
            assert data["truncated"] is True

    @pytest.mark.asyncio
    async def test_network_error(self):
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(side_effect=ConnectionError("Network error"))

        with patch("engine.tools.scraper.validate_url"), patch("engine.tools.scraper.httpx.AsyncClient", return_value=mock_client):
            result = await execute(url="https://example.com")
            assert not result.success
            assert "Fetch failed" in result.error

    @pytest.mark.asyncio
    async def test_http_error(self):
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = Exception("404 Not Found")

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(return_value=mock_response)

        with patch("engine.tools.scraper.validate_url"), patch("engine.tools.scraper.httpx.AsyncClient", return_value=mock_client):
            result = await execute(url="https://example.com/notfound")
            assert not result.success

    @pytest.mark.asyncio
    async def test_user_agent_header(self):
        mock = _mock_httpx(SAMPLE_HTML)
        with patch("engine.tools.scraper.validate_url"), patch("engine.tools.scraper.httpx.AsyncClient", return_value=mock):
            await execute(url="https://example.com")
            call_kwargs = mock.get.call_args
            assert call_kwargs.kwargs["headers"]["User-Agent"] == "MIX/1.0"

    @pytest.mark.asyncio
    async def test_kwargs_ignored(self):
        with patch("engine.tools.scraper.validate_url"), patch("engine.tools.scraper.httpx.AsyncClient", return_value=_mock_httpx(SAMPLE_HTML)):
            result = await execute(url="https://example.com", extra="ignored")
            assert result.success
