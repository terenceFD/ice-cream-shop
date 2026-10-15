import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { USD_TO_XAF } from "../shared/currency.js";
import {
  cameroonLocations,
  cameroonDeliveryLocations,
  coldStoneMenuCategories,
  getMenuItemId,
} from "../src/data.js";

const databasePath =
  process.env.DATABASE_PATH ||
  fileURLToPath(new URL("./database.sqlite", import.meta.url));
const configuredDatabaseBackend =
  process.env.DATABASE_BACKEND?.trim().toLowerCase() ||
  (process.env.DATABASE_URL ? "postgres" : "sqlite");

if (!["sqlite", "postgres"].includes(configuredDatabaseBackend)) {
  throw new Error('DATABASE_BACKEND must be either "sqlite" or "postgres".');
}

export const databaseKind = configuredDatabaseBackend;

// Built-in category covers that changed to better-matching photos: [category, old default, new].
// Only covers still on the old default change, so covers an admin picked are kept.
const CATEGORY_IMAGE_UPDATES = [
  ["Ice Cream", "/menu-images/product-1.webp", "/menu-images/ice-cream-signature.webp"],
  ["Silk & Sorbet", "/menu-images/product-5.webp", "/menu-images/silk-chocolate-shake.webp"],
  ["Novelties", "/cream/cream%201.webp", "/menu-images/sorbet-cup.webp"],
  ["Limited-Time Favorites", "/menu-images/product-3.webp", "/menu-images/limited-time-treats.webp"],
  // Official Cold Stone photos (rows run in order, so older defaults reach these too).
  ["Ice Cream", "/menu-images/ice-cream-signature.webp", "/menu-official/ice-cream/signature-creations/founders-favorite.webp"],
  ["Cakes & Pies", "/cake-images/cake-1.webp", "/menu-official/cakes/birthday-cakes.webp"],
  ["Silk & Sorbet", "/menu-images/silk-chocolate-shake.webp", "/menu-official/dairy-free-ice-cream-sorbet/sorbet.webp"],
  ["Milkshakes & Smoothies", "/milk/mk-1.webp", "/menu-official/milkshakes-fruit-smoothies/milkshakes/very-vanilla.webp"],
  ["Novelties", "/menu-images/sorbet-cup.webp", "/menu-official/novelties/ice-cream-cupcakes/cake-batter-delux.webp"],
  ["Limited-Time Favorites", "/menu-images/limited-time-treats.webp", "/menu-official/limited-time-offers/the-cat-in-the-hats-cotton-candy-catastrophe.webp"],
];
// Same idea for built-in category descriptions: only rows still showing the old text change,
// so a description an admin has edited is kept.
const CATEGORY_DESCRIPTION_UPDATES = [
  ["Silk & Sorbet", "Dairy-free alternatives listed on the global menu.", "Creamy dairy-free scoops and fruity sorbets."],
  ["Novelties", "Portable frozen treats from the global menu.", "Grab-and-go frozen treats: ice cream cupcakes and cookie sandwiches."],
];

// Flavor photos that showed a different product: [flavor name, old photo, matching photo].
// vanilla.jpg shows a strawberry scoop and strawberry.jpg shows vanilla scoops, so they swap.
// Only flavors still on the old photo change, so photos an admin picked are kept.
const FLAVOR_IMAGE_UPDATES = [
  ["Vanilla Dream", "/images/vanilla.jpg", "/images/strawberry.jpg"],
  ["Strawberry Delight", "/images/strawberry.jpg", "/images/vanilla.jpg"],
  ["Cookies & Cream", "/images/hero-ice-cream.jpg", "/cream/cream%202.webp"],
];

export let database;

