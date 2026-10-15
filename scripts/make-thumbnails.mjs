// Makes smaller copies of every photo in public/ under public/thumbs/<width>/ (same path, WebP),
// so pages can show small pictures without downloading the full-size photo. Runs before every
// build and dev start; copies that are already up to date are skipped.
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { PHOTO_WIDTHS } from '../src/photoSizes.js'

const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url))
const thumbsDirectory = join(publicDirectory, 'thumbs')
// Icons and the logo are already small; fonts are not photos.
const SKIP_DIRECTORIES = new Set(['thumbs', 'icons', 'fonts'])

function listFiles(directory, found = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) listFiles(path, found)
    else found.push(path)
  }
  return found
}

function listPhotos() {
  return readdirSync(publicDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !SKIP_DIRECTORIES.has(entry.name))
    .flatMap((entry) => listFiles(join(publicDirectory, entry.name)))
    .filter((path) => /\.(webp|jpe?g|png)$/i.test(path))
}

/** public/a/b.jpg -> public/thumbs/480/a/b.webp (every copy is WebP). */
export function thumbnailPathFor(photoPath, width) {
  return join(thumbsDirectory, String(width), relative(publicDirectory, photoPath)).replace(/\.(jpe?g|png|webp)$/i, '.webp')
}

export async function makeThumbnails() {
  sharp.cache(false)
  const photos = listPhotos()
  const wanted = new Set()
  let made = 0
  for (const photo of photos) {
    for (const width of PHOTO_WIDTHS) {
      const target = thumbnailPathFor(photo, width)
      wanted.add(target)
      if (existsSync(target) && statSync(target).mtimeMs >= statSync(photo).mtimeMs) continue
      mkdirSync(dirname(target), { recursive: true })
      await sharp(photo)
        .rotate()
        .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: width <= 160 ? 70 : 72, effort: 5 })
        .toFile(target)
      made += 1
    }
  }
  // Remove copies of photos that were deleted or renamed, and copies in old locations.
  let removed = 0
  if (existsSync(thumbsDirectory)) {
    for (const copy of listFiles(thumbsDirectory)) {
      if (!wanted.has(copy)) {
        rmSync(copy)
        removed += 1
      }
    }
  }
  return { photos: photos.length, made, removed }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await makeThumbnails()
  console.log(`Thumbnails: ${result.photos} photos, ${result.made} copies made, ${result.removed} removed.`)
}
