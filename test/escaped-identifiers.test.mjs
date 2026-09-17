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
  @doc("reserved keyword; exact wire name must survive")
  \`op\`: SyncOp;
  @TypeSpec.JsonSchema.extension("additionalProperties", #{ type: "integer", minimum: 0 })
  vectorClock: json;
}
`;

test('escaped TypeSpec keyword identifiers preserve the exact persistence and wire name', () => {
  const contract = parseTypeSpec(source, 'escaped.tsp');
  const event = contract.models.find((model) => model.name === 'Event');
  assert.ok(event);
  assert.equal(event.fields.find((field) => field.name === 'op')?.enumName, 'SyncOp');
  assert.equal(event.fields.find((field) => field.name === 'vectorClock')?.type, 'json');
  assert.match(EMITTERS['sql/schema.sql'](contract, 'test'), /\bop sync_op NOT NULL\b/);
  assert.match(EMITTERS['rust/types.rs'](contract, 'test'), /pub op: SyncOp/);
  assert.match(EMITTERS['typescript/types.d.ts'](contract, 'test'), /\bop: SyncOp;/);
});

test('balanced decorator object literals do not terminate a model body or split a field', () => {
  const contract = parseTypeSpec(source, 'decorator-object.tsp');
  const event = contract.models[0];
  assert.deepEqual(event.fields.map((field) => field.name), ['id', 'op', 'vectorClock']);
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

test('unbalanced model and field delimiters fail closed', () => {
  assert.throws(
    () => parseTypeSpec('namespace X; @Ores.table("x") model X { @key id: uuid; payload: json;', 'open.tsp'),
    /unterminated model body/,
  );
  assert.throws(
    () => parseTypeSpec('namespace X; @Ores.table("x") model X { @key id: uuid; @doc("oops" payload: json; }', 'bad-field.tsp'),
    /unterminated field declaration delimiter|unsupported field/,
  );
});
