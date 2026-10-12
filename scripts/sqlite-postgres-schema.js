export function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`
}

export function postgresTableDefinition(table) {
  let sql = table.sql
  const caseInsensitiveColumns = new Set()
  const columnPattern = /^\s*([a-z_][a-z0-9_]*)\s+TEXT\b[^\n,]*COLLATE NOCASE/gim
  for (const match of sql.matchAll(columnPattern)) caseInsensitiveColumns.add(match[1])

  const inlineConstraintPattern = /UNIQUE\s*\(([^)]*COLLATE NOCASE[^)]*)\)/gi
  for (const match of sql.matchAll(inlineConstraintPattern)) {
    const column = /\b([a-z_][a-z0-9_]*)\s+COLLATE NOCASE/i.exec(match[1])
    if (column) caseInsensitiveColumns.add(column[1])
  }

  sql = sql.replace(/\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/gi, 'SERIAL PRIMARY KEY')
    .replace(/\bREAL\b/gi, 'DOUBLE PRECISION')
    .replace(/\s+COLLATE\s+NOCASE\b/gi, '')
    .replace(/\b(created_at|updated_at|delivered_at|replied_at|expires_at|applied_at)\s+TEXT\b/gi, '$1 TIMESTAMP')
  for (const column of caseInsensitiveColumns) {
    sql = sql.replace(new RegExp(`(\\b${column}\\s+)TEXT\\b`, 'i'), '$1CITEXT')
  }
  return sql
}

export function orderTablesByForeignKeys(tables) {
  const pending = [...tables]
  const ordered = []
  const available = new Set()

  while (pending.length) {
    const readyIndex = pending.findIndex(({ sql }) => {
      const references = [...sql.matchAll(/\bREFERENCES\s+([a-z_][a-z0-9_]*)/gi)]
        .map((match) => match[1].toLowerCase())
      return references.every((name) => available.has(name) || !pending.some((table) => table.name.toLowerCase() === name))
    })
    if (readyIndex < 0) {
      throw new Error(`Could not resolve PostgreSQL table dependencies: ${pending.map(({ name }) => name).join(', ')}`)
    }
    const [table] = pending.splice(readyIndex, 1)
    ordered.push(table)
    available.add(table.name.toLowerCase())
  }

  return ordered
}
