import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import { MAX_UPLOAD_SIDE, optimizeUploadedImage, UnreadableImageError } from './images.js'

function photo(width, height, format = 'jpeg') {
  // Noise compresses badly, like a real photo.
  const pixels = Buffer.alloc(width * height * 3)
  for (let index = 0; index < pixels.length; index += 1) pixels[index] = (index * 7919) % 251
  return sharp(pixels, { raw: { width, height, channels: 3 } })[format]().toBuffer()
}

test('shrinks a large upload to the maximum size and saves it as WebP', async () => {
  const input = await photo(3000, 2000)
  const result = await optimizeUploadedImage(input, 'jpeg')
  assert.equal(result.contentType, 'image/webp')
  assert.equal(result.extension, '.webp')
  const { width, height, format } = await sharp(result.buffer).metadata()
  assert.equal(format, 'webp')
  assert.equal(width, MAX_UPLOAD_SIDE)
  assert.equal(height, 800)
  assert.ok(result.buffer.length < input.length)
})

test('keeps a small upload as it is when WebP would not be smaller', async () => {
  // Already small and heavily compressed: re-encoding at normal quality would only grow it.
  const input = await sharp(await photo(300, 300)).webp({ quality: 10 }).toBuffer()
  const result = await optimizeUploadedImage(input, 'webp')
  assert.equal(result.buffer, input)
  assert.equal(result.contentType, 'image/webp')
})

test('keeps GIFs unchanged so animations still play', async () => {
  const input = await sharp({ create: { width: 2000, height: 2000, channels: 3, background: '#092a53' } }).gif().toBuffer()
  const result = await optimizeUploadedImage(input, 'gif')
  assert.equal(result.buffer, input)
  assert.equal(result.extension, '.gif')
})

test('rejects a file that is not a readable image', async () => {
  const broken = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(200, 1)])
  await assert.rejects(optimizeUploadedImage(broken, 'jpeg'), UnreadableImageError)
})
