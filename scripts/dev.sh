#!/usr/bin/env bash
set -euo pipefail

echo "=== MIX Dev Setup ==="

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "Error: python3 not found. Install Python 3.11+."
    exit 1
fi

# Check Node
if ! command -v node &>/dev/null; then
    echo "Error: node not found. Install Node.js 22+."
    exit 1
fi

# Setup Python engine
echo "[1/3] Installing Python dependencies..."
cd "$(dirname "$0")/.."
pip install -e "./engine[dev]" --quiet 2>/dev/null || pip3 install -e "./engine[dev]" --quiet

# Setup Node.js gateway
echo "[2/3] Installing Node.js dependencies..."
npm install --quiet 2>/dev/null

# Create default config
echo "[3/3] Creating default config..."
mkdir -p ~/.mix/data
if [ ! -f ~/.mix/config.json ]; then
    cat > ~/.mix/config.json << 'EOF'
{
  "engine": { "host": "127.0.0.1", "port": 18700 },
  "gateway": { "host": "127.0.0.1", "port": 18789 },
  "llm": {
    "provider": "openrouter",
    "model": "openai/gpt-4o",
    "api_key": ""
  },
  "memory": {
    "db_path": "~/.mix/data/mix.db",
    "max_entries": 10000
  },
  "security": {
    "dm_policy": "pairing",
    "allowed_users": []
  }
}
EOF
    echo "  Created ~/.mix/config.json - edit it to add your API key."
fi

echo ""
echo "MIX setup complete!"
echo ""
echo "  Start engine:   make engine"
echo "  Start gateway:  make gateway"
echo "  Start both:     make dev"
echo ""
echo "  API: http://127.0.0.1:18789/api/health"
echo ""
