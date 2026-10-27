import test from 'node:test'
import assert from 'node:assert/strict'
import { storeAdminCanAccess } from './admin-access.js'

test('permits store-scoped operations only', () => {
  for (const [method, path] of [
    ['GET', '/orders'],
    ['GET', '/customers'],
    ['GET', '/payments'],
    ['GET', '/reviews'],
    ['GET', '/cake-requests'],
    ['GET', '/notifications'],
    ['PATCH', '/orders/42/status'],
    ['DELETE', '/orders/42/stale-payment'],
    ['DELETE', '/orders/delivered'],
    ['PATCH', '/reviews/7/approval'],
    ['DELETE', '/reviews/7'],
    ['PATCH', '/cake-requests/12/status'],
    ['PATCH', '/cake-requests/12'],
    ['PATCH', '/cake-requests/12'],
    ['GET', '/event-orders/deposit-notices'],
    ['PATCH', '/event-orders/42/deposit-notice'],
    ['DELETE', '/event-orders/42'],
    ['PATCH', '/notifications/14/read'],
    ['POST', '/notifications/14/reply'],
    ['DELETE', '/notifications/14'],
    ['DELETE', '/notifications'],
  ]) {
    assert.equal(storeAdminCanAccess(method, path), true, `${method} ${path}`)
  }
})

test('normalizes mounted API paths, query strings, trailing slashes, and method case', () => {
  for (const [method, path] of [
    ['GET', '/api/admin/orders?status=active'],
    ['DELETE', '/api/admin/orders/delivered?storeId=2'],
    ['get', '/reviews/?countOnly=true'],
    ['GET', '/api/admin/cake-requests/'],
    ['get', '/notifications?unreadOnly=true'],
  ]) {
    assert.equal(storeAdminCanAccess(method, path), true, `${method} ${path}`)
  }
})

test('blocks access to business-wide records and settings', () => {
  for (const [method, path] of [
    ['GET', '/admins'],
    ['GET', '/activity'],
    ['GET', '/inventory'],
    ['GET', '/stock-alerts'],
    ['GET', '/menu-categories'],
    ['GET', '/discount-codes'],
    ['GET', '/fulfillment-settings'],
    ['PUT', '/fulfillment-zones'],
    ['PATCH', '/customers/2/ban'],
    ['DELETE', '/customers/2'],
    ['GET', '/orders/43/status'],
    ['POST', '/notifications'],
    ['GET', '/notifications/14'],
    ['DELETE', '/event-orders/not-a-number'],
  ]) {
    assert.equal(storeAdminCanAccess(method, path), false, `${method} ${path}`)
  }
})
