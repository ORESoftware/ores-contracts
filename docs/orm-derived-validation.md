# ORM-derived validation projections

ORM-first Diesel/SeaORM parsing and derivative validation generation is owned by [`ORESoftware/ores-orm-core`](https://github.com/ORESoftware/ores-orm-core).

`ores-contracts` remains the **contract-first persistence convergence** engine:

```text
human TypeSpec ---------> persistence IR_T -----> SQL / SeaORM / Diesel / language witnesses
human JSON Schema -----> persistence IR_J -----> SQL / SeaORM / Diesel / language witnesses
                              |                         |
                              +---- convergence --------+
```

The inverse lane is deliberately separate:

```text
Diesel witness ----\
                    +----> ORESoftware/ores-orm-core ----> private derivative DTOs/validators
SeaORM witness ----/                         |
                                             +----> public candidates
                                                        |
                                           TJSV Contract IR admission
```

## Authority boundary

- Human-authored TypeSpec and Draft 2020-12 JSON Schema remain independent peer authorities.
- `typespec-json-schema-validator` owns generic semantic parity, Contract IR identity, current-input verification, and public projection admission decisions.
- `ores-contracts` owns contract-first persistence convergence for the supported persistence subset.
- `ores-orm-core` owns ORM-first Diesel/SeaORM normalization, convergence, derivative shapes, and Rust/TypeScript/Dart/Gleam/JSON-Schema candidate generation.
- `ores-wit` owns WIT syntax/canonicalization/binding orchestration downstream of admitted Contract IR.

Do not copy ORM parsers or ORM-first language emitters into this repository. Doing so creates two definitions of Diesel/SeaORM semantics and allows the implementations to drift.

Public ORM-derived candidates are **not** publishable merely because Contract IR or receipt bytes were attached or hashed. They remain blocked until the owning TJSV admission flow verifies the exact current Contract IR, receipt, source digests, and projection evidence.

See the `ORESoftware/ores-orm-core` README and `ORESoftware/orm-core-template.rs` for repository-family integration.
