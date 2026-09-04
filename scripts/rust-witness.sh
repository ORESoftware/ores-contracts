#!/bin/sh
# usage: scripts/rust-witness.sh <generated-dir>   — cargo check the generated Rust lanes together.
set -eu
gen=${1:-generated}; here=$(cd "$(dirname "$0")/.." && pwd)
w=$here/witness/rust; mkdir -p "$w/src/generated"
cp "$gen/rust/types.rs" "$w/src/generated/types.rs"
cp "$gen/seaorm/entities.rs" "$w/src/generated/entities.rs"
cp "$gen/diesel/schema.rs" "$w/src/generated/schema.rs"
# generated files carry inner attributes (#![...]) which are not allowed inside include!; strip them
for f in "$w"/src/generated/*.rs; do sed -i.bak '/^#!\[/d' "$f" && rm -f "$f.bak"; done
# diesel lane refers to crate::sql_types / schema:: relative to its own module root
sed -i.bak 's/crate::sql_types::/super::sql_types::/g; s/table_name = schema::/table_name = super::schema::/g' "$w/src/generated/schema.rs" && rm -f "$w/src/generated/schema.rs.bak"
sed -i.bak 's/use crate::sql_types::\*;/use super::super::sql_types::*;/g' "$w/src/generated/schema.rs" && rm -f "$w/src/generated/schema.rs.bak"
( cd "$w" && cargo check --quiet ) && echo "[rust-witness] ok: serde types + SeaORM entities + Diesel schema compile together"
