import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Uploaded images go to Supabase Storage when it is configured, because hosts such as Render
// wipe the server's own disk on every deploy. Without it, images are saved to server/uploads,
// which is only suitable for local development.

export class ImageStorageConfigurationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ImageStorageConfigurationError'
  }
}

function stripQuotes(value) {
  return value?.trim().replace(/^(['"])(.*)\1$/, '$2').trim() || ''
}

/**
 * Accepts the Supabase Project URL in the forms people usually paste: with or without
 * "https://", with a trailing slash, or with an API path such as "/rest/v1" on the end.
 * Returns the bare https origin, or null when the value cannot be a Supabase project address.
 */
export function normalizeSupabaseUrl(value) {
  let text = stripQuotes(value)
  if (!text) return null
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `https://${text}`
  let parsed
  try {
    parsed = new URL(text)
  } catch {
    return null
  }
  if (!['https:', 'http:'].includes(parsed.protocol) || !parsed.hostname.includes('.')) return null
  return `https://${parsed.host}`
}

let reportedBadUrl = false

function supabaseStorageConfig(environment = process.env) {
  const rawUrl = stripQuotes(environment.SUPABASE_URL)
  const serviceKey = stripQuotes(environment.SUPABASE_SERVICE_ROLE_KEY)
  const bucket = stripQuotes(environment.SUPABASE_STORAGE_BUCKET) || 'menu-images'
  if (!rawUrl || !serviceKey) return null
  const url = normalizeSupabaseUrl(rawUrl)
  if (!url) {
    // Never stop the whole site over this setting; uploads report the problem instead.
    if (!reportedBadUrl) {
      console.error('SUPABASE_URL is not a valid Supabase Project URL, such as https://abcd1234.supabase.co. Image uploads are disabled.')
      reportedBadUrl = true
    }
    return { invalid: true }
  }
  return { url, origin: url, serviceKey, bucket }
}

export function imageStorageOrigin(environment = process.env) {
  const config = supabaseStorageConfig(environment)
  return config && !config.invalid ? config.origin : null
}

/** A safe summary for logs and health checks; never includes the key. */
export function imageStorageStatus(environment = process.env) {
  const config = supabaseStorageConfig(environment)
  if (!config) return 'local-disk'
  return config.invalid ? 'invalid-supabase-url' : 'supabase'
}

let bucketReady = false

async function ensurePublicBucket({ url, serviceKey, bucket }) {
  if (bucketReady) return
  const response = await fetch(`${url}/storage/v1/bucket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: bucket,
      name: bucket,
      public: true,
      file_size_limit: 5 * 1024 * 1024,
      allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    }),
  })
  // 409, or 400 with "already exists", means the bucket is already there.
  if (!response.ok) {
    const body = await response.text()
    if (response.status !== 409 && !/already exists|Duplicate/i.test(body)) {
      throw new Error(`Supabase Storage could not prepare the "${bucket}" bucket (HTTP ${response.status}).`)
    }
  }
  bucketReady = true
}

/**
 * Saves an already-validated image and returns the address to store in the database.
 * In production, refuses to fall back to the local disk so images are never silently lost.
 */
export async function saveUploadedImage({ buffer, filename, contentType, uploadDirectory, isProduction }) {
  const config = supabaseStorageConfig()
  if (config?.invalid) {
    throw new ImageStorageConfigurationError(
      'SUPABASE_URL on the server is not a valid Supabase Project URL. Use the address shown in Supabase under Project Settings > API, such as https://abcd1234.supabase.co.',
    )
  }
  if (!config) {
    if (isProduction) {
      throw new ImageStorageConfigurationError(
        'Image uploads need Supabase Storage on the live site. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.',
      )
    }
    await mkdir(uploadDirectory, { recursive: true })
    await writeFile(join(uploadDirectory, filename), buffer, { flag: 'wx' })
    return `/uploads/${filename}`
  }

  await ensurePublicBucket(config)
  const objectPath = `uploads/${filename}`
  const response = await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${objectPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.serviceKey}`,
      apikey: config.serviceKey,
      'Content-Type': contentType,
      'Cache-Control': 'max-age=31536000',
      'x-upsert': 'false',
    },
    body: buffer,
  })
  if (!response.ok) {
    throw new Error(`Supabase Storage rejected the image upload (HTTP ${response.status}).`)
  }
  return `${config.url}/storage/v1/object/public/${encodeURIComponent(config.bucket)}/${objectPath}`
}
