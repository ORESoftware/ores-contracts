import { readFileSync } from 'node:fs';

export const TJSV_PERSISTENCE_ADMISSION_SCHEMA = 'ores.contracts.tjsv-persistence-admission/v1';
const CONTRACT_IR_VERIFICATION_SCHEMA = 'ores.typespec-json-schema-validator.contract-ir-verification/v1';
const HEX_256 = /^[a-f0-9]{64}$/u;

function requireCondition(condition, message) {
  if (!condition) throw new Error(`STOPPED_FOR_EVALUATION: ${message}`);
}

function readJson(path, label) {
  let value;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`STOPPED_FOR_EVALUATION: cannot read ${label}: ${error.message}`, { cause: error });
  }
  return value;
}

function exactIdentities(values, label) {
  requireCondition(Array.isArray(values) && values.length > 0, `${label} must be a nonempty array`);
  const result = [];
  for (let index = 0; index < values.length; index++) {
    requireCondition(Object.hasOwn(values, index), `${label} contains a missing own element`);
    const value = values[index];
    requireCondition(typeof value === 'string' && value.trim() === value && value !== '', `${label} contains an invalid identity`);
    result.push(value);
  }
  requireCondition(new Set(result).size === result.length, `${label} contains duplicate identities`);
  return result.sort();
}

/**
 * Ask TJSV's canonical scope-aware consumer verifier to prove that a Contract IR
 * and parity report still bind to this checkout's exact source lanes. This
 * module deliberately does not reimplement Contract IR verification.
 *
 * `verifier` is an explicit test seam. Production callers resolve the reviewed
 * TJSV package subpath at build/admission time.
 */
export async function verifyTjsvPersistenceAdmission(cfg, verifier) {
  requireCondition(cfg?.tjsv && typeof cfg.tjsv === 'object', 'TJSV admission configuration is required');
  const expectedDeclarations = exactIdentities(cfg.tjsv.expectedDeclarations, 'tjsv.expectedDeclarations');
  if (verifier === undefined) {
    ({ verifyConsumerContract: verifier } = await import('@oresoftware/typespec-json-schema-validator/consumer-verification'));
  }
  requireCondition(typeof verifier === 'function', 'canonical TJSV consumer verifier is unavailable');

  const contractIr = readJson(cfg.tjsv.contractIr, 'TJSV Contract IR');
  const parityReport = readJson(cfg.tjsv.report, 'TJSV parity report');
  const verification = await verifier({
    contractIr,
    report: parityReport,
    typespec: cfg.typespec,
    generatedSchema: cfg.tjsv.generatedSchema,
    authoredSchema: cfg.jsonSchema,
    expectedDeclarations,
  });

  requireCondition(
    verification?.schema === CONTRACT_IR_VERIFICATION_SCHEMA
      && verification.status === 'passed'
      && verification.admissible === true,
    'TJSV current-input verification did not pass',
  );
  for (const key of ['suppliedIrId', 'computedIrId', 'expectedIrId', 'receiptRunId']) {
    requireCondition(typeof verification[key] === 'string' && HEX_256.test(verification[key]), `TJSV verification ${key} is invalid`);
  }
  requireCondition(
    verification.suppliedIrId === verification.computedIrId
      && verification.computedIrId === verification.expectedIrId,
    'TJSV Contract IR identities disagree',
  );
  const declarationIds = exactIdentities(verification.declarationIds, 'TJSV verified declarations');
  requireCondition(
    JSON.stringify(declarationIds) === JSON.stringify(expectedDeclarations),
    'TJSV verified declaration scope differs from persistence admission scope',
  );

  return Object.freeze({
    schema: TJSV_PERSISTENCE_ADMISSION_SCHEMA,
    status: 'passed',
    admissible: true,
    contractIrId: verification.expectedIrId,
    parityRunId: verification.receiptRunId,
    declarationIds: Object.freeze(declarationIds),
    sources: Object.freeze({
      typespec: cfg.typespec,
      generatedJsonSchema: cfg.tjsv.generatedSchema,
      authoredJsonSchema: cfg.jsonSchema,
    }),
  });
}

export function assertTjsvPersistenceAdmission(cfg, admission) {
  requireCondition(admission?.schema === TJSV_PERSISTENCE_ADMISSION_SCHEMA, 'missing or unrecognized TJSV persistence admission binding');
  requireCondition(admission.status === 'passed' && admission.admissible === true, 'TJSV persistence admission is not admissible');
  requireCondition(typeof admission.contractIrId === 'string' && HEX_256.test(admission.contractIrId), 'TJSV persistence admission has invalid Contract IR identity');
  requireCondition(typeof admission.parityRunId === 'string' && HEX_256.test(admission.parityRunId), 'TJSV persistence admission has invalid parity receipt identity');
  const declarations = exactIdentities(admission.declarationIds, 'TJSV persistence admission declarations');
  const expected = exactIdentities(cfg.tjsv.expectedDeclarations, 'tjsv.expectedDeclarations');
  requireCondition(JSON.stringify(declarations) === JSON.stringify(expected), 'TJSV persistence admission declaration scope is stale');
  requireCondition(admission.sources?.typespec === cfg.typespec, 'TJSV persistence admission TypeSpec path is stale');
  requireCondition(admission.sources?.generatedJsonSchema === cfg.tjsv.generatedSchema, 'TJSV persistence admission generated-schema path is stale');
  requireCondition(admission.sources?.authoredJsonSchema === cfg.jsonSchema, 'TJSV persistence admission authored-schema path is stale');
  return admission;
}
