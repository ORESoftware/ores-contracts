// Normalized intermediate representation shared by both authorities.
// Everything here is plain data; parsers produce it, emitters consume it,
// and parity is equality of canonical JSON.

export const SCALARS = Object.freeze({
  string: { sql: 'TEXT', rust: 'String', ts: 'string', dart: 'String', diesel: 'Text', seaorm: 'String' },
  uuid: { sql: 'UUID', rust: 'uuid::Uuid', ts: 'string', dart: 'String', diesel: 'Uuid', seaorm: 'Uuid' },
  int32: { sql: 'INTEGER', rust: 'i32', ts: 'number', dart: 'int', diesel: 'Int4', seaorm: 'i32' },
  int64: { sql: 'BIGINT', rust: 'i64', ts: 'number', dart: 'int', diesel: 'Int8', seaorm: 'i64' },
  float64: { sql: 'DOUBLE PRECISION', rust: 'f64', ts: 'number', dart: 'double', diesel: 'Float8', seaorm: 'f64' },
  boolean: { sql: 'BOOLEAN', rust: 'bool', ts: 'boolean', dart: 'bool', diesel: 'Bool', seaorm: 'bool' },
  utcDateTime: { sql: 'TIMESTAMPTZ', rust: 'chrono::DateTime<chrono::Utc>', ts: 'string', dart: 'DateTime', diesel: 'Timestamptz', seaorm: 'DateTimeWithTimeZone' },
  plainDate: { sql: 'DATE', rust: 'chrono::NaiveDate', ts: 'string', dart: 'DateTime', diesel: 'Date', seaorm: 'Date' },
  bytes: { sql: 'BYTEA', rust: 'Vec<u8>', ts: 'string', dart: 'List<int>', diesel: 'Bytea', seaorm: 'Vec<u8>' },
  json: { sql: 'JSONB', rust: 'serde_json::Value', ts: 'unknown', dart: 'Object?', diesel: 'Jsonb', seaorm: 'Json' },
});

export class ContractError extends Error {
  constructor(message, where) { super(where ? `${where}: ${message}` : message); this.name = 'ContractError'; this.where = where; }
}

/**
 * @typedef {{ name: string, type: string, nullable: boolean, array: boolean, enumName: string|null, enumValues: string[], maxLength: number|null, references: {model: string, field: string}|null, doc: string|null }} Field
 * @typedef {{ name: string, table: string, primaryKey: string[], unique: string[][], indexes: string[][], fields: Field[], doc: string|null }} Model
 * @typedef {{ namespace: string, enums: Record<string,string[]>, models: Model[] }} Contract
 */

export function field(partial) {
  return Object.freeze({
    name: partial.name, type: partial.type, nullable: !!partial.nullable, array: !!partial.array,
    enumName: partial.enumName ?? null, enumValues: Object.freeze([...(partial.enumValues ?? [])]),
    maxLength: partial.maxLength ?? null, references: partial.references ? Object.freeze({ ...partial.references }) : null,
    doc: partial.doc ?? null,
  });
}

export function model(partial) {
  return Object.freeze({
    name: partial.name, table: partial.table, primaryKey: Object.freeze([...(partial.primaryKey ?? [])]),
    unique: Object.freeze((partial.unique ?? []).map((u) => Object.freeze([...u]))),
    indexes: Object.freeze((partial.indexes ?? []).map((u) => Object.freeze([...u]))),
    fields: Object.freeze([...(partial.fields ?? [])]), doc: partial.doc ?? null,
  });
}

