import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { database } from './database.js'

function isUniqueConstraintError(error) {
  return error && (
    error.code === 'SQLITE_CONSTRAINT_UNIQUE'
    || error.code === '23505'
    || (typeof error.message === 'string' && /unique constraint/i.test(error.message))
  )
}

const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env
if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8
  || ADMIN_PASSWORD.startsWith('replace-with-')) {
  throw new Error('Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD (at least 8 characters) in the environment.')
}

const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)
try {
  await database.prepare('INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)')
    .run(ADMIN_NAME.trim(), ADMIN_EMAIL.trim().toLowerCase(), passwordHash)
  console.log(`Created first admin account for ${ADMIN_EMAIL.trim().toLowerCase()}.`)
} catch (error) {
  if (isUniqueConstraintError(error)) {
    throw new Error(`An admin account already exists for ${ADMIN_EMAIL}.`)
  }
  throw error
} finally {
  await database.close()
}
