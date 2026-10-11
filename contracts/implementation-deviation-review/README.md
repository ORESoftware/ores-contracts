# Implementation representation review: not a contract waiver

The required result for every released implementation remains 100% conformance
with independently authored TypeSpec and JSON Schema Draft 2020-12 contract
semantics. This contract models one *request for human review* of an internal
language-specific representation detail that is unusually difficult to express
identically across compilers. It never grants permission to change a wire
field, nullability, operation name, accepted/rejected instance, authentication,
authorization, privacy, idempotency, streaming cardinality, or error meaning.

Code comments such as `// @ores-conformance-deviation: rust-layout-0001`,
`# @ores-conformance-deviation: go-layout-0002`, or native attributes must
resolve to a repository-owned review document conforming to
`authored.schema.json`. The document carries the exact source SHA, path,
operation, TJSV Contract IR digest, issue URL, expiry, and positive and negative
fixture identifiers. Source comments are discoverable hints **only**: their
presence is never a bypass condition in codegen or runtime verification.

There is intentionally no `approved`, `skip`, `ignore`, `suppress`, or
`wire_exception` value in this review schema. The only decision is
`review_requested`, the only scope is `implementation_representation_only`,
and security plus observable conformance are always mandatory. This makes a
review record structurally incapable of declaring contract admission green.

The date field is an ISO-shaped review deadline, not an authorization to
release. The promotion controller must validate calendar dates and expiry
against its own trusted clock. It must also verify actual tests and source
hashes, not just a submitted review record. Missing evidence, stale revisions,
expired reviews, or a failed compiler/conformance corpus block promotion.

The TypeSpec and JSON Schema peers are independently authored and both must
pass TJSV parity. The generated schema and Contract IR are evidence only.
