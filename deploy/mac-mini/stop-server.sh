#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/handled-web.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "Handled web server is not running."
  exit 0
fi

PID="$(cat "$PID_FILE")"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "Stopped Handled web server (PID $PID)."
else
  echo "Removed stale PID file."
fi
rm -f "$PID_FILE"
