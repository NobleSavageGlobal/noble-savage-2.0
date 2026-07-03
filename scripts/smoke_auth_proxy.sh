#!/usr/bin/env bash
set -euo pipefail

FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:3000}"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:8000}"

rand_suffix="$(date +%s)-$RANDOM"
email="smoke-${rand_suffix}@example.local"
password="Sm0kePass!123"
name="Smoke User ${rand_suffix}"

echo "[1/5] Checking backend health: ${BACKEND_URL}/health"
backend_health="$(curl -sS "${BACKEND_URL}/health")"
if [[ "${backend_health}" != *"\"message\":\"ok\""* ]]; then
  echo "Backend health check failed: ${backend_health}"
  exit 1
fi

echo "[2/5] Checking frontend proxy health: ${FRONTEND_URL}/api-proxy/health"
proxy_health="$(curl -sS "${FRONTEND_URL}/api-proxy/health")"
if [[ "${proxy_health}" != *"\"message\":\"ok\""* ]]; then
  echo "Proxy health check failed: ${proxy_health}"
  exit 1
fi

echo "[3/5] Registering test user via proxy"
register_payload="$(printf '{"email":"%s","password":"%s","name":"%s"}' "${email}" "${password}" "${name}")"
register_response="$(curl -sS -X POST "${FRONTEND_URL}/api-proxy/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "${register_payload}")"

access_token="$(printf '%s' "${register_response}" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')"
if [[ -z "${access_token}" ]]; then
  echo "Registration failed: ${register_response}"
  exit 1
fi

echo "[4/5] Logging in via proxy"
login_payload="$(printf '{"email":"%s","password":"%s"}' "${email}" "${password}")"
login_response="$(curl -sS -X POST "${FRONTEND_URL}/api-proxy/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "${login_payload}")"
login_token="$(printf '%s' "${login_response}" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')"
if [[ -z "${login_token}" ]]; then
  echo "Login failed: ${login_response}"
  exit 1
fi

echo "[5/5] Verifying authenticated /me response"
me_response="$(curl -sS "${FRONTEND_URL}/api-proxy/api/auth/me" -H "Authorization: Bearer ${login_token}")"
if [[ "${me_response}" != *"\"email\":\"${email}\""* ]]; then
  echo "Auth /me verification failed: ${me_response}"
  exit 1
fi

echo "PASS: Proxy auth smoke test succeeded"
echo "User: ${email}"
