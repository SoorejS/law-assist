#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Saravonix License Daemon — Build & Run Guide
#
# HOW THE C++ FILES WORK:
#
#  Source files (what you write):
#    src/hardware.cpp   → reads MAC address, CPU model, machine serial from OS
#    src/crypto.cpp     → AES-256-GCM encryption + HMAC-SHA256 (via OpenSSL)
#    src/license_manager.cpp → saves/loads the encrypted license.dat file
#    src/ipc_server.cpp → Unix socket server — receives JSON requests from Python
#    src/main.cpp       → entry point — starts everything, runs daemon loop
#
#  Compile step (ONE TIME — takes ~15 seconds):
#    cmake + make → produces a single binary: build/saravonix-license
#
#  Runtime:
#    The binary runs as a BACKGROUND PROCESS alongside the Python engine.
#    Python calls it via a Unix socket (a special file at /tmp/saravonix_license.sock).
#    Request/response are newline-delimited JSON.
#    The Tauri app auto-starts and auto-kills this daemon.
#
#  Communication flow:
#    Tauri (Rust) → starts saravonix-license + python api.py as subprocesses
#    Python engine → connects to /tmp/saravonix_license.sock
#    Python engine → sends {"action":"validate"} before allowing cloud calls
#    Daemon → replies {"status":"VALID","seats":5,...}
#    User closes app → Tauri kills both processes
# ─────────────────────────────────────────────────────────────────────────────

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"

ACTION="${1:-help}"

