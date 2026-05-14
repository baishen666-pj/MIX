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

The **Gateway** (port 18789) is the public entry point for chat and WebSocket. The **Engine** (port 18700) exposes internal APIs for memory, skills, cron, and learning.

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
| Telegram | Working | `TELEGRAM_BOT_TOKEN` |
| Discord | Working | `DISCORD_BOT_TOKEN` |
| Slack | Working | `SLACK_BOT_TOKEN` |
| WeChat | Working | `WECHAT_WEBHOOK_URL` (webhook) or `WECHAT_CORP_ID`+`WECHAT_AGENT_ID`+`WECHAT_SECRET` (app) |
| IRC | Working | `IRC_SERVER`+`IRC_NICK`+`IRC_CHANNELS` |
| WhatsApp | Working | `WHATSAPP_ENABLED=true` (QR code pairing) |
| Matrix | Working | `MATRIX_HOMESERVER`+`MATRIX_ACCESS_TOKEN` |
| LINE | Working | `LINE_CHANNEL_ACCESS_TOKEN` (webhook at `/api/line/webhook`) |
| Google Chat | Working | `GOOGLE_CHAT_WEBHOOK_URL` (webhook at `/api/google-chat/webhook`) |
| Signal | Working | `SIGNAL_SERVER_URL`+`SIGNAL_PHONE_NUMBER` (requires signal-cli-rest) |
| Teams | Working | `TEAMS_BOT_ID` (webhook at `/api/teams/webhook`) |
| iMessage | Working | `IMESSAGE_BUSINESS_ID` (webhook at `/api/imessage/webhook`) |
| Feishu | Working | `FEISHU_APP_ID`+`FEISHU_APP_SECRET` (webhook at `/api/feishu/webhook`) |

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
| `llm.provider` | openrouter | LLM provider (openrouter/openai/anthropic/nvidia/local) |
| `llm.model` | openai/gpt-4o | Model to use |
| `llm.api_key` | - | API key |
| `engine.port` | 18700 | Engine listen port (internal APIs) |
| `gateway.port` | 18789 | Gateway listen port (chat entry point) |
| `security.dm_policy` | pairing | DM security: pairing/open/closed |
| `rate_limit.enabled` | true | Enable rate limiting |
| `rate_limit.requests_per_minute` | 60 | Max requests per minute per IP |
| `rate_limit.requests_per_hour` | 1000 | Max requests per hour per IP |

## Docker

```bash
# Build and start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop
docker-compose down
```

Access points after `docker-compose up`:
- **Web UI**: http://localhost:8080
- **Gateway API**: http://localhost:18789
- **Engine API**: http://localhost:18700

## Kubernetes

```bash
# Deploy to cluster
kubectl apply -k deploy/

# Check pods
kubectl get pods -l app=mix

# Port-forward for local access
kubectl port-forward svc/mix-gateway 18789:18789
kubectl port-forward svc/mix-engine 18700:18700
```

## Electron Desktop

### Development

```bash
cd electron && npm install
npx electron-vite dev
```

### Build installer

```bash
# Windows (NSIS)
bash scripts/build-desktop.sh --platform win

# macOS (DMG) — run on macOS
bash scripts/build-desktop.sh --platform mac

# Linux (AppImage + deb) — run on Linux
bash scripts/build-desktop.sh --platform linux
```

Output: `electron/dist/`

### Auto-update

Configure `electron/electron-builder.yml` with your GitHub repo:
```yaml
publish:
  provider: github
  owner: your-org
  repo: your-repo
```

Push a GitHub Release with the built artifacts to trigger updates.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MIX_GATEWAY_PORT` | 18789 | Gateway listen port |
| `MIX_ENGINE_PORT` | 18700 | Engine listen port |
| `MIX_CONFIG` | `~/.mix/config.json` | Config file path |
| `TELEGRAM_BOT_TOKEN` | - | Telegram bot token |
| `DISCORD_BOT_TOKEN` | - | Discord bot token |
| `SLACK_BOT_TOKEN` | - | Slack bot token |
| `API_KEYS` | - | Comma-separated gateway API keys |

## Test

```bash
make test
```

## License

MIT