if (configuredDatabaseBackend === "postgres") {
  const { database: postgresDatabase } = await import("./postgres.js");
  database = postgresDatabase;
} else {
  const sqliteDatabase = new Database(databasePath);
  sqliteDatabase.pragma("journal_mode = WAL");
  sqliteDatabase.pragma("foreign_keys = ON");

  sqliteDatabase.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      profile_picture TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'owner',
      store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      profile_picture TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      delivery_city TEXT NOT NULL DEFAULT '',
      delivery_residence TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS flavors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      detail TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL CHECK (price > 0),
      image TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'bg-[#fff1cf]',
      tag TEXT NOT NULL DEFAULT 'New flavor',
      servings INTEGER NOT NULL DEFAULT 2,
      allergies TEXT NOT NULL DEFAULT '[]',
      origin TEXT NOT NULL DEFAULT 'Cold Stone Creamery',
      stock INTEGER NOT NULL DEFAULT 100 CHECK (stock >= 0),
      reserved_stock INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0)
    );

    CREATE TABLE IF NOT EXISTS custom_menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_title TEXT NOT NULL,
      name TEXT NOT NULL,
      detail TEXT NOT NULL,
      image TEXT NOT NULL,
      price_xaf INTEGER NOT NULL CHECK (price_xaf > 0),
      stock INTEGER NOT NULL DEFAULT 100 CHECK (stock >= 0),
      is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (category_title, name COLLATE NOCASE)
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      delivery_city TEXT NOT NULL,
      delivery_postal_code TEXT NOT NULL DEFAULT '',
      delivery_residence TEXT NOT NULL DEFAULT '',
      subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
      discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
      total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
      currency TEXT NOT NULL DEFAULT 'xaf',
      discount_code TEXT NOT NULL DEFAULT '',
      discount_code_id INTEGER REFERENCES discount_codes(id) ON DELETE SET NULL,
      fulfillment_status TEXT NOT NULL DEFAULT 'preparing'
        CHECK (fulfillment_status IN ('preparing', 'ready', 'delivered')),
      status TEXT NOT NULL DEFAULT 'pending_payment'
        CHECK (status IN ('pending_payment', 'processing', 'delivered', 'payment_failed')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      delivered_at TEXT
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      flavor_id INTEGER,
      menu_item_id TEXT NOT NULL DEFAULT '',
      flavor_name TEXT NOT NULL,
      unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0)
    );

    CREATE TABLE IF NOT EXISTS menu_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL UNIQUE COLLATE NOCASE,
      description TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT '🍦',
      base_title TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS menu_inventory (
      item_id TEXT PRIMARY KEY,
      stock INTEGER NOT NULL DEFAULT 100 CHECK (stock >= 0),
      reserved_stock INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
      is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
      dietary_tags TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS discount_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE COLLATE NOCASE,
      discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
      discount_value INTEGER NOT NULL CHECK (discount_value > 0),
      minimum_total INTEGER NOT NULL DEFAULT 0 CHECK (minimum_total >= 0),
      max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
      uses INTEGER NOT NULL DEFAULT 0 CHECK (uses >= 0),
      reserved_uses INTEGER NOT NULL DEFAULT 0 CHECK (reserved_uses >= 0),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
      stripe_checkout_session_id TEXT NOT NULL UNIQUE,
      stripe_payment_intent_id TEXT,
      payment_provider TEXT NOT NULL DEFAULT 'stripe',
      provider_reference TEXT,
      provider_transaction_id TEXT,
      amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
      currency TEXT NOT NULL DEFAULT 'xaf',
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'failed')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  sqliteDatabase.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const flavorCurrencyMigrationId = "flavor-prices-xaf-540";
  const flavorCurrencyMigration = sqliteDatabase
    .prepare("SELECT id FROM schema_migrations WHERE id = ?")
    .get(flavorCurrencyMigrationId);
  if (!flavorCurrencyMigration) {
    sqliteDatabase.transaction(() => {
      sqliteDatabase
        .prepare("UPDATE flavors SET price = CAST(ROUND(price * ?) AS INTEGER)")
        .run(USD_TO_XAF);
      sqliteDatabase
        .prepare("INSERT INTO schema_migrations (id) VALUES (?)")
        .run(flavorCurrencyMigrationId);
    })();
  }

  const orderColumns = new Set(
    sqliteDatabase
      .prepare("PRAGMA table_info(orders)")
      .all()
      .map((column) => column.name),
  );
  if (!orderColumns.has("delivery_residence")) {
    sqliteDatabase.exec(
      "ALTER TABLE orders ADD COLUMN delivery_residence TEXT NOT NULL DEFAULT ''",
    );
  }

  const flavorColumns = new Set(
    sqliteDatabase
      .prepare("PRAGMA table_info(flavors)")
      .all()
      .map((column) => column.name),
  );
  if (!flavorColumns.has("stock")) {
    sqliteDatabase.exec(
      "ALTER TABLE flavors ADD COLUMN stock INTEGER NOT NULL DEFAULT 100 CHECK (stock >= 0)",
    );
  }
  if (!flavorColumns.has("reserved_stock")) {
    sqliteDatabase.exec(
      "ALTER TABLE flavors ADD COLUMN reserved_stock INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0)",
    );
  }

  const contactMessageColumns = new Set(
    sqliteDatabase
      .prepare("PRAGMA table_info(contact_messages)")
      .all()
      .map((column) => column.name),
  );
  if (!contactMessageColumns.has("replied_at")) {
    sqliteDatabase.exec("ALTER TABLE contact_messages ADD COLUMN replied_at TEXT");
  }

  function addColumnIfMissing(tableName, columnName, definition) {
    const columns = new Set(
      sqliteDatabase
        .prepare(`PRAGMA table_info(${tableName})`)
        .all()
        .map((column) => column.name),
    );
    if (!columns.has(columnName)) {
      sqliteDatabase.exec(
        `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`,
      );
    }
  }

  addColumnIfMissing("customers", "phone", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(
    "contact_messages",
    "store_id",
    "INTEGER REFERENCES stores(id) ON DELETE SET NULL",
  );
  addColumnIfMissing("customers", "delivery_city", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(
    "customers",
    "delivery_residence",
    "TEXT NOT NULL DEFAULT ''",
  );
  addColumnIfMissing(
    "customers",
    "loyalty_points",
    "INTEGER NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0)",
  );
  addColumnIfMissing(
    "customers",
    "is_banned",
    "INTEGER NOT NULL DEFAULT 0 CHECK (is_banned IN (0, 1))",
  );
  addColumnIfMissing(
    "orders",
    "customer_id",
    "INTEGER REFERENCES customers(id) ON DELETE SET NULL",
  );
  addColumnIfMissing("orders", "discount_code", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(
    "orders",
    "store_id",
    "INTEGER REFERENCES stores(id) ON DELETE SET NULL",
  );
  addColumnIfMissing("orders", "store_name", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("orders", "store_address", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("orders", "store_phone", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(
    "orders",
    "discount_code_id",
    "INTEGER REFERENCES discount_codes(id) ON DELETE SET NULL",
  );
  addColumnIfMissing(
    "orders",
    "fulfillment_status",
    "TEXT NOT NULL DEFAULT 'preparing'",
  );
  addColumnIfMissing(
    "orders",
    "fulfillment_type",
    "TEXT NOT NULL DEFAULT 'delivery'",
  );
  addColumnIfMissing("orders", "scheduled_for", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("orders", "delivery_fee", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(
    "orders",
    "loyalty_points_redeemed",
    "INTEGER NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "orders",
    "delivery_stage",
    "TEXT NOT NULL DEFAULT 'accepted'",
  );
  addColumnIfMissing("order_items", "menu_item_id", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(
    "custom_menu_items",
    "stock",
    "INTEGER NOT NULL DEFAULT 100 CHECK (stock >= 0)",
  );
  addColumnIfMissing(
    "custom_menu_items",
    "is_available",
    "INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1))",
  );
  addColumnIfMissing(
    "menu_inventory",
    "dietary_tags",
    "TEXT NOT NULL DEFAULT '[]'",
  );
  addColumnIfMissing(
    "menu_inventory",
    "low_stock_threshold",
    "INTEGER NOT NULL DEFAULT 5",
  );
  addColumnIfMissing(
    "discount_codes",
    "reserved_uses",
    "INTEGER NOT NULL DEFAULT 0 CHECK (reserved_uses >= 0)",
  );

  const orderStageMigrationId = "order-delivery-stage-v1";
  if (
    !sqliteDatabase
      .prepare("SELECT id FROM schema_migrations WHERE id = ?")
      .get(orderStageMigrationId)
  ) {
    sqliteDatabase.transaction(() => {
      sqliteDatabase
        .prepare(
          `
        UPDATE orders SET delivery_stage = CASE
          WHEN status = 'delivered' OR fulfillment_status = 'delivered' THEN 'delivered'
          WHEN fulfillment_status = 'ready' THEN 'ready'
          WHEN status = 'processing' THEN 'preparing'
          ELSE 'accepted'
        END
      `,
        )
        .run();
      sqliteDatabase
        .prepare("INSERT INTO schema_migrations (id) VALUES (?)")
        .run(orderStageMigrationId);
    })();
  }

  sqliteDatabase.exec(`
    CREATE TABLE IF NOT EXISTS fulfillment_zones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location TEXT NOT NULL UNIQUE COLLATE NOCASE,
      pickup_enabled INTEGER NOT NULL DEFAULT 1 CHECK (pickup_enabled IN (0, 1)),
      delivery_enabled INTEGER NOT NULL DEFAULT 0 CHECK (delivery_enabled IN (0, 1)),
      delivery_fee INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fulfillment_zone_id INTEGER NOT NULL UNIQUE REFERENCES fulfillment_zones(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      town TEXT NOT NULL,
      area TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      map_query TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS fulfillment_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS loyalty_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      points_delta INTEGER NOT NULL,
      entry_type TEXT NOT NULL CHECK (entry_type IN ('earned', 'redeemed', 'refunded')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(customer_id, order_id, entry_type)
    );

    CREATE TABLE IF NOT EXISTS customer_favorites (
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(customer_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS customer_saved_carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      source_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      label TEXT NOT NULL,
      items_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(customer_id, source_order_id)
    );

    CREATE TABLE IF NOT EXISTS menu_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      review TEXT NOT NULL DEFAULT '',
      is_approved INTEGER NOT NULL DEFAULT 0 CHECK (is_approved IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(customer_id, order_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS cake_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      size TEXT NOT NULL,
      flavor TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      toppings TEXT NOT NULL DEFAULT '[]',
      pickup_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'confirmed', 'declined')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
      admin_name TEXT NOT NULL,
      action TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Party and event orders: request, quote, deposit, confirmation.
    CREATE TABLE IF NOT EXISTS event_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_time TEXT NOT NULL,
      guest_count INTEGER NOT NULL,
      fulfillment_type TEXT NOT NULL,
      delivery_address TEXT NOT NULL DEFAULT '',
      items_json TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      estimated_total INTEGER NOT NULL,
      quoted_total INTEGER,
      deposit_amount INTEGER,
      status TEXT NOT NULL DEFAULT 'new',
      admin_note TEXT NOT NULL DEFAULT '',
      deposit_provider TEXT,
      deposit_reference TEXT,
      deposit_external_reference TEXT,
      deposit_paid_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_event_orders_customer ON event_orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_event_orders_store_date ON event_orders(store_id, event_date);

    -- Devices where a signed-in customer turned on promotion alerts.
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_customer ON push_subscriptions(customer_id);
  `);

  addColumnIfMissing("customers", "profile_picture", "TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing("orders", "review_reminder_sent_at", "TEXT");
  addColumnIfMissing("customers", "welcome_notification_sent_at", "TEXT");
  addColumnIfMissing("admins", "role", "TEXT NOT NULL DEFAULT 'owner'");
  addColumnIfMissing("admins", "security_pin_hash", "TEXT");
  // The site was renamed from "Antixor Icy"; flavors that used the old default origin follow.
  sqliteDatabase.prepare("UPDATE flavors SET origin = 'Cold Stone Creamery' WHERE origin = 'Antixor Icy'").run();
  addColumnIfMissing(
    "admins",
    "store_id",
    "INTEGER REFERENCES stores(id) ON DELETE SET NULL",
  );
  addColumnIfMissing(
    "cake_requests",
    "store_id",
    "INTEGER REFERENCES stores(id) ON DELETE SET NULL",
  );
  addColumnIfMissing(
    "custom_menu_items",
    "low_stock_threshold",
    "INTEGER NOT NULL DEFAULT 5",
  );
  addColumnIfMissing(
    "payments",
    "payment_provider",
    "TEXT NOT NULL DEFAULT 'stripe'",
  );
  addColumnIfMissing("payments", "provider_reference", "TEXT");
  addColumnIfMissing("payments", "provider_transaction_id", "TEXT");
  sqliteDatabase.exec(`
    UPDATE payments
    SET provider_reference = stripe_checkout_session_id
    WHERE provider_reference IS NULL
  `);
  sqliteDatabase.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_reference
    ON payments(provider_reference)
  `);

  const seedCategory = sqliteDatabase.prepare(`
    INSERT OR IGNORE INTO menu_categories (title, description, image, icon, base_title, sort_order)
    VALUES (@title, @description, @image, @icon, @title, @sortOrder)
  `);
  const refreshDefaultCategoryImage = sqliteDatabase.prepare(
    "UPDATE menu_categories SET image = ? WHERE base_title = ? AND image = ?",
  );
  for (const [baseTitle, previousImage, image] of CATEGORY_IMAGE_UPDATES) {
    refreshDefaultCategoryImage.run(image, baseTitle, previousImage);
  }
  const refreshDefaultCategoryDescription = sqliteDatabase.prepare(
    "UPDATE menu_categories SET description = ? WHERE base_title = ? AND description = ?",
  );
  for (const [baseTitle, previousDescription, description] of CATEGORY_DESCRIPTION_UPDATES) {
    refreshDefaultCategoryDescription.run(description, baseTitle, previousDescription);
  }
  sqliteDatabase.transaction(() => {
    const updateFlavorImage = sqliteDatabase.prepare(
      "UPDATE flavors SET image = ? WHERE name = ? AND image = ?",
    );
    for (const [name, previousImage, image] of FLAVOR_IMAGE_UPDATES) {
      updateFlavorImage.run(image, name, previousImage);
    }
  })();
  for (const [sortOrder, category] of coldStoneMenuCategories.entries()) {
    seedCategory.run({ ...category, sortOrder });
    for (const item of category.items) {
      sqliteDatabase
        .prepare("INSERT OR IGNORE INTO menu_inventory (item_id) VALUES (?)")
        .run(getMenuItemId(category.title, item.name));
    }
  }
  sqliteDatabase
    .prepare(
      `
    INSERT OR IGNORE INTO menu_inventory (item_id)
    SELECT 'menu:custom:' || id FROM custom_menu_items
  `,
    )
    .run();

  const seedZone = sqliteDatabase.prepare(`
    INSERT OR IGNORE INTO fulfillment_zones (location, pickup_enabled)
    VALUES (?, 1)
  `);
  for (const location of cameroonDeliveryLocations) seedZone.run(location.value);
  const seedStore = sqliteDatabase.prepare(`
    INSERT OR IGNORE INTO stores (
      fulfillment_zone_id, name, town, area, address, phone, map_query
    )
    SELECT id, ?, ?, ?, ?, ?, ?
    FROM fulfillment_zones
    WHERE location = ? COLLATE NOCASE
  `);
  for (const location of cameroonLocations) {
    seedStore.run(
      `${location.area} Branch`,
      location.town,
      location.area,
      location.address,
      location.phone || "",
      location.mapQuery,
      `${location.town} — ${location.area}`,
    );
  }
  sqliteDatabase.prepare(`
    UPDATE orders
    SET store_id = (
          SELECT s.id FROM stores s
          JOIN fulfillment_zones z ON z.id = s.fulfillment_zone_id
          WHERE z.location = orders.delivery_city COLLATE NOCASE
        ),
        store_name = COALESCE((
          SELECT s.name FROM stores s
          JOIN fulfillment_zones z ON z.id = s.fulfillment_zone_id
          WHERE z.location = orders.delivery_city COLLATE NOCASE
        ), store_name),
        store_address = COALESCE((
          SELECT s.address FROM stores s
          JOIN fulfillment_zones z ON z.id = s.fulfillment_zone_id
          WHERE z.location = orders.delivery_city COLLATE NOCASE
        ), store_address),
        store_phone = COALESCE((
          SELECT s.phone FROM stores s
          JOIN fulfillment_zones z ON z.id = s.fulfillment_zone_id
          WHERE z.location = orders.delivery_city COLLATE NOCASE
        ), store_phone)
    WHERE store_id IS NULL AND delivery_city != ''
  `).run();
  if (
    sqliteDatabase.prepare("SELECT COUNT(*) AS count FROM fulfillment_slots").get()
      .count === 0
  ) {
    const seedSlot = sqliteDatabase.prepare(`
      INSERT INTO fulfillment_slots (label, start_time, end_time, sort_order)
      VALUES (?, ?, ?, ?)
    `);
    for (const [sortOrder, [startTime, endTime]] of [
      ["10:00", "12:00"],
      ["12:00", "14:00"],
      ["14:00", "16:00"],
      ["16:00", "18:00"],
    ].entries()) {
      seedSlot.run(`${startTime}–${endTime}`, startTime, endTime, sortOrder);
    }
  }

  sqliteDatabase.exec(`
    CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);
    CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);
    CREATE INDEX IF NOT EXISTS idx_menu_reviews_item_approved ON menu_reviews(item_id, is_approved);
    CREATE INDEX IF NOT EXISTS idx_cake_requests_status ON cake_requests(status, id);
    CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON admin_activity(created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_reference
      ON payments(provider_reference);
  `);

  database = sqliteDatabase;
}

export async function verifyDatabaseSchema() {
  if (databaseKind !== "postgres") return;

  const requiredTables = [
    "admins",
    "admin_activity",
    "cake_requests",
    "contact_messages",
    "custom_menu_items",
    "customer_favorites",
    "customer_saved_carts",
    "customers",
    "discount_codes",
    "flavors",
    "fulfillment_slots",
    "fulfillment_zones",
    "loyalty_ledger",
    "menu_categories",
    "menu_inventory",
    "menu_reviews",
    "order_items",
    "orders",
    "payments",
    "stores",
  ];
  const result = await database.prepare(`
    SELECT table_name AS "tableName"
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name = ANY(?)
  `).all(requiredTables);
  const presentTables = new Set(result.map(({ tableName }) => tableName));
  const missingTables = requiredTables.filter((tableName) => !presentTables.has(tableName));
  if (missingTables.length) {
    throw new Error(
      `PostgreSQL schema is incomplete. Missing tables: ${missingTables.join(", ")}. ` +
      "Migrate the SQLite schema and data into this database before starting the app.",
    );
  }

  await database.prepare(`
    ALTER TABLE admins ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'owner'
  `).run();
  await database.prepare(`
    ALTER TABLE admins ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL
  `).run();
  await database.prepare(`
    ALTER TABLE admins ADD COLUMN IF NOT EXISTS security_pin_hash TEXT
  `).run();
  await database.prepare(`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_reminder_sent_at TEXT
  `).run();
  await database.prepare(`
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS welcome_notification_sent_at TEXT
  `).run();
  // Built-in menu products need a stock row before they can be ordered; products added to the
  // menu in src/data.js get theirs here (existing rows and their stock are left untouched).
  for (const category of coldStoneMenuCategories) {
    for (const item of category.items) {
      await database
        .prepare("INSERT INTO menu_inventory (item_id) VALUES (?) ON CONFLICT (item_id) DO NOTHING")
        .run(getMenuItemId(category.title, item.name));
    }
  }
  await database.prepare(`
    CREATE TABLE IF NOT EXISTS event_orders (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_time TEXT NOT NULL,
      guest_count INTEGER NOT NULL,
      fulfillment_type TEXT NOT NULL,
      delivery_address TEXT NOT NULL DEFAULT '',
      items_json TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      estimated_total INTEGER NOT NULL,
      quoted_total INTEGER,
      deposit_amount INTEGER,
      status TEXT NOT NULL DEFAULT 'new',
      admin_note TEXT NOT NULL DEFAULT '',
      deposit_provider TEXT,
      deposit_reference TEXT,
      deposit_external_reference TEXT,
      deposit_paid_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
  await database.prepare(`
    CREATE INDEX IF NOT EXISTS idx_event_orders_customer ON event_orders(customer_id)
  `).run();
  await database.prepare(`
    CREATE INDEX IF NOT EXISTS idx_event_orders_store_date ON event_orders(store_id, event_date)
  `).run();
  await database.prepare(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).run();
  await database.prepare(`
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_customer ON push_subscriptions(customer_id)
  `).run();
  for (const [baseTitle, previousImage, image] of CATEGORY_IMAGE_UPDATES) {
    await database.prepare(
      "UPDATE menu_categories SET image = ? WHERE base_title = ? AND image = ?",
    ).run(image, baseTitle, previousImage);
  }
  for (const [baseTitle, previousDescription, description] of CATEGORY_DESCRIPTION_UPDATES) {
    await database.prepare(
      "UPDATE menu_categories SET description = ? WHERE base_title = ? AND description = ?",
    ).run(description, baseTitle, previousDescription);
  }
  // One transaction, so the vanilla/strawberry swap never leaves both on the same photo.
  await database.transaction(async () => {
    for (const [name, previousImage, image] of FLAVOR_IMAGE_UPDATES) {
      await database.prepare(
        "UPDATE flavors SET image = ? WHERE name = ? AND image = ?",
      ).run(image, name, previousImage);
    }
  });
  // The site was renamed from "Antixor Icy"; update the default and flavors that used it.
  await database.prepare(`
    ALTER TABLE flavors ALTER COLUMN origin SET DEFAULT 'Cold Stone Creamery'
  `).run();
  await database.prepare(`
    UPDATE flavors SET origin = 'Cold Stone Creamery' WHERE origin = 'Antixor Icy'
  `).run();
  await database.prepare(`
    ALTER TABLE cake_requests ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL
  `).run();
  await database.prepare(`
    ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL
  `).run();
  await database.prepare(`
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'stripe'
  `).run();
  await database.prepare(`
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_reference TEXT
  `).run();
  await database.prepare(`
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT
  `).run();
  await database.prepare(`
    UPDATE payments SET provider_reference = stripe_checkout_session_id
    WHERE provider_reference IS NULL
  `).run();
  await database.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_reference
    ON payments(provider_reference)
  `).run();
}

export function toFlavor(row) {
  return {
    ...row,
    currency: "xaf",
    reservedStock: row.reserved_stock,
    availableQuantity: Math.max(0, row.stock - row.reserved_stock),
    allergies: JSON.parse(row.allergies),
  };
}

export async function listFlavors() {
  return (await database
    .prepare("SELECT * FROM flavors ORDER BY id")
    .all())
    .map(toFlavor);
}

export async function findFlavor(id) {
  const row = await database.prepare("SELECT * FROM flavors WHERE id = ?").get(id);
  return row ? toFlavor(row) : null;
}

export async function saveFlavor(flavor) {
  const values = {
    ...flavor,
    stock:
      Number.isSafeInteger(flavor.stock) && flavor.stock >= 0
        ? flavor.stock
        : 100,
    allergies: JSON.stringify(flavor.allergies || []),
  };

  if (flavor.id) {
    await database
      .prepare(
        `
      UPDATE flavors
      SET name = @name, detail = @detail, description = @description, price = @price,
          image = @image, color = @color, tag = @tag, servings = @servings,
          allergies = @allergies, origin = @origin, stock = @stock
      WHERE id = @id
    `,
      )
      .run(values);
    return findFlavor(flavor.id);
  }

  const result = await database
    .prepare(
      `
    INSERT INTO flavors (name, detail, description, price, image, color, tag, servings, allergies, origin, stock)
    VALUES (@name, @detail, @description, @price, @image, @color, @tag, @servings, @allergies, @origin, @stock)
  `,
    )
    .run(values);
  return findFlavor(Number(result.lastInsertRowid));
}

function toMenuItem(row) {
  return {
    id: `menu:custom:${row.id}`,
    itemType: "menu",
    name: row.name,
    detail: row.detail,
    image: row.image,
    priceXaf: row.price_xaf,
    price: row.price_xaf,
    currency: "xaf",
    categoryTitle: row.category_title,
    color: "bg-[#f4f2f2]",
    stock: row.stock ?? 100,
    reservedStock: row.reserved_stock ?? 0,
    isAvailable: row.is_available !== 0,
    dietaryTags: JSON.parse(row.dietary_tags || "[]"),
    availableQuantity: Math.max(
      0,
      (row.stock ?? 100) - (row.reserved_stock ?? 0),
    ),
    lowStockThreshold: row.lowStockThreshold ?? 5,
  };
}

export async function listCustomMenuItems() {
  return (await database
    .prepare(
      `
    SELECT c.id, c.category_title, c.name, c.detail, c.image, c.price_xaf,
      COALESCE(i.stock, c.stock) AS stock,
      COALESCE(i.is_available, c.is_available) AS is_available,
      i.reserved_stock, i.dietary_tags, i.low_stock_threshold AS "lowStockThreshold"
    FROM custom_menu_items c
    LEFT JOIN menu_inventory i ON i.item_id = 'menu:custom:' || c.id
    ORDER BY c.id
  `,
    )
    .all())
    .map(toMenuItem);
}

export async function findCustomMenuItem(id) {
  const row = await database
    .prepare(
      `
    SELECT c.id, c.category_title, c.name, c.detail, c.image, c.price_xaf,
      COALESCE(i.stock, c.stock) AS stock,
      COALESCE(i.is_available, c.is_available) AS is_available,
      i.reserved_stock, i.dietary_tags, i.low_stock_threshold AS "lowStockThreshold"
    FROM custom_menu_items c
    LEFT JOIN menu_inventory i ON i.item_id = 'menu:custom:' || c.id
    WHERE c.id = ?
  `,
    )
    .get(id);
  return row ? toMenuItem(row) : null;
}

export async function saveCustomMenuItem(item) {
  if (databaseKind === "postgres") {
    return database.transaction(async () => {
      const result = await database
        .prepare(
          `
        INSERT INTO custom_menu_items (category_title, name, detail, image, price_xaf, stock, is_available)
        VALUES (@categoryTitle, @name, @detail, @image, @priceXaf, @stock, @isAvailable)
      `,
        )
        .run({ ...item, isAvailable: item.isAvailable === false ? 0 : 1 });
      const id = Number(result.lastInsertRowid);
      await database
        .prepare(
          "INSERT INTO menu_inventory (item_id, stock, is_available) VALUES (?, ?, ?)",
        )
        .run(`menu:custom:${id}`, item.stock, item.isAvailable === false ? 0 : 1);
      return findCustomMenuItem(id);
    });
  }

  const id = database.transaction(() => {
    const result = database
      .prepare(
        `
      INSERT INTO custom_menu_items (category_title, name, detail, image, price_xaf, stock, is_available)
      VALUES (@categoryTitle, @name, @detail, @image, @priceXaf, @stock, @isAvailable)
    `,
      )
      .run({ ...item, isAvailable: item.isAvailable === false ? 0 : 1 });
    const id = Number(result.lastInsertRowid);
    database
      .prepare(
        "INSERT INTO menu_inventory (item_id, stock, is_available) VALUES (?, ?, ?)",
      )
      .run(`menu:custom:${id}`, item.stock, item.isAvailable === false ? 0 : 1);
    return id;
  })();
  return findCustomMenuItem(id);
}

export async function updateCustomMenuItem(id, item) {
  if (databaseKind === "postgres") {
    await database.transaction(async () => {
      await database
        .prepare(
          `
        UPDATE custom_menu_items
        SET category_title = @categoryTitle, name = @name, detail = @detail,
            image = @image, price_xaf = @priceXaf, stock = @stock, is_available = @isAvailable
        WHERE id = @id
      `,
        )
        .run({ ...item, id, isAvailable: item.isAvailable === false ? 0 : 1 });
      const result = await database
        .prepare(
          `
        UPDATE menu_inventory SET stock = ?, is_available = ?
        WHERE item_id = ? AND reserved_stock <= ?
      `,
        )
        .run(
          item.stock,
          item.isAvailable === false ? 0 : 1,
          `menu:custom:${id}`,
          item.stock,
        );
      if (!result.changes) {
        const error = new Error(
          "Stock cannot be lower than the quantity reserved for pending checkouts.",
        );
        error.code = "STOCK_RESERVED";
        throw error;
      }
    });
    return findCustomMenuItem(id);
  }

  database.transaction(() => {
    database
      .prepare(
        `
      UPDATE custom_menu_items
      SET category_title = @categoryTitle, name = @name, detail = @detail,
          image = @image, price_xaf = @priceXaf, stock = @stock, is_available = @isAvailable
      WHERE id = @id
    `,
      )
      .run({ ...item, id, isAvailable: item.isAvailable === false ? 0 : 1 });
    const result = database
      .prepare(
        `
      UPDATE menu_inventory SET stock = ?, is_available = ?
      WHERE item_id = ? AND reserved_stock <= ?
    `,
      )
      .run(
        item.stock,
        item.isAvailable === false ? 0 : 1,
        `menu:custom:${id}`,
        item.stock,
      );
    if (!result.changes) {
      const error = new Error(
        "Stock cannot be lower than the quantity reserved for pending checkouts.",
      );
      error.code = "STOCK_RESERVED";
      throw error;
    }
  })();
  return findCustomMenuItem(id);
}

export async function deleteCustomMenuItem(id) {
  if (databaseKind === "postgres") {
    return database.transaction(async () => {
      const inventory = await database
        .prepare("SELECT reserved_stock FROM menu_inventory WHERE item_id = ?")
        .get(`menu:custom:${id}`);
      if (inventory?.reserved_stock > 0) return "reserved";
      await database
        .prepare("DELETE FROM menu_inventory WHERE item_id = ?")
        .run(`menu:custom:${id}`);
      const result = await database
        .prepare("DELETE FROM custom_menu_items WHERE id = ?")
        .run(id);
      return result.changes > 0 ? "deleted" : "not_found";
    });
  }

  return database.transaction(() => {
    const inventory = database
      .prepare("SELECT reserved_stock FROM menu_inventory WHERE item_id = ?")
      .get(`menu:custom:${id}`);
    if (inventory?.reserved_stock > 0) return "reserved";
    database
      .prepare("DELETE FROM menu_inventory WHERE item_id = ?")
      .run(`menu:custom:${id}`);
    return database
      .prepare("DELETE FROM custom_menu_items WHERE id = ?")
      .run(id).changes > 0
      ? "deleted"
      : "not_found";
  })();
}

export async function listMenuCategories() {
  return (await database
    .prepare(
      `
    SELECT id, title, description, image, icon, base_title AS "baseTitle", sort_order AS "sortOrder"
    FROM menu_categories ORDER BY sort_order, id
  `,
    )
    .all());
}

export async function saveMenuCategory(category) {
  if (databaseKind === "postgres") {
    return database.transaction(async () => {
      if (category.id) {
        await database
          .prepare(
            `
          UPDATE menu_categories
          SET title = ?, description = ?, image = ?, icon = ?, sort_order = ?
          WHERE id = ?
        `,
          )
          .run(
            category.title,
            category.description,
            category.image,
            category.icon,
            category.sortOrder,
            category.id,
          );
        await database
          .prepare(
            "UPDATE custom_menu_items SET category_title = ? WHERE category_title = ?",
          )
          .run(category.title, category.previousTitle);
        return database
          .prepare(
            `
          SELECT id, title, description, image, icon, base_title AS "baseTitle", sort_order AS "sortOrder"
          FROM menu_categories WHERE id = ?
        `,
          )
          .get(category.id);
      }
      const result = await database
        .prepare(
          `
        INSERT INTO menu_categories (title, description, image, icon, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `,
        )
        .run(
          category.title,
          category.description,
          category.image,
          category.icon,
          category.sortOrder,
        );
      return database
        .prepare(
          `
        SELECT id, title, description, image, icon, base_title AS "baseTitle", sort_order AS "sortOrder"
        FROM menu_categories WHERE id = ?
      `,
        )
        .get(Number(result.lastInsertRowid));
    });
  }

  return database.transaction(() => {
    if (category.id) {
      database
        .prepare(
          `
        UPDATE menu_categories
        SET title = ?, description = ?, image = ?, icon = ?, sort_order = ?
        WHERE id = ?
      `,
        )
        .run(
          category.title,
          category.description,
          category.image,
          category.icon,
          category.sortOrder,
          category.id,
        );
      database
        .prepare(
          "UPDATE custom_menu_items SET category_title = ? WHERE category_title = ?",
        )
        .run(category.title, category.previousTitle);
      return database
        .prepare(
          `
        SELECT id, title, description, image, icon, base_title AS "baseTitle", sort_order AS "sortOrder"
        FROM menu_categories WHERE id = ?
      `,
        )
        .get(category.id);
    }
    const result = database
      .prepare(
        `
      INSERT INTO menu_categories (title, description, image, icon, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `,
      )
      .run(
        category.title,
        category.description,
        category.image,
        category.icon,
        category.sortOrder,
      );
    return database
      .prepare(
        `
      SELECT id, title, description, image, icon, base_title AS "baseTitle", sort_order AS "sortOrder"
      FROM menu_categories WHERE id = ?
    `,
      )
      .get(Number(result.lastInsertRowid));
  })();
}

export async function deleteMenuCategory(id) {
  if (databaseKind === "postgres") {
    return database.transaction(async () => {
      const category = await database
        .prepare("SELECT title, base_title FROM menu_categories WHERE id = ?")
        .get(id);
      if (!category) return "not_found";
      const customItems = (await database
        .prepare(
          "SELECT COUNT(*) AS count FROM custom_menu_items WHERE category_title = ?",
        )
        .get(category.title)).count;
      const staticItems = category.base_title
        ? coldStoneMenuCategories.find(
            (entry) => entry.title === category.base_title,
          )?.items.length || 0
        : 0;
      if (customItems > 0 || staticItems > 0) return "not_empty";
      await database.prepare("DELETE FROM menu_categories WHERE id = ?").run(id);
      return "deleted";
    });
  }

  return database.transaction(() => {
    const category = database
      .prepare("SELECT title, base_title FROM menu_categories WHERE id = ?")
      .get(id);
    if (!category) return "not_found";
    const customItems = database
      .prepare(
        "SELECT COUNT(*) AS count FROM custom_menu_items WHERE category_title = ?",
      )
      .get(category.title).count;
    const staticItems = category.base_title
      ? coldStoneMenuCategories.find(
          (entry) => entry.title === category.base_title,
        )?.items.length || 0
      : 0;
    if (customItems > 0 || staticItems > 0) return "not_empty";
    database.prepare("DELETE FROM menu_categories WHERE id = ?").run(id);
    return "deleted";
  })();
}

export async function updateMenuInventory(
  itemId,
  { stock, isAvailable, dietaryTags, lowStockThreshold },
) {
  if (databaseKind === "postgres") {
    return database.transaction(async () => {
      const result = await database
        .prepare(
          `
        UPDATE menu_inventory SET stock = ?, is_available = ?, dietary_tags = ?, low_stock_threshold = ?
        WHERE item_id = ? AND reserved_stock <= ?
      `,
        )
        .run(
          stock,
          isAvailable ? 1 : 0,
          JSON.stringify(dietaryTags || []),
          lowStockThreshold,
          itemId,
          stock,
        );
      if (result.changes && itemId.startsWith("menu:custom:")) {
        const id = Number(itemId.slice("menu:custom:".length));
        await database
          .prepare(
            "UPDATE custom_menu_items SET stock = ?, is_available = ?, low_stock_threshold = ? WHERE id = ?",
          )
          .run(stock, isAvailable ? 1 : 0, lowStockThreshold, id);
      }
      return result.changes > 0;
    });
  }

  return database.transaction(() => {
    const result = database
      .prepare(
        `
      UPDATE menu_inventory SET stock = ?, is_available = ?, dietary_tags = ?, low_stock_threshold = ?
      WHERE item_id = ? AND reserved_stock <= ?
    `,
      )
      .run(
        stock,
        isAvailable ? 1 : 0,
        JSON.stringify(dietaryTags || []),
        lowStockThreshold,
        itemId,
        stock,
      );
    if (result.changes && itemId.startsWith("menu:custom:")) {
      const id = Number(itemId.slice("menu:custom:".length));
      database
        .prepare(
          "UPDATE custom_menu_items SET stock = ?, is_available = ?, low_stock_threshold = ? WHERE id = ?",
        )
        .run(stock, isAvailable ? 1 : 0, lowStockThreshold, id);
    }
    return result.changes > 0;
  })();
}

export async function listMenuInventory() {
  return (await database
    .prepare(
      `
    SELECT item_id AS "itemId", stock, reserved_stock AS "reservedStock",
      is_available AS "isAvailable", dietary_tags AS "dietaryTags",
      low_stock_threshold AS "lowStockThreshold"
    FROM menu_inventory
  `,
    )
    .all())
    .map((entry) => ({
      ...entry,
      isAvailable: Boolean(entry.isAvailable),
      dietaryTags: JSON.parse(entry.dietaryTags),
      lowStockThreshold: entry.lowStockThreshold,
      availableQuantity: Math.max(0, entry.stock - entry.reservedStock),
    }));
}

export async function listDiscountCodes() {
  return (await database
    .prepare(
      `
    SELECT id, code, discount_type AS "discountType", discount_value AS "discountValue",
      minimum_total AS "minimumTotal", max_uses AS "maxUses", uses, is_active AS "isActive",
      reserved_uses AS "reservedUses", expires_at AS "expiresAt"
    FROM discount_codes ORDER BY id DESC
  `,
    )
    .all())
    .map((code) => ({ ...code, isActive: Boolean(code.isActive) }));
}

export async function saveDiscountCode(code) {
  if (code.id) {
    await database
      .prepare(
        `
      UPDATE discount_codes SET code = ?, discount_type = ?, discount_value = ?,
        minimum_total = ?, max_uses = ?, is_active = ?, expires_at = ?
      WHERE id = ?
    `,
      )
      .run(
        code.code,
        code.discountType,
        code.discountValue,
        code.minimumTotal,
        code.maxUses,
        code.isActive ? 1 : 0,
        code.expiresAt || null,
        code.id,
      );
    const codes = await listDiscountCodes();
    return codes.find((entry) => entry.id === code.id);
  }
  const result = await database
    .prepare(
      `
    INSERT INTO discount_codes (code, discount_type, discount_value, minimum_total, max_uses, is_active, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      code.code,
      code.discountType,
      code.discountValue,
      code.minimumTotal,
      code.maxUses,
      code.isActive ? 1 : 0,
      code.expiresAt || null,
    );
  const codes = await listDiscountCodes();
  return codes.find((entry) => entry.id === Number(result.lastInsertRowid));
}

export async function deleteDiscountCode(id) {
  return (
    (await database.prepare("DELETE FROM discount_codes WHERE id = ?").run(id))
      .changes > 0
  );
}

export async function getValidDiscountCode(code, subtotal) {
  const discount = await database
    .prepare(
      `
    SELECT id, code, discount_type AS "discountType", discount_value AS "discountValue",
      minimum_total AS "minimumTotal", max_uses AS "maxUses", uses, expires_at AS "expiresAt"
    FROM discount_codes
    WHERE code = ? COLLATE NOCASE AND is_active = 1
      AND (expires_at IS NULL OR datetime(expires_at) > CURRENT_TIMESTAMP)
      AND (max_uses IS NULL OR uses + reserved_uses < max_uses)
  `,
    )
    .get(code);
  if (!discount || subtotal < discount.minimumTotal) return null;
  return discount;
}

export async function rollbackCheckoutOrder(orderId) {
  if (databaseKind === "postgres") {
    return database.transaction(async () => {
      const result = await database.prepare(`
        UPDATE orders SET status = 'payment_failed'
        WHERE id = ? AND status = 'pending_payment'
      `).run(orderId);
      if (result.changes === 0) return false;

      const items = await database.prepare(
        'SELECT flavor_id AS "flavorId", menu_item_id AS "menuItemId", quantity FROM order_items WHERE order_id = ? ORDER BY id',
      ).all(orderId);
      for (const item of items) {
        if (item.flavorId !== null) {
          await database.prepare(`
            UPDATE flavors SET reserved_stock = MAX(0, reserved_stock - ?)
            WHERE id = ?
          `).run(item.quantity, item.flavorId);
        } else if (item.menuItemId) {
          await database.prepare(`
            UPDATE menu_inventory SET reserved_stock = MAX(0, reserved_stock - ?)
            WHERE item_id = ?
          `).run(item.quantity, item.menuItemId);
        }
      }

      await database.prepare(`
        UPDATE discount_codes SET reserved_uses = MAX(0, reserved_uses - 1)
        WHERE id = (SELECT discount_code_id FROM orders WHERE id = ?)
      `).run(orderId);

      const order = await database.prepare(`
        SELECT customer_id AS "customerId", loyalty_points_redeemed AS "pointsRedeemed"
        FROM orders WHERE id = ?
      `).get(orderId);
      if (order?.customerId && order.pointsRedeemed > 0) {
        await database.prepare(
          "UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?",
        ).run(order.pointsRedeemed, order.customerId);
        await database.prepare(`
          INSERT OR IGNORE INTO loyalty_ledger (customer_id, order_id, points_delta, entry_type)
          VALUES (?, ?, ?, 'refunded')
        `).run(order.customerId, orderId, order.pointsRedeemed);
      }
      return true;
    });
  }

  return database.transaction(() => {
    const result = database.prepare(`
      UPDATE orders SET status = 'payment_failed'
      WHERE id = ? AND status = 'pending_payment'
    `).run(orderId)
    if (result.changes === 0) return false

    const items = database.prepare(
      'SELECT flavor_id AS "flavorId", menu_item_id AS "menuItemId", quantity FROM order_items WHERE order_id = ? ORDER BY id',
    ).all(orderId)

    for (const item of items) {
      if (item.flavorId !== null) {
        database.prepare(`
          UPDATE flavors SET reserved_stock = MAX(0, reserved_stock - ?)
          WHERE id = ?
        `).run(item.quantity, item.flavorId)
      } else if (item.menuItemId) {
        database.prepare(`
          UPDATE menu_inventory SET reserved_stock = MAX(0, reserved_stock - ?)
          WHERE item_id = ?
        `).run(item.quantity, item.menuItemId)
      }
    }

    database.prepare(`
      UPDATE discount_codes SET reserved_uses = MAX(0, reserved_uses - 1)
      WHERE id = (SELECT discount_code_id FROM orders WHERE id = ?)
    `).run(orderId)

    const order = database.prepare(`
      SELECT customer_id AS "customerId", loyalty_points_redeemed AS "pointsRedeemed"
      FROM orders WHERE id = ?
    `).get(orderId)
    if (order?.customerId && order.pointsRedeemed > 0) {
      database.prepare('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?')
        .run(order.pointsRedeemed, order.customerId)
      database.prepare(`
        INSERT OR IGNORE INTO loyalty_ledger (customer_id, order_id, points_delta, entry_type)
        VALUES (?, ?, ?, 'refunded')
      `).run(order.customerId, orderId, order.pointsRedeemed)
    }

    return true
  })()
}

export async function finalizePaidCheckout(orderId, session, provider = "stripe") {
  if (databaseKind === "postgres") {
    return database.transaction(async () => {
      const result = await database.prepare(`
        UPDATE payments
        SET status = 'paid',
            stripe_payment_intent_id = ?, provider_transaction_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE order_id = ? AND provider_reference = ? AND payment_provider = ? AND status = 'pending'
        `).run(
          provider === "stripe" && typeof session.payment_intent === "string" ? session.payment_intent : null,
          provider === "campay" ? String(session.transactionId) : null,
        orderId,
        session.id,
        provider,
      );
      if (result.changes === 0) return { paymentRecorded: false, earnedPoints: 0 };

      const items = await database.prepare(
        'SELECT flavor_id AS "flavorId", menu_item_id AS "menuItemId", quantity FROM order_items WHERE order_id = ? ORDER BY id',
      ).all(orderId);
      for (const item of items) {
        const stockResult = item.flavorId !== null
          ? await database.prepare(`
              UPDATE flavors
              SET stock = stock - ?, reserved_stock = reserved_stock - ?
              WHERE id = ? AND stock >= ? AND reserved_stock >= ?
            `).run(item.quantity, item.quantity, item.flavorId, item.quantity, item.quantity)
          : await database.prepare(`
              UPDATE menu_inventory
              SET stock = stock - ?, reserved_stock = reserved_stock - ?
              WHERE item_id = ? AND stock >= ? AND reserved_stock >= ?
            `).run(item.quantity, item.quantity, item.menuItemId, item.quantity, item.quantity);
        if (stockResult.changes === 0) {
          throw new Error(`Reserved ${item.flavorId !== null ? "flavor" : "menu"} inventory is no longer available.`);
        }
      }

      await database.prepare(`
        UPDATE discount_codes SET uses = uses + 1, reserved_uses = MAX(0, reserved_uses - 1)
        WHERE id = (SELECT discount_code_id FROM orders WHERE id = ?)
      `).run(orderId);
      const order = await database.prepare(`
        SELECT customer_id AS "customerId", subtotal_cents AS "subtotalCents",
          discount_cents AS "discountCents"
        FROM orders WHERE id = ?
      `).get(orderId);
      let earnedPoints = 0;
      if (order.customerId) {
        earnedPoints = Math.floor(Math.max(0, order.subtotalCents - order.discountCents) / 100);
        if (earnedPoints > 0) {
          await database.prepare(
            "UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?",
          ).run(earnedPoints, order.customerId);
          await database.prepare(`
            INSERT OR IGNORE INTO loyalty_ledger (customer_id, order_id, points_delta, entry_type)
            VALUES (?, ?, ?, 'earned')
          `).run(order.customerId, orderId, earnedPoints);
        }
      }
      await database.prepare(`
        UPDATE orders SET status = CASE WHEN status = 'pending_payment' THEN 'processing' ELSE status END
        WHERE id = ?
      `).run(orderId);
      return { paymentRecorded: true, earnedPoints };
    });
  }

  return database.transaction(() => {
    const updatePayment = database.prepare(`
      UPDATE payments
      SET status = 'paid',
        stripe_payment_intent_id = ?, provider_transaction_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ? AND provider_reference = ? AND payment_provider = ? AND status = 'pending'
    `)
    const updateOrder = database.prepare(`
      UPDATE orders SET status = CASE WHEN status = 'pending_payment' THEN 'processing' ELSE status END
      WHERE id = ?
    `)

    const result = updatePayment.run(
      provider === 'stripe' && typeof session.payment_intent === 'string' ? session.payment_intent : null,
      provider === 'campay' ? String(session.transactionId) : null,
      orderId,
      session.id,
      provider,
    )
    if (result.changes === 0) return { paymentRecorded: false, earnedPoints: 0 }

    const items = database.prepare(
      'SELECT flavor_id AS "flavorId", menu_item_id AS "menuItemId", quantity FROM order_items WHERE order_id = ? ORDER BY id',
    ).all(orderId)

    const decrementStock = database.prepare(`
      UPDATE flavors
      SET stock = stock - ?, reserved_stock = reserved_stock - ?
      WHERE id = ? AND stock >= ? AND reserved_stock >= ?
    `)

    for (const item of items) {
      if (item.flavorId !== null) {
        const stockResult = decrementStock.run(item.quantity, item.quantity, item.flavorId, item.quantity, item.quantity)
        if (stockResult.changes === 0) throw new Error('Reserved flavor inventory is no longer available.')
      } else if (item.menuItemId) {
        const stockResult = database.prepare(`
          UPDATE menu_inventory
          SET stock = stock - ?, reserved_stock = reserved_stock - ?
          WHERE item_id = ? AND stock >= ? AND reserved_stock >= ?
        `).run(item.quantity, item.quantity, item.menuItemId, item.quantity, item.quantity)
        if (stockResult.changes === 0) throw new Error('Reserved menu inventory is no longer available.')
      }
    }

    database.prepare(`
      UPDATE discount_codes SET uses = uses + 1, reserved_uses = MAX(0, reserved_uses - 1)
      WHERE id = (SELECT discount_code_id FROM orders WHERE id = ?)
    `).run(orderId)

    const order = database.prepare(`
      SELECT customer_id AS "customerId", subtotal_cents AS "subtotalCents",
        discount_cents AS "discountCents"
      FROM orders WHERE id = ?
    `).get(orderId)

    let earnedPoints = 0
    if (order.customerId) {
      earnedPoints = Math.floor(Math.max(0, order.subtotalCents - order.discountCents) / 100)
      if (earnedPoints > 0) {
        database.prepare('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?')
          .run(earnedPoints, order.customerId)
        database.prepare(`
          INSERT OR IGNORE INTO loyalty_ledger (customer_id, order_id, points_delta, entry_type)
          VALUES (?, ?, ?, 'earned')
        `).run(order.customerId, orderId, earnedPoints)
      }
    }

    updateOrder.run(orderId)
    return { paymentRecorded: true, earnedPoints }
  })()
}

export async function finalizeZeroAmountCheckout(orderId, orderItems) {
  if (databaseKind === "postgres") {
    return database.transaction(async () => {
      for (const item of orderItems) {
        const result = item.flavorId !== null
          ? await database.prepare(`
              UPDATE flavors SET stock = stock - ?, reserved_stock = reserved_stock - ?
              WHERE id = ? AND stock >= ? AND reserved_stock >= ?
            `).run(item.quantity, item.quantity, item.flavorId, item.quantity, item.quantity)
          : await database.prepare(`
              UPDATE menu_inventory SET stock = stock - ?, reserved_stock = reserved_stock - ?
              WHERE item_id = ? AND stock >= ? AND reserved_stock >= ?
            `).run(item.quantity, item.quantity, item.menuItemId, item.quantity, item.quantity);
        if (!result.changes) {
          throw new Error(`Reserved ${item.flavorId !== null ? "flavor" : "menu"} inventory is no longer available.`);
        }
      }
      const result = await database.prepare(`
        UPDATE orders SET status = 'processing', fulfillment_status = 'preparing'
        WHERE id = ?
      `).run(orderId);
      return result.changes > 0;
    });
  }

  return database.transaction(() => {
    for (const item of orderItems) {
      if (item.flavorId !== null) {
        const result = database.prepare(`
          UPDATE flavors SET stock = stock - ?, reserved_stock = reserved_stock - ?
          WHERE id = ? AND stock >= ? AND reserved_stock >= ?
        `).run(item.quantity, item.quantity, item.flavorId, item.quantity, item.quantity)
        if (!result.changes) {
          throw new Error('Reserved flavor inventory is no longer available.')
        }
      } else if (item.menuItemId) {
        const result = database.prepare(`
          UPDATE menu_inventory SET stock = stock - ?, reserved_stock = reserved_stock - ?
          WHERE item_id = ? AND stock >= ? AND reserved_stock >= ?
        `).run(item.quantity, item.quantity, item.menuItemId, item.quantity, item.quantity)
        if (!result.changes) {
          throw new Error('Reserved menu inventory is no longer available.')
        }
      }
    }

    const result = database.prepare(`
      UPDATE orders SET status = 'processing', fulfillment_status = 'preparing'
      WHERE id = ?
    `).run(orderId)
    return result.changes > 0
  })()
}

export async function createPaymentRecord({
  orderId,
  stripeCheckoutSessionId,
  providerReference = stripeCheckoutSessionId,
  provider = "stripe",
  amountCents,
  currency,
}) {
  const result = await database.prepare(`
    INSERT INTO payments (
      order_id, stripe_checkout_session_id, payment_provider, provider_reference, amount_cents, currency
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(orderId, stripeCheckoutSessionId, provider, providerReference, amountCents, currency)
  return {
    id: Number(result.lastInsertRowid),
    orderId,
    stripeCheckoutSessionId,
    provider,
    providerReference,
    amountCents,
    currency,
  }
}

export async function markCheckoutPaymentFailed(orderId, sessionId, provider = "stripe") {
  if (databaseKind === "postgres") {
    return database.transaction(async () => {
      const result = await database.prepare(`
        UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP
        WHERE order_id = ? AND provider_reference = ? AND payment_provider = ? AND status = 'pending'
      `).run(orderId, sessionId, provider);
      if (result.changes === 0) return false;

      const items = await database.prepare(
        'SELECT flavor_id AS "flavorId", menu_item_id AS "menuItemId", quantity FROM order_items WHERE order_id = ? ORDER BY id',
      ).all(orderId);
      for (const item of items) {
        if (item.flavorId !== null) {
          await database.prepare(`
            UPDATE flavors SET reserved_stock = MAX(0, reserved_stock - ?)
            WHERE id = ?
          `).run(item.quantity, item.flavorId);
        } else if (item.menuItemId) {
          await database.prepare(`
            UPDATE menu_inventory SET reserved_stock = MAX(0, reserved_stock - ?)
            WHERE item_id = ?
          `).run(item.quantity, item.menuItemId);
        }
      }
      await database.prepare(`
        UPDATE discount_codes SET reserved_uses = MAX(0, reserved_uses - 1)
        WHERE id = (SELECT discount_code_id FROM orders WHERE id = ?)
      `).run(orderId);
      await database.prepare(`
        UPDATE orders SET status = 'payment_failed'
        WHERE id = ? AND status = 'pending_payment'
      `).run(orderId);

      const order = await database.prepare(`
        SELECT customer_id AS "customerId", loyalty_points_redeemed AS "pointsRedeemed"
        FROM orders WHERE id = ?
      `).get(orderId);
      if (order?.customerId && order.pointsRedeemed > 0) {
        await database.prepare(
          "UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?",
        ).run(order.pointsRedeemed, order.customerId);
        await database.prepare(`
          INSERT OR IGNORE INTO loyalty_ledger (customer_id, order_id, points_delta, entry_type)
          VALUES (?, ?, ?, 'refunded')
        `).run(order.customerId, orderId, order.pointsRedeemed);
      }
      return true;
    });
  }

  return database.transaction(() => {
    const result = database.prepare(`
      UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ? AND provider_reference = ? AND payment_provider = ? AND status = 'pending'
    `).run(orderId, sessionId, provider)
    if (result.changes === 0) return false

    const items = database.prepare(
      'SELECT flavor_id AS "flavorId", menu_item_id AS "menuItemId", quantity FROM order_items WHERE order_id = ? ORDER BY id',
    ).all(orderId)

    for (const item of items) {
      if (item.flavorId !== null) {
        database.prepare(`
          UPDATE flavors SET reserved_stock = MAX(0, reserved_stock - ?)
          WHERE id = ?
        `).run(item.quantity, item.flavorId)
      } else if (item.menuItemId) {
        database.prepare(`
          UPDATE menu_inventory SET reserved_stock = MAX(0, reserved_stock - ?)
          WHERE item_id = ?
        `).run(item.quantity, item.menuItemId)
      }
    }

    database.prepare(`
      UPDATE discount_codes SET reserved_uses = MAX(0, reserved_uses - 1)
      WHERE id = (SELECT discount_code_id FROM orders WHERE id = ?)
    `).run(orderId)

    database.prepare(`
      UPDATE orders SET status = 'payment_failed'
      WHERE id = ? AND status = 'pending_payment'
    `).run(orderId)

    const order = database.prepare(`
      SELECT customer_id AS "customerId", loyalty_points_redeemed AS "pointsRedeemed"
      FROM orders WHERE id = ?
    `).get(orderId)

    if (order?.customerId && order.pointsRedeemed > 0) {
      database.prepare('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?')
        .run(order.pointsRedeemed, order.customerId)
      database.prepare(`
        INSERT OR IGNORE INTO loyalty_ledger (customer_id, order_id, points_delta, entry_type)
        VALUES (?, ?, ?, 'refunded')
      `).run(order.customerId, orderId, order.pointsRedeemed)
    }

    return true
  })()
}

export async function updateAdminProfilePicture(adminId, profilePicture) {
  if (databaseKind === "postgres") {
    return database.transaction(async () => {
      await database.prepare("UPDATE admins SET profile_picture = ? WHERE id = ?")
        .run(profilePicture, adminId);
      return database.prepare(`
        SELECT a.id, a.name, a.email, a.profile_picture AS "profilePicture",
          a.role, a.store_id AS "storeId", s.name AS "storeName"
        FROM admins a LEFT JOIN stores s ON s.id = a.store_id WHERE a.id = ?
      `).get(adminId);
    });
  }

  return database.transaction(() => {
    database.prepare('UPDATE admins SET profile_picture = ? WHERE id = ?').run(profilePicture, adminId)
    return database.prepare(`
      SELECT a.id, a.name, a.email, a.profile_picture AS "profilePicture",
        a.role, a.store_id AS "storeId", s.name AS "storeName"
      FROM admins a LEFT JOIN stores s ON s.id = a.store_id WHERE a.id = ?
    `).get(adminId)
  })()
}

export async function setCustomerBanStatus(id, isBanned) {
  if (databaseKind === "postgres") {
    return database.transaction(async () => {
      const result = await database.prepare("UPDATE customers SET is_banned = ? WHERE id = ?")
        .run(isBanned ? 1 : 0, id);
      if (!result.changes) return null;
      return { id, isBanned };
    });
  }

  return database.transaction(() => {
    const result = database.prepare('UPDATE customers SET is_banned = ? WHERE id = ?')
      .run(isBanned ? 1 : 0, id)
    if (!result.changes) return null
    return { id, isBanned }
  })()
}

export async function clearDeliveredOrders(storeId = null) {
  const storeFilter = storeId === null ? '' : ' AND store_id = ?'
  const parameters = storeId === null ? [] : [storeId]
  if (databaseKind === "postgres") {
    return database.transaction(async () => {
      const count = Number((await database.prepare(
        `SELECT COUNT(*) AS count FROM orders WHERE status = 'delivered'${storeFilter}`,
      ).get(...parameters)).count);
      if (count <= 3) return { count, deleted: false };
      const deletedCount = (await database.prepare(
        `DELETE FROM orders WHERE status = 'delivered'${storeFilter}`,
      ).run(...parameters)).changes;
      return { count: deletedCount, deleted: true };
    });
  }

  return database.transaction(() => {
    const { count } = database.prepare(
      `SELECT COUNT(*) AS count FROM orders WHERE status = 'delivered'${storeFilter}`,
    ).get(...parameters)
    if (count <= 3) return { count, deleted: false }

    const deletedCount = database.prepare(
      `DELETE FROM orders WHERE status = 'delivered'${storeFilter}`,
    ).run(...parameters).changes
    return { count: deletedCount, deleted: true }
  })()
}

export async function createAdminAccount({ name, email, passwordHash, profilePicture = '', storeId }) {
  if (databaseKind === "postgres") {
    return database.transaction(async () => {
      const result = await database.prepare(`
        INSERT INTO admins (name, email, password_hash, profile_picture, role, store_id)
        VALUES (?, ?, ?, ?, 'store_admin', ?)
      `).run(name, email, passwordHash, profilePicture, storeId);
      return database.prepare(`
        SELECT a.id, a.name, a.email, a.profile_picture AS "profilePicture",
          a.role, a.store_id AS "storeId", s.name AS "storeName"
        FROM admins a LEFT JOIN stores s ON s.id = a.store_id WHERE a.id = ?
      `).get(Number(result.lastInsertRowid));
    });
  }

  return database.transaction(() => {
    const result = database.prepare(`
      INSERT INTO admins (name, email, password_hash, profile_picture, role, store_id)
      VALUES (?, ?, ?, ?, 'store_admin', ?)
    `).run(name, email, passwordHash, profilePicture, storeId)
    return database.prepare(`
      SELECT a.id, a.name, a.email, a.profile_picture AS "profilePicture",
        a.role, a.store_id AS "storeId", s.name AS "storeName"
      FROM admins a LEFT JOIN stores s ON s.id = a.store_id WHERE a.id = ?
    `).get(Number(result.lastInsertRowid))
  })()
}

export async function updateFulfillmentZones(zones) {
  if (databaseKind === "postgres") {
    return database.transaction(async () => {
      for (const zone of zones) {
        await database.prepare(`
          UPDATE fulfillment_zones SET pickup_enabled = ?, delivery_enabled = ?,
            delivery_fee = ?, is_active = ? WHERE id = ?
        `).run(
          zone.pickupEnabled ? 1 : 0,
          zone.deliveryEnabled ? 1 : 0,
          Number(zone.deliveryFee),
          zone.isActive ? 1 : 0,
          Number(zone.id),
        );
      }
      return zones.length;
    });
  }

  return database.transaction(() => {
    const update = database.prepare(`
      UPDATE fulfillment_zones SET pickup_enabled = ?, delivery_enabled = ?,
        delivery_fee = ?, is_active = ? WHERE id = ?
    `)
    for (const zone of zones) {
      update.run(
        zone.pickupEnabled ? 1 : 0,
        zone.deliveryEnabled ? 1 : 0,
        Number(zone.deliveryFee),
        zone.isActive ? 1 : 0,
        Number(zone.id),
      )
    }
    return zones.length
  })()
}

export async function updateFulfillmentSlots(slots) {
  if (databaseKind === "postgres") {
    return database.transaction(async () => {
      await database.prepare("DELETE FROM fulfillment_slots").run();
      for (const [index, slot] of slots.entries()) {
        await database.prepare(`
          INSERT INTO fulfillment_slots (label, start_time, end_time, is_active, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          slot.label.trim(),
          slot.startTime,
          slot.endTime,
          slot.isActive ? 1 : 0,
          index,
        );
      }
      return slots.length;
    });
  }

  return database.transaction(() => {
    database.prepare('DELETE FROM fulfillment_slots').run()
    const insert = database.prepare(`
      INSERT INTO fulfillment_slots (label, start_time, end_time, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `)
    slots.forEach((slot, index) => insert.run(
      slot.label.trim(),
      slot.startTime,
      slot.endTime,
      slot.isActive ? 1 : 0,
      index,
    ))
    return slots.length
  })()
}

export async function listCakeRequests(storeId = null) {
  const storeFilter = storeId === null ? '' : 'WHERE r.store_id = ?'
  const requests = await database.prepare(`
    SELECT r.id, r.customer_name AS "customerName", r.customer_email AS "customerEmail",
      r.customer_phone AS "customerPhone", r.size, r.flavor, r.message, r.toppings,
      r.pickup_date AS "pickupDate", r.status, r.store_id AS "storeId",
      s.name AS "storeName", r.created_at AS "createdAt"
    FROM cake_requests r LEFT JOIN stores s ON s.id = r.store_id
    ${storeFilter} ORDER BY r.id DESC LIMIT 200
  `).all(...(storeId === null ? [] : [storeId]))
  return requests.map((request) => ({ ...request, toppings: JSON.parse(request.toppings) }))
}

export async function setCakeRequestStatus(id, status, storeId = null) {
  const storeFilter = storeId === null ? '' : ' AND store_id = ?'
  const parameters = storeId === null ? [status, id] : [status, id, storeId]
  if (databaseKind === "postgres") {
    return database.transaction(async () => {
      const result = await database.prepare(
        `UPDATE cake_requests SET status = ? WHERE id = ?${storeFilter}`,
      ).run(...parameters);
      if (!result.changes) return null;
      return { id, status };
    });
  }

  return database.transaction(() => {
    const result = database.prepare(
      `UPDATE cake_requests SET status = ? WHERE id = ?${storeFilter}`,
    ).run(...parameters)
    if (!result.changes) return null
    return { id, status }
  })()
}

export async function setReviewApproval(id, isApproved) {
  if (databaseKind === "postgres") {
    return database.transaction(async () => {
      const result = await database.prepare("UPDATE menu_reviews SET is_approved = ? WHERE id = ?")
        .run(isApproved ? 1 : 0, id);
      if (!result.changes) return null;
      return { id, isApproved };
    });
  }

  return database.transaction(() => {
    const result = database.prepare('UPDATE menu_reviews SET is_approved = ? WHERE id = ?')
      .run(isApproved ? 1 : 0, id)
    if (!result.changes) return null
    return { id, isApproved }
  })()
}

export async function addCustomerFavorite(customerId, itemId) {
  const result = await database.prepare(
    'INSERT OR IGNORE INTO customer_favorites (customer_id, item_id) VALUES (?, ?)',
  ).run(customerId, itemId)
  return { itemId, created: result.changes > 0 }
}

export async function removeCustomerFavorite(customerId, itemId) {
  const result = await database.prepare(
    'DELETE FROM customer_favorites WHERE customer_id = ? AND item_id = ?',
  ).run(customerId, itemId)
  return result.changes > 0
}

export async function registerCustomer({ name, email, passwordHash, profilePicture = '' }) {
  const result = await database.prepare(`
    INSERT INTO customers (name, email, password_hash, profile_picture)
    VALUES (?, ?, ?, ?)
  `).run(name, email, passwordHash, profilePicture)
  const customer = await database.prepare(`
    SELECT id, name, email, phone, delivery_city AS "deliveryCity",
      delivery_residence AS "deliveryResidence", profile_picture AS "profilePicture"
    FROM customers WHERE id = ?
  `).get(Number(result.lastInsertRowid))
  return customer
}

export async function updateCustomerProfile({ customerId, name, phone, deliveryCity, deliveryResidence, profilePicture }) {
  const result = await database.prepare(`
    UPDATE customers
    SET name = ?, phone = ?, delivery_city = ?, delivery_residence = ?, profile_picture = ?
    WHERE id = ?
  `).run(name, phone, deliveryCity, deliveryResidence, profilePicture, customerId)
  if (!result.changes) return null
  return database.prepare(`
    SELECT id, name, email, phone, delivery_city AS "deliveryCity",
      delivery_residence AS "deliveryResidence", profile_picture AS "profilePicture",
      loyalty_points AS "loyaltyPoints", is_banned AS "isBanned"
    FROM customers WHERE id = ?
  `).get(customerId)
}

export async function saveCustomerCart({ customerId, orderId, label, items }) {
  const result = await database.prepare(`
    INSERT OR IGNORE INTO customer_saved_carts (customer_id, source_order_id, label, items_json)
    VALUES (?, ?, ?, ?)
  `).run(customerId, orderId, label, JSON.stringify(items))
  if (result.changes === 0) {
    return null
  }
  const savedCart = await database.prepare(`
    SELECT id, source_order_id AS "sourceOrderId", label,
      items_json AS "itemsJson", created_at AS "createdAt"
    FROM customer_saved_carts WHERE customer_id = ? AND source_order_id = ?
  `).get(customerId, orderId)
  return {
    id: savedCart.id,
    sourceOrderId: savedCart.sourceOrderId,
    label: savedCart.label,
    items: JSON.parse(savedCart.itemsJson),
    createdAt: savedCart.createdAt,
  }
}

export async function deleteSavedCart({ customerId, id }) {
  const result = await database.prepare(
    'DELETE FROM customer_saved_carts WHERE id = ? AND customer_id = ?',
  ).run(id, customerId)
  return result.changes > 0
}

export async function deleteFlavor(id) {
  const result = await database.prepare('DELETE FROM flavors WHERE id = ?').run(id)
  return result.changes > 0
}

export async function createMenuReview({ customerId, orderId, itemId, rating, review }) {
  const result = await database.prepare(`
    INSERT INTO menu_reviews (customer_id, order_id, item_id, rating, review)
    VALUES (?, ?, ?, ?, ?)
  `).run(customerId, orderId, itemId, rating, review)
  return { reviewId: Number(result.lastInsertRowid), pendingApproval: true }
}

export async function createCakeRequest({
  customerId,
  storeId,
  customerName,
  customerEmail,
  customerPhone,
  size,
  flavor,
  message,
  toppings,
  pickupDate,
}) {
  const result = await database.prepare(`
    INSERT INTO cake_requests (
      customer_id, store_id, customer_name, customer_email, customer_phone,
      size, flavor, message, toppings, pickup_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    customerId,
    storeId,
    customerName,
    customerEmail,
    customerPhone,
    size,
    flavor,
    message,
    JSON.stringify(toppings || []),
    pickupDate,
  )
  return { id: Number(result.lastInsertRowid) }
}

export async function createContactMessage({ name, email, phone, subject, message, storeId }) {
  const result = await database.prepare(`
    INSERT INTO contact_messages (store_id, name, email, phone, subject, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(storeId, name, email, phone, subject, message)
  return { messageId: Number(result.lastInsertRowid) }
}

export async function markContactMessageRead(id, storeId = null, unassignedOnly = false) {
  const result = storeId !== null
    ? await database.prepare('UPDATE contact_messages SET is_read = 1 WHERE id = ? AND store_id = ?').run(id, storeId)
    : unassignedOnly
      ? await database.prepare('UPDATE contact_messages SET is_read = 1 WHERE id = ? AND store_id IS NULL').run(id)
      : await database.prepare('UPDATE contact_messages SET is_read = 1 WHERE id = ?').run(id)
  return result.changes > 0
}

export async function deleteContactMessage(id, storeId = null, unassignedOnly = false) {
  const storeFilter = storeId !== null ? ' AND store_id = ?' : unassignedOnly ? ' AND store_id IS NULL' : ''
  const parameters = storeId !== null ? [id, storeId] : [id]
  const result = await database.prepare(`
    DELETE FROM contact_messages WHERE id = ?
    ${storeFilter}
  `).run(...parameters)
  return result.changes > 0
}

export async function deleteContactMessages(storeId = null, unassignedOnly = false) {
  const storeFilter = storeId !== null ? ' WHERE store_id = ?' : unassignedOnly ? ' WHERE store_id IS NULL' : ''
  const parameters = storeId !== null ? [storeId] : []
  const result = await database.prepare(`DELETE FROM contact_messages${storeFilter}`).run(...parameters)
  return result.changes
}

export async function markContactMessageReplied(id, storeId = null, unassignedOnly = false) {
  const storeFilter = storeId !== null ? ' AND store_id = ?' : unassignedOnly ? ' AND store_id IS NULL' : ''
  const parameters = storeId !== null ? [id, storeId] : [id]
  const result = await database.prepare(
    `UPDATE contact_messages SET is_read = 1, replied_at = CURRENT_TIMESTAMP WHERE id = ?${storeFilter}`,
  ).run(...parameters)
  if (!result.changes) return null
  const { repliedAt } = await database.prepare(
    `SELECT replied_at AS "repliedAt" FROM contact_messages WHERE id = ?${storeFilter}`,
  ).get(...parameters)
  return { repliedAt }
}

export async function createAdminActivity({ adminId, adminName, action, method, path }) {
  const result = await database.prepare(`
    INSERT INTO admin_activity (admin_id, admin_name, action, method, path)
    VALUES (?, ?, ?, ?, ?)
  `).run(adminId, adminName, action, method, path)
  return { id: Number(result.lastInsertRowid) }
}

export async function updateOrderFulfillmentStatus(id, fulfillmentStatus) {
  if (databaseKind === "postgres") {
    return database.transaction(async () => {
      const status = fulfillmentStatus === "delivered" ? "delivered" : "processing";
      const legacyStatus = fulfillmentStatus === "delivered"
        ? "delivered"
        : fulfillmentStatus === "ready"
          ? "ready"
          : "preparing";
      const result = await database.prepare(`
        UPDATE orders
        SET fulfillment_status = ?, delivery_stage = ?, status = ?,
          delivered_at = CASE WHEN ? = 'delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END
        WHERE id = ? AND status = 'processing'
      `).run(legacyStatus, fulfillmentStatus, status, fulfillmentStatus, id);

      if (result.changes === 0) {
        const order = await database.prepare("SELECT status FROM orders WHERE id = ?").get(id);
        if (!order) return { changed: false, notFound: true };
        return { changed: false, notFound: false };
      }
      return {
        changed: true,
        notFound: false,
        fulfillmentStatus: legacyStatus,
        deliveryStage: fulfillmentStatus,
      };
    });
  }

  return database.transaction(() => {
    const status = fulfillmentStatus === 'delivered' ? 'delivered' : 'processing'
    const legacyStatus = fulfillmentStatus === 'delivered'
      ? 'delivered'
      : fulfillmentStatus === 'ready'
        ? 'ready'
        : 'preparing'

    const result = database.prepare(`
      UPDATE orders
      SET fulfillment_status = ?, delivery_stage = ?, status = ?,
        delivered_at = CASE WHEN ? = 'delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END
      WHERE id = ? AND status = 'processing'
    `).run(legacyStatus, fulfillmentStatus, status, fulfillmentStatus, id)

    if (result.changes === 0) {
      const order = database.prepare('SELECT status FROM orders WHERE id = ?').get(id)
      if (!order) return { changed: false, notFound: true }
      return { changed: false, notFound: false }
    }

    return {
      changed: true,
      notFound: false,
      fulfillmentStatus: legacyStatus,
      deliveryStage: fulfillmentStatus,
    }
  })()
}

export async function deleteFailedOrder(id) {
  if (databaseKind === "postgres") {
    return database.transaction(async () => {
      const order = await database.prepare(`
        SELECT o.status AS "orderStatus", p.status AS "paymentStatus"
        FROM orders o LEFT JOIN payments p ON p.order_id = o.id
        WHERE o.id = ?
      `).get(id);
      if (!order) return "not_found";
      if (order.orderStatus !== "payment_failed" || (order.paymentStatus && order.paymentStatus !== "failed")) {
        return "not_failed";
      }
      await database.prepare("DELETE FROM orders WHERE id = ?").run(id);
      return "deleted";
    });
  }

  return database.transaction(() => {
    const order = database.prepare(`
      SELECT o.status AS "orderStatus", p.status AS "paymentStatus"
      FROM orders o LEFT JOIN payments p ON p.order_id = o.id
      WHERE o.id = ?
    `).get(id)
    if (!order) return 'not_found'
    if (order.orderStatus !== 'payment_failed' || (order.paymentStatus && order.paymentStatus !== 'failed')) {
      return 'not_failed'
    }

    database.prepare('DELETE FROM orders WHERE id = ?').run(id)
    return 'deleted'
  })()
}

export async function createCheckoutOrder({
  customer,
  name,
  email,
  phone,
  city,
  store,
  residence,
  fulfillmentType,
  scheduledFor,
  deliveryFee,
  orderItems,
  subtotalCents,
  discountCents,
  totalCents,
  currency,
  discountCode,
  pointsRedeemed,
}) {
  if (databaseKind === "postgres") {
    return database.transaction(async () => {
      for (const item of orderItems) {
        const result = item.flavorId !== null
          ? await database.prepare(`
              UPDATE flavors SET reserved_stock = reserved_stock + ?
              WHERE id = ? AND stock - reserved_stock >= ?
            `).run(item.quantity, item.flavorId, item.quantity)
          : await database.prepare(`
              UPDATE menu_inventory SET reserved_stock = reserved_stock + ?
              WHERE item_id = ? AND is_available = 1 AND stock - reserved_stock >= ?
            `).run(item.quantity, item.menuItemId, item.quantity);
        if (result.changes === 0) {
          const error = new Error(`Not enough ${item.flavorName} in stock. Refresh your bag and try again.`);
          error.code = "INSUFFICIENT_STOCK";
          throw error;
        }
      }

      if (discountCode) {
        const reservation = await database.prepare(`
          UPDATE discount_codes SET reserved_uses = reserved_uses + 1
          WHERE id = ? AND is_active = 1
            AND (expires_at IS NULL OR datetime(expires_at) > CURRENT_TIMESTAMP)
            AND (max_uses IS NULL OR uses + reserved_uses < max_uses)
        `).run(discountCode.id);
        if (!reservation.changes) {
          const error = new Error("That discount code has just reached its usage limit. Try another code.");
          error.code = "DISCOUNT_CODE_UNAVAILABLE";
          throw error;
        }
      }

      if (pointsRedeemed > 0) {
        const points = await database.prepare(`
          UPDATE customers SET loyalty_points = loyalty_points - ?
          WHERE id = ? AND loyalty_points >= ?
        `).run(pointsRedeemed, customer.id, pointsRedeemed);
        if (!points.changes) {
          const error = new Error("Your loyalty balance changed. Refresh checkout and try again.");
          error.code = "LOYALTY_BALANCE_CHANGED";
          throw error;
        }
      }

      const result = await database.prepare(`
        INSERT INTO orders (
          customer_id, customer_name, customer_email, customer_phone, delivery_address, delivery_city,
          store_id, store_name, store_address, store_phone,
          delivery_postal_code, delivery_residence, subtotal_cents, discount_cents, total_cents,
          currency, discount_code, discount_code_id, fulfillment_type, scheduled_for,
          delivery_fee, loyalty_points_redeemed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        customer?.id ?? null,
        name,
        email,
        phone,
        "",
        city,
        store.id,
        store.name,
        store.address,
        store.phone,
        "",
        residence,
        subtotalCents,
        discountCents,
        totalCents,
        currency,
        discountCode?.code || "",
        discountCode?.id || null,
        fulfillmentType,
        scheduledFor,
        deliveryFee,
        pointsRedeemed,
      );

      const newOrderId = Number(result.lastInsertRowid);
      if (pointsRedeemed > 0) {
        await database.prepare(`
          INSERT INTO loyalty_ledger (customer_id, order_id, points_delta, entry_type)
          VALUES (?, ?, ?, 'redeemed')
        `).run(customer.id, newOrderId, -pointsRedeemed);
      }

      for (const item of orderItems) {
        await database.prepare(`
          INSERT INTO order_items (
            order_id, flavor_id, menu_item_id, flavor_name, unit_price_cents, quantity, line_total_cents
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          newOrderId,
          item.flavorId,
          item.menuItemId,
          item.flavorName,
          item.unitPriceCents,
          item.quantity,
          item.lineTotalCents,
        );
      }

      if (customer) {
        await database.prepare(`
          UPDATE customers SET name = ?, phone = ?, delivery_city = ?, delivery_residence = ? WHERE id = ?
        `).run(name, phone, city, residence, customer.id);
      }
      return newOrderId;
    });
  }

  return database.transaction(() => {
    const reserveStock = database.prepare(`
      UPDATE flavors SET reserved_stock = reserved_stock + ?
      WHERE id = ? AND stock - reserved_stock >= ?
    `)
    const reserveMenuStock = database.prepare(`
      UPDATE menu_inventory SET reserved_stock = reserved_stock + ?
      WHERE item_id = ? AND is_available = 1 AND stock - reserved_stock >= ?
    `)

    for (const item of orderItems) {
      const result = item.flavorId !== null
        ? reserveStock.run(item.quantity, item.flavorId, item.quantity)
        : reserveMenuStock.run(item.quantity, item.menuItemId, item.quantity)
      if (result.changes === 0) {
        const error = new Error(`Not enough ${item.flavorName} in stock. Refresh your bag and try again.`)
        error.code = 'INSUFFICIENT_STOCK'
        throw error
      }
    }

    if (discountCode) {
      const reservation = database.prepare(`
        UPDATE discount_codes SET reserved_uses = reserved_uses + 1
        WHERE id = ? AND is_active = 1
          AND (expires_at IS NULL OR datetime(expires_at) > CURRENT_TIMESTAMP)
          AND (max_uses IS NULL OR uses + reserved_uses < max_uses)
      `).run(discountCode.id)
      if (!reservation.changes) {
        const error = new Error('That discount code has just reached its usage limit. Try another code.')
        error.code = 'DISCOUNT_CODE_UNAVAILABLE'
        throw error
      }
    }

    if (pointsRedeemed > 0) {
      const points = database.prepare(`
        UPDATE customers SET loyalty_points = loyalty_points - ?
        WHERE id = ? AND loyalty_points >= ?
      `).run(pointsRedeemed, customer.id, pointsRedeemed)
      if (!points.changes) {
        const error = new Error('Your loyalty balance changed. Refresh checkout and try again.')
        error.code = 'LOYALTY_BALANCE_CHANGED'
        throw error
      }
    }

    const result = database.prepare(`
      INSERT INTO orders (
        customer_id, customer_name, customer_email, customer_phone, delivery_address, delivery_city,
        store_id, store_name, store_address, store_phone,
        delivery_postal_code, delivery_residence, subtotal_cents, discount_cents, total_cents,
        currency, discount_code, discount_code_id, fulfillment_type, scheduled_for,
        delivery_fee, loyalty_points_redeemed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      customer?.id ?? null,
      name,
      email,
      phone,
      '',
      city,
      store.id,
      store.name,
      store.address,
      store.phone,
      '',
      residence,
      subtotalCents,
      discountCents,
      totalCents,
      currency,
      discountCode?.code || '',
      discountCode?.id || null,
      fulfillmentType,
      scheduledFor,
      deliveryFee,
      pointsRedeemed,
    )

    const newOrderId = Number(result.lastInsertRowid)
    if (pointsRedeemed > 0) {
      database.prepare(`
        INSERT INTO loyalty_ledger (customer_id, order_id, points_delta, entry_type)
        VALUES (?, ?, ?, 'redeemed')
      `).run(customer.id, newOrderId, -pointsRedeemed)
    }

    const insertItem = database.prepare(`
      INSERT INTO order_items (
        order_id, flavor_id, menu_item_id, flavor_name, unit_price_cents, quantity, line_total_cents
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    for (const item of orderItems) {
      insertItem.run(
        newOrderId,
        item.flavorId,
        item.menuItemId,
        item.flavorName,
        item.unitPriceCents,
        item.quantity,
        item.lineTotalCents,
      )
    }

    if (customer) {
      database.prepare(`
        UPDATE customers SET name = ?, phone = ?, delivery_city = ?, delivery_residence = ? WHERE id = ?
      `).run(name, phone, city, residence, customer.id)
    }

    return newOrderId
  })()
}
