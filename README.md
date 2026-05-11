# MIX

Unified AI Agent Platform. Merging the best of [Hermes Agent](https://github.com/NousResearch/hermes-agent) and [OpenClaw](https://github.com/openclaw/openclaw) into a single, self-learning system.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Gateway (TS)                   │
│  ┌─────────┬──────────┬───────┬──────┬────────┐ │
│  │Telegram │ Discord  │ Slack │IRC   │WebChat │ │
│  └────┬────┴────┬─────┴───┬───┴──┬───┴───┬────┘ │
│       │         │         │      │       │      │
│  ┌────▼─────────▼─────────▼──────▼───────▼────┐ │
│  │            Channel Registry                 │ │
│  └────────────────┬────────────────────────────┘ │
│                   │                              │
│  ┌────────────────▼────────────────────────────┐ │
│  │          DM Security Filter                 │ │
│  └────────────────┬────────────────────────────┘ │
│                   │ HTTP + WebSocket             │
└───────────────────┼──────────────────────────────┘
                    │
┌───────────────────┼──────────────────────────────┐
│            Engine (Python)                        │
│  ┌────────────────▼────────────────────────────┐ │
│  │            Agent Loop                        │ │
│  │  ┌────────┐  ┌────────┐  ┌───────────────┐ │ │
│  │  │  LLM   │  │ Memory │  │ Skills System │ │ │
│  │  │Multi-P │  │SQLite  │  │ Registry+Exec │ │ │
│  │  └────────┘  │ FTS5   │  └───────────────┘ │ │
│  │              └────────┘                     │ │
│  │  ┌────────────────┐  ┌──────────────────┐  │ │
│  │  │ Learning Loop  │  │  Cron Scheduler  │  │ │
│  │  │ Pattern Detect │  │  Async Jobs      │  │ │
│  │  └────────────────┘  └──────────────────┘  │ │
│  └─────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Clone
git clone <your-repo-url> mix && cd mix

# Setup
pip install -e ".[dev]"
npm install

# Configure
cp .env.example .env
# Edit .env: add your LLM API key

# Start
make dev
```

Or use the CLI:

```bash
mix config init
mix model openrouter openai/gpt-4o --api-key sk-xxx
mix doctor
mix start
```

## API Reference

### Chat

```bash
# Send a message
curl -X POST http://localhost:18789/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"hello"}'

# Stream via WebSocket
wscat -c ws://localhost:18789/ws/chat
> {"message":"tell me a story"}
```

### Memory

```bash
# Search memories
curl -X POST http://localhost:18700/api/memory/search \
  -d '{"query":"user preferences","limit":5}'
```

### Skills

```bash
# List skills
curl http://localhost:18700/api/skills

# Execute a skill
curl -X POST http://localhost:18700/api/skills/execute \
  -d '{"skill_name":"example","args":{"name":"MIX"}}'
```

### Cron

```bash
# Schedule a daily report
curl -X POST http://localhost:18700/api/cron/schedule \
  -d '{"name":"daily-report","cron":"0 9 * * *","message":"Summarize today"}'

# List jobs
curl http://localhost:18700/api/cron/jobs
```

### Learning

```bash
# Check learning insights
curl http://localhost:18700/api/learning/insights

# Promote an insight to a skill
curl -X POST http://localhost:18700/api/learning/insights/<id>/promote
```

## Channels

| Channel | Status | Config |
|---------|--------|--------|
| WebChat | Working | Built-in |
| Telegram | Ready | `TELEGRAM_BOT_TOKEN` |
| Discord | Ready | `DISCORD_BOT_TOKEN` |
| Slack | Ready | `SLACK_BOT_TOKEN` |
| IRC | Planned | - |
| WhatsApp | Planned | - |
| WeChat | Planned | - |

## Creating Skills

Create a directory under `skills/` with a `SKILL.md`:

```
skills/my-skill/
└── SKILL.md
```

```markdown
# My Skill

## name
my-skill

## version
1.0.0

## description
Does something useful

## Trigger
- /myskill
- run my skill

## Handler

```python
async def run(args):
    return {"result": f"Processed {args}"}
```

The skill auto-registers on engine startup.

## Configuration

Key config values in `~/.mix/config.json` or `.env`:

| Key | Default | Description |
|-----|---------|-------------|
| `llm.provider` | openrouter | LLM provider |
| `llm.model` | openai/gpt-4o | Model to use |
| `llm.api_key` | - | API key |
| `engine.port` | 18700 | Engine listen port |
| `gateway.port` | 18789 | Gateway listen port |
| `security.dm_policy` | pairing | DM security: pairing/open/closed |

## Docker

```bash
docker-compose up -d
```

## Test

```bash
make test
```

## License

MIT
