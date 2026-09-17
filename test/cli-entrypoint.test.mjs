import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'));

test('published npm bin always executes the CLI implementation', () => {
  assert.equal(pkg.bin['ores-contracts'], 'bin/ores-contracts.mjs');
  const bin = resolve(repoRoot, pkg.bin['ores-contracts']);
  const result = spawnSync(process.execPath, [bin, 'definitely-not-a-command'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.error, undefined);
  assert.equal(result.status, 1, `stdout=${result.stdout}\nstderr=${result.stderr}`);
  assert.match(result.stderr, /usage: ores-contracts/);
});
