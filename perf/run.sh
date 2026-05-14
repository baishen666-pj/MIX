#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MOCK_PID=""
RESULTS_DIR="results"
MOCK_PORT=19876
DURATION=${DURATION:-30}
USERS=${USERS:-20}
TARGET=${TARGET:-engine}

cleanup() {
    if [ -n "$MOCK_PID" ]; then
        kill "$MOCK_PID" 2>/dev/null || true
        wait "$MOCK_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT

mkdir -p "$RESULTS_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[PERF]${NC} $*"; }
warn() { echo -e "${YELLOW}[PERF]${NC} $*"; }
fail() { echo -e "${RED}[PERF]${NC} $*" >&2; exit 1; }

# Check dependencies
check_deps() {
    if ! command -v k6 &>/dev/null; then
        fail "k6 not found. Install: https://k6.io/docs/get-started/installation/"
    fi
    if ! python -c "import fastapi" 2>/dev/null; then
        warn "Installing fastapi + uvicorn..."
        pip install -q fastapi uvicorn
    fi
}

# Start mock engine
start_mock() {
    log "Starting mock engine on port $MOCK_PORT..."
    python locust/mock_engine.py --port "$MOCK_PORT" &
    MOCK_PID=$!

    # Wait for health check
    for i in $(seq 1 30); do
        if curl -sf "http://127.0.0.1:$MOCK_PORT/api/health" >/dev/null 2>&1; then
            log "Mock engine ready (PID $MOCK_PID)"
            return 0
        fi
        sleep 0.5
    done
    fail "Mock engine failed to start"
}

# Run k6 scenario
run_k6() {
    local name=$1
    local file=$2
    local ts=$(date +%Y%m%d-%H%M%S)
    local result_file="$RESULTS_DIR/k6-${name}-${ts}.json"

    log "Running k6 scenario: $name"
    k6 run \
        --out "json=$result_file" \
        --summary-export "$RESULTS_DIR/k6-${name}-summary-${ts}.json" \
        --env ENGINE_URL="http://127.0.0.1:$MOCK_PORT" \
        "$file" 2>&1 | tail -20

    if [ $? -eq 0 ]; then
        log "$name: ${GREEN}PASS${NC}"
    else
        warn "$name: ${RED}FAIL${NC}"
    fi
}

# Run all k6 scenarios
run_all_k6() {
    local scenarios=(
        "health:k6/scenarios/engine-health.js"
        "chat:k6/scenarios/engine-chat.js"
        "sse-stream:k6/scenarios/engine-sse-stream.js"
        "marketplace:k6/scenarios/engine-marketplace.js"
        "memory-search:k6/scenarios/engine-memory-search.js"
    )

    for entry in "${scenarios[@]}"; do
        local name="${entry%%:*}"
        local file="${entry#*:}"
        run_k6 "$name" "$file"
        echo ""
    done
}

# Run Locust
run_locust() {
    if ! python -c "import locust" 2>/dev/null; then
        warn "Installing locust..."
        pip install -q locust
    fi

    log "Running Locust mixed scenario (${USERS} users, ${DURATION}s)..."
    local ts=$(date +%Y%m%d-%H%M%S)

    python -m locust \
        -f locust/locustfile.py \
        --host "http://127.0.0.1:$MOCK_PORT" \
        --headless \
        --users "$USERS" \
        --spawn-rate 5 \
        --run-time "${DURATION}s" \
        --csv "$RESULTS_DIR/locust-${ts}" \
        --html "$RESULTS_DIR/locust-${ts}.html" \
        --skip-log 2>&1 | tail -30

    log "Locust report: $RESULTS_DIR/locust-${ts}.html"
}

# Main
main() {
    log "MIX Performance Testing Suite"
    log "Target: $TARGET | Duration: ${DURATION}s | Users: $USERS"
    echo ""

    check_deps
    start_mock
    echo ""

    run_all_k6

    if [ "${RUN_LOCUST:-true}" = "true" ]; then
        run_locust
    fi

    echo ""
    log "All tests complete. Results in $RESULTS_DIR/"
}

main "$@"
