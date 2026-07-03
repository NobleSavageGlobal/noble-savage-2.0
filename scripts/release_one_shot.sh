#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_URL="https://noble-savage-backend-production.up.railway.app"
FRONTEND_URL="https://noble-savage-frontend-production.up.railway.app"

if ! command -v railway >/dev/null 2>&1; then
  echo "Error: railway CLI is required but not installed."
  exit 1
fi

pushd "${ROOT_DIR}" >/dev/null

echo "== Release One Shot: start =="
echo "Root: ${ROOT_DIR}"

echo "\n[1/6] Full diagnostic sweep"
./scripts/full_diagnostic.sh

echo "\n[2/6] Verify main is synced"
LOCAL_HEAD="$(git rev-parse --short HEAD)"
REMOTE_HEAD="$(git rev-parse --short origin/main)"
echo "Local:  ${LOCAL_HEAD}"
echo "Remote: ${REMOTE_HEAD}"
if [[ "${LOCAL_HEAD}" != "${REMOTE_HEAD}" ]]; then
  echo "Error: local HEAD does not match origin/main. Push first."
  exit 1
fi

echo "\n[3/6] Deploy backend (service-root mode)"
railway up backend --path-as-root --service noble-savage-backend --detach

echo "\n[4/6] Deploy frontend (frontend directory)"
pushd "${ROOT_DIR}/frontend" >/dev/null
railway up --service noble-savage-frontend --detach
popd >/dev/null

echo "\n[5/6] Railway status snapshot"
railway service status --service noble-savage-backend
railway service status --service noble-savage-frontend

echo "\n[6/6] Live endpoint verification"
curl -fsS "${BACKEND_URL}/health"
echo
curl -fsSI "${FRONTEND_URL}" | head -n 1

echo "\n== Release One Shot: completed =="

git status --short
popd >/dev/null
