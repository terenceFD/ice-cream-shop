import test from 'node:test'
import assert from 'node:assert/strict'

process.env.DATABASE_URL ||= 'postgres://test:test@127.0.0.1:5432/test'
const { translateSql } = await import('./postgres.js')

test('converts positional and named SQLite parameters to PostgreSQL placeholders', () => {
  assert.deepEqual(
    translateSql('SELECT * FROM customers WHERE email = ? AND id = ?', ['a@example.com', 8]),
    { sql: 'SELECT * FROM customers WHERE email = $1 AND id = $2', values: ['a@example.com', 8] },
  )
  assert.deepEqual(
    translateSql('SELECT * FROM customers WHERE email = @email', { email: 'a@example.com' }),
    { sql: 'SELECT * FROM customers WHERE email = $1', values: ['a@example.com'] },
  )
})

test('preserves array parameters for PostgreSQL ANY queries', () => {
  assert.deepEqual(
    translateSql(
      "SELECT table_name FROM information_schema.tables WHERE table_name = ANY(?)",
      [["admins", "orders"]],
    ),
    {
      sql: "SELECT table_name FROM information_schema.tables WHERE table_name = ANY($1)",
      values: [["admins", "orders"]],
    },
  )
})

test('does not change parameter markers inside SQL strings or comments', () => {
  assert.deepEqual(
    translateSql("SELECT '?' AS marker, ? AS id -- @ignored\n/* ? @ignored */", [4]),
    { sql: "SELECT '?' AS marker, $1 AS id -- @ignored\n/* ? @ignored */", values: [4] },
  )
})

test('removes SQLite NOCASE collation clauses for CITEXT-backed PostgreSQL columns', () => {
  assert.deepEqual(
    translateSql('SELECT id FROM customers WHERE email = ? COLLATE NOCASE', ['a@example.com']),
    { sql: 'SELECT id FROM customers WHERE email = $1', values: ['a@example.com'] },
  )
})

test('translates SQLite ignore inserts and scalar max operations', () => {
  const result = translateSql(
    'INSERT OR IGNORE INTO loyalty_ledger (customer_id) VALUES (?)',
    [7],
  )

  assert.deepEqual(result, {
    sql: 'INSERT INTO loyalty_ledger (customer_id) VALUES ($1) ON CONFLICT DO NOTHING',
    values: [7],
  })
  assert.equal(translateSql('UPDATE flavors SET stock = MAX(0, stock - ?)', [2]).sql,
    'UPDATE flavors SET stock = GREATEST(0, stock - $1)')
})

test('translates supported SQLite datetime expressions', () => {
  assert.deepEqual(
    translateSql("SELECT datetime('now', '-41 minutes'), datetime(expires_at) FROM orders"),
    { sql: "SELECT CURRENT_TIMESTAMP - INTERVAL '41 minutes', expires_at FROM orders", values: [] },
  )
})
