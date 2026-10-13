import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = mkdtempSync(join(tmpdir(), 'ice-cream-payments-'))
const originalBackend = process.env.DATABASE_BACKEND
const originalPath = process.env.DATABASE_PATH
process.env.DATABASE_BACKEND = 'sqlite'
process.env.DATABASE_PATH = join(directory, 'payments.sqlite')

const {
  createCheckoutOrder,
  createPaymentRecord,
  database,
  finalizePaidCheckout,
  listFlavors,
  markCheckoutPaymentFailed,
} = await import('./database.js')

after(() => {
  database.close()
  rmSync(directory, { recursive: true, force: true })
  if (originalBackend === undefined) delete process.env.DATABASE_BACKEND
  else process.env.DATABASE_BACKEND = originalBackend
  if (originalPath === undefined) delete process.env.DATABASE_PATH
  else process.env.DATABASE_PATH = originalPath
})

async function createPendingPayment(reference, provider = 'flutterwave', providerReference = reference) {
  database.prepare(`
    INSERT INTO flavors (name, detail, description, price, image, stock)
    VALUES (?, 'Test flavor', 'Payment test flavor', 500, '/test-flavor.jpg', 100)
  `).run(`Payment ${reference}`)
  const flavor = (await listFlavors()).find((item) => item.availableQuantity > 0)
  const store = database.prepare('SELECT id, name, address, phone FROM stores ORDER BY id LIMIT 1').get()
  assert.ok(flavor)
  assert.ok(store)
  const orderItems = [{
    flavorId: flavor.id,
    menuItemId: '',
    flavorName: flavor.name,
    unitPriceCents: flavor.price,
    quantity: 1,
    lineTotalCents: flavor.price,
  }]
  const orderId = await createCheckoutOrder({
    customer: null,
    name: 'Payment Test',
    email: `${reference}@example.com`,
    phone: '000000000',
    city: 'Douala',
    store,
    residence: '',
    fulfillmentType: 'pickup',
    scheduledFor: '2026-12-01T10:00:00+01:00',
    deliveryFee: 0,
    orderItems,
    subtotalCents: flavor.price,
    discountCents: 0,
    totalCents: flavor.price,
    currency: 'xaf',
    discountCode: null,
    pointsRedeemed: 0,
  })
  assert.deepEqual(
    [typeof orderId, typeof reference, typeof provider, typeof providerReference, typeof flavor.price],
    ['number', 'string', 'string', 'string', 'number'],
  )
  await createPaymentRecord({
    orderId,
    stripeCheckoutSessionId: reference,
    providerReference,
    provider,
    amountCents: flavor.price,
    currency: 'xaf',
  })
  return { flavor, orderId, reference }
}

test('Flutterwave payment confirmation finalizes an order and records its transaction id once', async () => {
  const payment = await createPendingPayment('flw-test-paid-reference')

  const result = await finalizePaidCheckout(
    payment.orderId,
    { id: payment.reference, transactionId: '50123' },
    'flutterwave',
  )

  assert.equal(result.paymentRecorded, true)
  assert.equal(database.prepare('SELECT status FROM orders WHERE id = ?').get(payment.orderId).status, 'processing')
  assert.deepEqual(
    database.prepare(`
      SELECT payment_provider AS provider, provider_reference AS reference,
        provider_transaction_id AS transactionId, status
      FROM payments WHERE order_id = ?
    `).get(payment.orderId),
    {
      provider: 'flutterwave',
      reference: payment.reference,
      transactionId: '50123',
      status: 'paid',
    },
  )
  assert.equal(
    (await finalizePaidCheckout(
      payment.orderId,
      { id: payment.reference, transactionId: '50123' },
      'flutterwave',
    )).paymentRecorded,
    false,
  )
})

test('a failed Flutterwave payment releases its inventory reservation exactly once', async () => {
  const payment = await createPendingPayment('flw-test-failed-reference')

  assert.equal(await markCheckoutPaymentFailed(payment.orderId, payment.reference, 'flutterwave'), true)
  assert.equal(await markCheckoutPaymentFailed(payment.orderId, payment.reference, 'flutterwave'), false)
  assert.equal(database.prepare('SELECT status FROM orders WHERE id = ?').get(payment.orderId).status, 'payment_failed')
  assert.equal(
    database.prepare('SELECT status FROM payments WHERE order_id = ?').get(payment.orderId).status,
    'failed',
  )
  assert.equal(
    database.prepare('SELECT reserved_stock AS reservedStock FROM flavors WHERE id = ?').get(payment.flavor.id).reservedStock,
    payment.flavor.reservedStock,
  )
})

test('CamPay confirmation finalizes an order and records its provider reference once', async () => {
  const payment = await createPendingPayment(
    'campay-provider-reference',
    'campay',
    'icy-order-test-reference',
  )

  const result = await finalizePaidCheckout(
    payment.orderId,
    { id: 'icy-order-test-reference', transactionId: payment.reference },
    'campay',
  )

  assert.equal(result.paymentRecorded, true)
  assert.equal(database.prepare('SELECT status FROM orders WHERE id = ?').get(payment.orderId).status, 'processing')
  assert.deepEqual(
    database.prepare(`
      SELECT payment_provider AS provider, provider_reference AS reference,
        provider_transaction_id AS transactionId, status
      FROM payments WHERE order_id = ?
    `).get(payment.orderId),
    {
      provider: 'campay',
      reference: 'icy-order-test-reference',
      transactionId: 'campay-provider-reference',
      status: 'paid',
    },
  )
})

test('a failed CamPay payment releases its inventory reservation exactly once', async () => {
  const payment = await createPendingPayment(
    'campay-failed-provider-reference',
    'campay',
    'icy-order-failed-reference',
  )

  assert.equal(await markCheckoutPaymentFailed(payment.orderId, 'icy-order-failed-reference', 'campay'), true)
  assert.equal(await markCheckoutPaymentFailed(payment.orderId, 'icy-order-failed-reference', 'campay'), false)
  assert.equal(database.prepare('SELECT status FROM orders WHERE id = ?').get(payment.orderId).status, 'payment_failed')
  assert.equal(
    database.prepare('SELECT status FROM payments WHERE order_id = ?').get(payment.orderId).status,
    'failed',
  )
  assert.equal(
    database.prepare('SELECT reserved_stock AS reservedStock FROM flavors WHERE id = ?').get(payment.flavor.id).reservedStock,
    payment.flavor.reservedStock,
  )
})
