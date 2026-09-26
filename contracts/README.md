# Contracts

This directory is the repository-local contract boundary.

When this repository owns structured interfaces, keep independently authored TypeSpec and JSON Schema Draft 2020-12 authorities here. Neither authority may silently overwrite or generate the other. Reuse shared ORES contracts instead of copying them into a competing local schema.

Polyglot header files are downstream projections, not authorities. A repository may keep a `polyglot-header-profile.json` here to describe how an already-admitted Contract IR is projected, but generated Rust/TypeScript/Go/Dart/etc. headers belong under `generated/` and their executable proof belongs under `conformance/`. See `docs/polyglot-headers.md`.

Do not invent a contract merely to populate this directory; add package-specific authorities here only when this repository actually owns them.

## Provider benchmark receipts

The shared provider-neutral performance/cost comparison authority is documented
in [docs/provider-benchmark.md](../docs/provider-benchmark.md) and expressed by
`provider-benchmark-*.schema.json` plus the independent TypeSpec peer authority
at `typespec/provider-benchmark.tsp`.
