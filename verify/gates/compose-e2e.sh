#!/usr/bin/env bash
set -Eeuo pipefail
root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$root_dir"
compose=(docker compose -f deploy/compose.dev.yml)
if [ -f .env ]; then compose=(docker compose --env-file .env -f deploy/compose.dev.yml); fi
mkdir -p artifacts/verify/compose-e2e
cleanup() {
  "${compose[@]}" logs --no-color > artifacts/verify/compose-e2e/compose.log 2>&1 || true
  "${compose[@]}" down -v || true
}
trap cleanup EXIT
"${compose[@]}" up --build -d
for _ in $(seq 1 60); do
  if curl --fail --silent --show-error http://localhost:8080/actuator/health >/dev/null; then break; fi
  sleep 2
done
curl --fail --silent --show-error http://localhost:8080/actuator/health >/dev/null
E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:4173}" \
E2E_USER="${E2E_USER:-demo@example.com}" \
E2E_PASSWORD="${E2E_PASSWORD:-demo-password-only-for-local}" \
npm --prefix frontend run test:e2e
