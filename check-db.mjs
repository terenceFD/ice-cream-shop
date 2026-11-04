import Database from "better-sqlite3";
const db = new Database("server/database.sqlite");
console.log(
  db
    .prepare("SELECT name, image FROM flavors")
    .all()
    .map((r) => `${r.name} -> ${r.image}`)
    .join("\n"),
);
