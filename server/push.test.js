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
  buildOrderStatusNotification,
  buildPromotionNotification,
  buildWelcomeNotification,
  countCustomerSubscriptions,
  isPushConfigured,
  normalizeNotificationMessage,
  normalizePushSubscription,
  publicKeyForPrivateKey,
  pushStatus,
  sendToAllCustomers,
  sendToCustomer,
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
  const code = { code: 'SUMMER20', discountType: 'percent', discountValue: 20, minimumTotal: 3, expiresAt: '' }
  const automatic = buildPromotionNotification(code)
  assert.equal(automatic.title, 'Cold Stone Creamery: 20% off')
  assert.match(automatic.body, /SUMMER20/)
  assert.match(automatic.body, /orders of 3\+ items/)
  assert.equal(automatic.icon, '/icons/icon-192.png')
  assert.equal(automatic.url, '/menu')

  const fixed = buildPromotionNotification({ ...code, discountType: 'fixed', discountValue: 1000, minimumTotal: 0 })
  assert.equal(fixed.title, 'Cold Stone Creamery: 1,000 FCFA off')
})

test('builds the welcome notification with the site name, logo and first name', () => {
  const welcome = buildWelcomeNotification({ name: '  Agnes Forbi ' })
  assert.equal(welcome.title, 'Welcome to Cold Stone Creamery, Agnes!')
  assert.match(welcome.body, /account was created successfully/)
  assert.equal(welcome.icon, '/icons/icon-192.png')
  assert.equal(welcome.tag, 'welcome')
  assert.equal(buildWelcomeNotification({ name: '' }).title, 'Welcome to Cold Stone Creamery!')
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
  assert.deepEqual(result, { devices: 3, sent: 2, removed: 1, failed: 0, skipped: false, errors: [] })
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
  assert.deepEqual(result.errors, ['The push service returned HTTP 503.'])
  assert.equal(await countCustomerSubscriptions(db), 3)
})

test('explains a key rejection so the owner knows what to fix', async () => {
  const db = memoryDatabase()
  const result = await sendToAllCustomers(db, { title: 't', body: 'b' }, {
    send: async () => { throw Object.assign(new Error('Forbidden'), { statusCode: 403 }) },
  })
  assert.equal(result.sent, 0)
  assert.equal(result.errors.length, 1)
  assert.match(result.errors[0], /rejected the site's keys/)
})

test('reports the set-up as ready when the keys are a matching pair', () => {
  assert.equal(publicKeyForPrivateKey(keys.privateKey), keys.publicKey)
  assert.deepEqual(pushStatus(), { configured: true, problem: '' })
})

test('detects a public and private key that do not belong together', () => {
  const other = webpush.generateVAPIDKeys()
  assert.notEqual(publicKeyForPrivateKey(other.privateKey), keys.publicKey)
})

test('order notifications describe each step and replace each other', () => {
  const preparing = buildOrderStatusNotification({ orderId: 12, status: 'preparing', fulfillmentType: 'delivery' })
  assert.equal(preparing.title, 'Order #12 is being prepared')
  assert.equal(preparing.tag, 'order-12')
  assert.equal(preparing.url, '/account/orders?tab=orders')
  assert.equal(preparing.icon, '/icons/icon-192.png')
  assert.equal(buildOrderStatusNotification({ orderId: 12, status: 'out_for_delivery', fulfillmentType: 'delivery' }).title, 'Order #12 is out for delivery')
  assert.equal(buildOrderStatusNotification({ orderId: 12, status: 'delivered', fulfillmentType: 'delivery' }).title, 'Order #12 has been delivered')
  assert.equal(buildOrderStatusNotification({ orderId: 12, status: 'confirmed' }).title, 'Order #12 confirmed')
  assert.equal(buildOrderStatusNotification({ orderId: 12, status: 'nonsense' }), null)
})

test('pickup orders are worded for pickup', () => {
  const ready = buildOrderStatusNotification({ orderId: 7, status: 'ready', fulfillmentType: 'pickup', storeName: 'Bonapriso' })
  assert.equal(ready.body, 'Your treats are ready for pickup at Bonapriso.')
  assert.equal(buildOrderStatusNotification({ orderId: 7, status: 'delivered', fulfillmentType: 'pickup' }).title, 'Order #7 has been picked up')
})

test("order updates go only to that customer's devices", async () => {
  const db = memoryDatabase()
  const delivered = []
  const result = await sendToCustomer(db, 1, { title: 'Order #1 is being prepared', body: 'b', tag: 'order-1' }, {
    send: async (subscription) => { delivered.push(subscription.endpoint) },
  })
  assert.equal(result.sent, 2)
  assert.deepEqual(delivered.sort(), ['https://push.example/ada-laptop', 'https://push.example/ada-phone'])
  const banned = await sendToCustomer(db, 3, { title: 't', body: 'b' }, { send: async () => {} })
  assert.equal(banned.devices, 0)
})
