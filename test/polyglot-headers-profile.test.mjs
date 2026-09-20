import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

test('polyglot header profile schema stays fail-closed', () => {
  const schema = readJson('contracts/polyglot-header-profile.schema.json');
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.properties.schema.const, 'ores.polyglot-header-profile/v1');
  assert.equal(schema.properties.source.properties.kind.const, 'tjsv-contract-ir');
  assert.equal(schema.properties.source.properties.requireCompleteScope.const, true);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.source.additionalProperties, false);
  assert.equal(schema.properties.targets.items.additionalProperties, false);
  assert.equal(schema.properties.conformance.additionalProperties, false);
  assert.equal(schema.properties.conformance.properties.requireCleanRegeneration.const, true);
  assert.equal(schema.properties.conformance.properties.requireOutputManifest.const, true);
});

test('default polyglot header matrix requires the four compile-surface consumers', () => {
  const profile = readJson('templates/polyglot-headers/conformance/polyglot-headers.v1.json');
  assert.equal(profile.schema, 'ores.polyglot-header-profile/v1');
  assert.deepEqual(profile.source, { kind: 'tjsv-contract-ir', requireCompleteScope: true });
  assert.deepEqual(profile.requiredDeclarations, []);

  const targets = new Map(profile.targets.map((target) => [target.language, target]));
  assert.equal(targets.size, profile.targets.length, 'duplicate target language');
  assert.deepEqual([...targets.keys()].sort(), ['dart', 'go', 'rust', 'typescript']);
  for (const target of targets.values()) {
    assert.equal(target.mode, 'compile-surface');
    assert.equal(target.externalConsumer, true);
    assert.equal(target.implementationCrossCheck, true);
  }

  assert.deepEqual(profile.conformance, {
    requireCleanRegeneration: true,
    requireOutputManifest: true,
    requireCompileChecks: true,
    requireFixtureChecks: true,
  });
});
