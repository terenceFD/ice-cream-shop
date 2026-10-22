import Database from "better-sqlite3";
import crypto from "node:crypto";

const db = new Database("./server/database.sqlite", { readonly: true });
const row = db
  .prepare(
    "SELECT email, verification_id, code_hash FROM password_resets ORDER BY created_at DESC LIMIT 1",
  )
  .get();
if (!row) {
  console.log("no password_resets row");
  process.exit(0);
}
console.log("email:", row.email);
console.log("verification id:", row.verification_id);
const secret = "local-verification-secret-0123456789abcdef";
for (let n = 0; n < 1000000; n++) {
  const code = String(n).padStart(6, "0");
  const hash = crypto
    .createHmac("sha256", secret)
    .update(row.verification_id + ":" + code)
    .digest("hex");
  if (hash === row.code_hash) {
    console.log("CODE:", code);
    break;
  }
}
