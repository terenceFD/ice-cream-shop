import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { makeThumbnails } from './make-thumbnails.mjs'

// Small photo copies (public/thumbs) are refreshed whenever a photo changed.
await makeThumbnails().catch((error) => console.error('Unable to make photo thumbnails:', error.message))

const backend = spawn(process.execPath, [fileURLToPath(new URL('../server/index.js', import.meta.url))], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_BACKEND: process.env.DATABASE_BACKEND || 'sqlite' },
})
const children = [backend]
let shuttingDown = false

function stopChildren(signal = 'SIGTERM') {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill(signal)
  }
}

for (const child of children) {
  child.on('error', (error) => {
    console.error('Unable to start the development API:', error.message)
    process.exitCode = 1
    stopChildren()
  })
  child.on('exit', (code) => {
    if (shuttingDown) return
    console.error(`The development API exited unexpectedly${code === null ? '.' : ` with code ${code}.`}`)
    process.exitCode = code || 1
    stopChildren()
  })
}

process.once('SIGINT', () => stopChildren('SIGINT'))
process.once('SIGTERM', () => stopChildren('SIGTERM'))

async function waitForApi() {
  const deadline = Date.now() + 60_000
  let lastError
  while (Date.now() < deadline) {
    if (backend.exitCode !== null || shuttingDown) {
      throw new Error('The development API stopped before it became ready.')
    }
    try {
      const response = await fetch('http://127.0.0.1:3001/api/health')
      if (response.ok) return
      lastError = new Error(`The development API health check returned HTTP ${response.status}.`)
    } catch (error) {
      lastError = error
    }
    await delay(300)
  }
  throw new Error(`The development API did not become ready within 60 seconds.${lastError ? ` ${lastError.message}` : ''}`)
}

try {
  await waitForApi()
  if (!shuttingDown) {
    const frontend = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))], {
      stdio: 'inherit',
      env: process.env,
    })
    children.push(frontend)
    frontend.on('error', (error) => {
      console.error('Unable to start the development frontend:', error.message)
      process.exitCode = 1
      stopChildren()
    })
    frontend.on('exit', (code) => {
      if (shuttingDown) return
      console.error(`The development frontend exited unexpectedly${code === null ? '.' : ` with code ${code}.`}`)
      process.exitCode = code || 1
      stopChildren()
    })
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
  stopChildren()
}
