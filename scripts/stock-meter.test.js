import test from 'node:test'
import assert from 'node:assert/strict'
import { stockBarPercent } from '../src/pages/feature/admin/stockMeter.js'

test('a stock bar is full well above the alert level and shrinks towards it', () => {
  assert.equal(stockBarPercent(100, 10), 100)
  assert.equal(stockBarPercent(40, 10), 100)
  assert.equal(stockBarPercent(20, 10), 50)
  assert.equal(stockBarPercent(10, 10), 25)
  assert.equal(stockBarPercent(0, 10), 0)
})

test('a stock bar never goes below empty and copes with an alert level of zero', () => {
  assert.equal(stockBarPercent(-3, 5), 0)
  assert.equal(stockBarPercent(2, 0), 50)
})
