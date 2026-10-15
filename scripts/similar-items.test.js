import assert from 'node:assert/strict'
import test from 'node:test'
import { rankSimilar } from '../src/lib/similarItems.js'

const items = [
  { key: 'a', group: 'Ice Cream', text: 'Cookie Mintster Mint Ice Cream with chocolate sandwich cookies' },
  { key: 'b', group: 'Ice Cream', text: 'Surrender to Strawberry Strawberry Ice Cream with strawberries' },
  { key: 'c', group: 'Cakes', text: 'Mint Chip Mint chocolate chip ice cream cake' },
  { key: 'd', group: 'Ice Cream', text: 'Mint Mint Chocolate Chocolate Chip Mint Ice Cream with chocolate chips' },
  { key: 'e', group: 'Shakes', text: 'Very Vanilla shake' },
]

test('ranks the same group first, then shared ingredients, and never the item itself', () => {
  const ranked = rankSimilar(items[0], items, 4).map((item) => item.key)
  assert.deepEqual(ranked, ['d', 'b', 'c', 'e'])
  assert.ok(!ranked.includes('a'))
})

test('returns at most the requested number', () => {
  assert.equal(rankSimilar(items[1], items, 2).length, 2)
})
