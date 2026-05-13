"""Comprehensive tests for engine.tools.image_gen module.

All external HTTP calls are mocked. Tests cover parameter validation,
API response handling, error scenarios, and definition structure.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from engine.tools.image_gen import IMAGE_GEN_DEFINITION, execute


def _make_mock_client(response_data: dict, *, raise_error: Exception | None = None):
    """Create a mock httpx.AsyncClient with proper sync/async method separation."""
    mock_response = MagicMock()
    if raise_error:
        mock_response.raise_for_status.side_effect = raise_error
    else:
        mock_response.raise_for_status.return_value = None
    mock_response.json.return_value = response_data

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.post = AsyncMock(return_value=mock_response)
    return mock_client


# --- Definition ---


class TestDefinition:
    def test_definition_structure(self):
        assert IMAGE_GEN_DEFINITION["type"] == "function"
        func = IMAGE_GEN_DEFINITION["function"]
        assert func["name"] == "image_generate"
        assert "prompt" in func["parameters"]["properties"]
        assert func["parameters"]["required"] == ["prompt"]

    def test_size_enum_values(self):
        props = IMAGE_GEN_DEFINITION["function"]["parameters"]["properties"]
        assert set(props["size"]["enum"]) == {"1024x1024", "1792x1024", "1024x1792"}

    def test_style_enum_values(self):
        props = IMAGE_GEN_DEFINITION["function"]["parameters"]["properties"]
        assert set(props["style"]["enum"]) == {"vivid", "natural"}


# --- Missing API Key ---


class TestMissingApiKey:
    @pytest.mark.asyncio
    async def test_no_api_key_env_nor_kwarg(self):
        with patch.dict("os.environ", {}, clear=True):
            import os

            os.environ.pop("OPENAI_API_KEY", None)
            result = await execute(prompt="a cat", api_key="")
            assert not result.success
            assert "OPENAI_API_KEY" in result.error

    @pytest.mark.asyncio
    async def test_api_key_from_kwargs(self):
        mock_client = _make_mock_client({"data": [{"url": "https://example.com/img.png", "revised_prompt": "a cat"}]})
        with patch("engine.tools.image_gen.httpx.AsyncClient", return_value=mock_client):
            result = await execute(prompt="a cat", api_key="sk-test-key")
            assert result.success
            assert "Generated 1 image" in result.output


# --- Successful Generation ---


class TestSuccessfulGeneration:
    @pytest.mark.asyncio
    async def test_single_image(self):
        mock_client = _make_mock_client(
            {"data": [{"url": "https://cdn.example.com/img1.png", "revised_prompt": "revised cat"}]}
        )
        with patch("engine.tools.image_gen.httpx.AsyncClient", return_value=mock_client):
            result = await execute(prompt="a cat", api_key="sk-test")
            assert result.success
            assert "Generated 1 image" in result.output
            assert result.metadata is not None
            assert len(result.metadata["images"]) == 1
            assert result.metadata["images"][0]["url"] == "https://cdn.example.com/img1.png"

    @pytest.mark.asyncio
    async def test_multiple_images(self):
        mock_client = _make_mock_client(
            {
                "data": [
                    {"url": "https://cdn.example.com/img1.png", "revised_prompt": "cat 1"},
                    {"url": "https://cdn.example.com/img2.png", "revised_prompt": "cat 2"},
                ]
            }
        )
        with patch("engine.tools.image_gen.httpx.AsyncClient", return_value=mock_client):
            result = await execute(prompt="cats", n=2, api_key="sk-test")
            assert result.success
            assert "Generated 2 image" in result.output
            assert len(result.metadata["images"]) == 2

    @pytest.mark.asyncio
    async def test_sends_correct_payload(self):
        mock_client = _make_mock_client({"data": [{"url": "https://example.com/img.png"}]})
        with patch("engine.tools.image_gen.httpx.AsyncClient", return_value=mock_client):
            await execute(
                prompt="a sunset",
                size="1792x1024",
                n=1,
                style="natural",
                api_key="sk-test",
            )
            call_kwargs = mock_client.post.call_args
            json_body = call_kwargs.kwargs["json"]
            assert json_body["prompt"] == "a sunset"
            assert json_body["size"] == "1792x1024"
            assert json_body["style"] == "natural"
            assert json_body["model"] == "dall-e-3"

    @pytest.mark.asyncio
    async def test_authorization_header(self):
        mock_client = _make_mock_client({"data": [{"url": "https://example.com/img.png"}]})
        with patch("engine.tools.image_gen.httpx.AsyncClient", return_value=mock_client):
            await execute(prompt="test", api_key="sk-my-key")
            call_kwargs = mock_client.post.call_args
            headers = call_kwargs.kwargs["headers"]
            assert headers["Authorization"] == "Bearer sk-my-key"


# --- Error Handling ---


class TestErrorHandling:
    @pytest.mark.asyncio
    async def test_http_error(self):
        mock_client = _make_mock_client({}, raise_error=Exception("HTTP 429 Rate Limit"))
        with patch("engine.tools.image_gen.httpx.AsyncClient", return_value=mock_client):
            result = await execute(prompt="a cat", api_key="sk-test")
            assert not result.success
            assert "Image generation failed" in result.error

    @pytest.mark.asyncio
    async def test_network_error(self):
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(side_effect=ConnectionError("Network unreachable"))

        with patch("engine.tools.image_gen.httpx.AsyncClient", return_value=mock_client):
            result = await execute(prompt="a cat", api_key="sk-test")
            assert not result.success

    @pytest.mark.asyncio
    async def test_empty_data_array(self):
        mock_client = _make_mock_client({"data": []})
        with patch("engine.tools.image_gen.httpx.AsyncClient", return_value=mock_client):
            result = await execute(prompt="a cat", api_key="sk-test")
            assert result.success
            assert "Generated 0 image" in result.output

    @pytest.mark.asyncio
    async def test_missing_url_in_response(self):
        mock_client = _make_mock_client({"data": [{"revised_prompt": "no url"}]})
        with patch("engine.tools.image_gen.httpx.AsyncClient", return_value=mock_client):
            result = await execute(prompt="a cat", api_key="sk-test")
            assert result.success
            assert result.metadata["images"][0]["url"] == ""


# --- Kwargs Handling ---


class TestKwargs:
    @pytest.mark.asyncio
    async def test_extra_kwargs_ignored(self):
        mock_client = _make_mock_client({"data": [{"url": "https://example.com/img.png"}]})
        with patch("engine.tools.image_gen.httpx.AsyncClient", return_value=mock_client):
            result = await execute(prompt="test", api_key="sk-test", extra_param="ignored")
            assert result.success
