# Contract stack boundary

`ores-contracts` is the persistence/code-generation convergence engine in the ORES contract stack. It is deliberately narrower than the shared contract registry and deliberately separate from wire/runtime conformance.

## What this repository owns

For a caller-supplied pair of independently authored TypeSpec and Draft 2020-12 JSON Schema authorities, `ores-contracts` may:

- parse both sources independently into its persistence-oriented normalized IR;
- fail closed on unsupported persistence constructs;
- compare the two persistence interpretations;
- emit deterministic SQL, SeaORM, Diesel, Rust, TypeScript and Dart witnesses from each lane;
- require byte/semantic agreement before promotion;
- optionally apply both SQL lanes to isolated PostgreSQL schemas and compare live database shape; and
- produce reproducible receipts/witnesses for downstream admission.

This repository owns the implementation of those persistence/codegen semantics and the documented supported subset.

## What this repository does not own

`ores-contracts` is **not**:

- the fleet-wide source registry for shared contracts;
- the authority for product/domain contract definitions;
- the generic TypeSpec-versus-JSON-Schema wire parity engine;
- the generic Contract IR identity/receipt protocol;
- the runtime adapter evidence format or runtime-conformance decision engine;
- the fleet dependency/policy orchestrator; or
- a migration runner that may mutate production databases directly.

Those responsibilities are intentionally split:

| Responsibility | Owner |
| --- | --- |
| Fleet-generic shared authored peer contracts and reviewed fixture corpora | `ORESoftware/ores-interfaces` |
| Product/domain authored peer contracts | owning product/domain `*-interfaces` repository |
| Wire/schema parity, Contract IR, projection verification, runtime evidence and runtime-conformance decisions | `ORESoftware/typespec-json-schema-validator` (TJSV) |
| Persistence/codegen convergence for the supported subset | `ORESoftware/ores-contracts` |
| Fleet resolved-version policy/orchestration | `ORESoftware/ores-cli` |
| DDL application | the owning migration/declarative-migrations path, never this library merely because it can emit SQL |

## Required ordering

For a contract family that needs persistence projection:

1. The owning `*-interfaces` repository contains the two independently human-authored authorities.
2. TJSV runs first and must establish current-input wire/schema parity. TypeSpec-emitted Schema B is evidence only.
3. `ores-contracts` independently parses those same reviewed source files and proves the persistence/codegen subset converges.
4. If language/runtime implementations exist, isolated adapters execute the reviewed fixture corpus and TJSV's runtime-conformance protocol binds their verdicts to the exact admitted Contract IR and parity receipt.
5. `ores-cli` or repository CI verifies all required evidence against immutable resolved dependency revisions before promotion.

A pure transport/value contract does not need to invent tables or ORM semantics merely to pass `ores-contracts`. The tool should be invoked only when the family declares persistence semantics covered by the supported subset.

## Conformance code boundary

TJSV already provides the generic runtime-conformance protocol, evidence schemas, current-input binding, finding fingerprints and final fail-closed decision. `ores-contracts` must not copy that implementation.

This repository may produce persistence witnesses that are later referenced by a broader admission/conformance process, but it must not decide whether Rust, Dart, TypeScript, Go, protobuf or another runtime accepts the same instance set. Runtime expectations belong to reviewed fixture corpora in the contract-owning repository; runtime adapters return verdicts only.

## Parser overlap is intentional but bounded

TJSV and `ores-contracts` both inspect TypeSpec and JSON Schema, but for different proofs:

- TJSV asks: **do these two authored sources admit the same wire/runtime contract?**
- `ores-contracts` asks: **for the persistence subset explicitly represented in both sources, do they converge to the same database/ORM/codegen semantics?**

The second parser must never weaken or reinterpret the first proof. Unknown annotations or unsupported constructs fail closed unless they are explicitly classified as non-persistence metadata and covered by tests. TJSV remains responsible for their wire/runtime meaning.

## Relationship to `ORESoftware/ores-interfaces`

`ORESoftware/ores-interfaces` now contains repository-owned shared contract families under `contracts/<family>/<version>/`, while also preserving a legacy compatibility package sourced from `ores-otel/ores-interfaces`. `ores-contracts` must not infer authority ownership from that legacy package.

When a shared contract eventually requires persistence semantics, `ores-interfaces` remains the authority owner and passes exact paths/revisions to this tool. When a product contract requires persistence semantics, the product `*-interfaces` repo remains the owner. In both cases this repository is a build/admission dependency only.

## Current compatibility witness

At reconciliation time, the compatible stack included:

- `ORESoftware/typespec-json-schema-validator@dd3418aa243198619abfd6106cea3540ef0bbb4f`
- `ORESoftware/ores-contracts@fef0b716d950f717c240504bd85d6f1732a383a0`
- `ORESoftware/ores-interfaces@74bee7c2e8b50f3438983031316f388df996ad80`

These hashes describe one reviewed integration state. Consumers must use their own immutable resolved dependency graph rather than treating these values as permanent floating policy.
