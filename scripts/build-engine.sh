#!/bin/bash
# Build MIX Engine as standalone executable using PyInstaller
# Usage: python scripts/build-engine.sh
# Output: dist/mix-engine/mix-engine (or mix-engine.exe on Windows)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Building MIX Engine..."
echo "Root: $ROOT_DIR"

cd "$ROOT_DIR"

# Clean previous build
rm -rf build/ dist/

# Build with PyInstaller
pyinstaller \
  --name mix-engine \
  --onedir \
  --console \
  --noconfirm \
  --clean \
  --upx-dir "$(which upx 2>/dev/null || echo '')" \
  --add-data "engine:engine" \
  --hidden-import uvicorn.logging \
  --hidden-import uvicorn.loops \
  --hidden-import uvicorn.loops.auto \
  --hidden-import uvicorn.protocols \
  --hidden-import uvicorn.protocols.http \
  --hidden-import uvicorn.protocols.http.auto \
  --hidden-import uvicorn.protocols.websockets \
  --hidden-import uvicorn.protocols.websockets.auto \
  --hidden-import uvicorn.lifespan \
  --hidden-import uvicorn.lifespan.on \
  --hidden-import engine \
  --hidden-import engine.config \
  --hidden-import engine.main \
  --hidden-import engine.api.routes \
  --hidden-import engine.agent.bus \
  --hidden-import engine.agent.collaboration \
  --hidden-import engine.agent.orchestrator \
  --hidden-import engine.tools.registry \
  --hidden-import engine.tools.dynamic \
  --hidden-import engine.tools.approval \
  --hidden-import engine.tools.history \
  --hidden-import engine.memory.store \
  --hidden-import engine.rag.pipeline \
  --hidden-import engine.rag.collections \
  --hidden-import engine.rag.chunking \
  --hidden-import engine.rag.reranker \
  --hidden-import engine.rag.citations \
  --hidden-import engine.monitoring.metrics \
  --hidden-import engine.middleware.api_key_auth \
  --hidden-import engine.middleware.rate_limit \
  --exclude-module tkinter \
  --exclude-module matplotlib \
  --exclude-module numpy \
  --exclude-module torch \
  --exclude-module tensorflow \
  engine/main.py

echo ""
echo "Build complete: dist/mix-engine/"
echo "Executable: dist/mix-engine/mix-engine$(case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*|Windows_NT) echo ".exe";; esac)"
echo ""
echo "Size:"
du -sh dist/mix-engine/ 2>/dev/null || echo "N/A"
