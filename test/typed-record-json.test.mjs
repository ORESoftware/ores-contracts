import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTypeSpec } from '../src/parse-typespec.mjs';
import { parseJsonSchema } from '../src/parse-json-schema.mjs';
import { compare, ContractError } from '../src/ir.mjs';

const typespec = `
namespace Demo.Sync;
@Ores.table("clocks")
model Clock {
  @key id: uuid;
  values: Record<int64>;
}
`;

const jsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  'x-ores-namespace': 'Demo.Sync',
  $defs: {
    Clock: {
      type: 'object',
      additionalProperties: false,
      'x-ores-table': 'clocks',
      'x-ores-primary-key': ['id'],
      required: ['id', 'values'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        values: {
          type: 'object',
          'x-ores-json': true,
          additionalProperties: { type: 'integer', 'x-ores-width': 64 },
        },
      },
    },
  },
};

test('typed Record scalar map keeps JSON persistence parity', () => {
  const fromTypeSpec = parseTypeSpec(typespec);
  const fromJsonSchema = parseJsonSchema(jsonSchema);
  assert.deepEqual(compare(fromTypeSpec, fromJsonSchema), []);
  const values = fromTypeSpec.models[0].fields.find((field) => field.name === 'values');
  assert.equal(values.type, 'json');
  assert.equal(values.array, false);
});

test('typed Record rejects unknown value types and nested map composition', () => {
  assert.throws(
    () => parseTypeSpec(`namespace X; @Ores.table("a") model A { @key id: uuid; value: Record<Missing>; }`),
    ContractError,
  );
  assert.throws(
    () => parseTypeSpec(`namespace X; @Ores.table("a") model A { @key id: uuid; value: Record<Record>; }`),
    ContractError,
  );
  assert.throws(
    () => parseTypeSpec(`namespace X; @Ores.table("a") model A { @key id: uuid; value: Record<int64>[]; }`),
    /arrays of Record<T>/,
  );
});
