import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { BOOT_LOADER_SCRIPT, BOOT_LOADER_SCRIPT_HASH } from '../shared/bootLoader.js'

test('index.html has the places the website loader is written into', () => {
  const html = fs.readFileSync('index.html', 'utf8')
  assert.ok(html.includes('<!--boot-loader-head-->'))
  assert.ok(html.includes('<!--boot-loader-body-->'))
})

// The Content-Security-Policy only lets this inline script run if its hash matches exactly.
test('the built page carries the exact loader script the server allows', { skip: !fs.existsSync('dist/index.html') }, () => {
  const html = fs.readFileSync('dist/index.html', 'utf8')
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1])
  assert.deepEqual(inline, [BOOT_LOADER_SCRIPT])
  assert.equal(`'sha256-${createHash('sha256').update(inline[0]).digest('base64')}'`, BOOT_LOADER_SCRIPT_HASH)
  assert.ok(html.includes('id="boot-loader"'))
})
