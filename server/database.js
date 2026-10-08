import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { flavors as defaultFlavors } from '../src/data.js'

const databasePath = process.env.DATABASE_PATH || fileURLToPath(new URL('./database.sqlite', import.meta.url))
export const database = new Database(databasePath)

database.pragma('journal_mode = WAL')
database.pragma('foreign_keys = ON')

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
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS flavors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    detail TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL CHECK (price > 0),
    image TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'bg-[#fff1cf]',
    tag TEXT NOT NULL DEFAULT 'New flavor',
    servings INTEGER NOT NULL DEFAULT 2,
    allergies TEXT NOT NULL DEFAULT '[]',
    origin TEXT NOT NULL DEFAULT 'Antixor Icy',
    stock INTEGER NOT NULL DEFAULT 100 CHECK (stock >= 0),
    reserved_stock INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0)
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
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_city TEXT NOT NULL,
    delivery_postal_code TEXT NOT NULL,
    subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
    discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
    total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
    currency TEXT NOT NULL DEFAULT 'usd',
    status TEXT NOT NULL DEFAULT 'pending_payment'
      CHECK (status IN ('pending_payment', 'processing', 'delivered', 'payment_failed')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered_at TEXT
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    flavor_id INTEGER,
    flavor_name TEXT NOT NULL,
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    stripe_checkout_session_id TEXT NOT NULL UNIQUE,
    stripe_payment_intent_id TEXT,
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    currency TEXT NOT NULL DEFAULT 'usd',
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'paid', 'failed')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`)

const flavorColumns = new Set(database.prepare('PRAGMA table_info(flavors)').all().map((column) => column.name))
if (!flavorColumns.has('stock')) {
  database.exec('ALTER TABLE flavors ADD COLUMN stock INTEGER NOT NULL DEFAULT 100 CHECK (stock >= 0)')
}
if (!flavorColumns.has('reserved_stock')) {
  database.exec('ALTER TABLE flavors ADD COLUMN reserved_stock INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0)')
}

const contactMessageColumns = new Set(database.prepare('PRAGMA table_info(contact_messages)').all().map((column) => column.name))
if (!contactMessageColumns.has('replied_at')) {
  database.exec('ALTER TABLE contact_messages ADD COLUMN replied_at TEXT')
}

const flavorCount = database.prepare('SELECT COUNT(*) AS count FROM flavors').get().count
if (flavorCount === 0) {
  const insertFlavor = database.prepare(`
    INSERT INTO flavors (id, name, detail, description, price, image, color, tag, servings, allergies, origin, stock)
    VALUES (@id, @name, @detail, @description, @price, @image, @color, @tag, @servings, @allergies, @origin, 100)
  `)
  const seedFlavors = database.transaction((items) => {
    for (const flavor of items) {
      insertFlavor.run({ ...flavor, allergies: JSON.stringify(flavor.allergies) })
    }
  })
  seedFlavors(defaultFlavors)
}

export function toFlavor(row) {
  return {
    ...row,
    reservedStock: row.reserved_stock,
    availableQuantity: Math.max(0, row.stock - row.reserved_stock),
    allergies: JSON.parse(row.allergies),
  }
}

export function listFlavors() {
  return database.prepare('SELECT * FROM flavors ORDER BY id').all().map(toFlavor)
}

export function findFlavor(id) {
  const row = database.prepare('SELECT * FROM flavors WHERE id = ?').get(id)
  return row ? toFlavor(row) : null
}

export function saveFlavor(flavor) {
  const values = {
    ...flavor,
    stock: Number.isSafeInteger(flavor.stock) && flavor.stock >= 0 ? flavor.stock : 100,
    allergies: JSON.stringify(flavor.allergies || []),
  }

  if (flavor.id) {
    database.prepare(`
      UPDATE flavors
      SET name = @name, detail = @detail, description = @description, price = @price,
          image = @image, color = @color, tag = @tag, servings = @servings,
          allergies = @allergies, origin = @origin, stock = @stock
      WHERE id = @id
    `).run(values)
    return findFlavor(flavor.id)
  }

  const result = database.prepare(`
    INSERT INTO flavors (name, detail, description, price, image, color, tag, servings, allergies, origin, stock)
    VALUES (@name, @detail, @description, @price, @image, @color, @tag, @servings, @allergies, @origin, @stock)
  `).run(values)
  return findFlavor(Number(result.lastInsertRowid))
}
