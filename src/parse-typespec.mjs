// TypeSpec authority parser (supported subset — see docs/subset.md). The parser
// intentionally accepts only the bounded persistence projection and fails closed
// on anything outside that subset. Generic wire/schema equivalence belongs to TJSV.
import { field, model, finalize, ContractError, SCALARS } from './ir.mjs';

const DECORATOR_RE = /@([A-Za-z_][A-Za-z0-9_.]*)(?:\(([^)]*)\))?/g;
const ENUM_HEADER_RE = /\benum\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/g;
const MODEL_HEADER_RE = /((?:@[A-Za-z_][A-Za-z0-9_.]*(?:\([^)]*\))?\s*)*)\bmodel\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/g;

function stripComments(source, where) {
  let out = '';
  let quote = null;
  let escaped = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (quote !== null) {
      out += ch;
      if (escaped) { escaped = false; continue; }
      if (ch === '\\' && quote === '"') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === '`') {
      quote = ch;
      out += ch;
      continue;
    }

    if (ch === '/' && next === '/') {
      out += '  ';
      i++;
      while (i + 1 < source.length && source[i + 1] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }

    if (ch === '/' && next === '*') {
      out += '  ';
      i++;
      let closed = false;
      while (i + 1 < source.length) {
        const c = source[i + 1];
        const n = source[i + 2];
        if (c === '*' && n === '/') {
          out += '  ';
          i += 2;
          closed = true;
          break;
        }
        out += c === '\n' ? '\n' : ' ';
        i++;
      }
      if (!closed) throw new ContractError('unterminated block comment', where);
      continue;
    }

    out += ch;
  }
  return out;
}

function maskQuotedText(source) {
  let out = '';
  let quote = null;
  let escaped = false;
  for (const ch of source) {
    if (quote !== null) {
      if (escaped) {
        escaped = false;
        out += ch === '\n' ? '\n' : ' ';
        continue;
      }
      if (ch === '\\' && quote === '"') {
        escaped = true;
        out += ' ';
        continue;
      }
      if (ch === quote) {
        quote = null;
        out += ' ';
      } else {
        out += ch === '\n' ? '\n' : ' ';
      }
      continue;
    }
    if (ch === '"' || ch === '`') {
      quote = ch;
      out += ' ';
    } else {
      out += ch;
    }
  }
  return out;
}

function parseArgs(raw) {
  if (raw === undefined) return [];
  return [...raw.matchAll(/"([^"]*)"|(\d+)|([A-Za-z_][A-Za-z0-9_.]*)/g)]
    .map((m) => m[1] ?? (m[2] !== undefined ? Number(m[2]) : m[3]));
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

function persistenceIdentifier(raw, where) {
  if (!raw.startsWith('`')) return raw;
  if (!raw.endsWith('`') || raw.length < 3) {
    throw new ContractError(`invalid escaped identifier ${raw}`, where);
  }
  const value = raw.slice(1, -1);
  // Escaping exists only to preserve a legal wire/database identifier that collides
  // with TypeSpec syntax, e.g. `op`. It is not a path to broader identifier syntax.
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new ContractError(`unsupported escaped identifier ${raw}`, where);
  }
  return value;
}

function scanBalancedBody(source, openIndex, where, kind = 'model') {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (quote !== null) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\' && quote === '"') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return { body: source.slice(openIndex + 1, i), closeIndex: i };
      if (depth < 0) break;
    }
  }
  throw new ContractError(`unterminated ${kind} body`, where);
}

