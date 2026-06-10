#!/usr/bin/env bash
set -euo pipefail

# Determine script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source proxy.sh if present to export proxy env vars for this shell
if [ -f "$SCRIPT_DIR/proxy.sh" ]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/proxy.sh"
fi

# Default python and port (can be overridden by env)
PYTHON="${PYTHON:-python3}"
PORT="${PORT:-5000}"

echo "Checking for existing server on port $PORT..."

# Find PIDs listening on the TCP port and kill them
PIDS=""
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -i TCP:"$PORT" -sTCP:LISTEN -t || true)
elif command -v ss >/dev/null 2>&1; then
  PIDS=$(ss -ltnp 2>/dev/null | awk -v port=":$PORT" '$0 ~ port && /LISTEN/ {match($0, /pid=([0-9]+)/, a); if (a[1]) print a[1]}' || true)
fi

if [ -n "$PIDS" ]; then
  echo "Killing PID(s): $PIDS on port $PORT..."
  echo "$PIDS" | xargs -r kill -9
else
  echo "Port $PORT is clear."
fi

# Optionally run the original Windows start.bat under Wine
if [ "${RUN_WITH_WINE:-0}" = "1" ] && command -v wine >/dev/null 2>&1 && [ -f "$SCRIPT_DIR/start.bat" ]; then
  echo "Running start.bat under Wine..."
  wine cmd /c start.bat
  exit $?
fi

echo "Starting Flask server..."
echo "Using Python: $PYTHON"
cd "$SCRIPT_DIR"
exec "$PYTHON" app.py
