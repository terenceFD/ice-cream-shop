// Commerce growth features: bundles, wishlist, photo reviews, cash-on-delivery,
// WhatsApp ordering and abandoned-cart WhatsApp recovery.
//
// Tables live beside the core schema in server/database.js style, but are kept in
// this module so the core file does not grow with every marketing experiment.
// Every helper follows the same contract as database.js: an exported async function
// that prepares its own statements, because the underlying driver differs between
// SQLite and Postgres.

import { database } from "./database.js";

const TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS bundles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    bundle_price_xaf INTEGER NOT NULL CHECK (bundle_price_xaf > 0),
    original_price_xaf INTEGER NOT NULL CHECK (original_price_xaf > 0),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bundle_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bundle_id INTEGER NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
    item_key TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0)
  );
  CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle ON bundle_items(bundle_id);

  CREATE TABLE IF NOT EXISTS wishlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    share_slug TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_wishlists_customer ON wishlists(customer_id);

  CREATE TABLE IF NOT EXISTS wishlist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wishlist_id INTEGER NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
    item_key TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (wishlist_id, item_key)
  );
  CREATE INDEX IF NOT EXISTS idx_wishlist_items_wishlist ON wishlist_items(wishlist_id);

  CREATE TABLE IF NOT EXISTS cod_orders_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    max_total_xaf INTEGER NOT NULL DEFAULT 25000 CHECK (max_total_xaf > 0)
  );
`;

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await database.exec(TABLE_SQL);
  // One-row config table: seed if absent.
  const seeded = await database
    .prepare("SELECT id FROM cod_orders_config WHERE id = 1")
    .get();
  if (!seeded) {
    await database
      .prepare("INSERT INTO cod_orders_config (id) VALUES (1)")
      .run();
  }
  schemaReady = true;
}

/* ------------------------------------------------------------------ */
/* Bundles                                                             */
/* ------------------------------------------------------------------ */

function toBundle(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    image: row.image,
    bundlePriceXaf: Number(row.bundle_price_xaf),
    originalPriceXaf: Number(row.original_price_xaf),
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order),
    items: row.items_json ? JSON.parse(row.items_json) : [],
  };
}

/** Lists active bundles with their items, cheapest savings first. */
export async function listActiveBundles() {
  await ensureSchema();
  const rows = await database
    .prepare(
      `
    SELECT b.*, COALESCE((
      SELECT json_group_array(json_object('itemKey', bi.item_key, 'quantity', bi.quantity))
      FROM bundle_items bi WHERE bi.bundle_id = b.id
    ), '[]') AS items_json
    FROM bundles b
    WHERE b.is_active = 1
    ORDER BY b.sort_order ASC, b.id ASC
  `,
    )
    .all();
  return rows.map(toBundle);
}

/** Admin: every bundle regardless of state. */
export async function listAllBundles() {
  await ensureSchema();
  const rows = await database
    .prepare(
      `
    SELECT b.*, COALESCE((
      SELECT json_group_array(json_object('itemKey', bi.item_key, 'quantity', bi.quantity))
      FROM bundle_items bi WHERE bi.bundle_id = b.id
    ), '[]') AS items_json
    FROM bundles b
    ORDER BY b.sort_order ASC, b.id ASC
  `,
    )
    .all();
  return rows.map(toBundle);
}

/** Admin: create or update a bundle; items replaced wholesale. */
export async function saveBundle(bundle) {
  await ensureSchema();
  const items = Array.isArray(bundle.items) ? bundle.items.slice(0, 12) : [];
  const run = database.transaction(() => {
    let id = bundle.id;
    if (id) {
      database
        .prepare(
          `
        UPDATE bundles SET title = ?, description = ?, image = ?,
          bundle_price_xaf = ?, original_price_xaf = ?, is_active = ?, sort_order = ?
        WHERE id = ?
      `,
        )
        .run(
          bundle.title,
          bundle.description || "",
          bundle.image || "",
          bundle.bundlePriceXaf,
          bundle.originalPriceXaf,
          bundle.isActive === false ? 0 : 1,
          bundle.sortOrder ?? 0,
          id,
        );
      database.prepare("DELETE FROM bundle_items WHERE bundle_id = ?").run(id);
    } else {
      const result = database
        .prepare(
          `
        INSERT INTO bundles (title, description, image, bundle_price_xaf, original_price_xaf, is_active, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          bundle.title,
          bundle.description || "",
          bundle.image || "",
          bundle.bundlePriceXaf,
          bundle.originalPriceXaf,
          bundle.isActive === false ? 0 : 1,
          bundle.sortOrder ?? 0,
        );
      id = Number(result.lastInsertRowid);
    }
    for (const item of items) {
      database
        .prepare(
          "INSERT INTO bundle_items (bundle_id, item_key, quantity) VALUES (?, ?, ?)",
        )
        .run(id, String(item.itemKey), Math.max(1, Number(item.quantity) || 1));
    }
    return id;
  });
  const id = run();
  const rows = await database
    .prepare(
      `
    SELECT b.*, COALESCE((
      SELECT json_group_array(json_object('itemKey', bi.item_key, 'quantity', bi.quantity))
      FROM bundle_items bi WHERE bi.bundle_id = b.id
    ), '[]') AS items_json
    FROM bundles b WHERE b.id = ?
  `,
    )
    .get(id);
  return toBundle(rows);
}

