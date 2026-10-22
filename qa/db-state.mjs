import Database from "better-sqlite3";

const db = new Database("./server/database.sqlite", { readonly: true });
console.log(
  "has password_resets:",
  db
    .prepare(
      "SELECT count(*) AS n FROM sqlite_master WHERE name='password_resets'",
    )
    .get().n > 0,
);
console.log(
  "customer exists:",
  db
    .prepare(
      "SELECT count(*) AS n FROM customers WHERE email='reset-test@example.com'",
    )
    .get().n > 0,
);
const rows = db
  .prepare("SELECT email, attempts, expires_at FROM password_resets")
  .all();
console.log("reset rows:", JSON.stringify(rows));
