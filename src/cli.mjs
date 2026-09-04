#!/usr/bin/env node
// ores-contracts — independent TypeSpec + JSON Schema authorities → parity-checked SQL / SeaORM / Diesel / Rust / TS / Dart.
//
//   ores-contracts check     [--config contracts.config.json] [--database-url URL]
//   ores-contracts generate  [--config ...]            # writes agreed artifacts to <out>/ (only when parity passes)
//   ores-contracts bootstrap --from json-schema|typespec [--config ...] [--force]   # draft the other authority
//   ores-contracts db-check  --database-url URL         # apply SQL_T and SQL_J to two schemas, diff pg catalogs (Diesel-style db-first witness)
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseTypeSpec } from './parse-typespec.mjs';
import { parseJsonSchema } from './parse-json-schema.mjs';
import { compare, canonical, ContractError } from './ir.mjs';
import { EMITTERS, renderTypeSpec, renderJsonSchema } from './emit/index.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex');

export function loadConfig(path) {
  const cfgPath = resolve(path ?? 'contracts.config.json');
  const raw = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')) : {};
  const root = dirname(cfgPath);
  return Object.freeze({
    root,
    typespec: resolve(root, raw.typespec ?? 'contracts/typespec/main.tsp'),
    jsonSchema: resolve(root, raw.jsonSchema ?? 'contracts/json-schema/contract.schema.json'),
    out: resolve(root, raw.out ?? 'generated'),
    target: resolve(root, raw.target ?? 'target/ores-contracts'),
    artifacts: raw.artifacts ?? Object.keys(EMITTERS),
    tspCompile: raw.tspCompile ?? true,
  });
}

function readAuthorities(cfg) {
  const lanes = {};
  if (existsSync(cfg.typespec)) {
    const text = readFileSync(cfg.typespec, 'utf8');
    lanes.typespec = { text, digest: sha(text), contract: parseTypeSpec(text, cfg.typespec) };
  }
  if (existsSync(cfg.jsonSchema)) {
    const text = readFileSync(cfg.jsonSchema, 'utf8');
    lanes['json-schema'] = { text, digest: sha(text), contract: parseJsonSchema(JSON.parse(text), cfg.jsonSchema) };
  }
  return lanes;
}

function emitLane(cfg, lane, contract) {
  const files = {};
  for (const name of cfg.artifacts) {
    const fn = EMITTERS[name];
    if (!fn) throw new ContractError(`unknown artifact ${name}`, 'config.artifacts');
    files[name] = fn(contract, lane);
  }
  return files;
}

function writeTree(base, files) {
  for (const [rel, text] of Object.entries(files)) {
    const p = join(base, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text);
  }
}

