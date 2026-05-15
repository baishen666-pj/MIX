.PHONY: install dev engine gateway test test-engine test-gateway test-web lint lint-engine lint-gateway lint-web typecheck typecheck-engine typecheck-gateway clean setup docker-up docker-down docker-build docker-logs desktop perf perf-clean

PYTHON ?= python3
NODE ?= node
PIP ?= pip
NPM ?= npm
DOCKER ?= docker

install:
	$(PIP) install -e ".[dev]"
	$(NPM) install

dev:
	$(NPM) run dev

engine:
	cd engine && $(PYTHON) -m uvicorn engine.main:app --reload --host 127.0.0.1 --port 18700

gateway:
	$(NPM) run dev -w mix-gateway

test: test-engine test-gateway test-web

test-engine:
	$(PYTHON) -m pytest tests/ --tb=short -q

test-gateway:
	cd gateway && npx vitest run

test-web:
	cd web && npx vitest run

lint: lint-engine lint-gateway lint-web

lint-engine:
	$(PYTHON) -m ruff check engine/ tests/

lint-gateway:
	cd gateway && npx tsc --noEmit

lint-web:
	cd web && npx tsc --noEmit

typecheck: typecheck-engine typecheck-gateway

typecheck-engine:
	$(PYTHON) -m mypy engine/ --config-file pyproject.toml

typecheck-gateway:
	cd gateway && npx tsc --noEmit

clean:
	rm -rf gateway/dist gateway/node_modules
	find engine -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	rm -rf .venv

setup:
	$(PIP) install -e ".[dev]"
	$(NPM) install
	@echo ""
	@echo "MIX setup complete! Run 'make dev' to start."

# Docker commands

docker-build:
	$(DOCKER) compose build

docker-up:
	$(DOCKER) compose up -d
	@echo ""
	@echo "MIX is running:"
	@echo "  Web UI:    http://localhost:8080"
	@echo "  Gateway:   http://localhost:18789"
	@echo "  Engine:    http://localhost:18700"

docker-down:
	$(DOCKER) compose down

docker-logs:
	$(DOCKER) compose logs -f

docker-restart:
	$(DOCKER) compose restart

desktop:
	bash scripts/build-desktop.sh

perf:
	cd perf && $(MAKE) perf-all

perf-clean:
	cd perf && $(MAKE) perf-clean
