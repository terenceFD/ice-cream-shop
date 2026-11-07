// Live vision test: asks the agent what the attached photo shows, using the full
// pipeline (vision-model routing, base64 inlining, tool calling, verify pass).
import "dotenv/config";
import Database from "better-sqlite3";
import { suggestReply } from "../server/chat-assistant.js";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// A REAL product photo — the 8×8 stub PNG was rejected by the provider's decoder.
function findPhoto(dir) {
  let anyPhoto = "";
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findPhoto(full);
        // An ice-cream-named photo wins immediately; otherwise keep the first seen.
        if (found && /ice|cream|scoop|cone/i.test(found)) return found;
        if (found && !anyPhoto) anyPhoto = found;
      } else if (
        /\.(jpe?g|png)$/i.test(entry.name) &&
        statSync(full).size > 20000
      ) {
        if (/ice|cream|scoop|cone/i.test(entry.name)) return full;
        if (!anyPhoto) anyPhoto = full;
      }
    }
  } catch {}
  return anyPhoto;
}
const photoPath = findPhoto(
  path.join(
    fileURLToPath(new URL("..", import.meta.url)),
    "public",
    "ice-images",
  ),
);
if (!photoPath) {
  console.log("no photo found");
  process.exit(1);
}
const mime = /\.png$/i.test(photoPath) ? "image/png" : "image/jpeg";
// Stored as the inline data URI the chat widget would upload — same shape the
// real customer flow produces (upload endpoint → dataUrl → stored → inlined).
const imageUrl = `data:${mime};base64,${readFileSync(photoPath).toString("base64")}`;
console.log("photo:", path.basename(photoPath));

const sqlite = new Database("server/database.sqlite", { readonly: true });
const database = {
  prepare: (sql) => ({
    all: (...args) => sqlite.prepare(sql).all(...args),
    get: (...args) => sqlite.prepare(sql).get(...args),
    run: (...args) => sqlite.prepare(sql).run(...args),
  }),
};

const result = await suggestReply(
  [
    {
      sender: "customer",
      body: "What do you see in this photo? Do you sell something like it?",
      // The shape the server produces: SELECT … image_url AS "imageUrl".
      imageUrl,
    },
  ],
  { database, language: "en", customerPage: "/menu", imageUrl },
);
console.log("source:", result.source);
console.log("aiFailure:", JSON.stringify(result.aiFailure || null));
console.log("reply:", result.suggestion?.slice(0, 400));
