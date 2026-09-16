// TypeSpec authority parser (supported subset — see docs/subset.md). Regex-based on
// purpose: it accepts exactly what the fleet persistence contract allows and fails
// closed on anything else. Generic wire/schema equivalence belongs to TJSV; this
// parser extracts only the bounded persistence projection plus ORES annotations.
import { field, model, finalize, ContractError, SCALARS } from './ir.mjs';

const DECORATOR_RE = /@([A-Za-z_][A-Za-z0-9_.]*)(?:\(([^)]*)\))?/g;

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function parseArgs(raw) {
  if (raw === undefined) return [];
  return [...raw.matchAll(/"([^"]*)"|(\d+)|([A-Za-z_][A-Za-z0-9_.]*)/g)].map((m) => m[1] ?? (m[2] !== undefined ? Number(m[2]) : m[3]));
}

/** Split `@a @b(x) name?: type;` blocks preceding a declaration into decorators. */
function decoratorsOf(prefix) {
  const out = [];
  for (const m of prefix.matchAll(DECORATOR_RE)) out.push({ name: m[1], args: parseArgs(m[2]) });
  return out;
}

function csv(s) { return String(s).split(',').map((x) => x.trim()).filter(Boolean); }

function recordValueType(typeExpr) {
  return /^Record<\s*([A-Za-z_][A-Za-z0-9_.]*)\s*>$/.exec(typeExpr)?.[1] ?? null;
}

function persistenceScalar(typeExpr, decorators, where) {
  const format = decorators.find((d) => d.name === 'format' || d.name === 'TypeSpec.format')?.args[0] ?? null;
  if (format !== null) {
    if (typeExpr !== 'string') throw new ContractError('@format persistence projection is only supported on string fields', where);
    if (format !== 'uuid') throw new ContractError(`unsupported persistence string format ${format}`, where);
    return 'uuid';
  }
  return typeExpr;
}

export function parseTypeSpec(source, where = 'main.tsp') {
  const src = stripComments(source);
  const ns = src.match(/\bnamespace\s+([A-Za-z_][A-Za-z0-9_.]*)\s*;/);
  if (!ns) throw new ContractError('missing `namespace X;`', where);

  const enums = {};
  for (const m of src.matchAll(/\benum\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*?)\}/g)) {
    const values = [];
    for (const line of m[2].split(/[,\n]/)) {
      const t = line.trim(); if (!t) continue;
      const v = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*"([^"]*)"$/) ?? t.match(/^([A-Za-z_][A-Za-z0-9_]*)$/);
      if (!v) throw new ContractError(`unsupported enum member \`${t}\``, `${where}:enum ${m[1]}`);
      values.push(v[2] ?? v[1]);
    }
    if (!values.length) throw new ContractError('empty enum', `${where}:enum ${m[1]}`);
    enums[m[1]] = values;
  }

  const models = [];
  const modelRe = /((?:@[A-Za-z_][A-Za-z0-9_.]*(?:\([^)]*\))?\s*)*)\bmodel\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([^}]*)\}/g;
  for (const m of src.matchAll(modelRe)) {
    const [, decoPrefix, name, body] = m;
    const decos = decoratorsOf(decoPrefix);
    const table = decos.find((d) => d.name === 'Ores.table' || d.name === 'table')?.args[0] ?? null;
    if (!table) throw new ContractError('model needs @Ores.table("name")', `${where}:model ${name}`);
    const unique = decos.filter((d) => d.name === 'Ores.unique' || d.name === 'unique').map((d) => csv(d.args[0]));
    const indexes = decos.filter((d) => d.name === 'Ores.index' || d.name === 'index').map((d) => csv(d.args[0]));
    const doc = decos.find((d) => d.name === 'doc')?.args[0] ?? null;
    const fields = []; const primaryKey = [];
    // fields: decorators may precede on the same or previous lines; split on ';'
    for (const stmt of body.split(';')) {
      const t = stmt.trim(); if (!t) continue;
      const fm = t.match(/^([\s\S]*?)([A-Za-z_][A-Za-z0-9_]*)(\?)?\s*:\s*((?:Record<\s*[A-Za-z_][A-Za-z0-9_.]*\s*>)|[A-Za-z_][A-Za-z0-9_.]*)(\[\])?$/);
      if (!fm) throw new ContractError(`unsupported field \`${t.replace(/\s+/g, ' ')}\``, `${where}:model ${name}`);
      const [, prefix, fname, opt, typeExpr, arr] = fm;
      const fd = decoratorsOf(prefix);
      const recordValue = recordValueType(typeExpr);
      const isEnum = !recordValue && !!enums[typeExpr];
      let persistenceType = null;
      if (recordValue) {
        const recordValueIsEnum = !!enums[recordValue];
        if (recordValue !== 'unknown' && !recordValueIsEnum && !SCALARS[recordValue]) {
          throw new ContractError(`unsupported Record value type ${recordValue}`, `${where}:${name}.${fname}`);
        }
        if (arr) {
          throw new ContractError('arrays of Record<T> are outside the supported subset', `${where}:${name}.${fname}`);
        }
        persistenceType = 'json';
      } else if (isEnum) {
        persistenceType = 'enum';
      } else {
        persistenceType = persistenceScalar(typeExpr, fd, `${where}:${name}.${fname}`);
        if (!SCALARS[persistenceType]) {
          throw new ContractError(`unsupported type ${typeExpr}`, `${where}:${name}.${fname}`);
        }
      }
      if (fd.some((d) => d.name === 'key')) primaryKey.push(fname);
      const ref = fd.find((d) => d.name === 'Ores.references' || d.name === 'references');
      const refParts = ref ? String(ref.args[0]).split('.') : null;
      if (ref && refParts.length !== 2) throw new ContractError('@Ores.references expects "Model.field"', `${where}:${name}.${fname}`);
      if (ref && recordValue) throw new ContractError('Record<T> fields cannot be foreign keys', `${where}:${name}.${fname}`);
      const maxLength = fd.find((d) => d.name === 'maxLength')?.args[0] ?? null;
      const fdoc = fd.find((d) => d.name === 'doc')?.args[0] ?? null;
      fields.push(field({
        name: fname,
        type: persistenceType,
        nullable: !!opt,
        array: !!arr,
        enumName: isEnum ? typeExpr : null,
        enumValues: isEnum ? enums[typeExpr] : [],
        maxLength,
        references: ref ? { model: refParts[0], field: refParts[1] } : null,
        doc: fdoc,
      }));
    }
    models.push(model({ name, table, primaryKey, unique, indexes, fields, doc }));
  }
  if (!models.length) throw new ContractError('no models found', where);
  return finalize(ns[1], enums, models);
}
