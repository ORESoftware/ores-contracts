# Supported contract subset (v0.1)

Both authorities describe the same thing: persisted models with scalar fields,
enums, arrays of scalars/enums, primary keys, unique constraints, indexes and
foreign keys. Anything outside this subset fails closed in **both** parsers.

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
| string / maxLength | `string`, `@maxLength(n)` | `{ type: "string", maxLength: n }` |
| uuid | `uuid` | `{ type: "string", format: "uuid" }` |
| int32 / int64 | `int32` / `int64` | `{ type: "integer", "x-ores-width": 32|64 }` (default 32) |
| float64 | `float64` | `{ type: "number" }` |
| boolean | `boolean` | `{ type: "boolean" }` |
| utcDateTime / plainDate | `utcDateTime` / `plainDate` | `format: "date-time"` / `format: "date"` |
| bytes | `bytes` | `{ type: "string", format: "byte" }` |
| json | `json` | `{ type: "object", "x-ores-json": true }` |
| docs | `@doc("…")` | `description` |

Field names are camelCase in both authorities; SQL/Rust/Dart emitters
snake_case columns and fields, TypeScript keeps camelCase (matching the JSON
wire format, which Rust structs also use via `rename_all = "camelCase"`).
