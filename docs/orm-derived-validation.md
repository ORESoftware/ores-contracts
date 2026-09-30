# ORM-derived validation projections

This is the Rust equivalent of a `drizzle-zod` witness lane, with one important authority boundary: Diesel/SeaORM definitions are **derivative persistence evidence**, not a replacement for independently authored TypeSpec + JSON Schema.

`ores-orm-derive` reads the committed Diesel `table!` schema and SeaORM `DeriveEntityModel` source, normalizes both, and fails closed unless table/column/type/nullability/array/primary-key shape agrees. SeaORM `DeriveActiveEnum` metadata supplies enum values that Diesel's table schema cannot recover.

A public projection is never implicit. The policy file must explicitly allowlist every model and field that may leave `*-orm-core`. This prevents accidental publication of password hashes, tenancy columns, internal audit fields, soft-delete markers, secrets, or backend-only identifiers.

Example policy:

```json
{
  "source_namespace": "acme.persistence",
  "namespace": "acme.public.persistence",
  "models": {
    "User": {
      "name": "UserPublic",
      "fields": ["id", "email", "display_name", "status"]
    }
  }
}
```

Run from a private `*-orm-core` repository:

```sh
ores-orm-derive \
  --diesel generated/diesel/schema.rs \
  --seaorm generated/seaorm/entities.rs \
  --policy orm-derived.public.json \
  --out generated/orm-derived
```

Outputs are deterministic witnesses:

- Draft 2020-12 JSON Schema
- plain Rust Serde DTOs with `deny_unknown_fields`
- TypeScript Zod schemas/types
- Dart runtime validators
- Gleam decoders/types
- normalized ORM projection + SHA-256 receipt

Promotion rule: copy/publish these artifacts into `*-lib-core`, `*-clients`, or SDK packages only after the generated JSON Schema / language artifacts are admitted against the current TypeSpec + authored JSON Schema Contract IR using `typespec-json-schema-validator` language-boundary/projection evidence. `ores-wit` may then consume the same admitted Contract IR for WIT/bindgen projections; ORM source must not bypass TJSV and become a WIT authority.
