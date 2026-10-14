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

function supabaseStorageConfig(environment = process.env) {
  const url = environment.SUPABASE_URL?.trim().replace(/\/+$/, '')
  const serviceKey = environment.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const bucket = environment.SUPABASE_STORAGE_BUCKET?.trim() || 'menu-images'
  if (!url || !serviceKey) return null
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:') {
    throw new ImageStorageConfigurationError('SUPABASE_URL must use HTTPS.')
  }
  return { url, origin: parsed.origin, serviceKey, bucket }
}

export function imageStorageOrigin(environment = process.env) {
  return supabaseStorageConfig(environment)?.origin || null
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
