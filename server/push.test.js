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
  buildAdminOrderNotification,
  buildEventOrderNotification,
  buildOrderStatusNotification,
  buildPromotionNotification,
  buildReviewReminderNotification,
  buildWelcomeNotification,
  countCustomerSubscriptions,
  isPushConfigured,
  isPublicPushAddress,
  normalizeNotificationMessage,
  normalizePushUnsubscribe,
  normalizePushSubscription,
  publicKeyForPrivateKey,
  pushStatus,
  sendToAdmins,
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
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL
    );
    INSERT INTO customers (id, name, is_banned) VALUES (1, 'Ada', 0), (2, 'Ben', 0), (3, 'Banned', 1);
  `)
  const insert = db.prepare('INSERT INTO push_subscriptions (customer_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)')
  insert.run(1, 'https://fcm.googleapis.com/fcm/send/ada-phone', validKeys.p256dh, validKeys.auth)
  insert.run(1, 'https://fcm.googleapis.com/fcm/send/ada-laptop', validKeys.p256dh, validKeys.auth)
  insert.run(2, 'https://fcm.googleapis.com/fcm/send/ben-gone', validKeys.p256dh, validKeys.auth)
  insert.run(3, 'https://fcm.googleapis.com/fcm/send/banned', validKeys.p256dh, validKeys.auth)
  return db
}

test('push is enabled when VAPID keys are set', () => {
  assert.equal(isPushConfigured(), true)
})

test('accepts a real browser subscription and rejects unsafe ones', () => {
  assert.deepEqual(
    normalizePushSubscription({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      expirationTime: null,
      keys: validKeys,
    }),
    { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', ...validKeys },
  )
  assert.deepEqual(
    normalizePushSubscription({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      expirationTime: Date.now() + 60_000,
      keys: validKeys,
    }),
    { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', ...validKeys },
  )
  assert.equal(normalizePushSubscription({ endpoint: 'http://insecure.example/x', keys: validKeys }), null)
  assert.equal(normalizePushSubscription({ endpoint: 'https://attacker.example/x', keys: validKeys }), null)
  assert.equal(normalizePushSubscription({ endpoint: 'https://127.0.0.1/private', keys: validKeys }), null)
  assert.equal(normalizePushSubscription({ endpoint: 'https://user@fcm.googleapis.com/fcm/send/abc', keys: validKeys }), null)
  assert.equal(normalizePushSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: validKeys, unexpected: true }), null)
  assert.equal(normalizePushSubscription({ endpoint: 'https://push.example/x', keys: { p256dh: 'short', auth: validKeys.auth } }), null)
  assert.equal(normalizePushSubscription({ endpoint: 'not a url', keys: validKeys }), null)
  assert.equal(normalizePushSubscription(null), null)
})

test('validates and trims unsubscribe payloads without permitting extra fields', () => {
  assert.equal(normalizePushUnsubscribe({ endpoint: ' https://fcm.googleapis.com/fcm/send/abc ' }), 'https://fcm.googleapis.com/fcm/send/abc')
  assert.equal(normalizePushUnsubscribe({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', extra: true }), null)
  assert.equal(normalizePushUnsubscribe({ endpoint: ' ' }), null)
})

test('allows only globally routable push-service resolution addresses', () => {
  assert.equal(isPublicPushAddress('8.8.8.8'), true)
  assert.equal(isPublicPushAddress('2606:4700:4700::1111'), true)
  assert.equal(isPublicPushAddress('127.0.0.1'), false)
  assert.equal(isPublicPushAddress('10.0.0.1'), false)
  assert.equal(isPublicPushAddress('169.254.1.1'), false)
  assert.equal(isPublicPushAddress('::1'), false)
  assert.equal(isPublicPushAddress('::ffff:127.0.0.1'), false)
  assert.equal(isPublicPushAddress('not-an-ip'), false)
})

test('builds the promotion notification with the site name, logo and code', () => {
  const code = { code: 'SUMMER20', discountType: 'percent', discountValue: 20, minimumTotal: 3, expiresAt: '' }
  const automatic = buildPromotionNotification(code)
  assert.equal(automatic.title, 'Cold Stone Creamery: 20% off')
  assert.match(automatic.body, /SUMMER20/)
  assert.match(automatic.body, /orders of 3\+ items/)
  assert.equal(automatic.icon, '/logo.png')
  assert.equal(automatic.url, '/menu')

  const fixed = buildPromotionNotification({ ...code, discountType: 'fixed', discountValue: 1000, minimumTotal: 0 })
  assert.equal(fixed.title, 'Cold Stone Creamery: 1,000 FCFA off')
})

test('builds the welcome notification with the site name, logo and first name', () => {
  const welcome = buildWelcomeNotification({ name: '  Agnes Forbi ' })
  assert.equal(welcome.title, 'Welcome to Cold Stone Creamery, Agnes!')
  assert.match(welcome.body, /account was created successfully/)
  assert.equal(welcome.icon, '/logo.png')
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
  assert.deepEqual(delivered.map(([endpoint]) => endpoint).sort(), [
    'https://fcm.googleapis.com/fcm/send/ada-laptop',
    'https://fcm.googleapis.com/fcm/send/ada-phone',
  ])
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

test('removes legacy subscriptions with unapproved endpoints without sending to them', async () => {
  const db = memoryDatabase()
  db.prepare('INSERT INTO push_subscriptions (customer_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)')
    .run(1, 'https://127.0.0.1/private', validKeys.p256dh, validKeys.auth)
  const attempted = []
  const result = await sendToCustomer(db, 1, { title: 't', body: 'b' }, {
    send: async (subscription) => { attempted.push(subscription.endpoint) },
  })
  assert.equal(result.removed, 1)
  assert.equal(result.sent, 2)
  assert.equal(attempted.some((endpoint) => endpoint.includes('127.0.0.1')), false)
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM push_subscriptions WHERE endpoint = 'https://127.0.0.1/private'").get().n, 0)
})

test('removes rejected subscriptions and explains how to restore alerts', async () => {
  for (const statusCode of [401, 403]) {
    const db = memoryDatabase()
    const result = await sendToAllCustomers(db, { title: 't', body: 'b' }, {
      send: async () => { throw Object.assign(new Error('Forbidden'), { statusCode }) },
    })
    assert.equal(result.sent, 0)
    assert.equal(result.removed, 3)
    assert.equal(result.failed, 3)
    assert.equal(result.errors.length, 1)
    assert.match(result.errors[0], new RegExp(`VAPID credentials \\(HTTP ${statusCode}\\)`))
    assert.match(result.errors[0], /turn alerts on again/)
    assert.equal(await countCustomerSubscriptions(db), 0)
    db.close()
  }
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
  assert.equal(preparing.title, 'Cold Stone Creamery: Order #12 is being prepared')
  assert.equal(preparing.tag, 'order-12')
  assert.equal(preparing.url, '/account/orders?tab=orders')
  assert.equal(preparing.icon, '/logo.png')
  assert.equal(buildOrderStatusNotification({ orderId: 12, status: 'out_for_delivery', fulfillmentType: 'delivery' }).title, 'Cold Stone Creamery: Order #12 is out for delivery')
  assert.equal(buildOrderStatusNotification({ orderId: 12, status: 'delivered', fulfillmentType: 'delivery' }).title, 'Cold Stone Creamery: Order #12 has been delivered')
  assert.equal(buildOrderStatusNotification({ orderId: 12, status: 'confirmed' }).title, 'Cold Stone Creamery: Order #12 confirmed')
  assert.equal(buildOrderStatusNotification({ orderId: 12, status: 'nonsense' }), null)
})

test('pickup orders are worded for pickup', () => {
  const ready = buildOrderStatusNotification({ orderId: 7, status: 'ready', fulfillmentType: 'pickup', storeName: 'Bonapriso' })
  assert.equal(ready.body, 'Your treats are ready for pickup at Bonapriso.')
  assert.equal(buildOrderStatusNotification({ orderId: 7, status: 'delivered', fulfillmentType: 'pickup' }).title, 'Cold Stone Creamery: Order #7 has been picked up')
})

test("order updates go only to that customer's devices", async () => {
  const db = memoryDatabase()
  const delivered = []
  const result = await sendToCustomer(db, 1, { title: 'Order #1 is being prepared', body: 'b', tag: 'order-1' }, {
    send: async (subscription) => { delivered.push(subscription.endpoint) },
  })
  assert.equal(result.sent, 2)
  assert.deepEqual(delivered.sort(), [
    'https://fcm.googleapis.com/fcm/send/ada-laptop',
    'https://fcm.googleapis.com/fcm/send/ada-phone',
  ])
  const banned = await sendToCustomer(db, 3, { title: 't', body: 'b' }, { send: async () => {} })
  assert.equal(banned.devices, 0)
})

test('new-order alerts reach the admin devices of the given admin IDs', async () => {
  const db = memoryDatabase()
  db.exec('CREATE TABLE admins (id INTEGER PRIMARY KEY)')
  db.exec('ALTER TABLE push_subscriptions ADD COLUMN admin_id INTEGER REFERENCES admins(id)')
  db.prepare('INSERT INTO admins (id) VALUES (7), (8)').run()
  db.prepare('INSERT INTO push_subscriptions (customer_id, admin_id, endpoint, p256dh, auth) VALUES (NULL, ?, ?, ?, ?)')
    .run(7, 'https://fcm.googleapis.com/fcm/send/admin-7', validKeys.p256dh, validKeys.auth)
  db.prepare('INSERT INTO push_subscriptions (customer_id, admin_id, endpoint, p256dh, auth) VALUES (NULL, ?, ?, ?, ?)')
    .run(8, 'https://fcm.googleapis.com/fcm/send/admin-8', validKeys.p256dh, validKeys.auth)
  const delivered = []
  const result = await sendToAdmins(db, buildAdminOrderNotification({ orderId: 42, storeName: 'Douala', totalCents: 2500 }), {
    adminIds: [7],
    send: async (subscription) => { delivered.push(subscription.endpoint) },
  })
  assert.equal(result.sent, 1)
  assert.deepEqual(delivered, ['https://fcm.googleapis.com/fcm/send/admin-7'])
  const none = await sendToAdmins(db, { title: 't', body: 'b' }, { adminIds: [] })
  assert.equal(none.devices, 0)
})

test('builds the admin new-order notification with store, amount and dashboard link', () => {
  const notification = buildAdminOrderNotification({ orderId: 42, storeName: 'Douala', totalCents: 2500, currency: 'xaf' })
  assert.equal(notification.title, 'Cold Stone Creamery: New order #42 at Douala · 2,500 XAF')
  assert.match(notification.body, /Tap to open it in the admin dashboard/)
  assert.equal(notification.tag, 'admin-order-42')
  assert.equal(notification.url, '/admin/orders?order=42')
  assert.equal(notification.icon, '/logo.png')
})

test('brands every push type with the site name and logo', () => {
  const notifications = [
    buildPromotionNotification({ code: 'SWEET', discountType: 'percent', discountValue: 10, minimumTotal: 0, expiresAt: '' }),
    buildOrderStatusNotification({ orderId: 8, status: 'preparing' }),
    buildEventOrderNotification({ eventOrderId: 9, kind: 'confirmed' }),
    buildAdminOrderNotification({ orderId: 10, storeName: 'Douala', totalCents: 500 }),
    buildWelcomeNotification(),
    buildReviewReminderNotification({ orderId: 11 }),
  ]
  for (const notification of notifications) {
    assert.match(notification.title, /Cold Stone Creamery/)
    assert.equal(notification.icon, '/logo.png')
    assert.equal(notification.badge, '/logo.png')
  }
})

test('adds branding to custom push payloads without duplicating the site name', async () => {
  const db = memoryDatabase()
  const delivered = []
  await sendToCustomer(db, 1, { title: 'Order update', body: 'Ready', icon: '/wrong.png' }, {
    send: async (_subscription, payload) => delivered.push(JSON.parse(payload)),
  })
  assert.equal(delivered.length, 2)
  for (const notification of delivered) {
    assert.equal(notification.title, 'Cold Stone Creamery: Order update')
    assert.equal(notification.icon, '/logo.png')
    assert.equal(notification.badge, '/logo.png')
  }

  let duplicateTitle
  await sendToCustomer(db, 1, { title: 'Cold Stone Creamery: hello', body: 'Hi' }, {
    send: async (_subscription, payload) => { duplicateTitle = JSON.parse(payload).title },
  })
  assert.equal(duplicateTitle, 'Cold Stone Creamery: hello')
})
