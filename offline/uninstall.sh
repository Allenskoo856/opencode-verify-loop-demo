#!/usr/bin/env bash
set -Eeuo pipefail
echo 'This removes only project-scoped verifier files and containers; database volumes are preserved.'
docker compose -f deploy/compose.offline.yml down --remove-orphans || true
rm -f ./verify-controller/bin/verify-loop
