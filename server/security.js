import { randomUUID } from 'node:crypto'
import bcrypt from 'bcrypt'

// Passwords that appear at the top of every leaked-password list. Attackers try these first.
const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', '123123123', '11111111', '00000000', '87654321',
  '12341234', '11223344', '88888888', '99999999', '12121212', '01234567', '1q2w3e4r',
  '1qaz2wsx', 'qwertyui', 'qwerty123', 'qwertyuiop', 'asdfghjk', 'azertyui', 'azerty123',
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword',
  'motdepasse', 'iloveyou', 'iloveyou1', 'welcome1', 'welcome123', 'letmein1', 'sunshine',
  'princess', 'football', 'baseball', 'superman', 'trustno1', 'abcd1234', 'abc12345',
  'admin123', 'administrator', 'changeme', 'default1', 'computer', 'internet', 'whatever',
  'cameroon', 'cameroun', 'douala123', 'yaounde1', 'icecream', 'icecream1', 'coldstone',
  'coldstone1', 'coldstonecreamery', 'coldstone2026',
])

// Returns an error message when a new password is too easy to guess, otherwise null.
export function weakPasswordReason(password, { email = '', name = '' } = {}) {
  const lowered = password.toLowerCase()
  if (COMMON_PASSWORDS.has(lowered) || /^(.)\1+$/.test(password)) {
    return 'That password is too common and easy to guess. Choose something more unique.'
  }
  const emailName = email.split('@')[0]?.toLowerCase() || ''
  if ((emailName.length >= 4 && lowered.includes(emailName))
    || (name.trim().length >= 4 && lowered.includes(name.trim().toLowerCase()))) {
    return 'Your password must not contain your name or email address.'
  }
  return null
}

// Comparing against a throwaway hash when an account does not exist makes a failed sign-in
// take as long as a real one, so response timing does not reveal which emails have accounts.
const dummyPasswordHash = bcrypt.hash(randomUUID(), 12)

export async function spendPasswordCheckTime(password) {
  await bcrypt.compare(password, await dummyPasswordHash)
}

// Admin accounts lock after repeated wrong passwords, whatever network the attempts come from.
// Kept in memory: a restart clears the counters, which is acceptable for a single API instance.
const ADMIN_MAX_FAILURES = 5
const ADMIN_LOCK_MS = 15 * 60 * 1000
const adminSignInFailures = new Map()

function pruneAdminFailures(now) {
  if (adminSignInFailures.size < 5000) return
  for (const [email, entry] of adminSignInFailures) {
    if (entry.lockedUntil <= now && now - entry.lastFailureAt > ADMIN_LOCK_MS) adminSignInFailures.delete(email)
  }
}

export function adminLockRemainingMs(email, now = Date.now()) {
  const entry = adminSignInFailures.get(email.toLowerCase())
  return entry && entry.lockedUntil > now ? entry.lockedUntil - now : 0
}

export function recordAdminSignInFailure(email, now = Date.now()) {
  const key = email.toLowerCase()
  pruneAdminFailures(now)
  const previous = adminSignInFailures.get(key)
  // Old failures stop counting once a full lock period has passed without new ones.
  const failures = previous && now - previous.lastFailureAt < ADMIN_LOCK_MS ? previous.failures + 1 : 1
  const lockedUntil = failures >= ADMIN_MAX_FAILURES ? now + ADMIN_LOCK_MS : 0
  adminSignInFailures.set(key, { failures: lockedUntil ? 0 : failures, lockedUntil, lastFailureAt: now })
  return lockedUntil ? ADMIN_LOCK_MS : 0
}

export function clearAdminSignInFailures(email) {
  adminSignInFailures.delete(email.toLowerCase())
}
