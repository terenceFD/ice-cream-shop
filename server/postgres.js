import { AsyncLocalStorage } from 'node:async_hooks'
import pg from 'pg'
import { postgresSslConfig } from './postgres-ssl.js'

const { Pool } = pg
const connectionString = process.env.DATABASE_URL
const transactionContext = new AsyncLocalStorage()
const identityTables = new Set([
  'admins',
  'admin_activity',
  'cake_requests',
  'contact_messages',
  'custom_menu_items',
  'customers',
  'discount_codes',
  'flavors',
  'fulfillment_slots',
  'fulfillment_zones',
  'loyalty_ledger',
  'menu_categories',
  'menu_reviews',
  'order_items',
  'orders',
  'payments',
  'stores',
])

if (!connectionString) {
  throw new Error('Set DATABASE_URL before importing the Supabase PostgreSQL adapter.')
}

const pool = new Pool({
  connectionString,
  max: Number(process.env.DATABASE_POOL_SIZE || 5),
  ssl: postgresSslConfig(),
  application_name: 'ice-cream-site',
})

function parameterize(sql, parameters) {
  const values = []
  const namedParameters = !Array.isArray(parameters) && parameters !== null
    ? parameters
    : null
  let output = ''
  let index = 0
  let quote = ''
  let lineComment = false
  let blockComment = false

  while (index < sql.length) {
    const current = sql[index]
    const next = sql[index + 1]

    if (lineComment) {
      output += current
      if (current === '\n') lineComment = false
      index += 1
      continue
    }
    if (blockComment) {
      output += current
      if (current === '*' && next === '/') {
        output += next
        index += 2
        blockComment = false
      } else index += 1
      continue
    }
    if (quote) {
      output += current
      if (current === quote) {
        if (next === quote) {
          output += next
          index += 2
          continue
        }
        quote = ''
      }
      if (current === '\\' && quote === "'" && next) {
        output += next
        index += 2
      } else index += 1
      continue
    }
    if (current === '-' && next === '-') {
      output += current + next
      index += 2
      lineComment = true
      continue
    }
    if (current === '/' && next === '*') {
      output += current + next
      index += 2
      blockComment = true
      continue
    }
    if (current === "'" || current === '"' || current === '`') {
      quote = current === '`' ? '"' : current
      output += quote
      index += 1
      continue
    }

    if (current === '?' && Array.isArray(parameters)) {
      values.push(parameters[values.length])
      output += `$${values.length}`
      index += 1
      continue
    }
    if (current === '@' && namedParameters) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(sql.slice(index + 1))
      if (match) {
        values.push(namedParameters[match[0]])
        output += `$${values.length}`
        index += match[0].length + 1
        continue
      }
    }

    output += current
    index += 1
  }

  return { sql: output, values }
}

export function translateSql(sql, parameters = []) {
  const converted = parameterize(sql, parameters)
  let query = converted.sql
    .replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT INTO')
    .replace(/\s+COLLATE\s+NOCASE\b/gi, '')
    .replace(/\bdatetime\(\s*([a-z_][a-z0-9_.]*)\s*\)/gi, '$1')
    .replace(/\bMAX\(\s*0\s*,/gi, 'GREATEST(0,')

  query = query.replace(
    /\bdatetime\(\s*'now'\s*,\s*'-(\d+)\s+(minute|minutes|hour|hours|day|days)'\s*\)/gi,
    "CURRENT_TIMESTAMP - INTERVAL '$1 $2'",
  )

  if (/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql)) {
    const returningIndex = query.search(/\bRETURNING\b/i)
    const insertionPoint = returningIndex < 0 ? query.length : returningIndex
    query = `${query.slice(0, insertionPoint).trimEnd()} ON CONFLICT DO NOTHING ${query.slice(insertionPoint)}`
      .trim()
  }

  return { sql: query, values: converted.values }
}

function queryParameters(parameters) {
  if (parameters.length === 1 && parameters[0] && typeof parameters[0] === 'object'
    && !Array.isArray(parameters[0])) return parameters[0]
  return parameters
}

function activeClient() {
  return transactionContext.getStore()?.client || pool
}

function insertIdentity(sql) {
  const match = /\bINSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+([a-z_][a-z0-9_]*)/i.exec(sql)
  if (!match || !identityTables.has(match[1].toLowerCase()) || /\bRETURNING\b/i.test(sql)) {
    return sql
  }
  return `${sql.trimEnd()} RETURNING id`
}

export const database = {
  prepare(sql) {
    return {
      async all(...parameters) {
        const prepared = translateSql(sql, queryParameters(parameters))
        const result = await activeClient().query(prepared.sql, prepared.values)
        return result.rows
      },
      async get(...parameters) {
        const prepared = translateSql(sql, queryParameters(parameters))
        const result = await activeClient().query(prepared.sql, prepared.values)
        return result.rows[0]
      },
      async run(...parameters) {
        const statement = insertIdentity(sql)
        const prepared = translateSql(statement, queryParameters(parameters))
        const result = await activeClient().query(prepared.sql, prepared.values)
        return {
          changes: result.rowCount,
          lastInsertRowid: result.rows[0]?.id,
        }
      },
    }
  },
  async transaction(callback) {
    const context = transactionContext.getStore()
    if (context) {
      const savepoint = `nested_${context.depth + 1}`
      await context.client.query(`SAVEPOINT ${savepoint}`)
      try {
        const result = await transactionContext.run(
          { client: context.client, depth: context.depth + 1 },
          callback,
        )
        await context.client.query(`RELEASE SAVEPOINT ${savepoint}`)
        return result
      } catch (error) {
        await context.client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
        await context.client.query(`RELEASE SAVEPOINT ${savepoint}`)
        throw error
      }
    }

    const client = await pool.connect()
    let transactionStarted = false
    try {
      await client.query('BEGIN')
      transactionStarted = true
      const result = await transactionContext.run({ client, depth: 0 }, callback)
      await client.query('COMMIT')
      transactionStarted = false
      return result
    } catch (error) {
      if (transactionStarted) await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },
  async close() {
    await pool.end()
  },
}
