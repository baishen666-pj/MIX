#!/bin/bash
# MIX Desktop Build — produces Windows NSIS installer
# Usage: bash scripts/build-desktop.sh [--skip-engine]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SKIP_ENGINE="${1:-}"

echo "=== MIX Desktop Build ==="
echo "Root: $ROOT_DIR"
echo ""

# [1/3] Build Engine (PyInstaller)
if [ "$SKIP_ENGINE" != "--skip-engine" ]; then
  echo "=== [1/3] Building Engine (PyInstaller) ==="
  cd "$ROOT_DIR"
  if [ ! -f "dist/mix-engine/mix-engine.exe" ] && [ ! -f "dist/mix-engine/mix-engine" ]; then
    bash scripts/build-engine.sh
  else
    echo "Engine already built, skipping (delete dist/mix-engine/ to rebuild)"
  fi
else
  echo "=== [1/3] Skipping Engine (--skip-engine) ==="
fi

# [2/3] Bundle Gateway (esbuild)
echo ""
echo "=== [2/3] Bundling Gateway ==="
cd "$ROOT_DIR/gateway"
npm run bundle

# [3/3] Build + Package Electron
echo ""
echo "=== [3/3] Packaging Electron ==="
cd "$ROOT_DIR/electron"
npm run build:win

echo ""
echo "=== Build complete ==="
echo "Output: $ROOT_DIR/electron/dist/"
ls -la "$ROOT_DIR/electron/dist/"*.exe 2>/dev/null || echo "(no .exe found — check build output)"
