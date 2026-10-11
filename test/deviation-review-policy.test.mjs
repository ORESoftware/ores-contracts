import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assertNonWaiverReviewContract } from '../scripts/assert-deviation-non-waiver.mjs';

const schema = JSON.parse(readFileSync(new URL('../contracts/implementation-deviation-review/authored.schema.json', import.meta.url)));
const mutation = (edit) => {
  const input = structuredClone(schema);
  edit(input.$defs.DeviationReview);
  return input;
};
test('independent authored contract remains structurally incapable of approving deviations', () => {
  assert.equal(assertNonWaiverReviewContract(schema), true);
});
for (const [name, mutate] of [
  ['adds bypass toggle', model => { model.properties.skip_conformance = { type: 'boolean' }; }],
  ['adds approved review decision', model => { model.properties.decision = { enum: ['review_requested', 'approved'] }; }],
  ['weakens wire policy', model => { model.properties.observable_conformance = { const: 'optional' }; }],
  ['weakens security policy', model => { model.properties.security_policy_conformance = { const: 'optional' }; }],
  ['admits unknown exception fields', model => { model.unevaluatedProperties = true; }],
  ['drops negative test references', model => { model.required = model.required.filter(x => x !== 'negative_case_ids'); }],
  ['allows empty positive test list', model => { model.properties.positive_case_ids.minItems = 0; }],
  ['accepts mutable branch as revision', model => { model.properties.source_revision.pattern = '^.*$'; }],
  ['relaxes Contract IR binding', model => { model.properties.contract_ir_digest.pattern = '^.*$'; }],
  ['allows short arbitrary rationale', model => { model.properties.reason.minLength = 1; }],
  ['accepts arbitrary review URL', model => { model.properties.tracking_issue.pattern = '^.*$'; }],
]) {
  test('reject policy mutation: ' + name, () => {
    assert.throws(() => assertNonWaiverReviewContract(mutation(mutate)));
  });
}
