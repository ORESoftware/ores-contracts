import { readFileSync } from 'node:fs';

const AUTHORITATIVE_CONSTANTS = Object.freeze({
  schema: 'ores.conformance.deviation-review/v1',
  decision: 'review_requested',
  scope: 'implementation_representation_only',
  observable_conformance: 'mandatory',
  security_policy_conformance: 'mandatory',
  annotation: '@ores-conformance-deviation',
});
const REQUIRED_EVIDENCE = Object.freeze([
  'id', 'repository', 'source_revision', 'source_path', 'operation_id',
  'language', 'runtime', 'reason', 'tracking_issue', 'expires_on',
  'positive_case_ids', 'negative_case_ids', 'contract_ir_digest',
]);

export function assertNonWaiverReviewContract(schema) {
  if (schema?.$schema !== 'https://json-schema.org/draft/2020-12/schema'
      || schema.$ref !== '#/$defs/DeviationReview'
      || Object.keys(schema.$defs ?? {}).join(',') !== 'DeviationReview') {
    throw new Error('deviation review must have one closed Draft 2020-12 authority');
  }
  const model = schema.$defs.DeviationReview;
  if (model?.type !== 'object' || model.unevaluatedProperties !== false
      || !model.properties || !Array.isArray(model.required)) {
    throw new Error('deviation review must be a closed required-field object');
  }
  const expected = [...Object.keys(AUTHORITATIVE_CONSTANTS), ...REQUIRED_EVIDENCE].sort();
  const actual = Object.keys(model.properties).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)
      || JSON.stringify(expected) !== JSON.stringify([...model.required].sort())) {
    throw new Error('review schema may not add exemptions or omit proof fields');
  }
  for (const [field, value] of Object.entries(AUTHORITATIVE_CONSTANTS)) {
    const def = model.properties[field];
    if (def?.const !== value || Object.keys(def).length !== 1) {
      throw new Error(field + ' cannot become a conformance bypass or alternate decision');
    }
  }
  for (const field of ['positive_case_ids', 'negative_case_ids']) {
    const prop = model.properties[field];
    if (prop?.type !== 'array' || prop.minItems !== 1 || prop.items?.type !== 'string') {
      throw new Error(field + ' must contain executable conformance case references');
    }
  }
  if (model.properties.source_revision?.pattern !== '^[a-f0-9]{40}$'
      || model.properties.contract_ir_digest?.pattern !== '^sha256:[a-f0-9]{64}$'
      || !Number.isSafeInteger(model.properties.reason?.minLength)
      || model.properties.reason.minLength < 32
      || model.properties.tracking_issue?.pattern
        !== '^https://github[.]com/[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+/issues/[1-9][0-9]*$') {
    throw new Error('source binding, reviewed issue, or rationale requirements have weakened');
  }
  return true;
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const path = process.argv[2] ?? 'contracts/implementation-deviation-review/authored.schema.json';
  assertNonWaiverReviewContract(JSON.parse(readFileSync(path, 'utf8')));
  console.log('deviation review cannot waive executable or security conformance');
}
