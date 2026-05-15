# Changelog

All notable changes to MIX will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-05-14

### Added

#### Engine (Python / FastAPI)
- LLM routing with OpenAI, Anthropic, OpenRouter support
- Memory system with SQLite FTS5 full-text search
- Skills system with marketplace integration
- RAG pipeline with sentence-transformers embeddings
- Tool system with sandboxed execution (Docker / subprocess)
- Cron scheduler for recurring tasks
- Learning loop for pattern extraction
- Multi-agent collaboration with task decomposition and orchestration
- Document upload and knowledge base management
- Token budget management and context summarization
- Voice TTS/STT streaming support
- Monitoring metrics with Prometheus format output
- API key authentication and per-key rate limiting

#### Gateway (TypeScript / Fastify)
- 16 channel adapters: Slack, Discord, Telegram, WeChat, LINE, WhatsApp, Matrix, IRC, Signal, Teams, Google Chat, Feishu, iMessage, HTTP, WebSocket, CLI
- Zod request validation on all endpoints
- Rate limiting middleware (per-minute / per-hour)
- WebSocket streaming with SSE fallback
- Voice proxy for TTS/STT
- Gateway route modularization

#### Web UI (React / Vite)
- Chat interface with markdown rendering (react-markdown)
- Plugin marketplace with browse, search, one-click install, and update badges
- Multi-model selector UI
- Settings editing UI
- Knowledge base management
- Session export and search
- Dashboard with monitoring metrics
- react-router + zustand state management
- Tailwind CSS v4 + Zod validation
- i18n support (English / Chinese)
- Mobile responsive navigation
- Skeleton loading states
- Theme system with animations

#### Desktop (Electron)
- Cross-platform packaging: Windows (NSIS), macOS (DMG), Linux (AppImage + deb)
- Splash screen and system tray icon
- Auto-update via electron-updater + GitHub Releases
- Engine bundled via PyInstaller

#### Infrastructure
- Docker Compose: 3 services (engine, gateway, web) with health checks
- Kubernetes manifests: namespace, ingress, HPA, secrets, kustomization
- CI/CD: 8-job pipeline (test, lint, typecheck, docker-build, perf-test)
- Release workflow: 3-OS Electron build, Docker push to GHCR, GitHub Release
- Performance testing suite: k6 benchmarks + Locust mixed scenarios

#### CLI
- `mix config init` — interactive configuration
- `mix doctor` — health diagnostics
- `mix start` — start engine server

### Fixed
- Critical security: command injection, SSRF, timing attack, auth bypass
- Session persistence NOT NULL constraint bug
- Gateway proxy route coverage
- Docker sandbox output truncation and memory limits
- Gateway dist path resolution (project references)
- Web test alignment and code-splitting
- CI: mypy, ruff, gateway tsc, vitest configuration
- Rate limiting, approval wait, session persistence edge cases
- Windows asyncio ProactorEventLoop resource warnings

### Tests
- 1586 Python tests (89%+ coverage)
- 138 Gateway TypeScript tests
- 68 Web UI tests
- 6 Electron E2E tests
- Performance benchmarks: health (8178 RPS), chat (313 RPS), SSE (14 RPS), marketplace (1494 RPS), memory (4779 RPS)
