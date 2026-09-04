# ores-contracts

**TypeSpec and JSON Schema are independent, human-authored, top-level
authorities.** Neither is generated from the other. Each is parsed on its own
into a normalized IR, each IR drives the same deterministic emitters, and the
result must agree byte-for-byte:

```text
contracts/typespec/main.tsp ──parse──▶ IR_T ──emit──▶ SQL_T  SeaORM_T  Diesel_T  Rust_T  TS_T  Dart_T
contracts/json-schema/*.json ─parse──▶ IR_J ──emit──▶ SQL_J  SeaORM_J  Diesel_J  Rust_J  TS_J  Dart_J
                                        │                     ║ byte parity, receipt.json ║
                                        └── structural diff ──▶ findings → STOPPED_FOR_EVALUATION
```

No lane wins. A discrepancy is a finding with a stable fingerprint; `generate`
refuses to write `generated/` until a human changes an authored source. This is
the generalized, multi-model form of the convergence gate that
`ORESoftware/ores-middleware` proves on its own idempotency record.

## Commands

```sh
npx ores-contracts check                      # parse both, diff, emit both lanes to target/, byte-compare, receipt.json
npx ores-contracts generate                   # same, then write the agreed artifacts to generated/
npx ores-contracts bootstrap --from json-schema   # draft a TypeSpec authority from an existing JSON Schema (or --from typespec)
npx ores-contracts db-check --database-url … # apply SQL_T and SQL_J to two throwaway schemas, diff information_schema
scripts/rust-witness.sh generated            # cargo check: serde types + SeaORM entities + Diesel schema compile together
```

`contracts.config.json` (see `templates/interfaces/`) names the two sources,
the output dirs and the artifact list.

## Where each artifact goes in an org

| repo | consumes |
|---|---|
| `*-interfaces` | owns `contracts/` (both authorities) and commits `generated/`; CI = `templates/interfaces/.github/workflows/contracts.yml` |
| `*-orm-core` / `*-lib-core` | `generated/sql/schema.sql` (authored DDL input for declarative-migrations / dpm), `generated/seaorm/entities.rs` (code-first), `generated/diesel/schema.rs` (db-first mirror: `diesel print-schema` against the live DB must equal it) |
| `*-clients` | `generated/typescript/*`, `generated/dart/models.dart`, `generated/rust/types.rs` |
| `*-api-server.rs` / `*-web-server.rs` | `generated/rust/types.rs` + the TS validator at the HTTP boundary |

The Diesel lane is what makes the **db-first cross-check** concrete: SeaORM is
the application ORM (code-first), Diesel's `table!` is regenerated from the
real database (`diesel print-schema`) in `*-orm-core` CI and diffed against
`generated/diesel/schema.rs`. Drift in either direction stops the gate.

See `docs/subset.md` for exactly what both authorities may express.
