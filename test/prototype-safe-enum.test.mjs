import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTypeSpec } from '../src/parse-typespec.mjs';
import { parseJsonSchema } from '../src/parse-json-schema.mjs';
import { compare, ContractError } from '../src/ir.mjs';

function typespec(enumName, declareEnum) {
  return [
    'namespace Demo;',
    ...(declareEnum ? [`enum ${enumName} { Value: "ok" }`] : []),
    '@Ores.table("records")',
    'model Record {',
    '  @key id: int32;',
    `  status: ${enumName};`,
    '}',
  ].join('\n');
}

function jsonSchema(enumName, declareEnum) {
  const fields = {
    id: { type: 'integer' },
    status: { $ref: `#/$defs/${enumName}` },
  };
  const record = {
    type: 'object',
    additionalProperties: false,
    'x-ores-table': 'records',
    'x-ores-primary-key': ['id'],
    required: ['id', 'status'],
    properties: fields,
  };
  return {
    'x-ores-namespace': 'Demo',
    $defs: Object.fromEntries([
      ['Record', record],
      ...(declareEnum ? [[enumName, { type: 'string', enum: ['ok'] }]] : []),
    ]),
  };
}

for (const name of ['constructor', 'toString', '__proto__']) {
  test(`enum name ${name} is an own declaration in both authority parsers`, () => {
    const a = parseTypeSpec(typespec(name, true));
    const b = parseJsonSchema(jsonSchema(name, true));
    assert.deepEqual(compare(a, b), []);
    assert.equal(Object.hasOwn(a.enums, name), true);
    assert.equal(Object.hasOwn(b.enums, name), true);
    assert.deepEqual(a.enums[name], ['ok']);
    assert.deepEqual(b.enums[name], ['ok']);
    assert.equal(a.models[0].fields.find((field) => field.name === 'status').enumName, name);
  });

  test(`undeclared inherited name ${name} cannot satisfy an enum reference`, () => {
    assert.throws(() => parseTypeSpec(typespec(name, false)), ContractError);
    assert.throws(() => parseJsonSchema(jsonSchema(name, false)), ContractError);
  });
}

test('inherited JavaScript scalar property names are not persistence scalar types', () => {
  assert.throws(
    () => parseTypeSpec([
      'namespace Demo;',
      '@Ores.table("records")',
      'model Record { @key id: int32; bogus: hasOwnProperty; }',
    ].join('\n')),
    ContractError,
  );
});
