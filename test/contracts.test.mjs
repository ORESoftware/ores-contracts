import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, cpSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseTypeSpec } from '../src/parse-typespec.mjs';
import { parseJsonSchema } from '../src/parse-json-schema.mjs';
import { compare, canonical, ContractError } from '../src/ir.mjs';
import { renderTypeSpec, renderJsonSchema, EMITTERS } from '../src/emit/index.mjs';
import { loadConfig, check, generate, bootstrap } from '../src/cli.mjs';

const fx = new URL('./fixtures/', import.meta.url).pathname;
const tsp = () => parseTypeSpec(readFileSync(join(fx, 'typespec/main.tsp'), 'utf8'));
const js = () => parseJsonSchema(JSON.parse(readFileSync(join(fx, 'json-schema/contract.schema.json'), 'utf8')));
const quiet = { log: () => {} };
function scratch() { const d = mkdtempSync(join(tmpdir(), 'oc-')); cpSync(fx, d, { recursive: true }); return d; }

test('both authorities parse to the same IR', () => {
  assert.deepEqual(compare(tsp(), js()), []);
  assert.equal(canonical(tsp()), canonical(js()));
  const c = tsp();
  assert.deepEqual(c.models.map((m) => m.name), ['Customer', 'Invoice']);
  assert.deepEqual(c.models[1].fields.find((f) => f.name === 'customerId').references, { model: 'Customer', field: 'id' });
  assert.equal(c.models[0].fields.find((f) => f.name === 'tags').array, true);
});

test('every emitter is deterministic and lane-independent', () => {
  for (const [name, fn] of Object.entries(EMITTERS)) {
    const a = fn(tsp(), 'x'); const b = fn(js(), 'x');
    assert.equal(a, b, `${name} differs between lanes`);
    assert.equal(a, fn(tsp(), 'x'), `${name} not deterministic`);
  }
});

test('discrepancies are reported per field/model/enum, never silently picked', () => {
  const doc = JSON.parse(readFileSync(join(fx, 'json-schema/contract.schema.json'), 'utf8'));
  doc.$defs.InvoiceStatus.enum.push('void');
  doc.$defs.Invoice.properties.amountCents['x-ores-width'] = 32;
  delete doc.$defs.Customer.properties.tags; doc.$defs.Customer.required = doc.$defs.Customer.required.filter((x) => x !== 'tags');
  const diffs = compare(tsp(), parseJsonSchema(doc));
  assert.ok(diffs.some((d) => d.startsWith('enum InvoiceStatus: values differ')));
  assert.ok(diffs.some((d) => d.startsWith('field Invoice.amountCents.type')));
  assert.ok(diffs.some((d) => d === 'field Customer.tags: missing in json-schema'));
  assert.equal(diffs.length, 4); // enum-level + field-level views of the same enum change
});

test('parsers fail closed on unsupported constructs', () => {
  assert.throws(() => parseTypeSpec('namespace X;\nmodel A { @key id: uuid; x: float32; }'), ContractError);
  assert.throws(() => parseTypeSpec('namespace X;\n@Ores.table("a") model A { id: uuid; }'), /no primary key/);
  assert.throws(() => parseTypeSpec('namespace X;\n@Ores.table("a") model A { @key id: uuid; @Ores.references("B.id") b: uuid; }'), /unknown model B/);
  assert.throws(() => parseJsonSchema({ 'x-ores-namespace': 'X', $defs: { A: { type: 'object', 'x-ores-table': 'a', properties: {}, required: [] } } }), /sealed/);
  assert.throws(() => parseJsonSchema({ 'x-ores-namespace': 'X', $defs: { A: { type: 'object', additionalProperties: false, 'x-ores-table': 'a', 'x-ores-primary-key': ['id'], required: ['id'], properties: { id: { type: 'string', format: 'email' } } } } }), /unsupported string format/);
});

test('bootstrap round-trips: json-schema -> typespec draft -> same IR, and back', () => {
  const draft = renderTypeSpec(js(), 'note');
  assert.equal(canonical(parseTypeSpec(draft)), canonical(js()));
  const shadow = renderJsonSchema(tsp(), 'note');
  assert.equal(canonical(parseJsonSchema(shadow)), canonical(tsp()));
});

test('check → generate writes agreed artifacts; check refuses generate on mismatch', () => {
  const d = scratch();
  const cfg = loadConfig(join(d, 'contracts.config.json'));
  const r = check(cfg, quiet);
  assert.equal(r.status, 'passed');
  assert.ok(Object.values(r.artifacts).every((a) => a.byteParity));
  generate(cfg, quiet);
  assert.ok(existsSync(join(d, 'generated/sql/schema.sql')));
  assert.match(readFileSync(join(d, 'generated/rust/types.rs'), 'utf8'), /from both authorities/);
  // break parity
  const p = join(d, 'json-schema/contract.schema.json'); const doc = JSON.parse(readFileSync(p, 'utf8'));
  doc.$defs.Customer.properties.email.maxLength = 64; writeFileSync(p, JSON.stringify(doc));
  const r2 = check(cfg, quiet);
  assert.equal(r2.status, 'stopped_for_evaluation');
  assert.ok(r2.findings.some((f) => f.kind === 'authority-parity' && /maxLength/.test(f.detail)));
  assert.ok(r2.findings.some((f) => f.kind === 'artifact-parity' && /sql/.test(f.detail)));
  assert.throws(() => generate(cfg, quiet), /parity did not pass/);
});

test('bootstrap command refuses to overwrite without --force', () => {
  const d = scratch();
  const cfg = loadConfig(join(d, 'contracts.config.json'));
  assert.throws(() => bootstrap(cfg, 'json-schema', quiet), /--force/);
  bootstrap(cfg, 'json-schema', { ...quiet, force: true });
  assert.equal(canonical(parseTypeSpec(readFileSync(cfg.typespec, 'utf8'))), canonical(js()));
  assert.ok(existsSync(join(d, 'typespec/ores.tsp')) && existsSync(join(d, 'typespec/ores-decorators.js')));
});

test('generated TypeScript validator accepts valid and rejects invalid records', async () => {
  const d = scratch();
  const cfg = loadConfig(join(d, 'contracts.config.json'));
  generate(cfg, quiet);
  const m = await import(join(d, 'generated/typescript/validate.mjs'));
  assert.equal(m.validate('Customer', { id: '6f1e1c2a-1b2c-4d5e-8f90-1234567890ab', email: 'a@b.c', createdAt: '2026-09-04T00:00:00Z', tags: [] }).ok, true);
  const bad = m.validate('Invoice', { id: 'x', customerId: 'y', status: 'void', amountCents: 1.5, extra: 1 });
  assert.equal(bad.ok, false); assert.equal(bad.errors.length, 5);
  assert.equal(m.validate('Nope', {}).ok, false);
});
