// SQL added for referrals, saved bags and allergen notes must run on Postgres too.
// The translator is the only thing standing between SQLite-style SQL and production.
import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:5432/test";
const { translateSql } = await import("./postgres.js");

test("a saved bag insert becomes an upsert-safe insert on Postgres", () => {
  const translated = translateSql(
    "INSERT OR IGNORE INTO customer_saved_carts (customer_id, source_order_id, label, items_json) VALUES (?, ?, ?, ?)",
    [1, null, "Bag", "[]"],
  );
  assert.match(translated.sql, /INSERT INTO customer_saved_carts/);
  assert.match(translated.sql, /ON CONFLICT DO NOTHING/);
  assert.deepEqual(translated.values, [1, null, "Bag", "[]"]);
});

test("deleting a saved bag scopes to its owner", () => {
  const translated = translateSql(
    "DELETE FROM customer_saved_carts WHERE id = ? AND customer_id = ?",
    [5, 9],
  );
  assert.equal(
    translated.sql,
    "DELETE FROM customer_saved_carts WHERE id = $1 AND customer_id = $2",
  );
});

test("an empty-list write for checked allergens reaches Postgres as JSON text", () => {
  const translated = translateSql(
    "UPDATE menu_inventory SET allergens = COALESCE(?, allergens) WHERE item_id = ?",
    ["[]", "menu:ice-cream:x"],
  );
  assert.match(translated.sql, /COALESCE\(\$1, allergens\)/);
  assert.deepEqual(translated.values, ["[]", "menu:ice-cream:x"]);
});

test("the one-time allergen correction uses no SQLite-only function", () => {
  const sql = `UPDATE flavors SET allergies = ?
    WHERE LOWER(name) = LOWER(?) AND (allergies IS NULL OR allergies IN ('["None common"]', '[]'))`;
  const translated = translateSql(sql, ['["Dairy"]', "Vanilla Dream"]);
  assert.doesNotMatch(translated.sql, /INSERT OR IGNORE|MAX\(|COLLATE NOCASE/i);
  assert.match(translated.sql, /LOWER\(name\) = LOWER\(\$2\)/);
});

test("referral points credit uses plain arithmetic, not SQLite helpers", () => {
  const translated = translateSql(
    "UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?",
    [50, 3],
  );
  assert.equal(
    translated.sql,
    "UPDATE customers SET loyalty_points = loyalty_points + $1 WHERE id = $2",
  );
});
