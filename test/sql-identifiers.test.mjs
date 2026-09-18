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
  type: string;
  group: Group;
  @Ores.references("UserRecord.id") userId: uuid;
}

@Ores.table("type")
model TypeRecord {
  @key id: uuid;
}
`;

test('PostgreSQL emitter quotes every generated identifier without changing its spelling', () => {
  const contract = parseTypeSpec(source, 'reserved.tsp');
  const sql = EMITTERS['sql/schema.sql'](contract, 'typespec');

  assert.match(sql, /CREATE TYPE "group" AS ENUM/);
  assert.match(sql, /CREATE TABLE "user" \(/);
  assert.match(sql, /CREATE TABLE "order" \(/);
  assert.match(sql, /CREATE TABLE "type" \(/);
  assert.match(sql, /"window" TEXT NOT NULL CHECK \(char_length\("window"\) <= 32\)/);
  assert.match(sql, /"type" TEXT NOT NULL/);
  assert.match(sql, /"group" "group" NOT NULL/);
  assert.match(sql, /PRIMARY KEY \("id"\)/);
  assert.match(sql, /UNIQUE \("window", "user_id"\)/);
  assert.match(sql, /CREATE INDEX "order_idx_1" ON "order" \("window"\)/);
  assert.match(
    sql,
    /ALTER TABLE "order" ADD CONSTRAINT "order_user_id_fkey" FOREIGN KEY \("user_id"\) REFERENCES "user" \("id"\)/,
  );
});

test('Rust, SeaORM, and Diesel use raw identifiers while preserving reserved wire/database names', () => {
  const contract = parseTypeSpec(source, 'reserved-rust.tsp');

  const rust = EMITTERS['rust/types.rs'](contract, 'typespec');
  assert.match(rust, /#\[serde\(rename = "type"\)\]\n    pub r#type: String,/);

  const seaorm = EMITTERS['seaorm/entities.rs'](contract, 'typespec');
  assert.match(seaorm, /#\[serde\(rename = "type"\)\]\n        #\[sea_orm\(column_name = "type"\)\]\n        pub r#type: String,/);

  const diesel = EMITTERS['diesel/schema.rs'](contract, 'typespec');
  assert.match(diesel, /#\[sql_name = "type"\]\n            r#type -> Text,/);
  assert.match(diesel, /r#type \(id\) \{/);
  assert.match(diesel, /#\[diesel\(table_name = schema::r#type\)\]/);
  assert.match(diesel, /#\[serde\(rename = "type"\)\]\n    pub r#type: String,/);
});

test('SQL string literals remain escaped independently from identifiers', () => {
  const contract = parseTypeSpec(source.replace('Alpha: "alpha"', 'Alpha: "a\'b"'), 'literal.tsp');
  const sql = EMITTERS['sql/schema.sql'](contract, 'typespec');
  assert.match(sql, /'a''b'/);
});
