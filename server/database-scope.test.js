import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = mkdtempSync(join(tmpdir(), 'ice-cream-scope-'))
const originalBackend = process.env.DATABASE_BACKEND
const originalPath = process.env.DATABASE_PATH
process.env.DATABASE_BACKEND = 'sqlite'
process.env.DATABASE_PATH = join(directory, 'scope.sqlite')

const {
  createCakeRequest,
  createContactMessage,
  database,
  deleteContactMessage,
  deleteContactMessages,
  listCakeRequests,
  markContactMessageRead,
  setCakeRequestStatus,
} = await import('./database.js')

after(() => {
  database.close()
  rmSync(directory, { recursive: true, force: true })
  if (originalBackend === undefined) delete process.env.DATABASE_BACKEND
  else process.env.DATABASE_BACKEND = originalBackend
  if (originalPath === undefined) delete process.env.DATABASE_PATH
  else process.env.DATABASE_PATH = originalPath
})

test('cake requests and status updates are scoped to one store while an unscoped owner sees all', async () => {
  const stores = database.prepare('SELECT id FROM stores ORDER BY id LIMIT 2').all()
  assert.equal(stores.length, 2, 'test database should seed at least two stores')

  const makeRequest = (storeId, customerName) => createCakeRequest({
    customerId: null,
    storeId,
    customerName,
    customerEmail: `${customerName.toLowerCase()}@example.com`,
    customerPhone: '000000000',
    size: 'Medium',
    flavor: 'Vanilla',
    message: '',
    toppings: [],
    pickupDate: '2026-12-01',
  })
  const first = await makeRequest(stores[0].id, 'First Store')
  const second = await makeRequest(stores[1].id, 'Second Store')

  assert.deepEqual((await listCakeRequests(stores[0].id)).map(({ id }) => id), [first.id])
  assert.deepEqual(new Set((await listCakeRequests()).map(({ id }) => id)), new Set([first.id, second.id]))

  assert.equal(await setCakeRequestStatus(second.id, 'contacted', stores[0].id), null)
  assert.equal(database.prepare('SELECT status FROM cake_requests WHERE id = ?').get(second.id).status, 'new')
  assert.deepEqual(await setCakeRequestStatus(first.id, 'contacted', stores[0].id), {
    id: first.id,
    status: 'contacted',
  })
  assert.deepEqual(await setCakeRequestStatus(second.id, 'confirmed'), {
    id: second.id,
    status: 'confirmed',
  })
})

test('store-scoped contact-message actions cannot affect another store, while owner actions are unscoped', async () => {
  const stores = database.prepare('SELECT id FROM stores ORDER BY id LIMIT 2').all()
  const first = await createContactMessage({
    name: 'First Store',
    email: 'first@example.com',
    phone: '',
    subject: 'First',
    message: 'First store message',
    storeId: stores[0].id,
  })
  const second = await createContactMessage({
    name: 'Second Store',
    email: 'second@example.com',
    phone: '',
    subject: 'Second',
    message: 'Second store message',
    storeId: stores[1].id,
  })

  assert.equal(await markContactMessageRead(first.messageId, stores[0].id), true)
  assert.equal(await markContactMessageRead(second.messageId, stores[0].id), false)
  assert.equal(database.prepare('SELECT is_read AS isRead FROM contact_messages WHERE id = ?').get(second.messageId).isRead, 0)
  assert.equal(await markContactMessageRead(second.messageId), true)
  assert.equal(await deleteContactMessages(stores[0].id), 1)
  assert.ok(database.prepare('SELECT id FROM contact_messages WHERE id = ?').get(second.messageId))
  assert.equal(await deleteContactMessage(second.messageId), true)
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM contact_messages').get().count, 0)
})
