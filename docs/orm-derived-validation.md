# ORM-derived validation projections

The canonical inverse/code-first ORM derivative engine now lives in **`ORESoftware/ores-orm-core`** and is Rust-first. Diesel/SeaORM definitions are derivative persistence evidence, not a replacement for independently authored TypeSpec + JSON Schema.

`ORESoftware/ores-contracts` continues to own the contract-first persistence convergence lane: independently authored TypeSpec and JSON Schema are parsed separately, must converge, and may emit SQL/SeaORM/Diesel/language witnesses. It must not also evolve a competing long-term ORM parser/emitter stack.

## Legacy Node compatibility shim

The historical `ores-orm-derive` executable remains temporarily for bootstrap inspection by repositories that have not yet migrated to the Rust engine. It is **not** a release or publication generator.

Direct argv parsing has been removed from that shim. It runs only when explicitly opted into with `ORES_ORM_LEGACY_BOOTSTRAP=1` and receives its paths through environment variables:

```sh
ORES_ORM_LEGACY_BOOTSTRAP=1 \
ORES_ORM_DIESEL=generated/diesel/schema.rs \
ORES_ORM_SEAORM=generated/seaorm/entities.rs \
ORES_ORM_POLICY=orm-derived.public.json \
ORES_ORM_OUT=generated/orm-derived-bootstrap \
ores-orm-derive
```

Every legacy receipt is stamped:

```json
{
  "role": "legacy_bootstrap_evidence_only",
  "publication": "blocked_pending_rust_engine_and_tjsv_admission",
  "publishable": false
}
```

The shim also writes `DO_NOT_PUBLISH.md`. Its output must not be copied into `*-lib-core`, `*-pub-lib-core`, `*-clients`, SDKs, WIT packages, or releases.

## Canonical release flow

```text
Diesel --------------------\
                            +--> ORESoftware/ores-orm-core
SeaORM --------------------/         |
                                      +--> converged ORM IR
                                      +--> exact policy-derived shape
                                      +--> Rust / TS-Zod / Dart / Gleam / JSON Schema
                                      +--> provenance manifest
                                                   |
                                                   v
TypeSpec authority --------\                 TJSV admission
                             +--------------->     |
JSON Schema authority ------/                      v
                                          admitted derivative
```

The Rust engine preserves row/create/update/patch presence separately from SQL nullability, fail-closes on ambiguous cross-runtime scalar mappings, binds generated artifacts to the exact converged ORM IR + policy-derived shape, and keeps public candidates blocked until a separate TJSV admission step succeeds.

After admission:

- server-only derivative DTOs/validators may be consumed by `*-lib-core`;
- client-safe/public admitted DTOs/validators belong in `*-pub-lib-core`, `*-clients`, or language SDK packages;
- none of those packages imports executable `*-orm-core` code;
- `ores-wit` consumes the same admitted Contract IR rather than treating ORM definitions as authority.
