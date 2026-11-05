// Re-encodes the flavor-inspiration photos in place.
//
// They were saved as 1500x1500 JPEGs at high quality (160 KB to 481 KB) and are shown
// in cards about 168-340px wide, so almost every byte was wasted. The filenames stay
// the same, so no page has to change; only the pixels are re-encoded. The build's
// make-thumbnails step then regenerates the /thumbs/<width>/ WebP copies from these.
//
// Safe to run repeatedly: a photo that is already smaller than the target is skipped.
import { readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const directory = fileURLToPath(
  new URL("../public/flavor-inspiration/", import.meta.url),
);
// 1200px matches what photoSizes.js tells the browser the original is; the cards and
// the flavor page never show these larger than ~500px.
const MAX_WIDTH = 1200;
// Only re-encode photos above this size, so repeated runs cost nothing.
const SKIP_BELOW_BYTES = 120 * 1024;

export async function optimizeFlavorInspiration() {
  const report = [];
  for (const name of readdirSync(directory)) {
    if (!/\.(jpe?g)$/i.test(name)) continue;
    const path = join(directory, name);
    const before = statSync(path).size;
    if (before < SKIP_BELOW_BYTES) {
      report.push({ name, skipped: true, beforeKB: Math.round(before / 1024) });
      continue;
    }
    const buffer = await sharp(path)
      .rotate()
      .resize({
        width: MAX_WIDTH,
        height: MAX_WIDTH,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 72, progressive: true, mozjpeg: true })
      .toBuffer();
    if (buffer.length >= before) {
      report.push({ name, skipped: true, beforeKB: Math.round(before / 1024) });
      continue;
    }
    // Encoded to a temporary file and swapped in. Writing over the photo directly fails
    // on Windows while libvips still holds a handle from reading it.
    const temporary = `${path}.tmp`;
    writeFileSync(temporary, buffer);
    renameSync(temporary, path);
    report.push({
      name,
      beforeKB: Math.round(before / 1024),
      afterKB: Math.round(buffer.length / 1024),
    });
  }
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = await optimizeFlavorInspiration();
  let saved = 0;
  for (const row of report) {
    if (row.skipped) {
      console.log(
        `${row.name.padEnd(24)} ${String(row.beforeKB).padStart(4)} KB  (already small, skipped)`,
      );
      continue;
    }
    saved += row.beforeKB - row.afterKB;
    console.log(
      `${row.name.padEnd(24)} ${String(row.beforeKB).padStart(4)} KB -> ${String(row.afterKB).padStart(3)} KB`,
    );
  }
  console.log(`Saved ${saved} KB in total.`);
}
