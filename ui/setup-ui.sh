#!/bin/bash
# Saravonix UI — Phase 1 setup
# Run from the ui/ directory after running engine/setup.sh

set -e
echo "=== Saravonix UI Setup ==="

# ── Prerequisites check ─────────────────────────────────────────────────────────
command -v node &>/dev/null || { echo "ERROR: Node.js not found. Install from https://nodejs.org"; exit 1; }
command -v cargo &>/dev/null || {
  echo "ERROR: Rust not found. Install from https://rustup.rs"
  echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  exit 1
}

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "ERROR: Node.js 18+ required (found $(node -v))"
  exit 1
fi

# ── macOS: install Xcode CLI tools if needed ────────────────────────────────────
if [ "$(uname)" = "Darwin" ]; then
  xcode-select -p &>/dev/null || {
    echo "Installing Xcode CLI tools…"
    xcode-select --install
    echo "Re-run this script after installation completes."
    exit 1
  }
fi

# ── Install Tauri CLI (if needed) ───────────────────────────────────────────────
if ! cargo tauri --version &>/dev/null 2>&1; then
  echo "Installing Tauri CLI…"
  cargo install tauri-cli --version "^2.0" --locked
fi

# ── Install Node dependencies ───────────────────────────────────────────────────
echo "Installing Node dependencies…"
npm install

echo ""
echo "=== UI Setup complete ==="
echo ""
echo "To run in development mode:"
echo "  1. Start the engine first:  cd ../engine && python api.py"
echo "  2. In this directory:       npm run tauri dev"
echo ""
echo "To build a distributable app:"
echo "  npm run tauri build"
echo ""
echo "The app will auto-start the Python engine on launch."
