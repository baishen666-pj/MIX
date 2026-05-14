#!/bin/bash
# MIX Desktop Build — produces platform-specific installer
# Usage: bash scripts/build-desktop.sh [--skip-engine] [--platform win|mac|linux|all]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SKIP_ENGINE=""
PLATFORM=""

for arg in "$@"; do
  case "$arg" in
    --skip-engine) SKIP_ENGINE="--skip-engine" ;;
    --platform) shift ;; # handled below
    win|mac|linux|all) PLATFORM="$arg" ;;
  esac
done

if [ -z "$PLATFORM" ]; then
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*|Windows_NT) PLATFORM="win" ;;
    Darwin) PLATFORM="mac" ;;
    *) PLATFORM="linux" ;;
  esac
fi

echo "=== MIX Desktop Build ==="
echo "Root: $ROOT_DIR"
echo "Platform: $PLATFORM"
echo ""

# [1/3] Build Engine (PyInstaller)
if [ "$SKIP_ENGINE" != "--skip-engine" ]; then
  echo "=== [1/3] Building Engine (PyInstaller) ==="
  cd "$ROOT_DIR"
  ENGINE_BIN="dist/mix-engine/mix-engine"
  case "$PLATFORM" in
    win) ENGINE_BIN="dist/mix-engine/mix-engine.exe" ;;
  esac
  if [ ! -f "$ENGINE_BIN" ]; then
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

case "$PLATFORM" in
  win)
    npm run build:win
    ;;
  mac)
    npm run build:mac
    ;;
  linux)
    npm run build:linux
    ;;
  all)
    npm run build:win
    npm run build:mac
    npm run build:linux
    ;;
esac

echo ""
echo "=== Build complete ==="
echo "Output: $ROOT_DIR/electron/dist/"
ls -la "$ROOT_DIR/electron/dist/" 2>/dev/null | grep -E "\.(exe|dmg|AppImage|deb)$" || echo "(check build output for artifacts)"
