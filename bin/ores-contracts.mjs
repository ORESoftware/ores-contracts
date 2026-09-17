#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

if (result.error) {
  console.error(`[ores-contracts] failed to launch CLI: ${result.error.message}`);
  process.exit(1);
}
if (result.signal) {
  console.error(`[ores-contracts] CLI terminated by ${result.signal}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
