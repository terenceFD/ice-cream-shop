// Deletes ALL test accounts and ALL orders/cake requests/event orders/contact

// messages, EXCEPT Terence Timah's own accounts. Backs up the database first.
// LOCAL DATABASE ONLY — production is cleaned separately via Supabase SQL.
import Database from 'better-sqlite3'
import { copyFileSync, existsSync } from 'node:fs'

const DB = 'server/database.sqlite'
const KEEP_CUSTOMER_ID = 23 // Terence Timah (terencetimah1@gmail.com)
const KEEP_ADMIN_ID = 1 // Terence Timah (terencetimah3@gmail.com, owner)

if (!existsSync(DB)) throw new Error('database not found')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = `backup-before-cleanup-${stamp}.sqlite`
copyFileSync(DB, backup)
console.log(`backup created: ${backup}`)

const db = new Database(DB)
const count = (sql) => db.prepare(sql).get().c

const before = {
  customers: count('SELECT COUNT(*) AS c FROM customers'),
  admins: count('SELECT COUNT(*) AS c FROM admins'),
  orders: count('SELECT COUNT(*) AS c FROM orders'),
  cake: count('SELECT COUNT(*) AS c FROM cake_requests'),
  events: count('SELECT COUNT(*) AS c FROM event_orders'),
  contact: count('SELECT COUNT(*) AS c FROM contact_messages'),
  reviews: count('SELECT COUNT(*) AS c FROM menu_reviews'),
}

db.transaction(() => {
  // 1. Children that reference orders / customers (keep Terence's own rows).
  db.prepare('DELETE FROM menu_reviews WHERE order_id NOT IN (SELECT id FROM orders WHERE customer_id = ?)')
    .run(KEEP_CUSTOMER_ID)
  db.prepare('DELETE FROM loyalty_ledger WHERE customer_id <> ?').run(KEEP_CUSTOMER_ID)
  db.prepare('DELETE FROM customer_favorites WHERE customer_id <> ?').run(KEEP_CUSTOMER_ID)
  db.prepare('DELETE FROM customer_saved_carts WHERE customer_id <> ?').run(KEEP_CUSTOMER_ID)
  db.prepare('DELETE FROM push_subscriptions WHERE customer_id IS NULL OR customer_id <> ?').run(KEEP_CUSTOMER_ID)
  db.prepare('DELETE FROM push_subscriptions WHERE admin_id IS NULL OR admin_id <> ?').run(KEEP_ADMIN_ID)

  // 2. ALL orders (per request), and their line items.
  db.prepare('DELETE FROM order_items WHERE order_id NOT IN (SELECT id FROM orders WHERE customer_id = ?)')
    .run(KEEP_CUSTOMER_ID)
  db.prepare('DELETE FROM payments WHERE order_id NOT IN (SELECT id FROM orders WHERE customer_id = ?)')
    .run(KEEP_CUSTOMER_ID)
  db.prepare('DELETE FROM orders WHERE customer_id <> ? OR customer_id IS NULL').run(KEEP_CUSTOMER_ID)

  // 3. ALL cake requests, event orders, contact messages (per request).
  db.prepare('DELETE FROM cake_requests').run()
  db.prepare('DELETE FROM event_orders').run()
  db.prepare('DELETE FROM contact_messages').run()

  // 4. Test admin accounts (keep Terence) and the audit trail of the deleted ones.
  db.prepare('DELETE FROM admin_activity WHERE admin_id <> ?').run(KEEP_ADMIN_ID)
  db.prepare('DELETE FROM admins WHERE id <> ?').run(KEEP_ADMIN_ID)

  // 5. Test customer accounts (keep Terence).
  db.prepare('DELETE FROM customers WHERE id <> ?').run(KEEP_CUSTOMER_ID)

  // 6. Leftover verification records from testing.
  db.prepare('DELETE FROM pending_customer_signups').run()
  db.prepare('DELETE FROM password_resets').run()
})()

const after = {
  customers: count('SELECT COUNT(*) AS c FROM customers'),
  admins: count('SELECT COUNT(*) AS c FROM admins'),
  orders: count('SELECT COUNT(*) AS c FROM orders'),
  cake: count('SELECT COUNT(*) AS c FROM cake_requests'),
  events: count('SELECT COUNT(*) AS c FROM event_orders'),
  contact: count('SELECT COUNT(*) AS c FROM contact_messages'),
  reviews: count('SELECT COUNT(*) AS c FROM menu_reviews'),
}
console.log('before:', JSON.stringify(before))
console.log('after: ', JSON.stringify(after))

console.log('\nkept customers:', JSON.stringify(db.prepare('SELECT id, name, email FROM customers').all()))
console.log('kept admins:   ', JSON.stringify(db.prepare('SELECT id, name, email, role FROM admins').all()))
db.close()
