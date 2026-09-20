#!/bin/sh
set -eu
root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$root"
fail(){ echo "[ores-contracts conformance] $*" >&2; exit 1; }
for boundary in contracts conformance; do
  [ -d "$boundary" ] && [ ! -L "$boundary" ] || fail "$boundary/ must be a real non-symlink directory"
done
escaped=$(find contracts conformance -type l -print -quit 2>/dev/null || true)
[ -z "$escaped" ] || fail "symlink inside contract/conformance boundary: $escaped"
command -v node >/dev/null 2>&1 || fail "node is required"
npm test
node src/cli.mjs check --config test/fixtures/contracts.config.json
