import pytest

from engine.tools.webfetch import web_fetch, _strip_html


def test_strip_html():
    html = "<html><head><style>body{}</style></head><body><p>Hello &amp; world</p></body></html>"
    text = _strip_html(html)
    assert "Hello & world" in text
    assert "<" not in text


def test_strip_html_removes_scripts():
    html = '<html><body><script>alert("xss")</script><p>Content</p></body></html>'
    text = _strip_html(html)
    assert "alert" not in text
    assert "Content" in text


@pytest.mark.asyncio
async def test_web_fetch_invalid_url():
    result = await web_fetch("not-a-url")
    assert not result.success


@pytest.mark.asyncio
async def test_web_fetch_nonexistent_domain():
    result = await web_fetch("http://this-domain-does-not-exist-12345.com", timeout=5)
    assert not result.success