case "$ACTION" in

  # ── Build ─────────────────────────────────────────────────────────────────
  build)
    echo "=== Building Saravonix License Daemon ==="
    echo "Compiler: $(c++ --version | head -1)"
    mkdir -p "$BUILD_DIR"
    cd "$BUILD_DIR"
    cmake .. -DCMAKE_BUILD_TYPE=Release -DBUILD_TOOLS=ON 2>&1 | grep -E "(Found|Error|Warning|Configuring)"
    make -j"$(nproc 2>/dev/null || sysctl -n hw.logicalcpu)" 2>&1
    echo ""
    echo "Binary: $BUILD_DIR/saravonix-license"
    ls -lh "$BUILD_DIR/saravonix-license"
    echo ""
    echo "=== Build complete ==="
    ;;

  # ── Show this machine's hardware fingerprint ───────────────────────────────
  fingerprint)
    if [ ! -f "$BUILD_DIR/saravonix-license" ]; then
      echo "Binary not found. Run: ./build_and_run.sh build"
      exit 1
    fi
    SOCK=/tmp/svx_fp_$$.sock
    "$BUILD_DIR/saravonix-license" "$SOCK" /tmp/no_lic_$$ &
    DAEMON_PID=$!
    sleep 1
    echo '{"action":"fingerprint"}' | nc -U "$SOCK" 2>/dev/null || \
    echo '{"action":"fingerprint"}' | socat - UNIX-CONNECT:"$SOCK" 2>/dev/null
    kill $DAEMON_PID 2>/dev/null
    ;;

  # ── Run the daemon (foreground, for testing) ──────────────────────────────
  run)
    if [ ! -f "$BUILD_DIR/saravonix-license" ]; then
      echo "Binary not found. Run: ./build_and_run.sh build"
      exit 1
    fi
    LICENSE_FILE="${2:-../engine/license.dat}"
    SOCK_PATH="/tmp/saravonix_license.sock"
    echo "Starting daemon..."
    echo "  Socket: $SOCK_PATH"
    echo "  License: $LICENSE_FILE"
    echo "  Ctrl+C to stop"
    echo ""
    exec "$BUILD_DIR/saravonix-license" "$SOCK_PATH" "$LICENSE_FILE"
    ;;

  # ── Run in background (for production use) ────────────────────────────────
  start)
    if [ ! -f "$BUILD_DIR/saravonix-license" ]; then
      echo "Binary not found. Run: ./build_and_run.sh build"
      exit 1
    fi
    LICENSE_FILE="${2:-../engine/license.dat}"
    SOCK_PATH="/tmp/saravonix_license.sock"
    "$BUILD_DIR/saravonix-license" "$SOCK_PATH" "$LICENSE_FILE" &
    echo $! > /tmp/saravonix_license.pid
    echo "Daemon started (PID $(cat /tmp/saravonix_license.pid))"
    sleep 1
    # Quick health check
    RESULT=$(echo '{"action":"validate"}' | nc -U "$SOCK_PATH" 2>/dev/null || echo '{}')
    echo "Status: $RESULT"
    ;;

  # ── Stop background daemon ─────────────────────────────────────────────────
  stop)
    if [ -f /tmp/saravonix_license.pid ]; then
      kill "$(cat /tmp/saravonix_license.pid)" 2>/dev/null && echo "Daemon stopped"
      rm -f /tmp/saravonix_license.pid /tmp/saravonix_license.sock
    else
      pkill -f saravonix-license 2>/dev/null && echo "Daemon stopped" || echo "Daemon not running"
    fi
    ;;

  # ── Issue a license (for giving to a customer) ────────────────────────────
  issue)
    if [ ! -f "$BUILD_DIR/issue-license" ]; then
      echo "Build with tools: ./build_and_run.sh build"
      exit 1
    fi
    echo "Usage: $BUILD_DIR/issue-license \\"
    echo "  --customer-id  CUST_001 \\"
    echo "  --customer-name \"Annamalai & Associates\" \\"
    echo "  --fingerprint  <customer HW fingerprint> \\"
    echo "  --seats        5 \\"
    echo "  --vertical     law_firm \\"
    echo "  --days         365 \\"
    echo "  --out          license.dat"
    echo ""
    echo "Step 1: Customer runs: ./build_and_run.sh fingerprint"
    echo "Step 2: Customer sends you their fingerprint"
    echo "Step 3: You run the issue-license command above"
    echo "Step 4: You send them the license.dat file"
    echo "Step 5: They place it in the engine/ directory"
    ;;

  # ── Test the running daemon ────────────────────────────────────────────────
  test)
    SOCK="/tmp/saravonix_license.sock"
    if [ ! -S "$SOCK" ]; then
      echo "Daemon not running. Start with: ./build_and_run.sh start"
      exit 1
    fi
    echo "Testing daemon at $SOCK..."
    for action in validate fingerprint; do
      echo -n "  $action: "
      echo "{\"action\":\"$action\"}" | nc -U "$SOCK" 2>/dev/null || \
      echo "{\"action\":\"$action\"}" | socat - UNIX-CONNECT:"$SOCK" 2>/dev/null
    done
    ;;

  # ── Help ─────────────────────────────────────────────────────────────────
  *)
    cat << 'EOF'
Saravonix License Daemon — Build & Run

Commands:
  ./build_and_run.sh build          Compile all C++ source files → binary
  ./build_and_run.sh fingerprint    Show this machine's HW fingerprint
  ./build_and_run.sh run            Run daemon in foreground (testing)
  ./build_and_run.sh start          Run daemon in background (production)
  ./build_and_run.sh stop           Stop background daemon
  ./build_and_run.sh test           Test running daemon with sample requests
  ./build_and_run.sh issue          Show how to issue a customer license

C++ Source Files:
  src/hardware.cpp        Reads MAC, CPU, machine serial → SHA-256 fingerprint
  src/crypto.cpp          AES-256-GCM + HMAC-SHA256 via OpenSSL
  src/license_manager.cpp Encrypted license.dat save/load
  src/ipc_server.cpp      Unix socket JSON server (validate/seat/sign)
  src/main.cpp            Entry point, starts daemon loop
  tools/issue_license.cpp Saravonix's tool to issue customer license files

Runtime communication:
  Python engine ←→ /tmp/saravonix_license.sock ←→ C++ daemon
  Protocol: newline-delimited JSON
  {"action":"validate"} → {"status":"VALID","seat_count":5,...}
  {"action":"check_seat","session_id":"abc"} → {"allowed":true}
  {"action":"sign_cloud","payload":"..."} → {"signature":"HMAC_HEX"}
EOF
    ;;
esac
