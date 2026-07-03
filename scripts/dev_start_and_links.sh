#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

is_listening() {
  local port="$1"
  ss -ltn | grep -q ":${port} "
}

start_backend() {
  if is_listening "$BACKEND_PORT"; then
    echo "Backend already listening on ${BACKEND_PORT}"
    return
  fi

  echo "Starting backend on ${BACKEND_PORT}"
  (
    cd "${ROOT_DIR}/backend"
    .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "${BACKEND_PORT}" \
      >/tmp/ns_backend_live.log 2>&1 &
  )
}

start_frontend() {
  if is_listening "$FRONTEND_PORT"; then
    echo "Frontend already listening on ${FRONTEND_PORT}"
    return
  fi

  echo "Starting frontend on ${FRONTEND_PORT}"
  (
    cd "${ROOT_DIR}/frontend"
    npm run dev -- --hostname 127.0.0.1 --port "${FRONTEND_PORT}" \
      >/tmp/ns_frontend_live.log 2>&1 &
  )
}

wait_for_http() {
  local url="$1"
  local tries=30
  local count=0

  until curl -fsS "$url" >/dev/null 2>&1; do
    count=$((count + 1))
    if [[ "$count" -ge "$tries" ]]; then
      echo "Timed out waiting for ${url}"
      return 1
    fi
    sleep 1
  done
}

build_codespaces_url() {
  local port="$1"
  if [[ -n "${CODESPACE_NAME:-}" && -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]]; then
    echo "https://${CODESPACE_NAME}-${port}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
  fi
}

configure_public_frontend_port() {
  if [[ -z "${CODESPACE_NAME:-}" ]]; then
    return
  fi
  if ! command -v gh >/dev/null 2>&1; then
    return
  fi

  gh codespace ports visibility -c "${CODESPACE_NAME}" "${FRONTEND_PORT}:public" >/dev/null 2>&1 || true
}

main() {
  start_backend
  start_frontend

  wait_for_http "http://127.0.0.1:${BACKEND_PORT}/health"
  wait_for_http "http://127.0.0.1:${FRONTEND_PORT}"

  configure_public_frontend_port

  local frontend_public
  local backend_public
  frontend_public="$(build_codespaces_url "${FRONTEND_PORT}")"
  backend_public="$(build_codespaces_url "${BACKEND_PORT}")"

  echo
  echo "Ready to test"
  echo "Frontend local:  http://127.0.0.1:${FRONTEND_PORT}"
  echo "Backend local:   http://127.0.0.1:${BACKEND_PORT}/health"
  if [[ -n "${frontend_public}" ]]; then
    echo "Frontend public: ${frontend_public}"
  fi
  if [[ -n "${backend_public}" ]]; then
    echo "Backend public:  ${backend_public} (may stay private)"
  fi
  echo
  echo "Logs"
  echo "Backend:  /tmp/ns_backend_live.log"
  echo "Frontend: /tmp/ns_frontend_live.log"
}

main "$@"
