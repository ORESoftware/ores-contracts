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

@doc("real model; docs may contain } braces and https://example.test/contracts")
@Ores.table("events")
@Ores.unique("op")
@Ores.index("op")
model Event {
  @key id: uuid;
  @doc("reserved keyword; exact wire name must survive")
  \`op\`: SyncOp;
  @TypeSpec.JsonSchema.extension("additionalProperties", #{ type: "integer", minimum: 0 })
  vectorClock: json;
}

/* model Fake { @key id: uuid; } */

@Ores.table("receipts")
model Receipt {
  @key id: uuid;
  @doc("a string can say model Shadow { and still be data")
  note: string;
}
`;

test('escaped TypeSpec keyword identifiers preserve the exact persistence and wire name', () => {
  const contract = parseTypeSpec(source, 'escaped.tsp');
  const event = contract.models.find((model) => model.name === 'Event');
  assert.ok(event);
  assert.equal(event.fields.find((field) => field.name === 'op')?.enumName, 'SyncOp');
  assert.equal(event.fields.find((field) => field.name === 'vectorClock')?.type, 'json');
  assert.deepEqual(event.unique, [['op']]);
  assert.deepEqual(event.indexes, [['op']]);
  assert.match(EMITTERS['sql/schema.sql'](contract, 'test'), /\bop sync_op NOT NULL\b/);
  assert.match(EMITTERS['rust/types.rs'](contract, 'test'), /pub op: SyncOp/);
  assert.match(EMITTERS['typescript/types.d.ts'](contract, 'test'), /\bop: SyncOp;/);
});

test('balanced decorator object literals do not terminate a model body or split a field', () => {
  const contract = parseTypeSpec(source, 'decorator-object.tsp');
  const event = contract.models.find((model) => model.name === 'Event');
  assert.deepEqual(event.fields.map((field) => field.name), ['id', 'op', 'vectorClock']);
});

test('quoted braces, semicolons, URLs, and model-like text remain data', () => {
  const contract = parseTypeSpec(source, 'quoted-data.tsp');
  assert.deepEqual(contract.models.map((model) => model.name), ['Event', 'Receipt']);
  assert.match(contract.models.find((model) => model.name === 'Event').doc, /https:\/\/example\.test\/contracts/);
  assert.equal(contract.models.some((model) => model.name === 'Fake' || model.name === 'Shadow'), false);
});

test('nested object literals inside decorators are structurally scanned', () => {
  const nested = `
namespace Example.Contracts;
@Ores.table("events")
model Event {
  @key id: uuid;
  @TypeSpec.JsonSchema.extension("shape", #{ outer: #{ inner: "}" }, note: "x;y" })
  payload: json;
}
`;
  const contract = parseTypeSpec(nested, 'nested.tsp');
  assert.deepEqual(contract.models[0].fields.map((field) => field.name), ['id', 'payload']);
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

test('escaped and plain spellings collide after normalization', () => {
  const duplicate = `
namespace Example.Contracts;
@Ores.table("events")
model Event {
  @key id: uuid;
  op: string;
  \`op\`: string;
}
`;
  assert.throws(() => parseTypeSpec(duplicate, 'duplicate.tsp'), /duplicate field names/);
});

test('field declarations require semicolons even when otherwise parseable', () => {
  const missing = `
namespace Example.Contracts;
@Ores.table("events")
model Event {
  @key id: uuid;
  note: string
}
`;
  assert.throws(() => parseTypeSpec(missing, 'missing-semicolon.tsp'), /must end with a semicolon/);
});

test('line and block comments can contain declaration-looking syntax safely', () => {
  const commented = `
namespace Example.Contracts;
// model Fake { @key id: uuid; }
@Ores.table("events")
model Event {
  @key id: uuid; // model AlsoFake { }
  /* @doc("}; model Nope {") */
  note: string;
}
`;
  const contract = parseTypeSpec(commented, 'comments.tsp');
  assert.deepEqual(contract.models.map((model) => model.name), ['Event']);
});

test('unterminated block comments fail closed', () => {
  assert.throws(
    () => parseTypeSpec('namespace X; /* never closes', 'comment.tsp'),
    /unterminated block comment/,
  );
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
