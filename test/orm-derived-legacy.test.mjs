import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const bin = join(root, 'bin', 'ores-orm-derive.mjs');

const diesel = `diesel::table! {
  widgets (id) {
    id -> Text,
    label -> Nullable<Text>,
  }
}`;

const seaorm = `pub mod widget {
  #[derive(DeriveEntityModel)]
  #[sea_orm(table_name = "widgets")]
  pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub label: Option<String>,
  }
}`;

const policy = {
  source_namespace: 'example.persistence',
  namespace: 'example.public',
  models: {
    Widget: { name: 'WidgetPublic', fields: ['id', 'label'] },
  },
};

test('legacy ORM derive refuses execution without explicit bootstrap opt-in', () => {
  const run = spawnSync(process.execPath, [bin], { encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /deprecated bootstrap-only compatibility shim/);
});

test('legacy bootstrap output is stamped non-publishable', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ores-orm-legacy-'));
  const dieselPath = join(dir, 'diesel.rs');
  const seaormPath = join(dir, 'seaorm.rs');
  const policyPath = join(dir, 'policy.json');
  const out = join(dir, 'out');
  await Promise.all([
    writeFile(dieselPath, diesel),
    writeFile(seaormPath, seaorm),
    writeFile(policyPath, JSON.stringify(policy)),
  ]);

  const run = spawnSync(process.execPath, [bin], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ORES_ORM_LEGACY_BOOTSTRAP: '1',
      ORES_ORM_DIESEL: dieselPath,
      ORES_ORM_SEAORM: seaormPath,
      ORES_ORM_POLICY: policyPath,
      ORES_ORM_OUT: out,
    },
  });
  assert.equal(run.status, 0, run.stderr);

  const receipt = JSON.parse(await readFile(join(out, 'receipt.json'), 'utf8'));
  assert.equal(receipt.role, 'legacy_bootstrap_evidence_only');
  assert.equal(receipt.publication, 'blocked_pending_rust_engine_and_tjsv_admission');
  assert.equal(receipt.publishable, false);
  assert.match(await readFile(join(out, 'DO_NOT_PUBLISH.md'), 'utf8'), /not release\/publication evidence/);
});
