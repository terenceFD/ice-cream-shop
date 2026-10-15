import sharp from 'sharp'

// Uploaded photos are shown at most about 600px wide (twice that on sharp phone screens), so
// anything bigger only slows pages down. Every upload is resized and saved as WebP here.
export const MAX_UPLOAD_SIDE = 1200
const WEBP_QUALITY = 78

export class UnreadableImageError extends Error {
  constructor(cause) {
    super('This image could not be read. Try another photo, or save it again as JPEG or PNG.', { cause })
    this.name = 'UnreadableImageError'
  }
}

/**
 * Returns { buffer, extension, contentType } ready to store. GIFs are kept as they are, so
 * animations keep working; if resizing would not make a photo smaller, the original is kept.
 */
export async function optimizeUploadedImage(buffer, format) {
  const original = { buffer, extension: format === 'jpeg' ? '.jpg' : `.${format}`, contentType: `image/${format}` }
  if (format === 'gif') return original
  let optimized
  try {
    optimized = await sharp(buffer, { failOn: 'error' })
      .rotate() // apply the phone's orientation before the orientation tag is dropped
      .resize({ width: MAX_UPLOAD_SIDE, height: MAX_UPLOAD_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer({ resolveWithObject: true })
  } catch (error) {
    throw new UnreadableImageError(error)
  }
  const metadata = await sharp(buffer).metadata().catch(() => ({}))
  const wasResized = Math.max(metadata.width || 0, metadata.height || 0) > MAX_UPLOAD_SIDE
  if (!wasResized && optimized.data.length >= buffer.length) return original
  return { buffer: optimized.data, extension: '.webp', contentType: 'image/webp' }
}
