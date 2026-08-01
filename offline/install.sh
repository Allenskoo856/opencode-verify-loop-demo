#!/usr/bin/env bash
set -Eeuo pipefail
runtime=docker; bundle=''
while [ "$#" -gt 0 ]; do case "$1" in --runtime) runtime="$2"; shift 2;; --bundle) bundle="$2"; shift 2;; *) echo "unknown option: $1" >&2; exit 2;; esac; done
[ -n "$bundle" ] || { echo '--bundle is required' >&2; exit 2; }
command -v "$runtime" >/dev/null || { echo "$runtime not found" >&2; exit 2; }
bundle_dir=$(CDPATH= cd -- "$(dirname -- "$bundle")" && pwd)
bundle_file=$(basename -- "$bundle")
sha256sum "$bundle" | awk '{print $1 "  " ENVIRON["bundle_file"]}' > "$bundle_dir/.bundle.sha256"
mkdir -p offline-unpack
tar -xf "$bundle" -C offline-unpack
find offline-unpack -maxdepth 1 -type f -name '*.tar' -print0 | while IFS= read -r -d '' image; do "$runtime" load -i "$image"; done
install -m 0755 offline-unpack/verify-loop ./verify-controller/bin/verify-loop
cp -n offline-unpack/.env.offline.example .env.offline.example 2>/dev/null || true
echo "offline bundle installed with $runtime; no network request was made"
