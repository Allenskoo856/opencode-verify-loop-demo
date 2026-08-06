#!/usr/bin/env bash
set -Eeuo pipefail
root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
out_dir="$root_dir/offline/out"; tag=${1:-offline}
mkdir -p "$out_dir"
npm --prefix "$root_dir/verify-controller-ts" ci --ignore-scripts
npm --prefix "$root_dir/verify-controller-ts" run build
docker build --platform linux/amd64 -t "opencode-verify-controller:$tag" "$root_dir/verify-controller"
docker build --platform linux/amd64 -t "opencode-verify-backend:$tag" "$root_dir/backend"
docker build --platform linux/amd64 -t "opencode-verify-frontend:$tag" "$root_dir/frontend"
docker pull --platform linux/amd64 postgres:14-alpine
docker tag postgres:14-alpine opencode-verify-postgres:14
docker save -o "$out_dir/opencode-verify-controller-$tag.tar" "opencode-verify-controller:$tag"
docker save -o "$out_dir/opencode-verify-backend-$tag.tar" "opencode-verify-backend:$tag"
docker save -o "$out_dir/opencode-verify-frontend-$tag.tar" "opencode-verify-frontend:$tag"
docker save -o "$out_dir/opencode-verify-postgres-14.tar" opencode-verify-postgres:14
cp "$root_dir/verify-controller/bin/verify-loop" "$out_dir/verify-loop"
cp "$root_dir/verify-controller-ts/dist/verify-loop.js" "$out_dir/verify-loop.js"
cp "$root_dir/.env.offline.example" "$out_dir/.env.offline.example"
cp "$root_dir/deploy/compose.offline.yml" "$out_dir/compose.offline.yml"
cp "$root_dir/verify/policy.json" "$out_dir/policy.json"
mkdir -p "$out_dir/acceptance"
cp -R "$root_dir/acceptance/." "$out_dir/acceptance/"
mkdir -p "$out_dir/gates"
cp "$root_dir"/verify/gates/*.cjs "$out_dir/gates/"
(cd "$out_dir" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)
tar -C "$out_dir" -cf "$root_dir/offline/opencode-verify-loop-offline-$tag.tar" .
sha256sum "$root_dir/offline/opencode-verify-loop-offline-$tag.tar" > "$root_dir/offline/opencode-verify-loop-offline-$tag.tar.sha256"
echo "built offline/opencode-verify-loop-offline-$tag.tar"
