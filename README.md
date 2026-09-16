# ores-contracts

Persistence/code-generation convergence engine for independently authored TypeSpec and JSON Schema contract peers.

**TypeSpec and JSON Schema are independent, human-authored, top-level authorities.** Neither is generated from the other. Each is parsed on its own into a persistence-oriented normalized IR, each IR drives the same deterministic emitters, and the persistence/codegen result must agree:

```text
contracts/typespec/main.tsp ──parse──▶ IR_T ──emit──▶ SQL_T  SeaORM_T  Diesel_T  Rust_T  TS_T  Dart_T
contracts/json-schema/*.json ─parse──▶ IR_J ──emit──▶ SQL_J  SeaORM_J  Diesel_J  Rust_J  TS_J  Dart_J
                                        │                     ║ byte parity, receipt.json ║
                                        └── structural diff ──▶ findings → STOPPED_FOR_EVALUATION
```

No lane wins. A discrepancy is a finding with a stable fingerprint; `generate` refuses to write `generated/` until a human changes an authored source. This is the generalized persistence/codegen form of the convergence gate that `ORESoftware/ores-middleware` proves on its own idempotency record.

## Position in the contract stack

`ores-contracts` does **not** own the authored contract registry. `ORESoftware/ores-interfaces` owns fleet-generic shared semantic contracts; product/domain `*-interfaces` repositories own their own contract pairs.

`ORESoftware/typespec-json-schema-validator` (TJSV) remains the generic wire/schema parity engine and the owner of Contract IR identity, projection verification, runtime adapter evidence, and runtime-conformance decisions. `ores-contracts` is invoked as an additional gate only for contract families that explicitly use its supported persistence subset.

A pure transport/value contract should not acquire fake tables, indexes, or ORM semantics merely to pass this tool. Conversely, a persistence-bearing contract must not treat TJSV wire parity alone as proof that SQL/SeaORM/Diesel projections converge.

`ORESoftware/ores-cli` coordinates fleet policy and immutable resolved versions; it delegates the actual semantic proofs rather than becoming another parser.

See `docs/contract-stack-boundary.md` for the full responsibility split and `docs/subset.md` for exactly what the persistence projection may express.

## Commands

```sh
npx ores-contracts check                      # parse both, diff, emit both lanes to target/, byte-compare, receipt.json
npx ores-contracts generate                   # same, then write the agreed artifacts to generated/
npx ores-contracts bootstrap --from json-schema   # draft a TypeSpec authority from an existing JSON Schema (or --from typespec)
npx ores-contracts db-check --database-url … # apply SQL_T and SQL_J to two throwaway schemas, diff information_schema
scripts/rust-witness.sh generated            # cargo check: serde types + SeaORM entities + Diesel schema compile together
```

`bootstrap` is scaffolding only. Its output is never automatically promoted to peer authority; a human must independently review and adopt the drafted source.

`contracts.config.json` (see `templates/interfaces/`) names the two source authorities, output dirs and artifact list.

## Required relationship with TJSV

For a persistence-bearing contract family, repository CI should prove both layers against the same reviewed source revision:

1. TJSV current-input parity succeeds for the TypeSpec/JSON Schema pair and produces admissible Contract IR/receipt evidence.
2. `ores-contracts check` succeeds for the persistence subset and both independent emit lanes converge.
3. Runtime conformance, when implementations exist, uses TJSV's runtime-conformance protocol and reviewed contract-owner fixtures; it is not reimplemented here.

The overlap in parsing is intentional but bounded. TJSV answers whether the peer sources agree at the wire/runtime contract boundary. `ores-contracts` answers whether the explicitly supported persistence semantics converge. Unknown persistence-affecting annotations or constructs fail closed rather than being silently ignored.

## Where each artifact goes in an org

| repo | responsibility / consumes |
| --- | --- |
| `ORESoftware/ores-interfaces` | owns genuinely shared fleet-level authored peers and fixture corpora; does not become product persistence authority |
| product/domain `*-interfaces` | owns product/domain authored TypeSpec + JSON Schema peers; invokes TJSV and, when applicable, `ores-contracts` |
| `*-orm-core` / migration layers | consume `generated/sql/schema.sql`, `generated/seaorm/entities.rs`, and `generated/diesel/schema.rs`; do not become a second contract authority |
| `*-clients` | consume admitted `generated/typescript/*`, `generated/dart/models.dart`, `generated/rust/types.rs` or other language projections |
| `*-api-server.rs` / `*-web-server.rs` | consume admitted types/validators at request and RPC boundaries |

The Diesel lane makes the **db-first cross-check** concrete: SeaORM is the application ORM code-first witness, while Diesel's `table!` is regenerated from the real database (`diesel print-schema`) in `*-orm-core` CI and diffed against `generated/diesel/schema.rs`. Drift in either direction stops the gate.

`ores-contracts` emits DDL witnesses but does not own production migration execution. The owning declarative-migrations/dpm path applies reviewed DDL under its own controls.

## Conformance ownership

Generic runtime evidence schemas, current-input binding, finding fingerprints and final runtime decisions live in TJSV. Expected positive/negative cases live with the contract authority. Language/runtime adapters live with the implementation they execute and report verdicts only.

Do not copy those generic conformance components into this repository. Persistence witnesses generated here may be included in a broader admission receipt, but they are evidence, not runtime-conformance authority.