/** Run the full parity check; returns the receipt. Never throws on discrepancies (they are findings). */
export function check(cfg, { log = console.log } = {}) {
  const lanes = readAuthorities(cfg);
  const names = Object.keys(lanes);
  const receipt = { tool: 'ores-contracts', version: '0.1.0', checkedAt: new Date().toISOString(), authorities: {}, findings: [], artifacts: {}, status: 'passed' };
  if (names.length < 2) {
    receipt.status = 'stopped_for_evaluation';
    receipt.findings.push({ kind: 'missing-authority', detail: `need both authorities; found ${names.join(', ') || 'none'} (run bootstrap)` });
  }
  for (const [lane, l] of Object.entries(lanes)) {
    receipt.authorities[lane] = { path: lane === 'typespec' ? cfg.typespec : cfg.jsonSchema, sha256: l.digest, models: l.contract.models.map((m) => m.name), enums: Object.keys(l.contract.enums) };
    log(`[contracts] ${lane}: ${l.contract.models.length} models, ${Object.keys(l.contract.enums).length} enums (sha256 ${l.digest.slice(0, 12)})`);
  }
  if (cfg.tspCompile && lanes.typespec) {
    try {
      execFileSync('npx', ['--no-install', 'tsp', 'compile', cfg.typespec, '--no-emit'], { stdio: 'pipe', cwd: cfg.root });
      receipt.authorities.typespec.tspCompile = 'ok';
      log('[contracts] tsp compile: ok');
    } catch (e) {
      const msg = String(e.stderr ?? e.message).trim().split('\n').slice(-3).join(' | ');
      if (/not found|ENOENT|could not determine executable|npm ERR/i.test(msg)) { receipt.authorities.typespec.tspCompile = 'skipped (tsp not installed)'; log('[contracts] tsp compile: skipped (@typespec/compiler not installed)'); }
      else { receipt.authorities.typespec.tspCompile = 'failed'; receipt.findings.push({ kind: 'typespec-compile', detail: msg }); }
    }
  }
  if (lanes.typespec && lanes['json-schema']) {
    const diffs = compare(lanes.typespec.contract, lanes['json-schema'].contract);
    for (const d of diffs) receipt.findings.push({ kind: 'authority-parity', detail: d, fingerprint: sha(d).slice(0, 16) });
    log(`[contracts] authority parity: ${diffs.length === 0 ? 'ok' : `${diffs.length} discrepancies`}`);
  }
  // generate both lanes independently, byte-compare
  const laneFiles = {};
  for (const [lane, l] of Object.entries(lanes)) {
    laneFiles[lane] = emitLane(cfg, lane, l.contract);
    writeTree(join(cfg.target, lane), laneFiles[lane]);
    writeFileSync(join(cfg.target, lane, 'model.json'), canonical(l.contract));
  }
  if (laneFiles.typespec && laneFiles['json-schema']) {
    for (const name of cfg.artifacts) {
      const a = laneFiles.typespec[name].replace(/from the typespec authority/g, 'from the <lane> authority');
      const b = laneFiles['json-schema'][name].replace(/from the json-schema authority/g, 'from the <lane> authority');
      const same = a === b;
      receipt.artifacts[name] = { typespec: sha(laneFiles.typespec[name]), 'json-schema': sha(laneFiles['json-schema'][name]), byteParity: same };
      if (!same) receipt.findings.push({ kind: 'artifact-parity', detail: `${name} differs between lanes`, fingerprint: sha(a + b).slice(0, 16) });
    }
    log(`[contracts] artifact byte parity: ${Object.values(receipt.artifacts).every((x) => x.byteParity) ? 'ok' : 'MISMATCH'} (${cfg.artifacts.length} artifacts)`);
  }
  if (receipt.findings.length) receipt.status = 'stopped_for_evaluation';
  mkdirSync(cfg.target, { recursive: true });
  writeFileSync(join(cfg.target, 'receipt.json'), JSON.stringify(receipt, null, 2));
  log(`[contracts] ${receipt.status.toUpperCase()} — receipt ${join(cfg.target, 'receipt.json')}`);
  for (const f of receipt.findings) log(`[contracts]   ✗ ${f.kind}: ${f.detail}`);
  return receipt;
}

export function generate(cfg, opts = {}) {
  const receipt = check(cfg, opts);
  if (receipt.status !== 'passed') throw new ContractError('parity did not pass; refusing to write generated/ (see receipt)', 'generate');
  const lanes = readAuthorities(cfg);
  const files = emitLane(cfg, 'typespec', lanes.typespec.contract); // identical to json-schema lane by parity
  const agreed = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.replace(/from the typespec authority/g, 'from both authorities (parity-checked)')]));
  writeTree(cfg.out, agreed);
  writeFileSync(join(cfg.out, 'receipt.json'), JSON.stringify(receipt, null, 2));
  (opts.log ?? console.log)(`[contracts] wrote ${Object.keys(agreed).length} agreed artifacts to ${cfg.out}`);
  return receipt;
}

