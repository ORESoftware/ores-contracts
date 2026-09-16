import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, check, checkAdmitted } from '../src/cli.mjs';
import { TJSV_PERSISTENCE_ADMISSION_SCHEMA } from '../src/tjsv-admission.mjs';

const fx = new URL('./fixtures/', import.meta.url).pathname;
const quiet = { log: () => {} };
const hex = (char) => char.repeat(64);

function scratchWithTjsv(extra = {}) {
  const root = mkdtempSync(join(tmpdir(), 'oc-tjsv-'));
  cpSync(fx, root, { recursive: true });
  writeFileSync(join(root, 'contract-ir.json'), JSON.stringify({ schema: 'fixture-ir' }));
  writeFileSync(join(root, 'parity-report.json'), JSON.stringify({ runId: hex('b') }));
  writeFileSync(join(root, 'generated.schema.json'), JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema' }));
  const original = JSON.parse(readFileSync(join(root, 'contracts.config.json'), 'utf8'));
  writeFileSync(join(root, 'contracts.config.json'), JSON.stringify({
    ...original,
    tjsv: {
      contractIr: 'contract-ir.json',
      report: 'parity-report.json',
      generatedSchema: 'generated.schema.json',
      expectedDeclarations: ['Demo.Invoice', 'Demo.Customer'],
      ...extra,
    },
  }));
  return root;
}

function passedVerification() {
  return {
    schema: 'ores.typespec-json-schema-validator.contract-ir-verification/v1',
    status: 'passed',
    admissible: true,
    suppliedIrId: hex('a'),
    computedIrId: hex('a'),
    expectedIrId: hex('a'),
    receiptRunId: hex('b'),
    declarationIds: ['Demo.Customer', 'Demo.Invoice'],
  };
}

test('configured TJSV evidence is mandatory for the synchronous persistence gate', () => {
  const root = scratchWithTjsv();
  const cfg = loadConfig(join(root, 'contracts.config.json'));
  const receipt = check(cfg, quiet);
  assert.equal(receipt.status, 'stopped_for_evaluation');
  assert.ok(receipt.findings.some((finding) => finding.kind === 'tjsv-admission'));
});

test('canonical verifier binds exact current source lanes before persistence parity can pass', async () => {
  const root = scratchWithTjsv();
  const cfg = loadConfig(join(root, 'contracts.config.json'));
  let seen;
  const receipt = await checkAdmitted(cfg, {
    ...quiet,
    tjsvVerifier: async (input) => {
      seen = input;
      return passedVerification();
    },
  });
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.tjsv.schema, TJSV_PERSISTENCE_ADMISSION_SCHEMA);
  assert.equal(receipt.tjsv.contractIrId, hex('a'));
  assert.equal(receipt.tjsv.parityRunId, hex('b'));
  assert.deepEqual(receipt.tjsv.declarationIds, ['Demo.Customer', 'Demo.Invoice']);
  assert.equal(seen.typespec, cfg.typespec);
  assert.equal(seen.generatedSchema, cfg.tjsv.generatedSchema);
  assert.equal(seen.authoredSchema, cfg.jsonSchema);
  assert.deepEqual(seen.expectedDeclarations, ['Demo.Customer', 'Demo.Invoice']);
});

test('canonical verifier failure stops before persistence promotion', async () => {
  const root = scratchWithTjsv();
  const cfg = loadConfig(join(root, 'contracts.config.json'));
  await assert.rejects(
    () => checkAdmitted(cfg, { ...quiet, tjsvVerifier: async () => { throw new Error('stale current inputs'); } }),
    /stale current inputs/,
  );
});

test('verification identities and declaration scope must agree exactly', async () => {
  const root = scratchWithTjsv();
  const cfg = loadConfig(join(root, 'contracts.config.json'));
  await assert.rejects(
    () => checkAdmitted(cfg, {
      ...quiet,
      tjsvVerifier: async () => ({ ...passedVerification(), computedIrId: hex('c') }),
    }),
    /identities disagree/,
  );
  await assert.rejects(
    () => checkAdmitted(cfg, {
      ...quiet,
      tjsvVerifier: async () => ({ ...passedVerification(), declarationIds: ['Demo.Customer'] }),
    }),
    /scope differs/,
  );
});

test('TJSV config is closed and requires immutable evidence inputs', () => {
  const root = scratchWithTjsv({ unexpected: true });
  assert.throws(() => loadConfig(join(root, 'contracts.config.json')), /unknown tjsv option/);
});
