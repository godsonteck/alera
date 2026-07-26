#!/bin/bash

set -e

API_URL="${1:-https://alera-gamma.vercel.app}"

echo "Testing ALERA deployment health..."
echo "Base URL: $API_URL"
echo ""

health_response="$(curl -sS -w "\n%{http_code}" "$API_URL/api/health" -H "Content-Type: application/json")"
health_body="$(printf '%s' "$health_response" | sed '$d')"
health_status="$(printf '%s' "$health_response" | tail -n1)"

echo "Checking /api/health"
echo "$health_body"
echo "HTTP Status: $health_status"
echo ""

ready_response="$(curl -sS -w "\n%{http_code}" "$API_URL/api/ready" -H "Content-Type: application/json")"
ready_body="$(printf '%s' "$ready_response" | sed '$d')"
ready_status="$(printf '%s' "$ready_response" | tail -n1)"

echo "Checking /api/ready"
echo "$ready_body"
echo "HTTP Status: $ready_status"
echo ""

python3 - "$health_status" "$ready_status" "$health_body" "$ready_body" <<'PY'
import json
import sys

health_status, ready_status, health_body, ready_body = sys.argv[1:5]

if health_status != "200":
    raise SystemExit(f"/api/health returned {health_status}")
if ready_status != "200":
    raise SystemExit(f"/api/ready returned {ready_status}")

health = json.loads(health_body)
ready = json.loads(ready_body)

environment = str(health.get("environment") or "").strip().lower()
if environment == "development":
    raise SystemExit("Deployment is still reporting ENVIRONMENT=development")

startup_check = ((health.get("checks") or {}).get("startup") or "").strip().lower()
database_check = ((health.get("checks") or {}).get("database") or "").strip().lower()
ready_status_value = str(ready.get("status") or "").strip().lower()

if startup_check != "ok":
    raise SystemExit(f"Startup check is not ok: {startup_check!r}")
if database_check not in {"ok", "connected"}:
    raise SystemExit(f"Database check is not healthy: {database_check!r}")
if ready_status_value != "ready":
    raise SystemExit(f"Readiness status is not ready: {ready_status_value!r}")

print("Deployment health checks passed.")
PY
