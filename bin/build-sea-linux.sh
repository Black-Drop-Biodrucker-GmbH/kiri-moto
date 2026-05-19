#!/usr/bin/env bash
# Build a standalone Linux binary using Node.js SEA.
# Run on the target Linux machine (x64 or arm64) from the repo root:
#   chmod +x bin/build-sea-linux.sh && ./bin/build-sea-linux.sh

set -e
cd "$(dirname "$0")/.."

mkdir -p dist

echo "Bundling source..."
node bin/bundle-cli.mjs

echo "Generating SEA blob..."
node --experimental-sea-config sea-config.json

ARCH=$(uname -m)
OUT="dist/kiri-linux-${ARCH}"

echo "Copying node binary..."
cp "$(which node)" "$OUT"

echo "Injecting SEA blob..."
npx postject "$OUT" NODE_SEA_BLOB dist/sea-prep.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
    --overwrite

chmod +x "$OUT"
echo "Done: $OUT"
"$OUT" --help
