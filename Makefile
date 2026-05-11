.PHONY: install dev engine gateway test clean

PYTHON ?= python3
NODE ?= node
PIP ?= pip
NPM ?= npm

install:
	$(PIP) install -e "./engine[dev]"
	$(NPM) install

dev: engine gateway

engine:
	cd engine && $(PYTHON) -m uvicorn engine.main:app --reload --host 127.0.0.1 --port 18700

gateway:
	$(NPM) run dev -w mix-gateway

test:
	cd engine && $(PYTHON) -m pytest --cov=engine --cov-report=term-missing
	$(NPM) run typecheck -w mix-gateway

clean:
	rm -rf gateway/dist gateway/node_modules
	find engine -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	rm -rf .venv

setup:
	$(PIP) install -e "./engine[dev]"
	$(NPM) install
	@echo ""
	@echo "MIX setup complete! Run 'make dev' to start."
