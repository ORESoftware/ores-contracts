# Oreslang contract projection and runtime evidence (draft)

Repository: `ORESoftware/ores-contracts`.
Existing authority / implementation roots: `contracts/`, `typespec/`, `conformance/`, `src/emit/`, `templates/polyglot-headers/`.

**No runtime support or complete conformance is asserted by this PR.**

1. Preserve TypeSpec and JSON Schema Draft 2020-12 as separately authored,
   mutually verifying **peers**, never generated authority replacements.
   Reconcile disagreements explicitly. Generated Oreslang declarations and
   normalized IR are evidence, not a third authority.
2. Bind Oreslang projection to the exact current-input TypeSpec/JSON Schema
   TJSV parity receipt and Contract IR, pin the complete source closure, and
   fail closed on unsupported fields or semantics.
3. Preserve persistence model/DDL/ORM convergence across separately parsed TypeSpec and JSON Schema IRs; run the persistence `ores-contracts check` gate
   **when** a contract carries SQL/ORM semantics. For transport-only contracts
   do not synthesize SQL tables.
4. Build a real Oreslang JVM/GraalVM runtime adapter and test with positive
   **and negative** contract-owner fixtures, including null-vs-missing,
   enum/union, numeric boundaries, invalid property types, exceptions, wire
   roundtrip and state transitions. Compare against existing peer languages.
5. Publish a TJSV-conformant language/runtime receipt only on executed
   compiler tests with exact Git head SHA, compiler version, artifact digest,
   trusted corpus digests and ingress+egress verdicts.
6. Keep JS/browser and Wasm/browser output as independent future targets.
   Require transpiler checks, sandboxed browser execution and differential
   fixture tests before advertising support. No ambient Java host access.
7. Update participant governance and CI atomically when the actual adapter
   exists; do not register an untested mandatory language.

**Exit gate:** source-pair parity, native compiler/test, differential fixture
conformance and executed exact-head CI, with no unexplained TJSV findings.
This file is a blocked implementation/admission plan, not delivered runtime code.
