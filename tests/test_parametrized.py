import pytest
from engine.memory.types import MemoryType
from engine.config import MixConfig, SecurityConfig, EngineConfig, MemoryConfig


@pytest.mark.parametrize("mem_type", ["fact", "preference", "context", "skill_result", "user_model"])
def test_memory_type_values(mem_type):
    assert MemoryType(mem_type).value == mem_type


@pytest.mark.parametrize("provider", ["openrouter", "openai", "anthropic", "nvidia", "local"])
def test_config_provider(provider):
    config = MixConfig()
    config.llm.provider = provider
    assert config.llm.provider == provider


@pytest.mark.parametrize("rpm,expected", [(30, 30), (60, 60), (120, 120)])
def test_rate_limit_config(rpm, expected):
    config = MixConfig()
    config.rate_limit.requests_per_minute = rpm
    assert config.rate_limit.requests_per_minute == expected


@pytest.mark.parametrize("dm_policy", ["pairing", "open", "closed"])
def test_security_dm_policy(dm_policy):
    config = SecurityConfig(dm_policy=dm_policy)
    assert config.dm_policy == dm_policy


@pytest.mark.parametrize("engine_port", [18700, 8080, 3000])
def test_engine_port_config(engine_port):
    config = EngineConfig(port=engine_port)
    assert config.port == engine_port
