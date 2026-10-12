import { readFileSync } from 'node:fs'

export function postgresSslConfig(environment = process.env) {
  if (environment.DATABASE_SSL === 'disable') return false

  const ssl = { rejectUnauthorized: true }
  const caFile = environment.DATABASE_SSL_CA_FILE?.trim()
  if (caFile) ssl.ca = readFileSync(caFile, 'utf8')
  return ssl
}
