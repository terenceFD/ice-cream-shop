import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { photoAt, photoSrcSet, PHOTO_WIDTHS } from '../shared/photoSizes.js'
import { thumbnailPathFor } from './make-thumbnails.mjs'

const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url))

test('pages ask for the same files the thumbnail script makes', () => {
  for (const photo of ['/ice-images/ice-9.jpg', '/cream/cream 4.webp', '/menu-official/cakes/birthday-cakes.webp']) {
    for (const width of PHOTO_WIDTHS) {
      const url = photoAt(photo, width)
      const file = thumbnailPathFor(join(publicDirectory, photo.slice(1)), width)
      assert.equal(join(publicDirectory, url.slice(1)), file)
    }
  }
  // Addresses written with %20 for spaces point at the same copy.
  assert.equal(decodeURIComponent(photoAt('/cream/cream%204.webp', 160)), '/thumbs/160/cream/cream 4.webp')
})

test('lists every size for site photos and leaves other addresses alone', () => {
  assert.equal(
    photoSrcSet('/ice-images/ice-4.webp'),
    '/thumbs/160/ice-images/ice-4.webp 160w, /thumbs/480/ice-images/ice-4.webp 480w, /thumbs/800/ice-images/ice-4.webp 800w, /ice-images/ice-4.webp 1200w',
  )
  for (const other of ['/uploads/a.jpg', 'https://project.supabase.co/storage/v1/object/public/menu-images/uploads/a.webp', '/logo.png', '', undefined]) {
    assert.equal(photoSrcSet(other), undefined)
    assert.equal(photoAt(other, 480), other)
  }
})

test('asks Unsplash for the width it needs', () => {
  const src = 'https://images.unsplash.com/photo-1?q=80&w=1074&auto=format&fit=crop'
  const small = new URL(photoAt(src, 480))
  assert.equal(small.searchParams.get('w'), '480')
  assert.equal(small.searchParams.get('fit'), 'crop')
  assert.match(photoSrcSet(src), /w=160.* 160w, .*w=800.* 800w, .* 1200w$/)
})
