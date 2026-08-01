#!/usr/bin/env bash
set -Eeuo pipefail
runtime=docker; bundle=''
while [ "$#" -gt 0 ]; do case "$1" in --runtime) runtime="$2"; shift 2;; --bundle) bundle="$2"; shift 2;; *) echo "unknown option: $1" >&2; exit 2;; esac; done
[ -n "$bundle" ] || { echo '--bundle is required' >&2; exit 2; }
command -v "$runtime" >/dev/null || { echo "$runtime not found" >&2; exit 2; }
bundle_dir=$(CDPATH= cd -- "$(dirname -- "$bundle")" && pwd)
bundle_file=$(basename -- "$bundle")
if [ -f "$bundle_dir/$bundle_file.sha256" ]; then (cd "$bundle_dir" && sha256sum -c "$bundle_file.sha256"); fi
unpack_dir=$(mktemp -d "${TMPDIR:-/tmp}/verify-loop-offline.XXXXXX")
trap 'rm -rf "$unpack_dir"' EXIT
tar -xf "$bundle" -C "$unpack_dir"
find "$unpack_dir" -maxdepth 1 -type f -name '*.tar' -print0 | while IFS= read -r -d '' image; do "$runtime" load -i "$image"; done
mkdir -p ./verify-controller/bin ./verify-controller-ts/dist ./deploy ./verify/gates
install -m 0755 "$unpack_dir/verify-loop" ./verify-controller/bin/verify-loop
if [ -f "$unpack_dir/verify-loop.js" ]; then install -m 0644 "$unpack_dir/verify-loop.js" ./verify-controller-ts/dist/verify-loop.js; fi
cp -n "$unpack_dir/.env.offline.example" .env.offline.example 2>/dev/null || true
cp -n "$unpack_dir/compose.offline.yml" deploy/compose.offline.yml 2>/dev/null || true
cp -n "$unpack_dir/policy.json" verify/policy.json 2>/dev/null || true
if [ -d "$unpack_dir/gates" ]; then cp -n "$unpack_dir"/gates/*.cjs verify/gates/ 2>/dev/null || true; fi
echo "offline bundle installed with $runtime; no network request was made"
