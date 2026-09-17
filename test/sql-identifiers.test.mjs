import assert from 'node:assert/strict';
import test from 'node:test';

import { parseTypeSpec } from '../src/parse-typespec.mjs';
import { EMITTERS } from '../src/emit/index.mjs';

const source = `
namespace Demo.Sql;

enum Group {
  Alpha: "alpha",
  Beta: "beta",
}

@Ores.table("user")
model UserRecord {
  @key id: uuid;
}

@Ores.table("order")
@Ores.unique("window,userId")
@Ores.index("window")
model Event {
  @key id: uuid;
  @maxLength(32) window: string;
  group: Group;
  @Ores.references("UserRecord.id") userId: uuid;
}
`;

test('PostgreSQL emitter quotes every generated identifier without changing its spelling', () => {
  const sql = EMITTERS['sql/schema.sql'](parseTypeSpec(source, 'reserved.tsp'), 'typespec');

  assert.match(sql, /CREATE TYPE "group" AS ENUM/);
  assert.match(sql, /CREATE TABLE "user" \(/);
  assert.match(sql, /CREATE TABLE "order" \(/);
  assert.match(sql, /"window" TEXT NOT NULL CHECK \(char_length\("window"\) <= 32\)/);
  assert.match(sql, /"group" "group" NOT NULL/);
  assert.match(sql, /PRIMARY KEY \("id"\)/);
  assert.match(sql, /UNIQUE \("window", "user_id"\)/);
  assert.match(sql, /CREATE INDEX "order_idx_1" ON "order" \("window"\)/);
  assert.match(
    sql,
    /ALTER TABLE "order" ADD CONSTRAINT "order_user_id_fkey" FOREIGN KEY \("user_id"\) REFERENCES "user" \("id"\)/,
  );
});

test('SQL string literals remain escaped independently from identifiers', () => {
  const contract = parseTypeSpec(source.replace('Alpha: "alpha"', 'Alpha: "a\'b"'), 'literal.tsp');
  const sql = EMITTERS['sql/schema.sql'](contract, 'typespec');
  assert.match(sql, /'a''b'/);
});
