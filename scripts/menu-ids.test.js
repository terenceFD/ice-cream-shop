import assert from 'node:assert/strict'
import test from 'node:test'
import { coldStoneMenuCategories, findMenuItem, findMenuItemBySlug, getMenuItemId, menuItemPublicPath } from '../shared/data.js'

test('renamed products keep the ID their stock, orders and favorites were saved under', () => {
  assert.equal(getMenuItemId('Milkshakes & Smoothies', 'Very Vanilla Shake'), 'menu:milkshakes-smoothies:milkshake-1')
  assert.equal(getMenuItemId('Cakes & Pies', 'Happy Birthday Cake'), 'menu:cakes-pies:birthday-cake-design-1')
  assert.equal(findMenuItem('menu:milkshakes-smoothies:milkshake-1').name, 'Very Vanilla Shake')
  assert.equal(findMenuItem('menu:ice-cream:candy-crunch-cone').name, 'Cake Batter Batter Batter')
  // Products that were never renamed are unchanged.
  assert.equal(getMenuItemId('Ice Cream', 'Cookie Mintster'), 'menu:ice-cream:cookie-mintster')
})

test('every menu product has its own ID and its own photo', () => {
  const ids = new Set()
  const photos = new Set()
  for (const category of coldStoneMenuCategories) {
    for (const item of category.items) {
      const id = getMenuItemId(category.title, item.name)
      assert.ok(!ids.has(id), `duplicate ID ${id}`)
      assert.ok(!photos.has(item.image), `photo used twice: ${item.image}`)
      ids.add(id)
      photos.add(item.image)
    }
  }
})

test('every catalog product has its own public address, and unknown names keep the menu query', () => {
  const paths = new Set()
  for (const category of coldStoneMenuCategories) {
    for (const item of category.items) {
      const path = menuItemPublicPath(category.title, item.name)
      assert.match(path, /^\/treat\/[a-z0-9-]+\/[a-z0-9-]+$/)
      assert.equal(paths.has(path), false, path)
      paths.add(path)
      const [, , categorySlug, itemSlug] = path.split('/')
      assert.equal(findMenuItemBySlug(categorySlug, itemSlug).item.name, item.name)
    }
  }
  assert.equal(findMenuItemBySlug('cakes-pies', 'strawberry-passion').item.name, 'Strawberry Passion')
  assert.equal(findMenuItemBySlug('cakes-pies', 'not-a-cake'), null)
  assert.match(menuItemPublicPath('Cakes & Pies', 'Not A Real Cake'), /^\/menu\?/)
})
