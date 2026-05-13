from pathlib import Path

from engine.config import MixConfig


def test_default_config() -> None:
    config = MixConfig()
    assert config.engine.port == 18700
    assert config.gateway.port == 18789
    assert config.llm.provider == "openrouter"
    assert config.security.dm_policy == "pairing"


def test_load_from_file(tmp_path: Path) -> None:
    config_file = tmp_path / "config.json"
    config_file.write_text('{"engine": {"port": 9999}, "llm": {"provider": "openai", "model": "gpt-4"}}')

    config = MixConfig.load(config_file)
    assert config.engine.port == 9999
    assert config.llm.provider == "openai"
    assert config.llm.model == "gpt-4"


def test_save_config(tmp_path: Path) -> None:
    config_file = tmp_path / "config.json"
    config = MixConfig()
    config.engine.port = 8080
    config.save(config_file)

    loaded = MixConfig.load(config_file)
    assert loaded.engine.port == 8080


def test_load_nonexistent(tmp_path: Path) -> None:
    config = MixConfig.load(tmp_path / "nonexistent.json")
    assert config.engine.port == 18700  # defaults
