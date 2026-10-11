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
export const database = new Database(databasePath);

database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");

database.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    profile_picture TEXT NOT NULL DEFAULT '',
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
    origin TEXT NOT NULL DEFAULT 'Antixor Icy',
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
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    currency TEXT NOT NULL DEFAULT 'xaf',
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'paid', 'failed')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

database.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const flavorCurrencyMigrationId = "flavor-prices-xaf-540";
const flavorCurrencyMigration = database
  .prepare("SELECT id FROM schema_migrations WHERE id = ?")
  .get(flavorCurrencyMigrationId);
if (!flavorCurrencyMigration) {
  database.transaction(() => {
    database
      .prepare("UPDATE flavors SET price = CAST(ROUND(price * ?) AS INTEGER)")
      .run(USD_TO_XAF);
    database
      .prepare("INSERT INTO schema_migrations (id) VALUES (?)")
      .run(flavorCurrencyMigrationId);
  })();
}

const orderColumns = new Set(
  database
    .prepare("PRAGMA table_info(orders)")
    .all()
    .map((column) => column.name),
);
if (!orderColumns.has("delivery_residence")) {
  database.exec(
    "ALTER TABLE orders ADD COLUMN delivery_residence TEXT NOT NULL DEFAULT ''",
  );
}

const flavorColumns = new Set(
  database
    .prepare("PRAGMA table_info(flavors)")
    .all()
    .map((column) => column.name),
);
if (!flavorColumns.has("stock")) {
  database.exec(
    "ALTER TABLE flavors ADD COLUMN stock INTEGER NOT NULL DEFAULT 100 CHECK (stock >= 0)",
  );
}
if (!flavorColumns.has("reserved_stock")) {
  database.exec(
    "ALTER TABLE flavors ADD COLUMN reserved_stock INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0)",
  );
}

const contactMessageColumns = new Set(
  database
    .prepare("PRAGMA table_info(contact_messages)")
    .all()
    .map((column) => column.name),
);
if (!contactMessageColumns.has("replied_at")) {
  database.exec("ALTER TABLE contact_messages ADD COLUMN replied_at TEXT");
}

