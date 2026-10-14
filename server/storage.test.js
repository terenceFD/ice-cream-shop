import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { ImageStorageConfigurationError, imageStorageOrigin, saveUploadedImage } from './storage.js'

const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function withEnvironment(values, run) {
  const keys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET']
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  for (const key of keys) delete process.env[key]
  Object.assign(process.env, values)
  return Promise.resolve(run()).finally(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })
}

test('saves to the local uploads folder during development when Supabase Storage is not set', () =>
  withEnvironment({}, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'uploads-'))
    try {
      const address = await saveUploadedImage({
        buffer: image, filename: 'a.png', contentType: 'image/png', uploadDirectory: directory, isProduction: false,
      })
      assert.equal(address, '/uploads/a.png')
      assert.deepEqual(await readFile(join(directory, 'a.png')), image)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }))

test('refuses to save to the server disk in production', () =>
  withEnvironment({}, async () => {
    await assert.rejects(
      saveUploadedImage({ buffer: image, filename: 'a.png', contentType: 'image/png', uploadDirectory: tmpdir(), isProduction: true }),
      ImageStorageConfigurationError,
    )
  }))

test('uploads to a public Supabase Storage bucket and returns its public address', () =>
  withEnvironment({
    SUPABASE_URL: 'https://project.supabase.co/',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    SUPABASE_STORAGE_BUCKET: 'menu-images',
  }, async () => {
    const calls = []
    const realFetch = globalThis.fetch
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options })
      if (url.endsWith('/storage/v1/bucket')) return new Response('{"message":"The resource already exists"}', { status: 400 })
      return new Response('{}', { status: 200 })
    }
    try {
      const address = await saveUploadedImage({
        buffer: image, filename: 'b.png', contentType: 'image/png', uploadDirectory: tmpdir(), isProduction: true,
      })
      assert.equal(address, 'https://project.supabase.co/storage/v1/object/public/menu-images/uploads/b.png')
      const upload = calls.find((call) => call.url.includes('/storage/v1/object/'))
      assert.equal(upload.url, 'https://project.supabase.co/storage/v1/object/menu-images/uploads/b.png')
      assert.equal(upload.options.headers.Authorization, 'Bearer service-key')
      assert.equal(upload.options.headers['Content-Type'], 'image/png')
      assert.equal(imageStorageOrigin(), 'https://project.supabase.co')
    } finally {
      globalThis.fetch = realFetch
    }
  }))
