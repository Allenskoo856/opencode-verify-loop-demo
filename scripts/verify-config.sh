#!/usr/bin/env bash
set -Eeuo pipefail
root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root_dir"
test -f backend/pom.xml
test -f frontend/package.json
test -f verify-controller/policy.yaml
test -f opencode.json
test "$(git diff --check | wc -l | tr -d ' ')" = 0
if rg -n --hidden -g '!node_modules' -g '!package-lock.json' -g '!*.lock' '(sk-[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{40,})' .; then
  echo 'possible secret detected' >&2
  exit 1
fi
echo 'configuration checks passed'
