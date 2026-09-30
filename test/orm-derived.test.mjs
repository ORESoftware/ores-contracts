import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schemaUrl = new URL('../contracts/orm-derived/v1/descriptor.schema.json', import.meta.url);
const exampleUrl = new URL('../contracts/orm-derived/v1/example.descriptor.json', import.meta.url);

const schema = JSON.parse(readFileSync(schemaUrl, 'utf8'));
const example = JSON.parse(readFileSync(exampleUrl, 'utf8'));

test('ORM derivative descriptor is explicitly downstream evidence', () => {
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(example.schema, 'ores.orm-descriptor/v1');
  assert.match(schema.$comment, /not an authored contract authority/i);
});

test('public projection policy is explicit and fail-closed by construction', () => {
  assert.equal(example.model.publicSurface, true);
  assert.ok(example.model.fields.length > 0);
  assert.ok(example.model.fields.every((field) => field.visibility !== 'unclassified'));

  const publicNames = example.model.fields
    .filter((field) => field.visibility === 'public')
    .map((field) => field.wireName);

  assert.deepEqual(publicNames, ['id', 'email', 'status']);
  assert.ok(!publicNames.includes('passwordHash'));
  assert.ok(!publicNames.includes('createdAt'));
});

test('insert/update eligibility differs from select nullability', () => {
  const fields = Object.fromEntries(example.model.fields.map((field) => [field.name, field]));

  assert.equal(fields.id.selectable, true);
  assert.equal(fields.id.insertable, false);
  assert.equal(fields.id.updatable, false);
  assert.equal(fields.id.generated, true);

  assert.equal(fields.email.nullable, false);
  assert.equal(fields.email.insertable, true);
  assert.equal(fields.email.updatable, true);

  assert.equal(fields.created_at.insertable, false);
  assert.equal(fields.created_at.updatable, false);
});

test('dual-ORM evidence names both adapters and pins an immutable revision', () => {
  assert.deepEqual(example.source.orm, ['seaorm', 'diesel']);
  assert.match(example.source.revision, /^[0-9a-f]{40}$/);
});
