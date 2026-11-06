import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTypeSpec } from '../src/parse-typespec.mjs';
import { parseJsonSchema } from '../src/parse-json-schema.mjs';
import { emitAttoLangTarget } from '../src/emit/attolang.mjs';
import { EMITTERS } from '../src/emit/index.mjs';

const root = new URL('./fixtures/', import.meta.url);
const tsp = () => parseTypeSpec(readFileSync(new URL('typespec/main.tsp', root), 'utf8'));
const schema = () => parseJsonSchema(JSON.parse(readFileSync(new URL('json-schema/contract.schema.json', root), 'utf8')));

test('AttoLang target descriptor has exact authority parity, no fabricated compilation proof', () => {
  const a = emitAttoLangTarget(tsp());
  const b = emitAttoLangTarget(schema());
  assert.equal(a, b);
  const target = JSON.parse(a);
  assert.equal(target.schema, 'ores.contracts.attolang.target/v1');
  assert.equal(target.canonicalLanguage, 'attolang');
  assert.equal(target.sourceExtension, '.atto');
  assert.equal(target.legacyExtension, '.ores');
  assert.equal(target.proofStatus, 'NOT_EXECUTED');
  assert.equal(target.claim, 'contract-type-projection-only');
  assert.ok(target.models.length > 0);
  assert.equal(EMITTERS['attolang/contract-target.json'](tsp(), 'typespec'), a);
});

test('AttoLang target types preserve optional, array, enum and validation requirements', () => {
  const descriptor = emitAttoLangTarget({
    namespace: 'X',
    enums: { Mode: ['ready', 'paused'] },
    models: [{ name: 'Sample', table: 'samples', primaryKey: ['id'], fields: [
      { name: 'id', type: 'uuid', nullable: false, array: false, enumName: null, maxLength: null, references: null },
      { name: 'maybe', type: 'int64', nullable: true, array: false, enumName: null, maxLength: null, references: null },
      { name: 'modes', type: 'string', nullable: false, array: true, enumName: 'Mode', maxLength: null, references: null },
      { name: 'opaque', type: 'json', nullable: false, array: false, enumName: null, maxLength: null, references: null },
    ] }],
  });
  const target = JSON.parse(descriptor);
  const fields = Object.fromEntries(target.models[0].fields.map((field) => [field.name, field]));
  assert.equal(fields.id.targetType, 'string');
  assert.equal(fields.id.runtimeValidation, 'uuid');
  assert.equal(fields.maybe.targetType, 'Option<int>');
  assert.equal(fields.modes.targetType, 'Array[Mode]');
  assert.equal(fields.modes.enumIdentity, 'Mode');
  assert.deepEqual(target.enums[0].values, ['ready', 'paused']);
  assert.equal(target.enums[0].nominal, true);
  assert.equal(fields.opaque.targetType, null);
  assert.equal(fields.opaque.status, 'requires-explicit-type-admission');
});
