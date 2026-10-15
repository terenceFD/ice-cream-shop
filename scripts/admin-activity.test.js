import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { describeAdminActivity } from '../src/pages/admin/describeAdminActivity.js'

test('admin activity entries read as plain sentences', () => {
  assert.deepEqual(describeAdminActivity('POST', '/api/admin/uploads'), { label: 'Uploaded a photo', id: null, area: 'catalog', known: true })
  assert.deepEqual(describeAdminActivity('DELETE', '/api/admin/flavors/10'), { label: 'Deleted flavor #{id}', id: '10', area: 'catalog', known: true })
  assert.equal(describeAdminActivity('PATCH', '/api/admin/orders/54/delivered').label, 'Marked order #{id} delivered')
  assert.equal(describeAdminActivity('DELETE', '/api/admin/orders/delivered').label, 'Cleared delivered orders')
  assert.equal(describeAdminActivity('DELETE', '/api/admin/orders/7').label, 'Deleted order #{id}')
})

test('an unknown request still gets a readable fallback', () => {
  assert.deepEqual(describeAdminActivity('PUT', '/api/admin/something-new'), { label: 'Made a change', id: null, area: 'settings', known: false })
})

// Every admin route that changes data must have a sentence, so new routes are not shown as "Made a change".
test('every admin write route on the server has a description', () => {
  const source = ['server/index.js', 'server/event-orders.js'].map((file) => fs.readFileSync(file, 'utf8')).join('\n')
  const routes = [...source.matchAll(/app\.(post|put|patch|delete)\('(\/api\/admin[^']*)'/g)]
  assert.ok(routes.length > 30)
  for (const [, method, route] of routes) {
    const examplePath = route.replace(/:\w+/g, '12')
    assert.ok(describeAdminActivity(method, examplePath).known, `${method.toUpperCase()} ${route} has no activity description`)
  }
})
