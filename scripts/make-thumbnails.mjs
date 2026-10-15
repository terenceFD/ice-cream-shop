// Makes a small copy of every photo in public/ under public/thumbs/ (same path, 480px wide, WebP),
// so pages can show small pictures without downloading the full-size photo. Runs before every
// build and dev start; photos whose copy is already up to date are skipped.
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

export const THUMBNAIL_WIDTH = 480
const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url))
const thumbsDirectory = join(publicDirectory, 'thumbs')
// Icons and the logo are already small; fonts are not photos.
const SKIP_DIRECTORIES = new Set(['thumbs', 'icons', 'fonts'])

function listPhotos(directory, found = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRECTORIES.has(relative(publicDirectory, path).split(sep)[0])) listPhotos(path, found)
    } else if (/\.(webp|jpe?g|png)$/i.test(entry.name) && directory !== publicDirectory.replace(/[\\/]$/, '')) {
      found.push(path)
    }
  }
  return found
}

/** public/a/b.jpg -> public/thumbs/a/b.webp (every copy is WebP). */
export function thumbnailPathFor(photoPath) {
  return join(thumbsDirectory, relative(publicDirectory, photoPath)).replace(/\.(jpe?g|png|webp)$/i, '.webp')
}

export async function makeThumbnails() {
  sharp.cache(false)
  const photos = listPhotos(publicDirectory)
  const wanted = new Set()
  let made = 0
  for (const photo of photos) {
    const target = thumbnailPathFor(photo)
    wanted.add(target)
    if (existsSync(target) && statSync(target).mtimeMs >= statSync(photo).mtimeMs) continue
    mkdirSync(dirname(target), { recursive: true })
    await sharp(photo)
      .rotate()
      .resize({ width: THUMBNAIL_WIDTH, height: THUMBNAIL_WIDTH, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72, effort: 5 })
      .toFile(target)
    made += 1
  }
  // Remove copies of photos that were deleted or renamed.
  let removed = 0
  if (existsSync(thumbsDirectory)) {
    for (const copy of listCopies(thumbsDirectory)) {
      if (!wanted.has(copy)) {
        rmSync(copy)
        removed += 1
      }
    }
  }
  return { photos: photos.length, made, removed }
}

function listCopies(directory, found = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) listCopies(path, found)
    else found.push(path)
  }
  return found
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await makeThumbnails()
  console.log(`Thumbnails: ${result.photos} photos, ${result.made} made, ${result.removed} removed.`)
}
