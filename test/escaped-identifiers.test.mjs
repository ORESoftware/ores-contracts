import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTypeSpec } from '../src/parse-typespec.mjs';
import { EMITTERS } from '../src/emit/index.mjs';

const source = `
namespace Example.Contracts;

enum SyncOp {
  Upsert: "upsert",
  Delete: "delete",
}

@Ores.table("events")
model Event {
  @key id: uuid;
  \`op\`: SyncOp;
}
`;

test('escaped TypeSpec keyword identifiers preserve the exact persistence and wire name', () => {
  const contract = parseTypeSpec(source, 'escaped.tsp');
  const event = contract.models.find((model) => model.name === 'Event');
  assert.ok(event);
  assert.equal(event.fields.find((field) => field.name === 'op')?.enumName, 'SyncOp');
  assert.match(EMITTERS['sql/schema.sql'](contract, 'test'), /\bop sync_op NOT NULL\b/);
  assert.match(EMITTERS['rust/types.rs'](contract, 'test'), /pub op: SyncOp/);
  assert.match(EMITTERS['typescript/types.d.ts'](contract, 'test'), /\bop: SyncOp;/);
});

test('escaped identifiers remain bounded to normal identifier spelling', () => {
  const invalid = `
namespace Example.Contracts;
@Ores.table("events")
model Event {
  @key id: uuid;
  \`not-a-wire-name\`: string;
}
`;
  assert.throws(() => parseTypeSpec(invalid, 'invalid.tsp'), /unsupported escaped identifier/);
});
