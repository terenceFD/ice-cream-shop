import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { database } from './database.js'

const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env
if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8
  || ADMIN_PASSWORD.startsWith('replace-with-')) {
  throw new Error('Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD (at least 8 characters) in the environment.')
}

const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)
try {
  database.prepare('INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)')
    .run(ADMIN_NAME.trim(), ADMIN_EMAIL.trim().toLowerCase(), passwordHash)
  console.log(`Created first admin account for ${ADMIN_EMAIL.trim().toLowerCase()}.`)
} catch (error) {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    throw new Error(`An admin account already exists for ${ADMIN_EMAIL}.`)
  }
  throw error
} finally {
  database.close()
}
