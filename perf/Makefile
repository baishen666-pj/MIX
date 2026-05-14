.PHONY: perf-install perf-k6-all perf-k6-health perf-k6-chat perf-k6-sse perf-k6-marketplace perf-k6-memory perf-locust perf-all perf-clean perf-mock-engine

ENGINE_URL ?= http://127.0.0.1:18700
RESULTS_DIR := results
DURATION ?= 30
USERS ?= 20

perf-install:
	@echo "Installing k6..."
	@command -v k6 >/dev/null 2>&1 || (echo "Please install k6: https://k6.io/docs/get-started/installation/" && exit 1)
	@pip install -q fastapi uvicorn 2>/dev/null || true
	@pip install -q locust 2>/dev/null || true
	@echo "Dependencies ready"

perf-mock-engine:
	python locust/mock_engine.py --port 18700

perf-k6-health:
	k6 run --env ENGINE_URL=$(ENGINE_URL) k6/scenarios/engine-health.js

perf-k6-chat:
	k6 run --env ENGINE_URL=$(ENGINE_URL) k6/scenarios/engine-chat.js

perf-k6-sse:
	k6 run --env ENGINE_URL=$(ENGINE_URL) k6/scenarios/engine-sse-stream.js

perf-k6-marketplace:
	k6 run --env ENGINE_URL=$(ENGINE_URL) k6/scenarios/engine-marketplace.js

perf-k6-memory:
	k6 run --env ENGINE_URL=$(ENGINE_URL) k6/scenarios/engine-memory-search.js

perf-k6-all: perf-k6-health perf-k6-chat perf-k6-sse perf-k6-marketplace perf-k6-memory
	@echo "All k6 scenarios complete"

perf-locust:
	python -m locust -f locust/locustfile.py --host $(ENGINE_URL) \
		--headless --users $(USERS) --spawn-rate 5 --run-time $(DURATION)s \
		--csv results/locust --html results/locust-report.html --skip-log

perf-all:
	bash run.sh --target engine --duration $(DURATION) --users $(USERS)

perf-clean:
	rm -rf results/