function splitStatements(body, where) {
  const out = [];
  let start = 0;
  let quote = null;
  let escaped = false;
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  let angle = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quote !== null) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\' && quote === '"') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '(') paren++;
    else if (ch === ')') paren--;
    else if (ch === '{') brace++;
    else if (ch === '}') brace--;
    else if (ch === '[') bracket++;
    else if (ch === ']') bracket--;
    else if (ch === '<') angle++;
    else if (ch === '>') angle--;
    else if (ch === ';' && paren === 0 && brace === 0 && bracket === 0 && angle === 0) {
      out.push(body.slice(start, i));
      start = i + 1;
    }
    if (paren < 0 || brace < 0 || bracket < 0 || angle < 0) {
      throw new ContractError('unbalanced field declaration delimiters', where);
    }
  }
  if (quote !== null || paren !== 0 || brace !== 0 || bracket !== 0 || angle !== 0) {
    throw new ContractError('unterminated field declaration delimiter', where);
  }
  if (body.slice(start).trim() !== '') {
    throw new ContractError('field declarations must end with a semicolon', where);
  }
  return out;
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
  const src = stripComments(source, where);
  const masked = maskQuotedText(src);
  const ns = masked.match(/\bnamespace\s+([A-Za-z_][A-Za-z0-9_.]*)\s*;/);
  if (!ns) throw new ContractError('missing `namespace X;`', where);

  const enums = {};
  ENUM_HEADER_RE.lastIndex = 0;
  let enumMatch;
  while ((enumMatch = ENUM_HEADER_RE.exec(masked)) !== null) {
    const name = enumMatch[1];
    const openIndex = ENUM_HEADER_RE.lastIndex - 1;
    const { body, closeIndex } = scanBalancedBody(src, openIndex, `${where}:enum ${name}`, 'enum');
    ENUM_HEADER_RE.lastIndex = closeIndex + 1;
    const values = [];
    for (const part of body.split(',')) {
      const t = part.trim(); if (!t) continue;
      const v = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*"([^"]*)"$/) ?? t.match(/^([A-Za-z_][A-Za-z0-9_]*)$/);
      if (!v) throw new ContractError(`unsupported enum member \`${t.replace(/\s+/g, ' ')}\``, `${where}:enum ${name}`);
      values.push(v[2] ?? v[1]);
    }
    if (!values.length) throw new ContractError('empty enum', `${where}:enum ${name}`);
    enums[name] = values;
  }

  const models = [];
  MODEL_HEADER_RE.lastIndex = 0;
  let m;
  while ((m = MODEL_HEADER_RE.exec(masked)) !== null) {
    const [, maskedDecoPrefix, name] = m;
    const prefixStart = m.index;
    const decoPrefix = src.slice(prefixStart, prefixStart + maskedDecoPrefix.length);
    const openIndex = MODEL_HEADER_RE.lastIndex - 1;
    const { body, closeIndex } = scanBalancedBody(src, openIndex, `${where}:model ${name}`);
    MODEL_HEADER_RE.lastIndex = closeIndex + 1;

    const decos = decoratorsOf(decoPrefix);
    const table = decos.find((d) => d.name === 'Ores.table' || d.name === 'table')?.args[0] ?? null;
    if (!table) throw new ContractError('model needs @Ores.table("name")', `${where}:model ${name}`);
    const unique = decos.filter((d) => d.name === 'Ores.unique' || d.name === 'unique').map((d) => csv(d.args[0]));
    const indexes = decos.filter((d) => d.name === 'Ores.index' || d.name === 'index').map((d) => csv(d.args[0]));
    const doc = decos.find((d) => d.name === 'doc')?.args[0] ?? null;
    const fields = []; const primaryKey = [];

    for (const stmt of splitStatements(body, `${where}:model ${name}`)) {
      const t = stmt.trim(); if (!t) continue;
      const fm = t.match(/^([\s\S]*?)(`[^`]+`|[A-Za-z_][A-Za-z0-9_]*)(\?)?\s*:\s*((?:Record<\s*[A-Za-z_][A-Za-z0-9_.]*\s*>)|[A-Za-z_][A-Za-z0-9_.]*)(\[\])?$/);
      if (!fm) throw new ContractError(`unsupported field \`${t.replace(/\s+/g, ' ')}\``, `${where}:model ${name}`);
      const [, prefix, rawFname, opt, typeExpr, arr] = fm;
      const fname = persistenceIdentifier(rawFname, `${where}:model ${name}`);
      const fd = decoratorsOf(prefix);
      const recordValue = recordValueType(typeExpr);
      const isEnum = !recordValue && !!enums[typeExpr];
      let persistenceType = null;
      if (recordValue) {
        const recordValueIsEnum = !!enums[recordValue];
        if (recordValue !== 'unknown' && !recordValueIsEnum && !SCALARS[recordValue]) {
          throw new ContractError(`unsupported Record value type ${recordValue}`, `${where}:${name}.${fname}`);
        }
        if (arr) throw new ContractError('arrays of Record<T> are outside the supported subset', `${where}:${name}.${fname}`);
        persistenceType = 'json';
      } else if (isEnum) {
        persistenceType = 'enum';
      } else {
        persistenceType = persistenceScalar(typeExpr, fd, `${where}:${name}.${fname}`);
        if (!SCALARS[persistenceType]) throw new ContractError(`unsupported type ${typeExpr}`, `${where}:${name}.${fname}`);
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
