// Pre-compresses the built frontend so the server can send .br and .gz files
// straight from disk. Compressing on every request burns CPU on Render's small
// instances and `compression` only kicks in when the client sends an
// Accept-Encoding the middleware recognises — the main bundle was measured
// leaving the server uncompressed (334 KB raw on the wire). A pre-built
// brotli copy is ~82 KB instead: a 4x smaller download for every visitor.
// Run after `vite build` (see the `build` script in package.json).
import { brotliCompress } from "node:zlib";
import { gzipSync } from "node:zlib";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const distDirectory = fileURLToPath(new URL("../dist/", import.meta.url));
// Brotli level 11 gives the smallest file; build time is irrelevant next to
// every visitor's download. Assets never change once written (Vite hashes
// their names), so the compressed copies are also content-addressed.
const BROTLI_LEVEL = 11;
const GZIP_LEVEL = 9;
const COMPRESSIBLE = /\.(?:js|css|html|svg|json|webmanifest|txt|xml)$/i;

async function compressTree(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  let files = 0;
  let savedBytes = 0;
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const sub = await compressTree(fullPath);
      files += sub.files;
      savedBytes += sub.savedBytes;
      continue;
    }
    if (!COMPRESSIBLE.test(entry.name)) continue;
    const source = await fs.readFile(fullPath);
    // Large bundles are skipped by compression's default threshold; with
    // pre-built files there is no threshold — the biggest files gain the most.
    const brotli = await new Promise((resolve, reject) =>
      brotliCompress(
        source,
        { params: { [1]: BROTLI_LEVEL } },
        (error, result) => (error ? reject(error) : resolve(result)),
      ),
    );
    const gzip = gzipSync(source, { level: GZIP_LEVEL });
    // Only keep a compressed copy when it is actually smaller.
    if (brotli.length < source.length)
      await fs.writeFile(`${fullPath}.br`, brotli);
    if (gzip.length < source.length) await fs.writeFile(`${fullPath}.gz`, gzip);
    const smallest = Math.min(brotli.length, gzip.length);
    if (smallest < source.length) {
      files += 1;
      savedBytes += source.length - smallest;
    }
  }
  return { files, savedBytes };
}

const { files, savedBytes } = await compressTree(distDirectory);
console.log(
  `Pre-compressed ${files} file(s); ${(savedBytes / 1024).toFixed(0)} KB saved.`,
);
