import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import Database from 'better-sqlite3'
import bcrypt from 'bcrypt'

const projectRoot = new URL('../', import.meta.url)

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return server.address().port
}

async function getAvailablePort() {
  const server = createServer()
  const port = await listen(server)
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return port
}

function createSmtpServer() {
  const messages = []
  const server = createServer((socket) => {
    let buffer = ''
    let readingMessage = false
    let messageLines = []
    socket.write('220 reset-test.local ESMTP\r\n')
    socket.on('data', (chunk) => {
      buffer += chunk.toString()
      let lineEnd = buffer.indexOf('\r\n')
      while (lineEnd !== -1) {
        const line = buffer.slice(0, lineEnd)
        buffer = buffer.slice(lineEnd + 2)
        if (readingMessage) {
          if (line === '.') {
            messages.push(messageLines.join('\n'))
            messageLines = []
            readingMessage = false
            socket.write('250 Message accepted\r\n')
          } else {
            messageLines.push(line)
          }
        } else if (/^EHLO /i.test(line)) {
          socket.write('250-reset-test.local\r\n250 PIPELINING\r\n')
        } else if (/^(MAIL FROM|RCPT TO):?/i.test(line)) {
          socket.write('250 OK\r\n')
        } else if (line.toUpperCase() === 'DATA') {
          readingMessage = true
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n')
        } else if (line.toUpperCase() === 'QUIT') {
          socket.write('221 Bye\r\n')
          socket.end()
        } else {
          socket.write('250 OK\r\n')
        }
        lineEnd = buffer.indexOf('\r\n')
      }
    })
  })
  return { server, messages }
}

async function waitForHealth(baseUrl, child, getStderr) {
  const deadline = Date.now() + 20_000
  let lastError
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API process exited early: ${getStderr()}`)
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) return
    } catch (error) {
      lastError = error
    }
    await delay(100)
  }
  throw new Error(`API did not become ready: ${lastError?.message || getStderr()}`)
}

async function post(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: await response.json() }
}

test('password reset emails a code, rejects invalid codes, updates the password, and avoids account enumeration', { timeout: 45_000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ice-cream-password-reset-'))
  const smtp = createSmtpServer()
  const smtpPort = await listen(smtp.server)
  const apiPort = await getAvailablePort()
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: projectRoot,
    stdio: ['ignore', 'ignore', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_BACKEND: 'sqlite',
      DATABASE_PATH: join(directory, 'password-reset.sqlite'),
      PORT: String(apiPort),
      JWT_SECRET: 'password-reset-test-secret-with-at-least-32-characters',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(smtpPort),
      SMTP_SECURE: 'false',
      SMTP_FROM: 'reset@example.test',
      SMTP_USER: '',
      SMTP_PASSWORD: '',
    },
  })
  let stderr = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => { stderr += chunk })
  const baseUrl = `http://127.0.0.1:${apiPort}`

  try {
    await waitForHealth(baseUrl, child, () => stderr)
    const database = new Database(join(directory, 'password-reset.sqlite'))
    const email = 'reset-customer@example.test'
    const oldPassword = 'Original password 2026'
    database.prepare(`
      INSERT INTO customers (name, email, password_hash)
      VALUES (?, ?, ?)
    `).run('Reset Customer', email, await bcrypt.hash(oldPassword, 4))
    database.close()

    const unknownRequest = await post(baseUrl, '/api/auth/password/reset-request', {
      email: 'unknown-customer@example.test',
    })
    assert.equal(unknownRequest.status, 200)
    assert.match(unknownRequest.body.verificationId, /^[0-9a-f-]{36}$/i)
    assert.equal(unknownRequest.body.expiresInSeconds, 600)
    assert.equal(smtp.messages.length, 0)

    const unknownConfirmation = await post(baseUrl, '/api/auth/password/reset-confirm', {
      verificationId: unknownRequest.body.verificationId,
      code: '000000',
      password: 'New secure password 2026',
    })
    assert.equal(unknownConfirmation.status, 400)

    const resetRequest = await post(baseUrl, '/api/auth/password/reset-request', { email })
    assert.equal(resetRequest.status, 200)
    assert.deepEqual(Object.keys(resetRequest.body).sort(), Object.keys(unknownRequest.body).sort())
    assert.equal(resetRequest.body.message, unknownRequest.body.message)
    assert.match(resetRequest.body.verificationId, /^[0-9a-f-]{36}$/i)
    assert.equal(smtp.messages.length, 1)

    const repeatedRequest = await post(baseUrl, '/api/auth/password/reset-request', { email })
    assert.equal(repeatedRequest.status, 200)
    assert.equal(repeatedRequest.body.verificationId, resetRequest.body.verificationId)
    assert.equal(smtp.messages.length, 1, 'cooldown should not send a duplicate email')

    const code = smtp.messages[0].match(/\n(\d{6})\n/)?.[1]
    assert.ok(code, 'reset email should contain a six-digit code')
    const invalidConfirmation = await post(baseUrl, '/api/auth/password/reset-confirm', {
      verificationId: resetRequest.body.verificationId,
      code: code === '000000' ? '000001' : '000000',
      password: 'New secure password 2026',
    })
    assert.equal(invalidConfirmation.status, unknownConfirmation.status)
    assert.equal(invalidConfirmation.body.error, unknownConfirmation.body.error)

    const newPassword = 'A different secure password 2026'
    const confirmation = await post(baseUrl, '/api/auth/password/reset-confirm', {
      verificationId: resetRequest.body.verificationId,
      code,
      password: newPassword,
    })
    assert.equal(confirmation.status, 200)

    const newLogin = await post(baseUrl, '/api/auth/login', { email, password: newPassword })
    assert.equal(newLogin.status, 200)
    assert.ok(newLogin.body.token)
    const oldLogin = await post(baseUrl, '/api/auth/login', { email, password: oldPassword })
    assert.equal(oldLogin.status, 401)

    const reusedCode = await post(baseUrl, '/api/auth/password/reset-confirm', {
      verificationId: resetRequest.body.verificationId,
      code,
      password: 'Another secure password 2026',
    })
    assert.equal(reusedCode.status, 400)
  } finally {
    if (child.exitCode === null) {
      child.kill()
      await new Promise((resolve) => child.once('exit', resolve))
    }
    await new Promise((resolve) => smtp.server.close(resolve))
    rmSync(directory, { recursive: true, force: true })
  }
})
