from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_CONFIG_PATH = Path(os.environ.get("MIX_CONFIG", "~/.mix/config.json")).expanduser()
DEFAULT_DB_PATH = Path(os.environ.get("MIX_DB", "~/.mix/data/mix.db")).expanduser()


@dataclass
class ProviderConfig:
    provider: str = "openrouter"
    model: str = "openai/gpt-4o"
    api_key: str = ""
    base_url: str = ""


@dataclass
class EngineConfig:
    host: str = "127.0.0.1"
    port: int = 18700
    debug: bool = False


@dataclass
class GatewayConfig:
    host: str = "127.0.0.1"
    port: int = 18789


@dataclass
class MemoryConfig:
    db_path: Path = field(default_factory=lambda: DEFAULT_DB_PATH)
    max_entries: int = 10000


@dataclass
class SecurityConfig:
    dm_policy: str = "pairing"
    allowed_users: list[str] = field(default_factory=list)


@dataclass
class RateLimitConfig:
    enabled: bool = True
    requests_per_minute: int = 60
    requests_per_hour: int = 1000


@dataclass
class MixConfig:
    engine: EngineConfig = field(default_factory=EngineConfig)
    gateway: GatewayConfig = field(default_factory=GatewayConfig)
    llm: ProviderConfig = field(default_factory=ProviderConfig)
    memory: MemoryConfig = field(default_factory=MemoryConfig)
    security: SecurityConfig = field(default_factory=SecurityConfig)
    rate_limit: RateLimitConfig = field(default_factory=RateLimitConfig)

    @classmethod
    def load(cls, path: Path | None = None) -> MixConfig:
        config_path = path or DEFAULT_CONFIG_PATH
        if not config_path.exists():
            return cls()
        with open(config_path) as f:
            data = json.load(f)
        return cls._from_dict(data)

    @classmethod
    def _from_dict(cls, data: dict) -> MixConfig:
        cfg = cls()
        if "engine" in data:
            cfg.engine = EngineConfig(**data["engine"])
        if "gateway" in data:
            cfg.gateway = GatewayConfig(**data["gateway"])
        if "llm" in data:
            cfg.llm = ProviderConfig(**data["llm"])
        if "memory" in data:
            mem = data["memory"]
            if "db_path" in mem:
                mem["db_path"] = Path(mem["db_path"])
            cfg.memory = MemoryConfig(**mem)
        if "security" in data:
            cfg.security = SecurityConfig(**data["security"])
        if "rate_limit" in data:
            cfg.rate_limit = RateLimitConfig(**data["rate_limit"])
        return cfg

    def save(self, path: Path | None = None) -> None:
        config_path = path or DEFAULT_CONFIG_PATH
        config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(config_path, "w") as f:
            json.dump(self._to_dict(), f, indent=2)

    def _to_dict(self) -> dict:
        return {
            "engine": {
                "host": self.engine.host,
                "port": self.engine.port,
                "debug": self.engine.debug,
            },
            "gateway": {
                "host": self.gateway.host,
                "port": self.gateway.port,
            },
            "llm": {
                "provider": self.llm.provider,
                "model": self.llm.model,
                "api_key": "***" if self.llm.api_key else "",
                "base_url": self.llm.base_url,
            },
            "memory": {
                "db_path": str(self.memory.db_path),
                "max_entries": self.memory.max_entries,
            },
            "security": {
                "dm_policy": self.security.dm_policy,
                "allowed_users": self.security.allowed_users,
            },
            "rate_limit": {
                "enabled": self.rate_limit.enabled,
                "requests_per_minute": self.rate_limit.requests_per_minute,
                "requests_per_hour": self.rate_limit.requests_per_hour,
            },
        }
