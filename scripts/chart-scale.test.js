import test from 'node:test'
import assert from 'node:assert/strict'
import { niceAxis } from '../src/pages/feature/admin/chartScale.js'

test('chart axes end on round numbers', () => {
  assert.deepEqual(niceAxis(7000), { max: 8000, step: 2000 })
  assert.deepEqual(niceAxis(10536), { max: 12000, step: 3000 })
  assert.deepEqual(niceAxis(950), { max: 1000, step: 250 })
})

test('count axes use whole-number steps', () => {
  assert.deepEqual(niceAxis(1, { integer: true }), { max: 4, step: 1 })
  assert.deepEqual(niceAxis(9, { integer: true }), { max: 12, step: 3 })
  assert.deepEqual(niceAxis(30, { integer: true }), { max: 40, step: 10 })
})

test('an empty chart still has an axis', () => {
  assert.deepEqual(niceAxis(0), { max: 4, step: 1 })
})
