// Deterministic AttoLang *target contract*, not executable .atto source.
// The current AttoLang specification distinguishes target types from proven
// backend lowering. JSON is intentionally not silently retyped to 'any'.
const SCALAR_TYPES = Object.freeze({
  string: 'string', uuid: 'string', int32: 'i32', int64: 'int',
  float64: 'f64', boolean: 'bool', utcDateTime: 'string',
  plainDate: 'string', bytes: 'Array[u8]',
});
const RUNTIME_VALIDATORS = Object.freeze({
  uuid: 'uuid', utcDateTime: 'iso-8601-date-time', plainDate: 'iso-8601-date',
  int32: 'signed-32-bit-range', int64: 'signed-64-bit-range',
  float64: 'finite-f64', bytes: 'byte-array-0..255',
});
function projectField(field, enums) {
  if (field.enumName !== null && field.enumName !== undefined
    && !Object.hasOwn(enums, field.enumName)) {
    throw new TypeError(`unknown nominal enum ${field.enumName} for AttoLang field ${field.name}`);
  }
  const base = field.enumName ?? (Object.hasOwn(SCALAR_TYPES, field.type) ? SCALAR_TYPES[field.type] : null);
  const blocked = base === null;
  const elementType = field.array && base ? `Array[${base}]` : base;
  return {
    name: field.name,
    targetType: blocked ? null : (field.nullable ? `Option<${elementType}>` : elementType),
    status: blocked ? 'requires-explicit-type-admission' : 'target-only',
    sourceType: field.type,
    enumIdentity: field.enumName ?? null,
    nullable: field.nullable,
    array: field.array,
    runtimeValidation: Object.hasOwn(RUNTIME_VALIDATORS, field.type)
      ? RUNTIME_VALIDATORS[field.type] : null,
    maxLength: field.maxLength,
    references: field.references,
  };
}

export function emitAttoLangTarget(contract) {
  const target = {
    schema: 'ores.contracts.attolang.target/v1',
    canonicalLanguage: 'attolang',
    sourceExtension: '.atto',
    legacyExtension: '.ores',
    proofStatus: 'NOT_EXECUTED',
    claim: 'contract-type-projection-only',
    namespace: contract.namespace,
    enums: Object.entries(contract.enums).map(([name, values]) => ({
      name, nominal: true, values: [...values], status: 'target-only',
    })),
    models: contract.models.map((model) => ({
      name: model.name,
      table: model.table,
      primaryKey: [...model.primaryKey],
      unique: (model.unique ?? []).map((parts) => [...parts]),
      indexes: (model.indexes ?? []).map((parts) => [...parts]),
      fields: model.fields.map((field) => projectField(field, contract.enums)),
    })),
  };
  return JSON.stringify(target, null, 2) + '\n';
}