export function bootstrap(cfg, from, { force = false, log = console.log } = {}) {
  const lanes = readAuthorities(cfg);
  const note = `BOOTSTRAPPED ${new Date().toISOString().slice(0, 10)} from the ${from} authority by ores-contracts. This is a DRAFT: review, then it is an independent human-authored authority.`;
  if (from === 'json-schema') {
    if (!lanes['json-schema']) throw new ContractError('no JSON Schema authority to bootstrap from', cfg.jsonSchema);
    if (existsSync(cfg.typespec) && !force) throw new ContractError(`${cfg.typespec} exists; pass --force to overwrite`, 'bootstrap');
    mkdirSync(dirname(cfg.typespec), { recursive: true });
    writeFileSync(cfg.typespec, renderTypeSpec(lanes['json-schema'].contract, note));
    writeFileSync(join(dirname(cfg.typespec), 'ores.tsp'), readFileSync(new URL('../typespec/ores.tsp', import.meta.url), 'utf8'));
    log(`[contracts] wrote draft ${cfg.typespec} (+ ores.tsp decorators)`);
  } else if (from === 'typespec') {
    if (!lanes.typespec) throw new ContractError('no TypeSpec authority to bootstrap from', cfg.typespec);
    if (existsSync(cfg.jsonSchema) && !force) throw new ContractError(`${cfg.jsonSchema} exists; pass --force to overwrite`, 'bootstrap');
    mkdirSync(dirname(cfg.jsonSchema), { recursive: true });
    writeFileSync(cfg.jsonSchema, JSON.stringify(renderJsonSchema(lanes.typespec.contract, note), null, 2) + '\n');
    log(`[contracts] wrote draft ${cfg.jsonSchema}`);
  } else throw new ContractError('--from must be json-schema or typespec', 'bootstrap');
}

/** DB-first witness: apply each lane's SQL into its own schema and diff pg catalogs via psql. */
export function dbCheck(cfg, databaseUrl, { log = console.log } = {}) {
  const lanes = readAuthorities(cfg);
  if (!lanes.typespec || !lanes['json-schema']) throw new ContractError('both authorities required', 'db-check');
  const psql = (sql) => execFileSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-A', '-t', '-c', sql], { encoding: 'utf8' });
  const catalog = (schema) => psql(`SELECT table_name, column_name, data_type, udt_name, is_nullable, character_maximum_length FROM information_schema.columns WHERE table_schema='${schema}' ORDER BY 1,2;`) + psql(`SELECT tc.table_name, tc.constraint_type, string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema) WHERE tc.table_schema='${schema}' GROUP BY 1,2,tc.constraint_name ORDER BY 1,2,3;`);
  const results = {};
  for (const lane of ['typespec', 'json-schema']) {
    const schema = `ores_contracts_${lane.replace('-', '_')}_${Date.now().toString(36)}`;
    const sql = EMITTERS['sql/schema.sql'](lanes[lane].contract, lane);
    psql(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}; ${sql}`);
    results[lane] = catalog(schema);
    psql(`DROP SCHEMA ${schema} CASCADE;`);
    log(`[contracts] db-check ${lane}: applied + read back ${results[lane].split('\n').length} catalog rows`);
  }
  const same = results.typespec === results['json-schema'];
  log(`[contracts] db-check catalog parity: ${same ? 'ok' : 'MISMATCH'}`);
  mkdirSync(cfg.target, { recursive: true });
  writeFileSync(join(cfg.target, 'db-check.json'), JSON.stringify({ parity: same, catalogs: results }, null, 2));
  return same;
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const opt = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
  const cfg = loadConfig(opt('--config'));
  try {
    switch (cmd) {
      case 'check': { const r = check(cfg); if (opt('--database-url')) dbCheck(cfg, opt('--database-url')); return r.status === 'passed' ? 0 : 2; }
      case 'generate': generate(cfg); return 0;
      case 'bootstrap': bootstrap(cfg, opt('--from'), { force: rest.includes('--force') }); return 0;
      case 'db-check': return dbCheck(cfg, opt('--database-url')) ? 0 : 2;
      default: console.error('usage: ores-contracts <check|generate|bootstrap --from json-schema|typespec|db-check --database-url URL> [--config contracts.config.json]'); return 1;
    }
  } catch (e) {
    console.error(`[contracts] error: ${e.message}`); return e instanceof ContractError ? 2 : 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
