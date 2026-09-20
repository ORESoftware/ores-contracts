# Polyglot contract headers

ORES repositories that publish cross-language libraries should project their admitted contract surface into generated, read-only language headers for external consumers and implementation cross-checks.

## Authority and generation boundary

The authored authorities remain independent TypeSpec and JSON Schema Draft 2020-12 files under `contracts/`. Neither source generates or overrides the other.

The only permitted generation path is:

```text
contracts/main.tsp -----------------------------.
                                                 +--> TJSV parity receipt --> Contract IR
contracts/authored.schema.json ----------------'                              |
                                                                                v
                                                            polyglot header emitter
                                                                                |
                                                                                v
                                                               generated/headers/*
```

The Contract IR and generated headers are derived artifacts, never editable authorities. Generation MUST stop unless the current TJSV Contract IR is `passed`, `admissible: true`, self-digest-valid, receipt-bound to the retained current parity report, and complete for the declaration scope requested by the repository profile.

## Repository layout

```text
contracts/
  main.tsp
  authored.schema.json
  polyglot-header-profile.json        # optional repo-local projection policy

conformance/
  polyglot-headers.v1.json            # required target/check matrix
  headers/                            # compile adapters + external-consumer fixtures

generated/
  headers/
    manifest.json                     # provenance + exact output digest ledger
    typescript/index.d.ts
    rust/mod.rs
    go/header.go
    dart/header.dart
    ...
```

A repository may keep its TypeSpec/JSON Schema authorities at established paths; the profile records those paths rather than forcing relocation.

## Required baseline targets

For ORES polyglot libraries, the default required compile-surface targets are:

- Rust
- TypeScript
- Go
- Dart

Additional targets may include Python, Java, Kotlin, C#, Swift, C/C++, or Gleam. WIT and Protobuf are optional `wire-only` projections; they do not imply that every JSON Schema/TypeSpec constraint is representable in those formats.

## Generated header contract

Each generated file MUST be deterministic for the same Contract IR, generator revision, and options. The output manifest MUST bind:

- Contract IR schema and `irId`;
- retained parity receipt `runId`;
- generator name, version/revision, and options digest;
- the exact declaration IDs projected;
- each declaration assertion digest;
- every generated output path, media type, size, and SHA-256;
- reviewed representation-delta IDs, if any; and
- the conformance profile digest.

Generated files must carry a short machine-readable provenance comment where the language permits comments, but the manifest is the canonical output ledger.

## Conformance responsibilities

`conformance/` owns evidence, not contract authority. A passing polyglot-header check MUST prove all applicable items below:

1. **Clean regeneration** — regenerating from the current admitted Contract IR produces byte-identical files and no extra outputs.
2. **Declaration coverage** — the generated manifest exactly covers `requiredDeclarations`; partial or extra declaration sets fail closed.
3. **Compile surface** — each `compile-surface` target compiles or type-checks the generated header in an isolated consumer package.
4. **Implementation cross-check** — when enabled, the real implementation is checked against the generated public surface rather than merely compiling the generated header by itself.
5. **Wire fixtures** — representative positive and negative fixtures exercise serialization/validation parity where the target has runtime encoding behavior.
6. **External-consumer smoke** — targets marked `externalConsumer: true` must be consumable without repository-private modules or server-only dependencies.
7. **Representation losses** — unsupported semantics require an explicit reviewed delta bound to the current declaration assertion digest; silent weakening is forbidden.
8. **Path/output safety** — symlinked outputs, path traversal, duplicate output paths, stale owned files, or unowned files in the generated output set fail closed.

## Implementation cross-check patterns

Use native compile-time mechanisms where possible:

- TypeScript: generated `.d.ts` plus a `tsc --noEmit` adapter that assigns/imports the real exported implementation surface.
- Rust: generated public traits/types plus compile assertions or adapter implementations against the real crate exports.
- Go: generated interfaces/types plus `var _ Interface = (*Implementation)(nil)`-style compile assertions where applicable.
- Dart: generated interfaces/types plus analyzer/compile adapters against the package exports.

For data-only wire models, compile checks must be supplemented by canonical fixture validation because structural compilation alone cannot prove JSON naming, requiredness, enum values, numeric bounds, or other runtime constraints.

## Fleet rule

For `github.com/ORESoftware/ores-*` repositories that expose a public cross-language contract, new contract work should include the profile/matrix above and should publish generated headers only from admitted Contract IR. Repositories without a public polyglot surface should not invent placeholder headers merely to satisfy layout policy.
