#!/bin/bash
# P2P Chatter Launcher Script (Linux/macOS)

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  P2P CHATTER LAUNCHER                                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Step 1: Check Node.js
echo "Step 1: Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js from https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node --version)
echo "✓ Node.js $NODE_VERSION found"

# Step 2: Install dependencies
echo ""
echo "Step 2: Installing dependencies..."
if [ ! -d "node_modules" ]; then
    npm install
    echo "✓ Dependencies installed"
else
    echo "✓ Dependencies already installed"
fi

# Step 3: Build
echo ""
echo "Step 3: Building TypeScript..."
npm run build
echo "✓ Build complete"

# Step 4: Run tests (optional)
echo ""
echo "Step 4: Running tests..."
npm test || echo "⚠ Tests skipped (optional)"

# Step 5: Start
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✓ P2P CHATTER LAUNCHED                                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Starting development server..."
npm run dev
