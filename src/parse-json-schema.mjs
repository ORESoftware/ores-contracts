// JSON Schema 2020-12 authority parser (supported subset — docs/subset.md).
// One document per contract: `$defs` holds enums (string + enum) and models
// (object). Persistence metadata is carried in `x-ores-*` vendor keywords.
import { field, model, finalize, ContractError, SCALARS } from './ir.mjs';

const FORMAT_TO_TYPE = { uuid: 'uuid', 'date-time': 'utcDateTime', date: 'plainDate', byte: 'bytes' };

function scalarOf(schema, where) {
  const t = Array.isArray(schema.type) ? schema.type.filter((x) => x !== 'null') : [schema.type];
  if (t.length !== 1) throw new ContractError(`ambiguous type ${JSON.stringify(schema.type)}`, where);
  const [type] = t;
  const fmt = schema.format;
  if (type === 'string') {
    if (fmt && !FORMAT_TO_TYPE[fmt]) throw new ContractError(`unsupported string format ${fmt}`, where);
    return fmt ? FORMAT_TO_TYPE[fmt] : 'string';
  }
  if (type === 'integer') {
    const w = schema['x-ores-width'] ?? 32;
    if (w !== 32 && w !== 64) throw new ContractError('x-ores-width must be 32 or 64', where);
    return w === 64 ? 'int64' : 'int32';
  }
  if (type === 'number') return 'float64';
  if (type === 'boolean') return 'boolean';
  if (type === 'object' && schema['x-ores-json'] === true) return 'json';
  throw new ContractError(`unsupported type ${type}`, where);
}

export function parseJsonSchema(doc, where = 'schema.json') {
  if (!doc || typeof doc !== 'object') throw new ContractError('document must be an object', where);
  const ns = doc['x-ores-namespace'];
  if (typeof ns !== 'string') throw new ContractError('missing x-ores-namespace', where);
  const defs = doc.$defs;
  if (!defs || typeof defs !== 'object') throw new ContractError('missing $defs', where);

  const enums = {};
  for (const [name, s] of Object.entries(defs)) {
    if (Array.isArray(s.enum)) {
      if (s.type !== 'string' || !s.enum.every((v) => typeof v === 'string') || !s.enum.length) throw new ContractError('enum must be a non-empty string enum', `${where}:$defs.${name}`);
      enums[name] = [...s.enum];
    }
  }

  const models = [];
  for (const [name, s] of Object.entries(defs)) {
    if (Array.isArray(s.enum)) continue;
    if (s.type !== 'object') throw new ContractError('model must be type object', `${where}:$defs.${name}`);
    const table = s['x-ores-table'];
    if (typeof table !== 'string') throw new ContractError('missing x-ores-table', `${where}:$defs.${name}`);
    if (s.additionalProperties !== false) throw new ContractError('models must set additionalProperties:false (sealed)', `${where}:$defs.${name}`);
    const required = new Set(s.required ?? []);
    const props = s.properties ?? {};
    const fields = [];
    for (const [fname, p0] of Object.entries(props)) {
      const w = `${where}:$defs.${name}.${fname}`;
      let p = p0; let array = false;
      if (p.type === 'array') { array = true; p = p.items ?? {}; if (!p || typeof p !== 'object') throw new ContractError('array needs items', w); }
      const nullable = !required.has(fname) || (Array.isArray(p0.type) && p0.type.includes('null'));
      let type; let enumName = null; let enumValues = [];
      if (typeof p.$ref === 'string') {
        const ref = p.$ref.replace(/^#\/\$defs\//, '');
        if (!enums[ref]) throw new ContractError(`$ref must point at an enum in $defs (got ${p.$ref})`, w);
        type = 'enum'; enumName = ref; enumValues = enums[ref];
      } else type = scalarOf(p, w);
      const refSpec = p0['x-ores-references'] ?? p['x-ores-references'] ?? null;
      const refParts = refSpec ? String(refSpec).split('.') : null;
      if (refSpec && refParts.length !== 2) throw new ContractError('x-ores-references expects "Model.field"', w);
      fields.push(field({ name: fname, type, nullable, array, enumName, enumValues, maxLength: p.maxLength ?? null, references: refSpec ? { model: refParts[0], field: refParts[1] } : null, doc: p0.description ?? null }));
    }
    models.push(model({ name, table, primaryKey: s['x-ores-primary-key'] ?? [], unique: s['x-ores-unique'] ?? [], indexes: s['x-ores-indexes'] ?? [], fields, doc: s.description ?? null }));
  }
  if (!models.length) throw new ContractError('no models found', where);
  return finalize(ns, enums, models);
}
