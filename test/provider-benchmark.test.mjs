import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const readJson = (path) => JSON.parse(read(path));

test('provider benchmark JSON authorities are closed and versioned', () => {
  const plan = readJson('contracts/provider-benchmark-plan.schema.json');
  const target = readJson('contracts/provider-benchmark-target-receipt.schema.json');
  const aggregate = readJson('contracts/provider-benchmark-aggregate-receipt.schema.json');

  assert.equal(plan.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(plan.additionalProperties, false);
  assert.equal(plan.properties.schema.const, 'ores.provider-benchmark.plan/v1');
  assert.equal(plan.properties.targets.items.additionalProperties, false);
  assert.equal(plan.properties.targets.items.properties.run.additionalProperties, false);
  assert.equal(plan.properties.targets.items.properties.resourceProfile.additionalProperties, false);

  assert.equal(target.additionalProperties, false);
  assert.equal(target.properties.schema.const, 'ores.provider-benchmark.target-receipt/v1');
  assert.deepEqual(target.properties.billing.properties.basis.enum, ['measured', 'estimated']);
  assert.equal(target.properties.billing.additionalProperties, false);
  assert.equal(target.properties.samples.additionalProperties, false);
  assert.equal(target.properties.samples.properties.latency.additionalProperties, false);

  assert.equal(aggregate.additionalProperties, false);
  assert.equal(
    aggregate.properties.schema.const,
    'ores.provider-benchmark.aggregate-receipt/v1',
  );
  assert.equal(aggregate.properties.targets.minItems, 1);
});

test('provider benchmark plan binds identity before invoking a driver', () => {
  const plan = readJson('contracts/provider-benchmark-plan.schema.json');
  assert.deepEqual(plan.required, [
    'schema',
    'releaseId',
    'requestCorpusSha256',
    'pricingSnapshot',
    'targets',
  ]);
  const target = plan.properties.targets.items;
  for (const name of [
    'id',
    'provider',
    'region',
    'artifactReceipts',
    'resourceProfile',
    'run',
    'receipt',
  ]) {
    assert.ok(target.required.includes(name), `target must require ${name}`);
  }
  assert.equal(target.properties.run.properties.argv.minItems, 1);
  assert.equal(target.properties.run.properties.inheritEnv.uniqueItems, true);
  assert.equal(target.properties.artifactReceipts.minProperties, 1);
});

test('target receipt binds the same immutable comparison identity', () => {
  const target = readJson('contracts/provider-benchmark-target-receipt.schema.json');
  for (const name of [
    'targetId',
    'provider',
    'region',
    'releaseId',
    'requestCorpusSha256',
    'artifactReceipts',
    'resourceProfile',
  ]) {
    assert.ok(target.required.includes(name), `receipt must require ${name}`);
  }
  const samples = target.properties.samples;
  for (const name of [
    'requestCount',
    'errorCount',
    'throttledCount',
    'coldCount',
    'warmCount',
    'durationMs',
    'throughputRps',
    'latency',
  ]) {
    assert.ok(samples.required.includes(name), `samples must require ${name}`);
  }
});

test('TypeSpec peer authority uses the same wire schema names', () => {
  const tsp = read('typespec/provider-benchmark.tsp');
  for (const wire of [
    'ores.provider-benchmark.plan/v1',
    'ores.provider-benchmark.target-receipt/v1',
    'ores.provider-benchmark.aggregate-receipt/v1',
  ]) {
    assert.ok(tsp.includes(`"${wire}"`), `TypeSpec missing ${wire}`);
  }
  for (const field of [
    'releaseId',
    'requestCorpusSha256',
    'artifactReceipts',
    'resourceProfile',
    'pricingSnapshotAsOf',
    'comparabilityIssues',
  ]) {
    assert.ok(tsp.includes(field), `TypeSpec missing ${field}`);
  }
});
