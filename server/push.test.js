import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import webpush from 'web-push'

// Configure throwaway keys before the module reads them.
const keys = webpush.generateVAPIDKeys()
process.env.VAPID_PUBLIC_KEY = keys.publicKey
process.env.VAPID_PRIVATE_KEY = keys.privateKey
process.env.VAPID_SUBJECT = 'https://example.test'
const {
  buildPromotionNotification,
  countCustomerSubscriptions,
  isPushConfigured,
  normalizeNotificationMessage,
  normalizePushSubscription,
  sendToAllCustomers,
} = await import('./push.js')

const validKeys = {
  p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
  auth: 'tBHItJI5svbpez7KI4CCXg',
}

function memoryDatabase() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, is_banned INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL
    );
    INSERT INTO customers (id, name, is_banned) VALUES (1, 'Ada', 0), (2, 'Ben', 0), (3, 'Banned', 1);
  `)
  const insert = db.prepare('INSERT INTO push_subscriptions (customer_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)')
  insert.run(1, 'https://push.example/ada-phone', validKeys.p256dh, validKeys.auth)
  insert.run(1, 'https://push.example/ada-laptop', validKeys.p256dh, validKeys.auth)
  insert.run(2, 'https://push.example/ben-gone', validKeys.p256dh, validKeys.auth)
  insert.run(3, 'https://push.example/banned', validKeys.p256dh, validKeys.auth)
  return db
}

test('push is enabled when VAPID keys are set', () => {
  assert.equal(isPushConfigured(), true)
})

test('accepts a real browser subscription and rejects unsafe ones', () => {
  assert.deepEqual(
    normalizePushSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: validKeys }),
    { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', ...validKeys },
  )
  assert.equal(normalizePushSubscription({ endpoint: 'http://insecure.example/x', keys: validKeys }), null)
  assert.equal(normalizePushSubscription({ endpoint: 'https://push.example/x', keys: { p256dh: 'short', auth: validKeys.auth } }), null)
  assert.equal(normalizePushSubscription({ endpoint: 'not a url', keys: validKeys }), null)
  assert.equal(normalizePushSubscription(null), null)
})

test('builds the promotion notification with the site name, logo and code', () => {
  const code = { code: 'SUMMER20', discountType: 'percent', discountValue: 20, minimumTotal: 5000, expiresAt: '' }
  const automatic = buildPromotionNotification(code)
  assert.equal(automatic.title, 'Cold Stone Creamery: 20% off')
  assert.match(automatic.body, /SUMMER20/)
  assert.match(automatic.body, /5,000 FCFA/)
  assert.equal(automatic.icon, '/icons/icon-192.png')
  assert.equal(automatic.url, '/menu')

  const fixed = buildPromotionNotification({ ...code, discountType: 'fixed', discountValue: 1000, minimumTotal: 0 })
  assert.equal(fixed.title, 'Cold Stone Creamery: 1,000 FCFA off')
})

test("uses the owner's message and adds the code only when it is missing", () => {
  const code = { code: 'SUMMER20', discountType: 'percent', discountValue: 20, minimumTotal: 0, expiresAt: '' }
  assert.equal(buildPromotionNotification(code, 'Weekend treat!\n\nAll sundaes 20% off.').body, 'Weekend treat! All sundaes 20% off. Code: SUMMER20')
  assert.equal(buildPromotionNotification(code, 'Use summer20 today').body, 'Use summer20 today')
  assert.equal(normalizeNotificationMessage('  Hi\u0007 there\t '), 'Hi there')
})

test('sends to every device of non-banned customers and removes devices that are gone', async () => {
  const db = memoryDatabase()
  assert.equal(await countCustomerSubscriptions(db), 3)
  const delivered = []
  const result = await sendToAllCustomers(db, { title: 't', body: 'b', tag: 'promotion-X' }, {
    send: async (subscription, payload) => {
      if (subscription.endpoint.endsWith('ben-gone')) throw Object.assign(new Error('Gone'), { statusCode: 410 })
      delivered.push([subscription.endpoint, JSON.parse(payload).title])
    },
  })
  assert.deepEqual(result, { sent: 2, removed: 1, failed: 0, skipped: false })
  assert.deepEqual(delivered.map(([endpoint]) => endpoint).sort(), ['https://push.example/ada-laptop', 'https://push.example/ada-phone'])
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM push_subscriptions WHERE endpoint LIKE '%ben-gone'").get().n, 0)
  assert.equal(await countCustomerSubscriptions(db), 2)
})

test('a temporary push-service error keeps the device for next time', async () => {
  const db = memoryDatabase()
  const result = await sendToAllCustomers(db, { title: 't', body: 'b' }, {
    send: async () => { throw Object.assign(new Error('Busy'), { statusCode: 503 }) },
  })
  assert.equal(result.failed, 3)
  assert.equal(result.removed, 0)
  assert.equal(await countCustomerSubscriptions(db), 3)
})