/** Validate cross-references and produce a frozen, sorted contract. Throws ContractError. */
export function finalize(namespace, enums, models) {
  const byName = new Map(models.map((m) => [m.name, m]));
  for (const m of models) {
    const names = new Set(m.fields.map((f) => f.name));
    if (names.size !== m.fields.length) throw new ContractError('duplicate field names', m.name);
    for (const k of m.primaryKey) if (!names.has(k)) throw new ContractError(`primary key references unknown field ${k}`, m.name);
    if (m.primaryKey.length === 0) throw new ContractError('model has no primary key', m.name);
    for (const u of m.unique) for (const k of u) if (!names.has(k)) throw new ContractError(`unique references unknown field ${k}`, m.name);
    for (const f of m.fields) {
      if (f.enumName && !enums[f.enumName]) throw new ContractError(`unknown enum ${f.enumName}`, `${m.name}.${f.name}`);
      if (!f.enumName && !SCALARS[f.type]) throw new ContractError(`unsupported type ${f.type}`, `${m.name}.${f.name}`);
      if (f.references) {
        const t = byName.get(f.references.model);
        if (!t) throw new ContractError(`references unknown model ${f.references.model}`, `${m.name}.${f.name}`);
        const tf = t.fields.find((x) => x.name === f.references.field);
        if (!tf) throw new ContractError(`references unknown field ${f.references.model}.${f.references.field}`, `${m.name}.${f.name}`);
        if (tf.type !== f.type || tf.array || f.array) throw new ContractError(`reference type mismatch (${f.type} vs ${tf.type})`, `${m.name}.${f.name}`);
      }
    }
  }
  const tables = new Set(models.map((m) => m.table));
  if (tables.size !== models.length) throw new ContractError('duplicate table names', namespace);
  return Object.freeze({
    namespace,
    enums: Object.freeze(Object.fromEntries(Object.keys(enums).sort().map((k) => [k, Object.freeze([...enums[k]])]))),
    models: Object.freeze([...models].sort((a, b) => a.name.localeCompare(b.name))),
  });
}

/** Canonical JSON: stable key order so two authorities compare byte-for-byte. */
export function canonical(value) {
  return JSON.stringify(value, (_, v) => (v && typeof v === 'object' && !Array.isArray(v)) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v, 2);
}

/** Structural diff of two contracts. Returns a list of human-readable discrepancies (empty = parity). */
export function compare(a, b, labelA = 'typespec', labelB = 'json-schema') {
  const out = [];
  if (a.namespace !== b.namespace) out.push(`namespace: ${labelA}=${a.namespace} ${labelB}=${b.namespace}`);
  for (const k of new Set([...Object.keys(a.enums), ...Object.keys(b.enums)])) {
    if (!a.enums[k]) out.push(`enum ${k}: missing in ${labelA}`);
    else if (!b.enums[k]) out.push(`enum ${k}: missing in ${labelB}`);
    else if (canonical(a.enums[k]) !== canonical(b.enums[k])) out.push(`enum ${k}: values differ (${labelA}=[${a.enums[k]}] ${labelB}=[${b.enums[k]}])`);
  }
  const am = new Map(a.models.map((m) => [m.name, m])); const bm = new Map(b.models.map((m) => [m.name, m]));
  for (const k of new Set([...am.keys(), ...bm.keys()])) {
    const x = am.get(k), y = bm.get(k);
    if (!x) { out.push(`model ${k}: missing in ${labelA}`); continue; }
    if (!y) { out.push(`model ${k}: missing in ${labelB}`); continue; }
    for (const p of ['table', 'primaryKey', 'unique', 'indexes']) if (canonical(x[p]) !== canonical(y[p])) out.push(`model ${k}.${p}: ${labelA}=${JSON.stringify(x[p])} ${labelB}=${JSON.stringify(y[p])}`);
    const xf = new Map(x.fields.map((f) => [f.name, f])); const yf = new Map(y.fields.map((f) => [f.name, f]));
    for (const fn of new Set([...xf.keys(), ...yf.keys()])) {
      const f = xf.get(fn), g = yf.get(fn);
      if (!f) { out.push(`field ${k}.${fn}: missing in ${labelA}`); continue; }
      if (!g) { out.push(`field ${k}.${fn}: missing in ${labelB}`); continue; }
      for (const p of ['type', 'nullable', 'array', 'enumName', 'enumValues', 'maxLength', 'references']) {
        if (canonical(f[p]) !== canonical(g[p])) out.push(`field ${k}.${fn}.${p}: ${labelA}=${JSON.stringify(f[p])} ${labelB}=${JSON.stringify(g[p])}`);
      }
    }
  }
  return out;
}
