// TypeSpec authority parser (supported subset — see docs/subset.md). Regex-based on
// purpose: it accepts exactly what the fleet persistence contract allows and fails
// closed on anything else. Generic wire/schema equivalence belongs to TJSV; this
// parser extracts only the bounded persistence projection plus ORES annotations.
import { field, model, finalize, ContractError, SCALARS } from './ir.mjs';

const DECORATOR_RE = /@([A-Za-z_][A-Za-z0-9_.]*)(?:\(([^)]*)\))?/g;
const MODEL_DECORATORS = new Set([
  'Ores.table', 'table',
  'Ores.unique', 'unique',
  'Ores.index', 'index',
  'doc', 'TypeSpec.doc',
]);
const FIELD_DECORATORS = new Set([
  'key', 'TypeSpec.key',
  'format', 'TypeSpec.format',
  'Ores.references', 'references',
  'maxLength', 'TypeSpec.maxLength',
  'doc', 'TypeSpec.doc',
]);

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
  for (const m of prefix.matchAll(DECORATOR_RE)) {
    out.push({ name: m[1], args: parseArgs(m[2]), rawArgs: m[2] });
  }
  return out;
}

function csv(s) { return String(s).split(',').map((x) => x.trim()).filter(Boolean); }

function assertKnownDecorators(decorators, allowed, where) {
  for (const decorator of decorators) {
    if (!allowed.has(decorator.name)) {
      throw new ContractError(`unsupported decorator @${decorator.name}`, where);
    }
  }
}

function matchingDecorators(decorators, names) {
  const accepted = new Set(names);
  return decorators.filter((decorator) => accepted.has(decorator.name));
}

function atMostOneDecorator(decorators, names, label, where) {
  const matches = matchingDecorators(decorators, names);
  if (matches.length > 1) throw new ContractError(`${label} may appear at most once`, where);
  return matches[0] ?? null;
}

function oneArgument(decorator, label, where) {
  if (!decorator || decorator.args.length !== 1 || decorator.args[0] === undefined || decorator.args[0] === '') {
    throw new ContractError(`${label} expects exactly one argument`, where);
  }
  return decorator.args[0];
}

function recordValueType(typeExpr) {
  return /^Record<\s*([A-Za-z_][A-Za-z0-9_.]*)\s*>$/.exec(typeExpr)?.[1] ?? null;
}

function persistenceScalar(typeExpr, decorators, where) {
  const formatDecorator = atMostOneDecorator(
    decorators,
    ['format', 'TypeSpec.format'],
    '@format',
    where,
  );
  if (formatDecorator) {
    const format = oneArgument(formatDecorator, '@format', where);
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
    const modelWhere = `${where}:model ${name}`;
    const decos = decoratorsOf(decoPrefix);
    assertKnownDecorators(decos, MODEL_DECORATORS, modelWhere);

    const tableDecorator = atMostOneDecorator(decos, ['Ores.table', 'table'], '@Ores.table', modelWhere);
    const table = tableDecorator ? oneArgument(tableDecorator, '@Ores.table', modelWhere) : null;
    if (!table) throw new ContractError('model needs @Ores.table("name")', modelWhere);

    const unique = matchingDecorators(decos, ['Ores.unique', 'unique']).map((decorator) =>
      csv(oneArgument(decorator, '@Ores.unique', modelWhere)));
    const indexes = matchingDecorators(decos, ['Ores.index', 'index']).map((decorator) =>
      csv(oneArgument(decorator, '@Ores.index', modelWhere)));
    if (unique.some((columns) => columns.length === 0)) throw new ContractError('@Ores.unique requires at least one field', modelWhere);
    if (indexes.some((columns) => columns.length === 0)) throw new ContractError('@Ores.index requires at least one field', modelWhere);

    const docDecorator = atMostOneDecorator(decos, ['doc', 'TypeSpec.doc'], '@doc', modelWhere);
    const doc = docDecorator ? oneArgument(docDecorator, '@doc', modelWhere) : null;
    const fields = []; const primaryKey = [];
    // fields: decorators may precede on the same or previous lines; split on ';'
    for (const stmt of body.split(';')) {
      const t = stmt.trim(); if (!t) continue;
      const fm = t.match(/^([\s\S]*?)([A-Za-z_][A-Za-z0-9_]*)(\?)?\s*:\s*((?:Record<\s*[A-Za-z_][A-Za-z0-9_.]*\s*>)|[A-Za-z_][A-Za-z0-9_.]*)(\[\])?$/);
      if (!fm) throw new ContractError(`unsupported field \`${t.replace(/\s+/g, ' ')}\``, modelWhere);
      const [, prefix, fname, opt, typeExpr, arr] = fm;
      const fieldWhere = `${where}:${name}.${fname}`;
      const fd = decoratorsOf(prefix);
      assertKnownDecorators(fd, FIELD_DECORATORS, fieldWhere);
      const keyDecorator = atMostOneDecorator(fd, ['key', 'TypeSpec.key'], '@key', fieldWhere);
      if (keyDecorator && keyDecorator.args.length !== 0) throw new ContractError('@key does not accept arguments', fieldWhere);
      const ref = atMostOneDecorator(fd, ['Ores.references', 'references'], '@Ores.references', fieldWhere);
      const maxLengthDecorator = atMostOneDecorator(fd, ['maxLength', 'TypeSpec.maxLength'], '@maxLength', fieldWhere);
      const fieldDocDecorator = atMostOneDecorator(fd, ['doc', 'TypeSpec.doc'], '@doc', fieldWhere);

      const recordValue = recordValueType(typeExpr);
      const isEnum = !recordValue && !!enums[typeExpr];
      let persistenceType = null;
      if (recordValue) {
        const recordValueIsEnum = !!enums[recordValue];
        if (recordValue !== 'unknown' && !recordValueIsEnum && !SCALARS[recordValue]) {
          throw new ContractError(`unsupported Record value type ${recordValue}`, fieldWhere);
        }
        if (arr) {
          throw new ContractError('arrays of Record<T> are outside the supported subset', fieldWhere);
        }
        persistenceType = 'json';
      } else if (isEnum) {
        persistenceType = 'enum';
      } else {
        persistenceType = persistenceScalar(typeExpr, fd, fieldWhere);
        if (!SCALARS[persistenceType]) {
          throw new ContractError(`unsupported type ${typeExpr}`, fieldWhere);
        }
      }
      if (keyDecorator) primaryKey.push(fname);

      const refTarget = ref ? oneArgument(ref, '@Ores.references', fieldWhere) : null;
      const refParts = ref ? String(refTarget).split('.') : null;
      if (ref && refParts.length !== 2) throw new ContractError('@Ores.references expects "Model.field"', fieldWhere);
      if (ref && recordValue) throw new ContractError('Record<T> fields cannot be foreign keys', fieldWhere);

      const maxLength = maxLengthDecorator ? oneArgument(maxLengthDecorator, '@maxLength', fieldWhere) : null;
      if (maxLength !== null && (!Number.isSafeInteger(maxLength) || maxLength < 0)) {
        throw new ContractError('@maxLength expects a non-negative integer', fieldWhere);
      }
      const fdoc = fieldDocDecorator ? oneArgument(fieldDocDecorator, '@doc', fieldWhere) : null;
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
