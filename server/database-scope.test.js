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
  createAdminAccount,
  removeAdminAccount,
  database,
  deleteContactMessage,
  deleteContactMessages,
  listOrderNotificationRecipients,
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

test('branch-scoped cake and contact-message actions stay within the selected town', async () => {
  const branches = database.prepare(`
    SELECT MIN(id) AS id, town FROM stores GROUP BY town ORDER BY town
  `).all()
  assert.deepEqual(new Set(branches.map(({ town }) => town)), new Set(['Douala', 'Yaoundé']))

  const requests = await Promise.all(branches.map(({ id }, index) => createCakeRequest({
    customerId: null,
    storeId: id,
    customerName: `Branch ${index}`,
    customerEmail: `branch-${index}@example.com`,
    customerPhone: '000000000',
    size: 'Medium',
    flavor: 'Vanilla',
    message: '',
    toppings: [],
    pickupDate: '2026-12-01',
  })))

  for (const [index, branch] of branches.entries()) {
    const branchRequests = await listCakeRequests(null, branch.town)
    assert.ok(branchRequests.some(({ id }) => id === requests[index].id))
    const otherRequest = requests[1 - index]
    assert.equal(await setCakeRequestStatus(otherRequest.id, 'contacted', null, branch.town), null)
    assert.equal(database.prepare('SELECT status FROM cake_requests WHERE id = ?').get(otherRequest.id).status, 'new')
  }

  const messages = await Promise.all(branches.map(({ id, town }) => createContactMessage({
    name: town,
    email: `${town.toLowerCase()}@example.com`,
    phone: '',
    subject: town,
    message: `Message for ${town}`,
    storeId: id,
  })))
  assert.equal(await markContactMessageRead(messages[1].messageId, null, false, branches[0].town), false)
  assert.equal(await markContactMessageRead(messages[0].messageId, null, false, branches[0].town), true)
  assert.equal(await deleteContactMessages(null, false, branches[0].town), 1)
  assert.ok(database.prepare('SELECT id FROM contact_messages WHERE id = ?').get(messages[1].messageId))
  assert.equal(await deleteContactMessage(messages[1].messageId), true)
})

test('branch administrator accounts are assigned to a town rather than a single store', async () => {
  const admin = await createAdminAccount({
    name: 'Douala Manager',
    email: 'douala-manager@example.com',
    passwordHash: 'test-password-hash',
    branchTown: 'Douala',
  })

  assert.equal(admin.role, 'branch_admin')
  assert.equal(admin.branchTown, 'Douala')
  assert.equal(admin.storeId, null)
  assert.equal(admin.storeName, null)
})

test('order notification recipients include the assigned branch and store admins only', async () => {
  const stores = database.prepare(`
    SELECT MIN(id) AS id, town FROM stores GROUP BY town ORDER BY town
  `).all()
  const douala = stores.find(({ town }) => town === 'Douala')
  const yaounde = stores.find(({ town }) => town === 'Yaoundé')
  assert.ok(douala)
  assert.ok(yaounde)

  database.prepare(`
    INSERT INTO admins (name, email, password_hash, role)
    VALUES (?, ?, ?, 'owner')
  `).run('Branch Owner', 'order-owner@example.com', 'test-password-hash')
  await createAdminAccount({
    name: 'Douala Branch Manager',
    email: 'order-douala@example.com',
    passwordHash: 'test-password-hash',
    branchTown: 'Douala',
  })
  await createAdminAccount({
    name: 'Yaounde Branch Manager',
    email: 'order-yaounde@example.com',
    passwordHash: 'test-password-hash',
    branchTown: 'Yaoundé',
  })
  await createAdminAccount({
    name: 'Douala Store Manager',
    email: 'order-store@example.com',
    passwordHash: 'test-password-hash',
    storeId: douala.id,
  })

  assert.deepEqual(await listOrderNotificationRecipients(douala.id), [
    'douala-manager@example.com',
    'order-owner@example.com',
    'order-douala@example.com',
    'order-store@example.com',
  ])
  assert.deepEqual(await listOrderNotificationRecipients(yaounde.id), [
    'order-owner@example.com',
    'order-yaounde@example.com',
  ])
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

test('owner accounts can be created and removed without removing the last owner', async () => {
  database.prepare('DELETE FROM admins').run()
  const firstOwner = await createAdminAccount({
    name: 'First Owner',
    email: 'first-owner@example.com',
    passwordHash: 'test-hash',
    role: 'owner',
  })
  const secondOwner = await createAdminAccount({
    name: 'Second Owner',
    email: 'second-owner@example.com',
    passwordHash: 'test-hash',
    role: 'owner',
  })

  assert.equal(firstOwner.role, 'owner')
  assert.equal(secondOwner.role, 'owner')
  assert.equal(await removeAdminAccount(secondOwner.id), 'deleted')
  assert.equal(await removeAdminAccount(firstOwner.id), 'last-owner')
  assert.equal(database.prepare('SELECT role FROM admins WHERE id = ?').get(firstOwner.id).role, 'owner')
})
