"""Tests for engine.voice.stt and engine.voice.tts — transcribe and synthesize."""

from __future__ import annotations

import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from engine.voice import stt, tts


class TestSTT:

    @pytest.mark.asyncio
    @patch("openai.AsyncOpenAI")
    async def test_transcribe_file_not_found(self, mock_openai_cls) -> None:
        mock_openai_cls.return_value = AsyncMock()
        with pytest.raises(FileNotFoundError, match="Audio file not found"):
            await stt.transcribe("/nonexistent/audio.wav", api_key="test-key")

    @pytest.mark.asyncio
    @patch("openai.AsyncOpenAI")
    async def test_transcribe_success(self, mock_openai_cls, tmp_path: Path) -> None:
        audio = tmp_path / "test.wav"
        audio.write_bytes(b"RIFF" + b"\x00" * 100)

        mock_client = AsyncMock()
        mock_transcript = MagicMock()
        mock_transcript.text = "Hello world"
        mock_client.audio.transcriptions.create.return_value = mock_transcript
        mock_openai_cls.return_value = mock_client

        result = await stt.transcribe(str(audio), api_key="test-key")
        assert result == "Hello world"

    @pytest.mark.asyncio
    @patch("openai.AsyncOpenAI")
    async def test_transcribe_with_language(self, mock_openai_cls, tmp_path: Path) -> None:
        audio = tmp_path / "test.wav"
        audio.write_bytes(b"RIFF" + b"\x00" * 100)

        mock_client = AsyncMock()
        mock_transcript = MagicMock()
        mock_transcript.text = "Bonjour"
        mock_client.audio.transcriptions.create.return_value = mock_transcript
        mock_openai_cls.return_value = mock_client

        result = await stt.transcribe(str(audio), language="fr", api_key="key")
        assert result == "Bonjour"

        call_kwargs = mock_client.audio.transcriptions.create.call_args.kwargs
        assert call_kwargs.get("language") == "fr"

    @pytest.mark.asyncio
    @patch("openai.AsyncOpenAI")
    async def test_transcribe_default_model(self, mock_openai_cls, tmp_path: Path) -> None:
        audio = tmp_path / "test.wav"
        audio.write_bytes(b"\x00" * 50)

        mock_client = AsyncMock()
        mock_transcript = MagicMock()
        mock_transcript.text = "test"
        mock_client.audio.transcriptions.create.return_value = mock_transcript
        mock_openai_cls.return_value = mock_client

        await stt.transcribe(str(audio), api_key="key")
        call_kwargs = mock_client.audio.transcriptions.create.call_args.kwargs
        assert call_kwargs.get("model") == "whisper-1"


class TestTTS:

    @pytest.mark.asyncio
    @patch("openai.AsyncOpenAI")
    async def test_synthesize_creates_file(self, mock_openai_cls, tmp_path: Path) -> None:
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.stream_to_file = MagicMock()
        mock_client.audio.speech.create.return_value = mock_response
        mock_openai_cls.return_value = mock_client

        result = await tts.synthesize("Hello world", api_key="test-key", output_dir=str(tmp_path))
        assert isinstance(result, str)
        assert str(tmp_path) in result

    @pytest.mark.asyncio
    @patch("openai.AsyncOpenAI")
    async def test_synthesize_caches_existing(self, mock_openai_cls, tmp_path: Path) -> None:
        mock_client = AsyncMock()
        mock_openai_cls.return_value = mock_client

        def fake_stream_to_file(path: str) -> None:
            from pathlib import Path as P
            P(path).write_bytes(b"fake audio")

        mock_response = MagicMock()
        mock_response.stream_to_file = fake_stream_to_file
        mock_client.audio.speech.create.return_value = mock_response

        result1 = await tts.synthesize("cache test", api_key="key", output_dir=str(tmp_path))
        result2 = await tts.synthesize("cache test", api_key="key", output_dir=str(tmp_path))

        assert result1 == result2
        assert mock_client.audio.speech.create.call_count == 1

    @pytest.mark.asyncio
    @patch("openai.AsyncOpenAI")
    async def test_synthesize_with_custom_voice(self, mock_openai_cls, tmp_path: Path) -> None:
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.stream_to_file = MagicMock()
        mock_client.audio.speech.create.return_value = mock_response
        mock_openai_cls.return_value = mock_client

        await tts.synthesize("test", voice="nova", model="tts-1-hd", api_key="key", output_dir=str(tmp_path))

        call_kwargs = mock_client.audio.speech.create.call_args.kwargs
        assert call_kwargs.get("voice") == "nova"
        assert call_kwargs.get("model") == "tts-1-hd"
