import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = mkdtempSync(join(tmpdir(), 'ice-cream-flavors-'))
const originalBackend = process.env.DATABASE_BACKEND
const originalPath = process.env.DATABASE_PATH
process.env.DATABASE_BACKEND = 'sqlite'
process.env.DATABASE_PATH = join(directory, 'flavors.sqlite')

const { database, migrateFlavorCatalog } = await import('./database.js')

after(() => {
  database.close()
  rmSync(directory, { recursive: true, force: true })
  if (originalBackend === undefined) delete process.env.DATABASE_BACKEND
  else process.env.DATABASE_BACKEND = originalBackend
  if (originalPath === undefined) delete process.env.DATABASE_PATH
  else process.env.DATABASE_PATH = originalPath
})

test('flavor catalog migration adds missing flavors and preserves existing stock', async () => {
  const insertFlavor = database.prepare(`
    INSERT INTO flavors (name, detail, description, price, image, stock, reserved_stock)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  insertFlavor.run('Vanilla Dream', 'Locally edited vanilla', 'Custom description', 4000, '/custom.webp', 24, 2)
  insertFlavor.run('Strawberry Delight', 'Real berries, real sweet', 'Existing', 2965, '/strawberry.webp', 20, 0)
  insertFlavor.run('Mango Magic', 'Sun-ripened Alphonso mango', 'Existing', 2965, '/mango.webp', 30, 0)
  insertFlavor.run('Cookies & Cream', 'Cookie chunks, creamy swirls', 'Existing', 2965, '/cookies.webp', 40, 0)
  const legacyBanana = insertFlavor.run(
    'Biscute',
    'Banana ice cream, caramel swirls',
    'Legacy description',
    2000,
    '/legacy.webp',
    42,
    3,
  )

  await migrateFlavorCatalog()

  const flavors = database.prepare('SELECT * FROM flavors ORDER BY id').all()
  assert.equal(flavors.length, 14)
  assert.deepEqual(
    flavors.map(({ name }) => name).sort(),
    [
      'Banana Caramel Swirl',
      'Birthday Cake Confetti',
      'Chocolate Brownie Fudge',
      'Chocolate Peanut Butter Cup',
      'Chocolate Pistachio',
      'Coffee Caramel Crunch',
      'Cookie Dough Chip',
      'Cookies & Cream',
      'Mango Magic',
      'Mixed Berry Cream',
      'Mint Chocolate Chip',
      'Strawberry Delight',
      'Strawberry Shortcake',
      'Vanilla Dream',
    ].sort(),
  )

  const vanilla = database.prepare('SELECT * FROM flavors WHERE name = ?').get('Vanilla Dream')
  assert.equal(vanilla.detail, 'Locally edited vanilla')
  assert.equal(vanilla.price, 4000)
  assert.equal(vanilla.stock, 24)

  const banana = database.prepare('SELECT * FROM flavors WHERE name = ?').get('Banana Caramel Swirl')
  assert.equal(banana.id, Number(legacyBanana.lastInsertRowid))
  assert.equal(banana.stock, 42)
  assert.equal(banana.reserved_stock, 3)
  assert.equal(database.prepare('SELECT id FROM flavors WHERE name = ?').get('Biscute'), undefined)

  database.prepare('DELETE FROM flavors WHERE name = ?').run('Chocolate Pistachio')
  await migrateFlavorCatalog()
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM flavors').get().count, 13)
})
