# Contributing to MIX

Thank you for your interest in contributing to MIX!

## Development Setup

### Prerequisites

- Python 3.11+
- Node.js 22+
- Docker (optional, for containerized testing)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/baishen666-pj/MIX.git
cd MIX

# Install all dependencies
make install

# Copy environment template
cp .env.example .env
# Edit .env with your API keys

# Start development servers
make dev
```

### Architecture Overview

| Component | Directory | Port |
|-----------|-----------|------|
| Engine (Python) | `engine/` | 18700 |
| Gateway (TypeScript) | `gateway/` | 18789 |
| Web UI (React) | `web/` | 5173 |
| Electron Desktop | `electron/` | — |

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feat/your-feature-name
```

Branch naming: `feat/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`

### 2. Make Changes

Follow the coding standards:
- **Python**: ruff linting, mypy type checking, PEP 8
- **TypeScript**: strict mode, no `any` types
- **React**: functional components, hooks, Tailwind CSS

### 3. Write Tests

All new features must include tests. Target 80%+ coverage.

```bash
# Run all tests
make test

# Run specific suites
python -m pytest tests/ -q          # Engine
cd gateway && npx vitest run         # Gateway
cd web && npx vitest run             # Web UI
```

### 4. Check Code Quality

```bash
make lint          # Lint all components
make typecheck     # Type check Python and TypeScript
```

### 5. Commit

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new channel adapter for Discord
fix: resolve WebSocket reconnection issue
test: add coverage for memory search
docs: update API reference
```

### 6. Submit a Pull Request

- Include a clear description of changes
- Reference any related issues
- Ensure CI passes (tests, lint, typecheck)
- Keep PRs focused on a single concern

## Project Structure

```
MIX/
├── engine/          # Python FastAPI engine
│   ├── api/         # REST API routes
│   ├── memory/      # Memory system
│   ├── skills/      # Skill registry
│   ├── tools/       # Tool system
│   └── rag/         # RAG pipeline
├── gateway/         # TypeScript Fastify gateway
│   └── src/
│       ├── channels/    # Channel implementations
│       ├── middleware/  # Auth, rate limiting
│       ├── routes/      # API proxy routes
│       └── __tests__/   # Gateway test suite
├── web/             # React web UI
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── i18n/
│       ├── store.ts     # Zustand state
│       └── __tests__/   # Web test suite
├── electron/        # Electron desktop app
├── tests/           # Python test suite
├── shared/          # Shared TypeScript protocols
├── perf/            # Performance benchmarks
├── deploy/          # Kubernetes manifests
└── scripts/         # Build and utility scripts
```

## Reporting Issues

- Use [GitHub Issues](https://github.com/baishen666-pj/MIX/issues)
- Include reproduction steps, expected vs actual behavior
- Specify your OS, Python version, and Node.js version

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
