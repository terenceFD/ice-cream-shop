// Minimal direct probe: does qwen-3.8-27b on Cerebras see a base64 image?
import "dotenv/config";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Use a REAL product photo — a decodable JPEG, unlike the 8×8 stub PNG.
let photoPath = "";
// The repo's public folder: scripts/ → project root → public/ice-images.
const menuDir = path.join(
  fileURLToPath(new URL("..", import.meta.url)),
  "public",
  "ice-images",
);
function findPhoto(dir) {
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findPhoto(full);
        if (found) return found;
      } else if (
        /\.(jpe?g|png|webp)$/i.test(entry.name) &&
        statSync(full).size > 20000
      ) {
        return full;
      }
    }
  } catch {}
  return "";
}
photoPath = findPhoto(menuDir);
if (!photoPath) {
  console.log("no photo found under", menuDir);
  process.exit(1);
}
const photoBuffer = readFileSync(photoPath);
const mime = /\.png$/i.test(photoPath)
  ? "image/png"
  : /\.webp$/i.test(photoPath)
    ? "image/webp"
    : "image/jpeg";
const dataUri = `data:${mime};base64,${photoBuffer.toString("base64")}`;
console.log(
  "photo:",
  path.basename(photoPath),
  `(${Math.round(photoBuffer.length / 1024)} KB, ${mime})`,
);
const response = await fetch(
  `${process.env.AI_BASE_URL.replace(/\/$/, "")}/chat/completions`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.AI_VISION_MODEL,
      max_completion_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "What color is this image? Answer in one word.",
            },
            { type: "image_url", image_url: { url: dataUri } },
          ],
        },
      ],
    }),
  },
);
const text = await response.text();
console.log("HTTP", response.status);
try {
  const data = JSON.parse(text);
  console.log(
    "reply:",
    (data.choices?.[0]?.message?.content || "").slice(0, 200) ||
      text.slice(0, 300),
  );
} catch {
  console.log(text.slice(0, 400));
}