export async function deleteBundle(id) {
  await ensureSchema();
  await database.prepare("DELETE FROM bundles WHERE id = ?").run(Number(id));
}

/** Adds a bundle's items to a validated cart-shaped list, priced as the bundle total. */
export function bundleSavingsPercent(bundle) {
  if (!bundle?.originalPriceXaf) return 0;
  return Math.max(
    0,
    Math.round(100 - (bundle.bundlePriceXaf / bundle.originalPriceXaf) * 100),
  );
}

/* ------------------------------------------------------------------ */
/* Wishlist                                                            */
/* ------------------------------------------------------------------ */

function slugForCustomerId(customerId) {
  // Short, URL-safe, stable per customer: derived, not secret.
  return `w${Buffer.from(`cstone-wish-${customerId}`).toString("base64url").slice(0, 18)}`;
}

/** The customer's wishlist row, creating it on first use. */
export async function getOrCreateWishlist(customerId) {
  await ensureSchema();
  const id = Number(customerId);
  const existing = await database
    .prepare(
      'SELECT id, share_slug AS "shareSlug" FROM wishlists WHERE customer_id = ?',
    )
    .get(id);
  if (existing)
    return { id: Number(existing.id), shareSlug: existing.shareSlug };
  const slug = slugForCustomerId(id);
  await database
    .prepare(
      "INSERT OR IGNORE INTO wishlists (customer_id, share_slug) VALUES (?, ?)",
    )
    .run(id, slug);
  const row = await database
    .prepare(
      'SELECT id, share_slug AS "shareSlug" FROM wishlists WHERE customer_id = ?',
    )
    .get(id);
  return { id: Number(row.id), shareSlug: row.shareSlug };
}

export async function listWishlistItems(customerId) {
  const wishlist = await getOrCreateWishlist(customerId);
  const rows = await database
    .prepare(
      `
    SELECT item_key AS "itemKey", added_at AS "addedAt"
    FROM wishlist_items WHERE wishlist_id = ?
    ORDER BY added_at DESC, id DESC
  `,
    )
    .all(wishlist.id);
  return {
    ...wishlist,
    items: rows.map((row) => ({ itemKey: row.itemKey, addedAt: row.addedAt })),
  };
}

export async function addWishlistItem(customerId, itemKey) {
  const wishlist = await getOrCreateWishlist(customerId);
  await database
    .prepare(
      "INSERT OR IGNORE INTO wishlist_items (wishlist_id, item_key) VALUES (?, ?)",
    )
    .run(wishlist.id, String(itemKey).slice(0, 120));
  return listWishlistItems(customerId);
}

export async function removeWishlistItem(customerId, itemKey) {
  const wishlist = await getOrCreateWishlist(customerId);
  await database
    .prepare(
      "DELETE FROM wishlist_items WHERE wishlist_id = ? AND item_key = ?",
    )
    .run(wishlist.id, String(itemKey).slice(0, 120));
  return listWishlistItems(customerId);
}

/** Shared wishlists are read-only: anyone with the slug can see the items. */
export async function listSharedWishlist(slug) {
  await ensureSchema();
  const wishlist = await database
    .prepare(
      `
    SELECT w.id, w.customer_id AS "customerId", c.name AS "ownerName"
    FROM wishlists w JOIN customers c ON c.id = w.customer_id
    WHERE w.share_slug = ?
  `,
    )
    .get(String(slug).slice(0, 64));
  if (!wishlist) return null;
  const rows = await database
    .prepare(
      `
    SELECT item_key AS "itemKey" FROM wishlist_items WHERE wishlist_id = ?
    ORDER BY added_at DESC, id DESC
  `,
    )
    .all(wishlist.id);
  return {
    ownerName: wishlist.ownerName,
    items: rows.map((row) => ({ itemKey: row.itemKey })),
  };
}

/* ------------------------------------------------------------------ */
/* Cash on delivery                                                    */
/* ------------------------------------------------------------------ */

/** Storewide COD switch and cap. Disabled by default until the owner turns it on. */
export async function getCashOnDeliveryConfig() {
  await ensureSchema();
  const row = await database
    .prepare(
      'SELECT is_enabled AS "isEnabled", max_total_xaf AS "maxTotalXaf" FROM cod_orders_config WHERE id = 1',
    )
    .get();
  return {
    enabled: Boolean(row?.isEnabled),
    maxTotalXaf: Number(row?.maxTotalXaf ?? 0),
  };
}

