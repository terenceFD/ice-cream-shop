import test from 'node:test'
import assert from 'node:assert/strict'
import {
  authenticatorUri,
  consumeRecoveryCode,
  createRecoveryCodes,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  hashRecoveryCode,
  verifyTotpCode,
} from './admin-mfa.js'

const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

test('verifies six-digit TOTP codes using the RFC 6238 SHA-1 test vectors', () => {
  assert.equal(verifyTotpCode(RFC_SECRET, '287082', 59_000), 1)
  assert.equal(verifyTotpCode(RFC_SECRET, '081804', 1_111_111_109_000), 37_037_036)
  assert.equal(verifyTotpCode(RFC_SECRET, '005924', 1_234_567_890_000), 41_152_263)
})

test('accepts a one-step clock skew, but will not accept a previously used code', () => {
  assert.equal(verifyTotpCode(RFC_SECRET, '755224', 30_000), 0)
  assert.equal(verifyTotpCode(RFC_SECRET, '287082', 59_000, 1), null)
})

test('encrypts authenticator secrets at rest and rejects tampering', () => {
  const secret = generateTotpSecret()
  const encrypted = encryptTotpSecret(secret, 'a-long-test-secret')
  assert.notEqual(encrypted, secret)
  assert.equal(decryptTotpSecret(encrypted, 'a-long-test-secret'), secret)
  assert.throws(() => decryptTotpSecret(encrypted, 'a-different-secret'))
})

test('creates single-use recovery codes that are stored only as hashes', () => {
  const secret = 'a-long-test-secret'
  const codes = createRecoveryCodes()
  assert.equal(codes.length, 10)
  assert.ok(codes.every((code) => /^[A-F\d]{4}(?:-[A-F\d]{4}){3}$/.test(code)))
  const hashes = codes.map((code) => hashRecoveryCode(code, secret))
  assert.ok(hashes.every((hash) => !codes.includes(hash)))
  const remaining = consumeRecoveryCode(codes[0], hashes, secret)
  assert.equal(remaining.length, 9)
  assert.equal(consumeRecoveryCode(codes[0], remaining, secret), null)
})

test('builds an authenticator-app provisioning URI', () => {
  const uri = authenticatorUri('ABC234', 'admin@example.com')
  assert.match(uri, /^otpauth:\/\/totp\//)
  assert.match(uri, /secret=ABC234/)
  assert.match(uri, /digits=6/)
  assert.match(uri, /period=30/)
})

test('dedicated MFA key preserves existing secrets and recovery codes after JWT rotation', () => {
  const original = process.env.ADMIN_MFA_ENCRYPTION_KEY
  try {
    delete process.env.ADMIN_MFA_ENCRYPTION_KEY
    const oldKey = 'original-session-key-used-at-enrollment'
    const encrypted = encryptTotpSecret(RFC_SECRET, oldKey)
    const code = createRecoveryCodes(1)[0]
    const hash = hashRecoveryCode(code, oldKey)
    process.env.ADMIN_MFA_ENCRYPTION_KEY = oldKey
    assert.equal(decryptTotpSecret(encrypted, 'rotated-session-key'), RFC_SECRET)
    assert.equal(hashRecoveryCode(code, 'rotated-session-key'), hash)
  } finally {
    if (original === undefined) delete process.env.ADMIN_MFA_ENCRYPTION_KEY
    else process.env.ADMIN_MFA_ENCRYPTION_KEY = original
  }
})

test('an incorrect MFA encryption key produces an actionable configuration error', async () => {
  const { AdminMfaConfigurationError } = await import('./admin-mfa.js')
  const original = process.env.ADMIN_MFA_ENCRYPTION_KEY
  try {
    delete process.env.ADMIN_MFA_ENCRYPTION_KEY
    const encrypted = encryptTotpSecret(RFC_SECRET, 'enrollment-key')
    assert.throws(() => decryptTotpSecret(encrypted, 'different-server-key'), (error) => {
      assert.ok(error instanceof AdminMfaConfigurationError)
      assert.match(error.message, /restore the original MFA encryption key/)
      assert.ok(!error.message.includes('enrollment-key'))
      return true
    })
  } finally {
    if (original === undefined) delete process.env.ADMIN_MFA_ENCRYPTION_KEY
    else process.env.ADMIN_MFA_ENCRYPTION_KEY = original
  }
})
