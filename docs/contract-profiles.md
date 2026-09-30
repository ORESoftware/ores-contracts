# Contract profiles

Tracking: #21.

`ores-contracts` supports two explicit admission profiles:

- `persistence` — the existing strict persistence model, including table/index/database semantics and persistence projections.
- `interfaces` — semantic parity for independently authored TypeSpec and Draft 2020-12 JSON Schema plus selected interface/language projections, without requiring persistence decorators.

The selected profile is part of deterministic receipt/evidence output and must never be inferred silently from missing decorators.

Config paths are resolved relative to the directory containing `contracts.config.json`. A config stored at `contracts/contracts.config.json` therefore refers to `typespec/main.tsp` and `json-schema/contract.schema.json`, not `contracts/typespec/...` from inside that file.

Generated evidence remains read-only; neither profile changes TypeSpec/JSON Schema peer authority.