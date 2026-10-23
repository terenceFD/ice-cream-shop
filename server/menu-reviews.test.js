import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = mkdtempSync(join(tmpdir(), 'ice-cream-reviews-'))
const originalBackend = process.env.DATABASE_BACKEND
const originalPath = process.env.DATABASE_PATH
process.env.DATABASE_BACKEND = 'sqlite'
process.env.DATABASE_PATH = join(directory, 'reviews.sqlite')

const { createMenuReviews, database, setReviewApproval } = await import('./database.js')

after(() => {
  database.close()
  rmSync(directory, { recursive: true, force: true })
  if (originalBackend === undefined) delete process.env.DATABASE_BACKEND
  else process.env.DATABASE_BACKEND = originalBackend
  if (originalPath === undefined) delete process.env.DATABASE_PATH
  else process.env.DATABASE_PATH = originalPath
})

test('creates reviews for multiple purchased products in one SQLite transaction', async () => {
  const customerId = Number(database.prepare(`
    INSERT INTO customers (name, email, password_hash)
    VALUES ('Review Customer', 'review@example.com', 'test-hash')
  `).run().lastInsertRowid)
  const orderId = Number(database.prepare(`
    INSERT INTO orders (
      customer_id, customer_name, customer_email, customer_phone,
      delivery_address, delivery_city, subtotal_cents, total_cents, status
    ) VALUES (?, 'Review Customer', 'review@example.com', '000000000', '', 'Douala', 1000, 1000, 'delivered')
  `).run(customerId).lastInsertRowid)

  const created = await createMenuReviews({
    customerId,
    orderId,
    itemIds: ['menu:ice-cream:first', 'menu:ice-cream:second'],
    rating: 5,
    review: 'Delicious',
  })

  assert.equal(created.length, 2)
  assert.deepEqual(
    database.prepare('SELECT item_id FROM menu_reviews WHERE order_id = ? ORDER BY item_id')
      .all(orderId)
      .map((row) => row.item_id),
    ['menu:ice-cream:first', 'menu:ice-cream:second'],
  )

  const firstReview = database.prepare(
    'SELECT id FROM menu_reviews WHERE order_id = ? ORDER BY item_id LIMIT 1',
  ).get(orderId)
  await setReviewApproval(firstReview.id, true)
  assert.equal(
    database.prepare('SELECT COUNT(*) AS count FROM menu_reviews WHERE is_approved = TRUE').get().count,
    1,
  )
  assert.equal(
    database.prepare('SELECT COUNT(*) AS count FROM menu_reviews WHERE is_approved = FALSE').get().count,
    1,
  )
})
