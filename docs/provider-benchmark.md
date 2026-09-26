# Provider benchmark contract

This repository owns the provider-neutral benchmark wire contract shared by
ORES, BeamScale, Scintilla, and other deployment clients.

The contract deliberately separates **measurement execution** from **deployment
mutation**. A benchmark plan identifies the exact release, request corpus,
artifact receipts, resource profile, provider/region, pricing snapshot, and an
argv-only driver declaration. The driver produces one fresh target receipt.
An aggregate receipt combines targets and records whether the comparison is
actually apples-to-apples.

Wire schema identifiers:

- `ores.provider-benchmark.plan/v1`
- `ores.provider-benchmark.target-receipt/v1`
- `ores.provider-benchmark.aggregate-receipt/v1`

Both `typespec/provider-benchmark.tsp` and the three JSON Schema files under
`contracts/` are independently authored peer authorities. Neither is generated
from the other.

## Security and reproducibility requirements

Consumers should fail closed unless all of the following hold:

- driver invocation is argv-only; no shell evaluation;
- child environment is cleared and only an explicit allowlist is inherited;
- benchmark-owned identity variables cannot be overridden by the plan;
- receipt output is a fresh, root-confined, non-symlink regular file;
- target receipt identity exactly matches the plan;
- latency values are finite, non-negative, and ordered p50 <= p95 <= p99;
- request/error/throttle/cold/warm counts are internally consistent;
- billing basis is explicitly `measured` or `estimated`;
- billing currency and pricing date match the plan's pricing snapshot;
- comparisons with mismatched resource profiles are marked non-comparable.

Credentials and secret values are never part of this contract. Plans name only
environment variables that a driver may inherit.

## Compatibility

`ores-stack` shipped an earlier product-prefixed
`ores.stack.benchmark.*.v1` receipt vocabulary. That remains a compatibility
surface. New cross-product integrations should use this provider-neutral
contract and adapters may translate the older ORES representation without
changing benchmark semantics.
