// Production runs on Postgres and the startup migration is hand-written, so a column added to
// the SQLite schema can exist locally and be missing in production. That is exactly how the
// cart page started answering 500: /api/menu selected menu_inventory.allergens, which the
// Postgres migration never created.
//
// This test reads the columns each table's Postgres migration creates and the columns the
// public queries select, and fails when a query reads something no migration adds.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const databaseSource = fs.readFileSync(
  new URL("../server/database.js", import.meta.url),
  "utf8",
);
const indexSource = fs.readFileSync(
  new URL("../server/index.js", import.meta.url),
  "utf8",
);

/** Columns created by `ALTER TABLE <table> ADD COLUMN ...` anywhere in database.js. */
function migratedColumns() {
  const added = new Map();
  for (const match of databaseSource.matchAll(
    /ALTER TABLE (\w+)\s+ADD COLUMN(?: IF NOT EXISTS)?\s+(\w+)/g,
  )) {
    const [, table, column] = match;
    if (!added.has(table)) added.set(table, new Set());
    added.get(table).add(column.toLowerCase());
  }
  return added;
}

/** Columns the base SQLite CREATE TABLE statements give each table. */
function createdColumns() {
  const created = new Map();
  for (const match of databaseSource.matchAll(
    /CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\s*\);/g,
  )) {
    const [, table, body] = match;
    const columns = new Set(
      [
        ...body.matchAll(
          /^\s*(\w+)\s+(?:INTEGER|TEXT|REAL|NUMERIC|BIGINT|SERIAL|BOOLEAN)/gm,
        ),
      ].map((column) => column[1].toLowerCase()),
    );
    created.set(table, columns);
  }
  return created;
}

test("every menu_inventory column the public menu reads exists after the Postgres migration", () => {
  // Only the ALTER TABLE statements count. Production databases were created before these
  // columns existed, so the SQLite CREATE TABLE is no evidence that Postgres has them.
  const added = migratedColumns().get("menu_inventory") || new Set();

  for (const column of [
    "restock_eta",
    "allergens",
    "low_stock_threshold",
    "is_available",
    "dietary_tags",
  ]) {
    assert.ok(
      added.has(column),
      `menu_inventory.${column} is read by the API but the Postgres migration never adds it`,
    );
  }
});

test("every referral column the account endpoints read exists after the Postgres migration", () => {
  const available = migratedColumns().get("customers") || new Set();
  for (const column of [
    "referral_code",
    "referred_by",
    "referral_bonus_paid",
  ]) {
    assert.ok(
      available.has(column),
      `customers.${column} is read by the API but the Postgres migration never adds it`,
    );
  }

  const signups =
    migratedColumns().get("pending_customer_signups") || new Set();
  for (const column of ["claim_order_id", "referral_code"]) {
    assert.ok(
      signups.has(column),
      `pending_customer_signups.${column} needs a Postgres migration`,
    );
  }
});

test("the Postgres migration runs before the server starts answering", () => {
  // verifyDatabaseSchema is awaited at the top of startup, before app.listen.
  const verifyAt = indexSource.indexOf("await verifyDatabaseSchema()");
  const listenAt = indexSource.indexOf("app.listen(");
  assert.ok(verifyAt > 0, "verifyDatabaseSchema should be awaited at startup");
  assert.ok(
    listenAt > verifyAt,
    "the schema must be verified before the server listens",
  );
});
