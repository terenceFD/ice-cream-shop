import assert from 'node:assert/strict'
import test from 'node:test'
import { registerCakeQuoteRoutes } from './cake-quotes.js'

function routeHarness(database, overrides = {}) {
  const routes = new Map()
  const app = Object.fromEntries(['get', 'post', 'patch'].map((method) => [
    method,
    (path, ...handlers) => routes.set(`${method.toUpperCase()} ${path}`, handlers.at(-1)),
  ]))
  const deps = {
    database,
    requireCustomer: () => {},
    requireAdmin: () => {},
    getStripe: () => null,
    isCamPayMobileMoneyEnabled: () => false,
    createCamPayPaymentLink: async () => ({}),
    getCamPayTransaction: async () => null,
    normalizeCameroonPhone: (phone) => phone,
    publicSiteUrl: () => 'https://example.test',
    email: { isConfigured: () => false },
    describeEmailError: (error) => error.message,
    selectedStoreTown: (admin) => admin.selectedStoreTown || null,
    ...overrides,
  }
  registerCakeQuoteRoutes(app, deps)
  return { routes, deps }
}

function responseFor() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
    end() { this.ended = true; return this },
  }
}

function cakeRow(overrides = {}) {
  return {
    id: 17,
    customerId: 4,
    storeId: 8,
    storeName: 'Bonanjo',
    storeTown: 'Douala',
    customerName: 'Amina',
    customerEmail: 'amina@example.test',
    customerPhone: '+237699000000',
    size: 'Medium',
    flavor: 'Vanilla',
    message: '',
    toppings: '[]',
    pickupDate: '2026-11-10',
    status: 'contacted',
    quotedTotal: 24000,
    depositAmount: 7200,
    adminNote: '',
    payToken: 'cake-pay-token',
    depositProvider: 'stripe',
    depositReference: 'cs_test_17',
    depositExternalReference: null,
    depositPaidAt: null,
    createdAt: '2026-10-18T12:00:00.000Z',
    ...overrides,
  }
}

test('a paid Stripe cake deposit marks the request and notifies the cake store admins', async () => {
  let row = cakeRow()
  let updateQuery = ''
  let recipients = null
  const database = {
    prepare(query) {
      return {
        get: async () => row,
        all: async () => [{ email: 'owner@example.test' }, { email: 'bonanjo@example.test' }],
        run: async (...args) => {
          if (query.includes('UPDATE cake_requests')) {
            updateQuery = query
            row = cakeRow({ status: 'confirmed', depositPaidAt: args[0] })
            return { changes: 1 }
          }
          return { changes: 1 }
        },
      }
    },
  }
  const { deps } = routeHarness(database, {
    email: {
      isConfigured: () => true,
      async sendCakeDepositReceived({ recipients: sentTo, request }) {
        recipients = sentTo
        assert.equal(request.id, 17)
        assert.equal(request.depositAmount, 7200)
      },
    },
  })

  await deps.onStripeCakeDepositPaid({
    metadata: { cakeRequestId: '17' },
    payment_status: 'paid',
    amount_total: 7200,
  })
  await new Promise((resolve) => setImmediate(resolve))

  assert.match(updateQuery, /deposit_admin_seen = 0/)
  assert.deepEqual(recipients, ['owner@example.test', 'bonanjo@example.test'])
})

test('the payment-return confirmation verifies Stripe, books the cake, and returns its confirmed state', async () => {
  let row = cakeRow()
  let updateQuery = ''
  const database = {
    prepare(query) {
      return {
        get: async () => row,
        all: async () => [],
        run: async (...args) => {
          if (query.includes('UPDATE cake_requests')) {
            updateQuery = query
            row = cakeRow({ status: 'confirmed', depositPaidAt: args[0] })
            return { changes: 1 }
          }
          return { changes: 1 }
        },
      }
    },
  }
  const { routes } = routeHarness(database, {
    getStripe: () => ({
      checkout: {
        sessions: {
          retrieve: async (id) => ({
            id,
            payment_status: 'paid',
            amount_total: 7200,
            metadata: { cakeRequestId: '17' },
          }),
        },
      },
    }),
  })
  const response = responseFor()
  await routes.get('POST /api/cake-requests/quote/:token/deposit/confirm')(
    { params: { token: 'cake-pay-token' }, body: { sessionId: 'cs_test_17' } },
    response,
  )

  assert.equal(response.body.paid, true)
  assert.equal(response.body.request.status, 'confirmed')
  assert.equal('depositReference' in response.body.request, false)
  assert.match(updateQuery, /deposit_admin_seen = 0/)
})

test('cake deposit notices are scoped to the store and can be dismissed by its admin', async () => {
  const queries = []
  let row = cakeRow({ status: 'confirmed' })
  const database = {
    prepare(query) {
      return {
        all: async (...args) => {
          queries.push({ query, args })
          return [{
            id: 17,
            customerName: 'Amina',
            depositAmount: 7200,
            size: 'Medium',
            flavor: 'Vanilla',
            pickupDate: '2026-11-10',
            storeName: 'Bonanjo',
          }]
        },
        get: async () => row,
        run: async (...args) => {
          queries.push({ query, args })
          return { changes: 1 }
        },
      }
    },
  }
  const { routes } = routeHarness(database)
  const list = routes.get('GET /api/admin/cake-requests/deposit-notices')
  const response = responseFor()
  await list({ admin: { role: 'store_admin', storeId: 8 } }, response)

  assert.equal(response.body.notices[0].depositAmount, 7200)
  assert.match(queries[0].query, /r\.store_id = \?/)
  assert.match(queries[0].query, /r\.deposit_admin_seen = 0/)
  assert.deepEqual(queries[0].args, [8])

  const dismiss = routes.get('PATCH /api/admin/cake-requests/:id/deposit-notice')
  const wrongStore = responseFor()
  await dismiss({ params: { id: '17' }, admin: { role: 'store_admin', storeId: 99 } }, wrongStore)
  assert.equal(wrongStore.statusCode, 404)

  const seen = responseFor()
  await dismiss({ params: { id: '17' }, admin: { role: 'store_admin', storeId: 8 } }, seen)
  assert.equal(seen.statusCode, 204)
  assert.equal(seen.ended, true)
  assert.match(queries.at(-1).query, /deposit_admin_seen = 1/)
})
