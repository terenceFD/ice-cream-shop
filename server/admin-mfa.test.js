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
