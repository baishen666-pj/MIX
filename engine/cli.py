"""MIX CLI - Command-line interface for the unified AI agent platform."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from engine.config import MixConfig, DEFAULT_CONFIG_PATH


def cmd_start(args: argparse.Namespace) -> None:
    import uvicorn
    from engine.main import create_app

    config = MixConfig.load()
    app = create_app(config)
    uvicorn.run(app, host=config.engine.host, port=config.engine.port)


def cmd_model(args: argparse.Namespace) -> None:
    config = MixConfig.load()
    if args.provider and args.model_name:
        config.llm.provider = args.provider
        config.llm.model = args.model_name
        if args.api_key:
            config.llm.api_key = args.api_key
        if args.base_url:
            config.llm.base_url = args.base_url
        config.save()
        print(f"Model set to {config.llm.provider}/{config.llm.model}")
    else:
        print(f"Current: {config.llm.provider}/{config.llm.model}")


def cmd_config(args: argparse.Namespace) -> None:
    config = MixConfig.load()
    if args.action == "show":
        print(json.dumps(config._to_dict(), indent=2))
    elif args.action == "set":
        parts = args.key_value.split("=", 1)
        if len(parts) != 2:
            print("Usage: mix config set key=value")
            sys.exit(1)
        key, value = parts
        _set_config_value(config, key, value)
        config.save()
        print(f"Set {key} = {value}")
    elif args.action == "init":
        config.save()
        print(f"Config written to {DEFAULT_CONFIG_PATH}")


def cmd_skills(args: argparse.Namespace) -> None:
    from engine.skills.registry import SkillRegistry
    registry = SkillRegistry(skills_dir=Path("skills"))
    count = registry.load_all()
    skills = registry.list_skills()
    if not skills:
        print("No skills found.")
        return
    print(f"Loaded {count} skill(s):\n")
    for s in skills:
        print(f"  {s['name']} v{s['version']} - {s['description']}")
        print(f"    Triggers: {', '.join(s['trigger'])}")
        print()


def cmd_doctor(args: argparse.Namespace) -> None:
    config = MixConfig.load()
    issues = []

    if not config.llm.api_key:
        issues.append("LLM API key not set (run: mix model <provider> <model> --api-key KEY)")

    if not config.memory.db_path.parent.exists():
        issues.append(f"Memory directory does not exist: {config.memory.db_path.parent}")

    try:
        import fastapi
        import uvicorn
        import openai
    except ImportError as e:
        issues.append(f"Missing dependency: {e}")

    try:
        import httpx
        import asyncio

        async def check():
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"http://{config.engine.host}:{config.engine.port}/api/health",
                    timeout=3,
                )
                return resp

        resp = asyncio.get_event_loop().run_until_complete(check())
        if resp.status_code != 200:
            issues.append(f"Engine health check failed: HTTP {resp.status_code}")
        else:
            print("  Engine: responding")
    except Exception:
        print("  Engine: not running (this is ok if not started)")

    if issues:
        print("Issues found:\n")
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue}")
        sys.exit(1)
    else:
        print("All checks passed.")


def _set_config_value(config: MixConfig, key: str, value: str) -> None:
    mapping = {
        "engine.host": lambda v: setattr(config.engine, "host", v),
        "engine.port": lambda v: setattr(config.engine, "port", int(v)),
        "gateway.host": lambda v: setattr(config.gateway, "host", v),
        "gateway.port": lambda v: setattr(config.gateway, "port", int(v)),
        "llm.provider": lambda v: setattr(config.llm, "provider", v),
        "llm.model": lambda v: setattr(config.llm, "model", v),
        "llm.api_key": lambda v: setattr(config.llm, "api_key", v),
        "llm.base_url": lambda v: setattr(config.llm, "base_url", v),
        "security.dm_policy": lambda v: setattr(config.security, "dm_policy", v),
    }
    setter = mapping.get(key)
    if setter:
        setter(value)
    else:
        print(f"Unknown config key: {key}")
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="mix",
        description="MIX - Unified AI Agent Platform",
    )
    sub = parser.add_subparsers(dest="command")

    # start
    start_p = sub.add_parser("start", help="Start the MIX engine")
    start_p.set_defaults(func=cmd_start)

    # model
    model_p = sub.add_parser("model", help="View or set LLM model")
    model_p.add_argument("provider", nargs="?", help="Provider name")
    model_p.add_argument("model_name", nargs="?", help="Model name")
    model_p.add_argument("--api-key", help="API key")
    model_p.add_argument("--base-url", help="Custom base URL")
    model_p.set_defaults(func=cmd_model)

    # config
    config_p = sub.add_parser("config", help="Manage configuration")
    config_sub = config_p.add_subparsers(dest="action")
    config_sub.add_parser("show", help="Show current config")
    config_set = config_sub.add_parser("set", help="Set a config value")
    config_set.add_argument("key_value", help="key=value pair")
    config_sub.add_parser("init", help="Initialize config file")
    config_p.set_defaults(func=cmd_config)

    # skills
    skills_p = sub.add_parser("skills", help="List loaded skills")
    skills_p.set_defaults(func=cmd_skills)

    # doctor
    doctor_p = sub.add_parser("doctor", help="Diagnose configuration issues")
    doctor_p.set_defaults(func=cmd_doctor)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
