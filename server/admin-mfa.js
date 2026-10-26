import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const TOTP_STEP_SECONDS = 30
const TOTP_DIGITS = 6

function encodeBase32(bytes) {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits) output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return output
}

function decodeBase32(secret) {
  let bits = 0
  let value = 0
  const bytes = []
  for (const character of secret.toUpperCase().replace(/=+$/, '')) {
    const digit = BASE32_ALPHABET.indexOf(character)
    if (digit < 0) throw new Error('Invalid authenticator secret.')
    value = (value << 5) | digit
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

function totpAtCounter(secret, counter) {
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff)
  return String(binary % (10 ** TOTP_DIGITS)).padStart(TOTP_DIGITS, '0')
}

function secureTextEqual(left, right) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function generateTotpSecret() {
  return encodeBase32(randomBytes(20))
}

export function verifyTotpCode(secret, code, now = Date.now(), lastCounter = -1) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null
  const currentCounter = Math.floor(now / 1000 / TOTP_STEP_SECONDS)
  for (const counter of [currentCounter - 1, currentCounter, currentCounter + 1]) {
    if (counter > lastCounter && secureTextEqual(totpAtCounter(secret, counter), code)) return counter
  }
  return null
}

export function authenticatorUri(secret, accountName, issuer = 'Cold Stone Creamery') {
  const label = `${issuer}:${accountName}`
  const query = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  })
  return `otpauth://totp/${encodeURIComponent(label)}?${query}`
}

export class AdminMfaConfigurationError extends Error {
  constructor(cause) {
    super('Authenticator verification is unavailable because this server cannot read the saved MFA configuration. Contact the store owner to restore the original MFA encryption key.', { cause })
    this.name = 'AdminMfaConfigurationError'
  }
}

function encryptionKey(secret) {
  // Existing installations fall back to JWT_SECRET. Set the dedicated key to
  // the ORIGINAL JWT_SECRET before rotating session-signing credentials.
  const key = process.env.ADMIN_MFA_ENCRYPTION_KEY?.trim() || secret
  return createHash('sha256').update(`cold-stone-admin-totp:${key}`).digest()
}

export function encryptTotpSecret(secret, jwtSecret) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(jwtSecret), iv)
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), ciphertext].map((value) => value.toString('base64url')).join('.')
}

export function decryptTotpSecret(encrypted, jwtSecret) {
  try {
    const [iv, tag, ciphertext] = encrypted.split('.').map((value) => Buffer.from(value, 'base64url'))
    if (!iv || iv.length !== 12 || !tag || tag.length !== 16 || !ciphertext?.length) {
      throw new Error('Stored authenticator secret is invalid.')
    }
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(jwtSecret), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch (error) {
    throw new AdminMfaConfigurationError(error)
  }
}

export function createRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const value = randomBytes(8).toString('hex').toUpperCase()
    return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}-${value.slice(12)}`
  })
}

export function hashRecoveryCode(code, jwtSecret) {
  const normalized = typeof code === 'string' ? code.replace(/[^a-f\d]/gi, '').toUpperCase() : ''
  if (!/^[A-F\d]{16}$/.test(normalized)) return ''
  return createHmac('sha256', encryptionKey(jwtSecret)).update(normalized).digest('hex')
}

export function consumeRecoveryCode(code, hashes, jwtSecret) {
  const candidate = hashRecoveryCode(code, jwtSecret)
  if (!candidate || !Array.isArray(hashes)) return null
  const index = hashes.findIndex((hash) => secureTextEqual(candidate, hash))
  if (index < 0) return null
  return hashes.filter((_hash, hashIndex) => hashIndex !== index)
}
