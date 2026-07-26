#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="0.0.0.0"
PORT="8080"
URL="http://127.0.0.1:${PORT}/"
LOG_DIR="${ROOT_DIR}/.local"
LOG_FILE="${LOG_DIR}/alera-dev.log"

mkdir -p "${LOG_DIR}"

# Check if server is already running
if ! curl -sf "${URL}" >/dev/null 2>&1; then
  (
    cd "${ROOT_DIR}"
    nohup npm run dev -- --host "${HOST}" --port "${PORT}" >"${LOG_FILE}" 2>&1 &
  )

  # Wait up to 60 seconds for server to start
  for i in $(seq 1 60); do
    if curl -sf "${URL}" >/dev/null 2>&1; then
      echo "Server started successfully"
      break
    fi
    sleep 1
  done
fi

# Final check
if ! curl -sf "${URL}" >/dev/null 2>&1; then
  echo "Failed to start ALERA. Check ${LOG_FILE}."
  sleep 3
  exit 1
fi

if command -v chromium >/dev/null 2>&1; then
  exec chromium --app="${URL}"
fi

exec xdg-open "${URL}"
