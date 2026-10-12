import 'dotenv/config'
import Database from 'better-sqlite3'
import pg from 'pg'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { orderTablesByForeignKeys, postgresTableDefinition, quoteIdentifier } from './sqlite-postgres-schema.js'

const { Client } = pg
const defaultSource = fileURLToPath(new URL('../server/database.sqlite', import.meta.url))
const sourceArgument = process.argv.find((argument) => argument.startsWith('--source='))
const sourcePath = resolve(sourceArgument ? sourceArgument.slice('--source='.length) : process.env.DATABASE_PATH || defaultSource)
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('Set DATABASE_URL to the Supabase PostgreSQL connection string before migrating.')
}

if (!['postgres:', 'postgresql:'].includes(new URL(connectionString).protocol)) {
  throw new Error('DATABASE_URL must be a PostgreSQL connection string.')
}

const sqlite = new Database(sourcePath, { readonly: true })
const client = new Client({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false },
  application_name: 'ice-cream-site-sqlite-migration',
})

async function migrate() {
  const tables = sqlite.prepare(`
    SELECT name, sql
    FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all()
  if (!tables.length) throw new Error(`No application tables found in SQLite source: ${sourcePath}`)

  const indexes = sqlite.prepare(`
    SELECT name, sql FROM sqlite_master
    WHERE type = 'index' AND sql IS NOT NULL ORDER BY name
  `).all()

  await client.connect()
  const existing = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name = ANY($1::text[])
    LIMIT 1
  `, [tables.map(({ name }) => name)])
  if (existing.rowCount) {
    throw new Error(`Supabase already contains application table "${existing.rows[0].table_name}". Migration stopped without changing data; use a new empty Supabase project or back up and clear the target first.`)
  }

  await client.query('BEGIN')
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS citext')

    for (const table of orderTablesByForeignKeys(tables)) {
      await client.query(postgresTableDefinition(table))
    }

    for (const index of indexes) {
      const indexSql = index.sql.replace(/\s+COLLATE\s+NOCASE\b/gi, '')
      await client.query(indexSql)
    }

    let totalRows = 0
    for (const table of orderTablesByForeignKeys(tables)) {
      const columns = sqlite.prepare(`PRAGMA table_info(${quoteIdentifier(table.name)})`).all()
      const columnNames = columns.map(({ name }) => name)
      const quotedColumns = columnNames.map(quoteIdentifier).join(', ')
      const placeholders = columnNames.map((_, index) => `$${index + 1}`).join(', ')
      const insertSql = `INSERT INTO ${quoteIdentifier(table.name)} (${quotedColumns}) VALUES (${placeholders})`
      const rows = sqlite.prepare(`SELECT * FROM ${quoteIdentifier(table.name)}`).iterate()
      let rowCount = 0
      for (const row of rows) {
        await client.query(insertSql, columnNames.map((column) => row[column]))
        rowCount += 1
      }
      totalRows += rowCount

      if (columns.some(({ name, pk }) => name === 'id' && pk > 0)) {
        await client.query(`
          SELECT setval(
            pg_get_serial_sequence($1, 'id'),
            GREATEST(COALESCE((SELECT MAX(id) FROM ${quoteIdentifier(table.name)}), 1), 1),
            EXISTS (SELECT 1 FROM ${quoteIdentifier(table.name)})
          )
        `, [`public.${table.name}`])
      }
      console.log(`Migrated ${rowCount} rows from ${table.name}.`)
    }

    await client.query('COMMIT')
    console.log(`Migration complete: ${tables.length} tables and ${totalRows} rows copied from ${sourcePath}.`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

try {
  await migrate()
} catch (error) {
  console.error('SQLite to Supabase migration failed:', error.message)
  process.exitCode = 1
} finally {
  sqlite.close()
  await client.end().catch(() => {})
}
