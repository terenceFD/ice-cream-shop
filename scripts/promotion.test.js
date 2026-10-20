import test from 'node:test'
import assert from 'node:assert/strict'
import { initialPromotionIsVisible } from '../src/lib/promotion.js'

const originalDocument = globalThis.document
const originalSessionStorage = globalThis.sessionStorage

test.afterEach(() => {
  if (originalDocument === undefined) delete globalThis.document
  else globalThis.document = originalDocument
  if (originalSessionStorage === undefined) delete globalThis.sessionStorage
  else globalThis.sessionStorage = originalSessionStorage
})

function setInitialPromotion(promotion, dismissedCode = '') {
  globalThis.document = {
    getElementById: () => ({ textContent: JSON.stringify({ promotion }) }),
  }
  globalThis.sessionStorage = {
    getItem: () => dismissedCode,
  }
}

test('an active embedded promotion is visible before hydration', () => {
  setInitialPromotion({ code: 'SWEET', expiresAt: '2099-01-01T00:00:00Z' })
  assert.equal(initialPromotionIsVisible(), true)
})

test('an expired or dismissed embedded promotion is not initially visible', () => {
  setInitialPromotion({ code: 'OLD', expiresAt: '2000-01-01T00:00:00Z' })
  assert.equal(initialPromotionIsVisible(), false)

  setInitialPromotion({ code: 'SWEET', expiresAt: '2099-01-01T00:00:00Z' }, 'SWEET')
  assert.equal(initialPromotionIsVisible(), false)
})