function addColumnIfMissing(tableName, columnName, definition) {
  const columns = new Set(
    database
      .prepare(`PRAGMA table_info(${tableName})`)
      .all()
      .map((column) => column.name),
  );
  if (!columns.has(columnName)) {
    database.exec(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`,
    );
  }
}

addColumnIfMissing("customers", "phone", "TEXT NOT NULL DEFAULT ''");
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
  !database
    .prepare("SELECT id FROM schema_migrations WHERE id = ?")
    .get(orderStageMigrationId)
) {
  database.transaction(() => {
    database
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
    database
      .prepare("INSERT INTO schema_migrations (id) VALUES (?)")
      .run(orderStageMigrationId);
  })();
}

database.exec(`
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
`);

addColumnIfMissing("customers", "profile_picture", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing(
  "custom_menu_items",
  "low_stock_threshold",
  "INTEGER NOT NULL DEFAULT 5",
);

const seedCategory = database.prepare(`
  INSERT OR IGNORE INTO menu_categories (title, description, image, icon, base_title, sort_order)
  VALUES (@title, @description, @image, @icon, @title, @sortOrder)
`);
for (const [sortOrder, category] of coldStoneMenuCategories.entries()) {
  seedCategory.run({ ...category, sortOrder });
  for (const item of category.items) {
    database
      .prepare("INSERT OR IGNORE INTO menu_inventory (item_id) VALUES (?)")
      .run(getMenuItemId(category.title, item.name));
  }
}
database
  .prepare(
    `
  INSERT OR IGNORE INTO menu_inventory (item_id)
  SELECT 'menu:custom:' || id FROM custom_menu_items
`,
  )
  .run();

const seedZone = database.prepare(`
  INSERT OR IGNORE INTO fulfillment_zones (location, pickup_enabled)
  VALUES (?, 1)
`);
for (const location of cameroonDeliveryLocations) seedZone.run(location.value);
const seedStore = database.prepare(`
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
database.prepare(`
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
  database.prepare("SELECT COUNT(*) AS count FROM fulfillment_slots").get()
    .count === 0
) {
  const seedSlot = database.prepare(`
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

database.exec(`
  CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
  CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);
  CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);
  CREATE INDEX IF NOT EXISTS idx_menu_reviews_item_approved ON menu_reviews(item_id, is_approved);
  CREATE INDEX IF NOT EXISTS idx_cake_requests_status ON cake_requests(status, id);
  CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON admin_activity(created_at DESC);
`);

export function toFlavor(row) {
  return {
    ...row,
    currency: "xaf",
    reservedStock: row.reserved_stock,
    availableQuantity: Math.max(0, row.stock - row.reserved_stock),
    allergies: JSON.parse(row.allergies),
  };
}

export function listFlavors() {
  return database
    .prepare("SELECT * FROM flavors ORDER BY id")
    .all()
    .map(toFlavor);
}

export function findFlavor(id) {
  const row = database.prepare("SELECT * FROM flavors WHERE id = ?").get(id);
  return row ? toFlavor(row) : null;
}

export function saveFlavor(flavor) {
  const values = {
    ...flavor,
    stock:
      Number.isSafeInteger(flavor.stock) && flavor.stock >= 0
        ? flavor.stock
        : 100,
    allergies: JSON.stringify(flavor.allergies || []),
  };

  if (flavor.id) {
    database
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

  const result = database
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

export function listCustomMenuItems() {
  return database
    .prepare(
      `
    SELECT c.id, c.category_title, c.name, c.detail, c.image, c.price_xaf,
      COALESCE(i.stock, c.stock) AS stock,
      COALESCE(i.is_available, c.is_available) AS is_available,
      i.reserved_stock, i.dietary_tags, i.low_stock_threshold AS lowStockThreshold
    FROM custom_menu_items c
    LEFT JOIN menu_inventory i ON i.item_id = 'menu:custom:' || c.id
    ORDER BY c.id
  `,
    )
    .all()
    .map(toMenuItem);
}

export function findCustomMenuItem(id) {
  const row = database
    .prepare(
      `
    SELECT c.id, c.category_title, c.name, c.detail, c.image, c.price_xaf,
      COALESCE(i.stock, c.stock) AS stock,
      COALESCE(i.is_available, c.is_available) AS is_available,
      i.reserved_stock, i.dietary_tags, i.low_stock_threshold AS lowStockThreshold
    FROM custom_menu_items c
    LEFT JOIN menu_inventory i ON i.item_id = 'menu:custom:' || c.id
    WHERE c.id = ?
  `,
    )
    .get(id);
  return row ? toMenuItem(row) : null;
}

export function saveCustomMenuItem(item) {
  return database.transaction(() => {
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
    return findCustomMenuItem(id);
  })();
}

export function updateCustomMenuItem(id, item) {
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

export function deleteCustomMenuItem(id) {
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

export function listMenuCategories() {
  return database
    .prepare(
      `
    SELECT id, title, description, image, icon, base_title AS baseTitle, sort_order AS sortOrder
    FROM menu_categories ORDER BY sort_order, id
  `,
    )
    .all();
}

export function saveMenuCategory(category) {
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
        SELECT id, title, description, image, icon, base_title AS baseTitle, sort_order AS sortOrder
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
      SELECT id, title, description, image, icon, base_title AS baseTitle, sort_order AS sortOrder
      FROM menu_categories WHERE id = ?
    `,
      )
      .get(Number(result.lastInsertRowid));
  })();
}

export function deleteMenuCategory(id) {
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

export function updateMenuInventory(
  itemId,
  { stock, isAvailable, dietaryTags, lowStockThreshold },
) {
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

export function listMenuInventory() {
  return database
    .prepare(
      `
    SELECT item_id AS itemId, stock, reserved_stock AS reservedStock,
      is_available AS isAvailable, dietary_tags AS dietaryTags,
      low_stock_threshold AS lowStockThreshold
    FROM menu_inventory
  `,
    )
    .all()
    .map((entry) => ({
      ...entry,
      isAvailable: Boolean(entry.isAvailable),
      dietaryTags: JSON.parse(entry.dietaryTags),
      lowStockThreshold: entry.lowStockThreshold,
      availableQuantity: Math.max(0, entry.stock - entry.reservedStock),
    }));
}

export function listDiscountCodes() {
  return database
    .prepare(
      `
    SELECT id, code, discount_type AS discountType, discount_value AS discountValue,
      minimum_total AS minimumTotal, max_uses AS maxUses, uses, is_active AS isActive,
      reserved_uses AS reservedUses, expires_at AS expiresAt
    FROM discount_codes ORDER BY id DESC
  `,
    )
    .all()
    .map((code) => ({ ...code, isActive: Boolean(code.isActive) }));
}

export function saveDiscountCode(code) {
  if (code.id) {
    database
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
    return listDiscountCodes().find((entry) => entry.id === code.id);
  }
  const result = database
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
  return listDiscountCodes().find(
    (entry) => entry.id === Number(result.lastInsertRowid),
  );
}

export function deleteDiscountCode(id) {
  return (
    database.prepare("DELETE FROM discount_codes WHERE id = ?").run(id)
      .changes > 0
  );
}

export function getValidDiscountCode(code, subtotal) {
  const discount = database
    .prepare(
      `
    SELECT id, code, discount_type AS discountType, discount_value AS discountValue,
      minimum_total AS minimumTotal, max_uses AS maxUses, uses, expires_at AS expiresAt
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
