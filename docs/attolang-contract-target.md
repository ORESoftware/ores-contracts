# AttoLang contract target descriptor

`ores-contracts` emits `attolang/contract-target.json` from the exact same
parity-admitted intermediate representation as the SQL, Rust, TypeScript and
Dart outputs. The descriptor records canonical `.atto` source identity,
explicit `.ores` migration compatibility, nominal enum identities, nullable
`Option<T>` types, arrays and validation obligations.

The descriptor has `proofStatus: NOT_EXECUTED` by construction. It is **not**
a compiler-generated `.atto` implementation or a backend-parity receipt.
Unknown JSON/foreign types deliberately use `targetType: null` and
`requires-explicit-type-admission` rather than being converted into an
unsafe catch-all. Other target types still require checked compiler lowering.
Do not promote a descriptor to executable source without grammar, ownership,
representation and exact-head backend tests.

Run `npm test` for the positive, cross-authority and blocked-type cases.
New source-generation support must be separately reviewed against
`ores-truffle-oreslang/attolang-language-spec.md` before it can claim
Java/GraalVM, LLVM, Wasm, Forge or .NET execution.
