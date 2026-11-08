// Match a chat photo to a catalog image by difference hash.
//
// The vision model can misname a picture. A hash of the real product file is a
// second opinion: an identical or near-identical image (a screenshot of the
// product, the file itself) is trusted, and a distant hash is not called a match.

import { readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const PUBLIC_DIR = resolve(fileURLToPath(new URL("../public/", import.meta.url)));
const UPLOADS_DIR = resolve(fileURLToPath(new URL("./uploads/", import.meta.url)));
const hashCache = new Map();

/** How close two 64-bit hashes must be before the photo is treated as that product. */
export const MATCH_DISTANCE = 16;

export function hammingDistance(left, right) {
  if (!left || !right || left.length !== right.length) return 64;
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) distance += 1;
  }
  return distance;
}

/** 64-bit difference hash from an 8×9 greyscale row. Exported for tests. */
export function differenceHashBits(pixels, width = 9, height = 8) {
  let bits = "";
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      bits += pixels[y * width + x] > pixels[y * width + x + 1] ? "1" : "0";
    }
  }
  return bits;
}

export async function hashImageBuffer(buffer) {
  const { data, info } = await sharp(buffer)
    .rotate()
    .greyscale()
    .resize(9, 8, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== 9 || info.height !== 8) return "";
  return differenceHashBits(data, info.width, info.height);
}

export function closestHash(target, items) {
  if (!target) return null;
  let best = null;
  let distance = 65;
  for (const item of items) {
    if (!item?.hash) continue;
    const next = hammingDistance(target, item.hash);
    if (next < distance) {
      distance = next;
      best = item;
    }
  }
  if (!best) return null;
  return { ...best, distance, confident: distance <= MATCH_DISTANCE };
}

function safeImageFile(imagePath) {
  if (typeof imagePath !== "string" || !imagePath.startsWith("/") || imagePath.includes("..")) return "";
  const root = imagePath.startsWith("/uploads/") ? UPLOADS_DIR : PUBLIC_DIR;
  const relative = imagePath.startsWith("/uploads/")
    ? imagePath.slice("/uploads/".length)
    : imagePath.slice(1);
  const filePath = resolve(root, relative);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) return "";
  return filePath;
}

async function hashCatalogFile(imagePath) {
  const filePath = safeImageFile(imagePath);
  if (!filePath) return "";
  try {
    const stamp = statSync(filePath).mtimeMs;
    const cached = hashCache.get(filePath);
    if (cached && cached.stamp === stamp) return cached.hash;
    const hash = await hashImageBuffer(readFileSync(filePath));
    hashCache.set(filePath, { stamp, hash });
    return hash;
  } catch {
    return "";
  }
}

/**
 * Compare an uploaded chat photo with the catalog images already on the facts.
 * `entries` are { name, path, image, addId, soldOut, price, allergens, detail }.
 */
export async function matchPhotoBuffer(buffer, entries) {
  const target = await hashImageBuffer(buffer);
  if (!target) return null;
  const hashed = [];
  for (const entry of entries) {
    if (!entry?.image) continue;
    const hash = await hashCatalogFile(entry.image);
    if (hash) hashed.push({ ...entry, hash });
  }
  const match = closestHash(target, hashed);
  if (!match) return null;
  delete match.hash;
  return match;
}
