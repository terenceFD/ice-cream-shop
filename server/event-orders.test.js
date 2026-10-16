import assert from 'node:assert/strict'
import test from 'node:test'
import { registerEventOrderRoutes, suggestedDeposit, validateEventRequest } from './event-orders.js'

const day = 86_400_000
const doualaDate = (offsetDays) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date(Date.now() + offsetDays * day))

const menu = {
  'flavor:1': { name: 'Vanilla Dream', price: 1500 },
  'menu:ice-cream:sundae': { name: 'Sundae', priceXaf: 3200 },
}
const deps = {
  resolveItem: async (id) => menu[id] || null,
  findStore: async (id, type) => (id === 1 && type === 'delivery' ? { id: 1, name: 'Bonanjo' } : id === 2 ? { id: 2, name: 'Akwa' } : null),
}
const valid = () => ({
  eventType: 'birthday',
  eventDate: doualaDate(10),
  eventTime: '15:30',
  guestCount: 40,
  fulfillmentType: 'delivery',
  deliveryAddress: 'Rue de la Joie, Bonapriso',
  phone: '+237 6 99 00 00 00',
  storeId: 1,
  items: [{ itemId: 'flavor:1', quantity: 20 }, { itemId: 'menu:ice-cream:sundae', quantity: 5 }, { itemId: 'flavor:1', quantity: 5 }],
  notes: 'Nut allergy at the table',
})

test('suggests a 30% deposit rounded up to the next 100 FCFA', () => {
  assert.equal(suggestedDeposit(53_500), 16_100)
  assert.equal(suggestedDeposit(10_000), 3_000)
  assert.equal(suggestedDeposit(0), 0)
})

test('prices a valid request from the current menu and merges repeated items', async () => {
  const { error, value } = await validateEventRequest(valid(), deps)
  assert.equal(error, undefined)
  assert.equal(value.items.length, 2)
  assert.deepEqual(value.items[0], { itemId: 'flavor:1', name: 'Vanilla Dream', quantity: 25, unitPrice: 1500, lineTotal: 37_500 })
  assert.equal(value.estimatedTotal, 25 * 1500 + 5 * 3200)
  assert.equal(value.storeName, 'Bonanjo')
})

test('rejects dates that are too soon or too far away', async () => {
  assert.match((await validateEventRequest({ ...valid(), eventDate: doualaDate(0) }, deps)).error, /event date/)
  assert.match((await validateEventRequest({ ...valid(), eventDate: doualaDate(400) }, deps)).error, /event date/)
})

test('requires at least 10 items in total', async () => {
  const { error } = await validateEventRequest({ ...valid(), items: [{ itemId: 'flavor:1', quantity: 4 }] }, deps)
  assert.match(error, /start at 10 items/)
})

test('requires an address for delivery but not for pickup', async () => {
  assert.match((await validateEventRequest({ ...valid(), deliveryAddress: '' }, deps)).error, /delivery address/)
  const pickup = await validateEventRequest({ ...valid(), fulfillmentType: 'pickup', storeId: 2, deliveryAddress: '' }, deps)
  assert.equal(pickup.error, undefined)
  assert.equal(pickup.value.deliveryAddress, '')
})

test('refuses stores that do not offer the chosen service, and unknown items', async () => {
  assert.match((await validateEventRequest({ ...valid(), fulfillmentType: 'pickup', storeId: 1 }, deps)).error, /active store/)
  assert.match((await validateEventRequest({ ...valid(), items: [{ itemId: 'menu:gone', quantity: 20 }] }, deps)).error, /no longer on the menu/)
})

test('ignores any price sent by the browser', async () => {
  const { value } = await validateEventRequest({ ...valid(), items: [{ itemId: 'flavor:1', quantity: 10, unitPrice: 1 }] }, deps)
  assert.equal(value.estimatedTotal, 15_000)
})

test('only deletes declined event orders within the admin store or branch scope', async () => {
  let order = { status: 'declined', storeId: 1, storeTown: 'Douala' }
  let deleted = false
  const routes = new Map()
  const app = Object.fromEntries(['get', 'post', 'patch', 'delete'].map((method) => [
    method,
    (path, _middleware, handler) => routes.set(`${method.toUpperCase()} ${path}`, handler),
  ]))
  registerEventOrderRoutes(app, {
    database: {
      prepare: (query) => ({
        get: async () => query.includes('FROM event_orders') ? {
          ...order,
          itemsJson: '[]',
          guestCount: 10,
          estimatedTotal: 1000,
          quotedTotal: null,
          depositAmount: null,
        } : null,
        run: async () => {
          deleted = true
          return { changes: 1 }
        },
      }),
    },
  })
  const remove = routes.get('DELETE /api/admin/event-orders/:id')
  const requestFor = (admin) => ({ params: { id: '7' }, admin })
  const responseFor = () => ({
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
    end() { this.ended = true; return this },
  })

  const wrongBranchResponse = responseFor()
  await remove(requestFor({ role: 'branch_admin', branchTown: 'Yaoundé' }), wrongBranchResponse)
  assert.equal(wrongBranchResponse.statusCode, 404)
  assert.equal(deleted, false)

  order = { status: 'confirmed', storeId: 1, storeTown: 'Douala' }
  const activeResponse = responseFor()
  await remove(requestFor({ role: 'store_admin', storeId: 1 }), activeResponse)
  assert.equal(activeResponse.statusCode, 409)
  assert.equal(deleted, false)

  order = { status: 'declined', storeId: 1, storeTown: 'Douala' }
  const declinedResponse = responseFor()
  await remove(requestFor({ role: 'store_admin', storeId: 1 }), declinedResponse)
  assert.equal(declinedResponse.statusCode, 204)
  assert.equal(declinedResponse.ended, true)
  assert.equal(deleted, true)
})
