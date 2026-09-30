# interface-only contracts

Driver: `ORESoftware/ores-contracts#21`

This is a bounded review contract for one independently mergeable slice of the driver issue; it does not claim full issue closure.

## Invariants

- Interface-only packages may omit runtime/schema payloads only when the contract explicitly declares that mode.
- Config template paths resolve relative to the reviewed contract root, not the caller's ambient working directory.
- Unknown contract modes and ambiguous template paths fail closed.
- Generated consumers must preserve the same mode/path semantics across languages.

## Verification

- Verify the exact PR head with the repository's normal checks.
- Add/retain negative coverage for fail-closed behavior where this boundary is executable.
- Treat missing, skipped, or zero-step CI as missing evidence.
- Keep generated artifacts downstream of the reviewed authority.

## Non-goals

No credentials, branch-protection bypass, or unreviewed compatibility break is introduced by this contract slice.
