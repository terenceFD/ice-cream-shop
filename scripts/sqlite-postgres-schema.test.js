import test from 'node:test'
import assert from 'node:assert/strict'
import { orderTablesByForeignKeys, postgresTableDefinition } from './sqlite-postgres-schema.js'

test('converts SQLite auto-increment and case-insensitive text columns', () => {
  const result = postgresTableDefinition({
    name: 'admins',
    sql: `CREATE TABLE admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      score REAL NOT NULL
    )`,
  })

  assert.match(result, /id SERIAL PRIMARY KEY/)
  assert.match(result, /email CITEXT NOT NULL UNIQUE/)
  assert.match(result, /score DOUBLE PRECISION/)
  assert.doesNotMatch(result, /COLLATE NOCASE/)
})

test('converts stored timestamp columns to PostgreSQL timestamp types', () => {
  const result = postgresTableDefinition({
    name: 'orders',
    sql: `CREATE TABLE orders (
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      scheduled_for TEXT NOT NULL DEFAULT ''
    )`,
  })

  assert.match(result, /created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP/)
  assert.match(result, /updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP/)
  assert.match(result, /scheduled_for TEXT NOT NULL DEFAULT ''/)
})

test('converts NOCASE on a column inside a composite unique constraint', () => {
  const result = postgresTableDefinition({
    name: 'items',
    sql: `CREATE TABLE items (
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      UNIQUE (category, name COLLATE NOCASE)
    )`,
  })

  assert.match(result, /name CITEXT NOT NULL/)
  assert.match(result, /UNIQUE \(category, name\)/)
})

test('orders tables so referenced tables are created first', () => {
  const result = orderTablesByForeignKeys([
    { name: 'order_items', sql: 'CREATE TABLE order_items (order_id INTEGER REFERENCES orders(id))' },
    { name: 'orders', sql: 'CREATE TABLE orders (id INTEGER PRIMARY KEY)' },
    { name: 'customers', sql: 'CREATE TABLE customers (id INTEGER PRIMARY KEY)' },
  ])

  const tableOrder = result.map(({ name }) => name)
  assert.ok(tableOrder.indexOf('orders') < tableOrder.indexOf('order_items'))
})

test('rejects cyclic table dependencies', () => {
  assert.throws(() => orderTablesByForeignKeys([
    { name: 'first_table', sql: 'CREATE TABLE first_table (id INTEGER REFERENCES second_table(id))' },
    { name: 'second_table', sql: 'CREATE TABLE second_table (id INTEGER REFERENCES first_table(id))' },
  ]), /Could not resolve PostgreSQL table dependencies/)
})
