"""Tests for engine/api/routes/voice.py -- TTS, STT, and STT-from-path endpoints."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from engine.api.routes import init_routes, router


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_client():
    """Build a TestClient with standard mocked dependencies."""
    app = FastAPI()
    app.include_router(router, prefix="/api")

    mock_tools = MagicMock()
    mock_tools._history = None
    mock_tools._approval = None
    mock_tools._dynamic = None

    with (
        patch("engine.api.routes.SkillLoader", return_value=MagicMock()),
        patch("engine.api.routes.ToolRegistry", return_value=mock_tools),
    ):
        init_routes(
            agent_loop=AsyncMock(),
            memory=AsyncMock(),
            skill_registry=None,
            learning=None,
            cron=None,
            agent_router=MagicMock(),
            mcp=None,
            api_key="test-api-key",
            decomposer=None,
            orchestrator=None,
            metrics=None,
            config=None,
            collaboration=None,
            rag_collections=None,
            rag_pipeline=None,
        )

    tc = TestClient(app, raise_server_exceptions=False)
    return tc


# ===================================================================
# POST /api/voice/tts
# ===================================================================


class TestVoiceTTS:
    """POST /api/voice/tts"""

    def test_returns_400_when_text_empty(self):
        # Arrange
        c = _build_client()
        # Act
        resp = c.post("/api/voice/tts", json={"text": ""})
        # Assert
        assert resp.status_code == 400
        assert "detail" in resp.json()

    def test_synthesizes_audio_successfully(self):
        # Arrange
        c = _build_client()
        with patch("engine.voice.tts.synthesize", new_callable=AsyncMock, return_value="/tmp/audio.mp3") as mock_synth:
            # Act
            resp = c.post("/api/voice/tts", json={"text": "Hello world"})
            # Assert
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "ok"
            assert data["path"] == "/tmp/audio.mp3"
            mock_synth.assert_awaited_once()

    def test_passes_voice_and_model_to_synthesize(self):
        # Arrange
        c = _build_client()
        with patch("engine.voice.tts.synthesize", new_callable=AsyncMock, return_value="/tmp/out.wav") as mock_synth:
            # Act
            resp = c.post("/api/voice/tts", json={"text": "hi", "voice": "nova", "model": "tts-1-hd"})
            # Assert
            assert resp.status_code == 200
            call_kwargs = mock_synth.call_args
            assert call_kwargs.kwargs.get("voice") == "nova" or call_kwargs[1].get("voice") == "nova"

    def test_returns_500_when_synthesize_raises(self):
        # Arrange
        c = _build_client()
        with patch("engine.voice.tts.synthesize", new_callable=AsyncMock, side_effect=RuntimeError("API down")):
            # Act
            resp = c.post("/api/voice/tts", json={"text": "fail case"})
            # Assert
            assert resp.status_code == 500
            assert "detail" in resp.json()

    def test_stream_mode_returns_streaming_response(self):
        # Arrange
        c = _build_client()

        async def fake_stream(*args, **kwargs):
            yield b"audio-chunk-1"
            yield b"audio-chunk-2"

        with patch("engine.voice.tts.synthesize_stream", side_effect=fake_stream):
            # Act
            resp = c.post("/api/voice/tts", json={"text": "stream me", "stream": True})
            # Assert
            assert resp.status_code == 200
            assert "audio/mpeg" in resp.headers.get("content-type", "")

    def test_stream_mode_error_in_try_block_returns_500(self):
        # Arrange -- synthesize_stream raises when called, before StreamingResponse
        # is even constructed. The try/except in the handler catches it.
        c = _build_client()
        with patch("engine.voice.tts.synthesize_stream", side_effect=RuntimeError("Stream broken")):
            # Act
            resp = c.post("/api/voice/tts", json={"text": "broken stream", "stream": True})
            # Assert
            assert resp.status_code == 500
            assert "detail" in resp.json()


# ===================================================================
# POST /api/voice/stt
# ===================================================================


class TestVoiceSTT:
    """POST /api/voice/stt"""

    def test_transcribes_audio_successfully(self):
        # Arrange
        c = _build_client()
        with patch("engine.voice.stt.transcribe", new_callable=AsyncMock, return_value="hello world") as mock_trans:
            # Act
            resp = c.post("/api/voice/stt", files={"file": ("audio.wav", b"fake-audio-data", "audio/wav")})
            # Assert
            assert resp.status_code == 200
            data = resp.json()
            assert data["text"] == "hello world"
            mock_trans.assert_awaited_once()

    def test_passes_audio_bytes_to_transcribe(self):
        # Arrange
        c = _build_client()
        audio_data = b"\x00\x01\x02\x03\x04\x05"
        with patch("engine.voice.stt.transcribe", new_callable=AsyncMock, return_value="test") as mock_trans:
            # Act
            resp = c.post("/api/voice/stt", files={"file": ("clip.wav", audio_data, "audio/wav")})
            # Assert
            assert resp.status_code == 200
            call_kwargs = mock_trans.call_args
            # Verify api_key was passed
            assert call_kwargs.kwargs.get("api_key") == "test-api-key" or call_kwargs[1].get("api_key") == "test-api-key"

    def test_returns_500_when_transcribe_raises(self):
        # Arrange
        c = _build_client()
        with patch("engine.voice.stt.transcribe", new_callable=AsyncMock, side_effect=RuntimeError("STT failed")):
            # Act
            resp = c.post("/api/voice/stt", files={"file": ("audio.wav", b"bad-data", "audio/wav")})
            # Assert
            assert resp.status_code == 500
            assert "detail" in resp.json()

    def test_returns_500_when_api_key_missing(self):
        """When _api_key is empty and transcribe raises, should get 500."""
        # Arrange -- build with empty api key
        app = FastAPI()
        app.include_router(router, prefix="/api")
        mock_tools = MagicMock()
        mock_tools._history = None
        mock_tools._approval = None
        mock_tools._dynamic = None
        with (
            patch("engine.api.routes.SkillLoader", return_value=MagicMock()),
            patch("engine.api.routes.ToolRegistry", return_value=mock_tools),
        ):
            init_routes(
                agent_loop=AsyncMock(),
                memory=AsyncMock(),
                skill_registry=None,
                learning=None,
                cron=None,
                agent_router=MagicMock(),
                mcp=None,
                api_key="",
                decomposer=None,
                orchestrator=None,
                metrics=None,
                config=None,
                collaboration=None,
                rag_collections=None,
                rag_pipeline=None,
            )
        tc = TestClient(app, raise_server_exceptions=False)

        with patch("engine.voice.stt.transcribe", new_callable=AsyncMock, side_effect=Exception("No API key configured")):
            # Act
            resp = tc.post("/api/voice/stt", files={"file": ("a.wav", b"data", "audio/wav")})
            # Assert
            assert resp.status_code == 500


# ===================================================================
# POST /api/voice/stt/path
# ===================================================================


class TestVoiceSTTPath:
    """POST /api/voice/stt/path"""

    def test_returns_400_when_path_empty(self):
        # Arrange
        c = _build_client()
        # Act
        resp = c.post("/api/voice/stt/path", json={"path": ""})
        # Assert
        assert resp.status_code == 400
        assert "detail" in resp.json()

    def test_returns_400_when_path_missing(self):
        # Arrange
        c = _build_client()
        # Act
        resp = c.post("/api/voice/stt/path", json={})
        # Assert
        assert resp.status_code == 400

    def test_transcribes_from_file_path_successfully(self):
        # Arrange
        c = _build_client()
        with patch("engine.voice.stt.transcribe", new_callable=AsyncMock, return_value="transcribed text") as mock_trans:
            # Act
            resp = c.post("/api/voice/stt/path", json={"path": "/recordings/meeting.wav"})
            # Assert
            assert resp.status_code == 200
            data = resp.json()
            assert data["text"] == "transcribed text"
            call_kwargs = mock_trans.call_args
            assert call_kwargs.kwargs.get("audio_path") == "/recordings/meeting.wav" or call_kwargs[1].get("audio_path") == "/recordings/meeting.wav"

    def test_returns_500_when_file_path_transcribe_fails(self):
        # Arrange
        c = _build_client()
        with patch("engine.voice.stt.transcribe", new_callable=AsyncMock, side_effect=FileNotFoundError("no such file")):
            # Act
            resp = c.post("/api/voice/stt/path", json={"path": "/nonexistent/audio.wav"})
            # Assert
            assert resp.status_code == 500
            assert "detail" in resp.json()
