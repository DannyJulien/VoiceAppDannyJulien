#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PID_FILE="$SCRIPT_DIR/handled-web.pid"
LOG_DIR="$SCRIPT_DIR/logs"

mkdir -p "$LOG_DIR"

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Handled web server is already running (PID $(cat "$PID_FILE"))."
  exit 0
fi

cd "$PROJECT_DIR"
nohup env HANDLED_HOST=127.0.0.1 HANDLED_PORT=4173 node "$SCRIPT_DIR/server.mjs" \
  >"$LOG_DIR/server.out.log" 2>"$LOG_DIR/server.err.log" < /dev/null &
echo $! > "$PID_FILE"
echo "Handled web server started on http://127.0.0.1:4173 (PID $(cat "$PID_FILE"))."