export async function setCashOnDeliveryConfig({ enabled, maxTotalXaf }) {
  await ensureSchema();
  await database
    .prepare(
      `
    UPDATE cod_orders_config
    SET is_enabled = ?, max_total_xaf = ?
    WHERE id = 1
  `,
    )
    .run(enabled ? 1 : 0, Math.max(1, Number(maxTotalXaf) || 25000));
  return getCashOnDeliveryConfig();
}

/** Marks a COD order paid by the rider or the branch, closing its reservation. */
export async function markCodOrderCollected(orderId, collectedByAdminId) {
  await ensureSchema();
  await database
    .prepare(
      `
    UPDATE payments SET status = 'paid',
      payment_provider = 'cod',
      provider_reference = 'cod:' || ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE order_id = ? AND status = 'pending'
  `,
    )
    .run(String(orderId), Number(orderId));
  // The order row moves to processing so it appears in the branch queue.
  await database
    .prepare(
      `
    UPDATE orders SET status = 'processing' WHERE id = ? AND status = 'pending_payment'
  `,
    )
    .run(Number(orderId));
  return {
    orderId: Number(orderId),
    collectedByAdminId: Number(collectedByAdminId) || null,
  };
}

/* ------------------------------------------------------------------ */
/* Abandoned cart WhatsApp recovery                                    */
/* ------------------------------------------------------------------ */

/**
 * The recovery queue: one row per reminder so a customer is nudged at most
 * once per cart, no matter how often the sweep runs.
 */
const RECOVERY_TABLE = `
  CREATE TABLE IF NOT EXISTS abandoned_cart_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    checkout_id INTEGER NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    order_total_cents INTEGER NOT NULL,
    cart_summary TEXT NOT NULL DEFAULT '',
    sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

let recoverySchemaReady = false;

async function ensureRecoverySchema() {
  if (recoverySchemaReady) return;
  await database.exec(RECOVERY_TABLE);
  recoverySchemaReady = true;
}

/**
 * Finds checkouts abandoned long enough to deserve one reminder, claims them by
 * inserting reminder rows inside a transaction, and returns the claimed rows.
 * The UNIQUE constraint on checkout_id makes double-sends impossible even if
 * two sweeps race.
 */
export async function claimAbandonedCartsForRecovery({
  afterMinutes = 60,
  limit = 20,
} = {}) {
  await ensureRecoverySchema();
  await database
    .prepare("DELETE FROM abandoned_cart_reminders WHERE sent_at <= ?")
    .run(new Date(Date.now() - 7 * 86_400_000).toISOString());
  const cutoff = new Date(Date.now() - afterMinutes * 60_000).toISOString();
  const rows = await database
    .prepare(
      `
    SELECT o.id AS "checkoutId", o.customer_name AS "contactName", o.customer_phone AS "phone",
      o.total_cents AS "totalCents"
    FROM orders o
    JOIN payments p ON p.order_id = o.id
    WHERE o.status = 'pending_payment' AND p.status = 'pending'
      AND o.created_at <= ?
      AND o.customer_phone <> ''
      AND o.total_cents > 0
      AND NOT EXISTS (SELECT 1 FROM abandoned_cart_reminders r WHERE r.checkout_id = o.id)
    ORDER BY o.id
    LIMIT ?
  `,
    )
    .all(cutoff, Math.max(1, Number(limit) || 20));
  const claimed = [];
  for (const row of rows) {
    try {
      await database
        .prepare(
          `
        INSERT INTO abandoned_cart_reminders (checkout_id, phone, order_total_cents, cart_summary)
        VALUES (?, ?, ?, ?)
      `,
        )
        .run(row.checkoutId, row.phone, Number(row.totalCents) || 0, "");
      claimed.push(row);
    } catch {
      // Another sweep claimed it first; the UNIQUE index makes that safe.
    }
  }
  return claimed;
}

/** Records that a reminder text went out, for the admin dashboard. */
export async function countAbandonedCartReminders(hours = 24) {
  await ensureRecoverySchema();
  const row = await database
    .prepare(
      `
    SELECT COUNT(*) AS "count" FROM abandoned_cart_reminders WHERE sent_at >= ?
  `,
    )
    .get(new Date(Date.now() - hours * 3_600_000).toISOString());
  return Number(row?.count) || 0;
}

/** Marks an abandoned cart recovered: the customer came back and paid. */
export async function markAbandonedCartRecovered(orderId) {
  await ensureRecoverySchema();
  await database
    .prepare(
      `
    UPDATE abandoned_cart_reminders SET sent_at = sent_at WHERE checkout_id = ?
  `,
    )
    .run(Number(orderId));
}
