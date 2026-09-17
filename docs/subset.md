# Supported contract subset (v0.1)

Both authorities describe the same thing: persisted models with scalar fields,
enums, arrays of scalars/enums, primary keys, unique constraints, indexes and
foreign keys. Typed `Record<T>` maps are also admitted as JSON persistence when
`T` is a supported scalar or enum; the independent runtime-schema lane remains
responsible for enforcing the dynamic-key value shape. Anything outside this
subset fails closed in **both** parsers.

| concept | TypeSpec | JSON Schema 2020-12 |
|---|---|---|
| namespace | `namespace Acme.Billing;` | `"x-ores-namespace": "Acme.Billing"` |
| enum | `enum S { A: "a", B: "b" }` | `$defs.S = { type: "string", enum: ["a","b"] }` |
| model / table | `@Ores.table("t") model M { … }` | `$defs.M = { type: "object", additionalProperties: false, "x-ores-table": "t", … }` |
| primary key | `@key` on field(s) | `"x-ores-primary-key": ["id"]` |
| unique | `@Ores.unique("a,b")` (repeatable) | `"x-ores-unique": [["a","b"]]` |
| index | `@Ores.index("a,b")` | `"x-ores-indexes": [["a","b"]]` |
| foreign key | `@Ores.references("M.field")` | `"x-ores-references": "M.field"` on the property |
| optional / nullable | `name?: T` | property not in `required` (or `type: [T, "null"]`) |
| array | `T[]` | `{ type: "array", items: … }` |
| typed JSON map | `Record<T>` for supported scalar/enum `T` | `{ type: "object", "x-ores-json": true, additionalProperties: <T schema> }` |
| string / maxLength | `string`, `@maxLength(n)` | `{ type: "string", maxLength: n }` |
| uuid | `uuid` | `{ type: "string", format: "uuid" }` |
| int32 / int64 | `int32` / `int64` | `{ type: "integer", "x-ores-width": 32|64 }` (default 32) |
| float64 | `float64` | `{ type: "number" }` |
| boolean | `boolean` | `{ type: "boolean" }` |
| utcDateTime / plainDate | `utcDateTime` / `plainDate` | `format: "date-time"` / `format: "date"` |
| bytes | `bytes` | `{ type: "string", format: "byte" }` |
| json | `json` | `{ type: "object", "x-ores-json": true }` |
| docs | `@doc("…")` | `description` |
| escaped field identifier | `` `op`: T `` → wire/persistence name `op` | ordinary property name `"op"` |

`Record<T>` is a persistence projection, not permission to ignore the value
schema. `ores-contracts` normalizes it to JSONB/JSON in generated persistence
artifacts; TJSV or another runtime-schema checker must still prove that the
TypeSpec and independently authored JSON Schema agree on the values accepted for
arbitrary keys. Nested `Record<Record<...>>`, arrays of records, and unknown
record value types remain outside the supported persistence subset.

TypeSpec field identifiers may be backtick-escaped only when the unescaped spelling is still a normal identifier. This exists for reserved words such as `` `op` `` and preserves the exact wire/database name; escaping does not admit punctuation, whitespace, or alternate wire spellings. The parser scans comments, quoted strings, decorator object literals, and model bodies structurally so declaration-looking text inside docs/comments cannot become a persistence declaration. Field declarations must end in semicolons and malformed delimiter/comment structure fails closed.

Field names are camelCase in both authorities; SQL/Rust/Dart emitters
snake_case columns and fields, TypeScript keeps camelCase (matching the JSON
wire format, which Rust structs also use via `rename_all = "camelCase"`).
