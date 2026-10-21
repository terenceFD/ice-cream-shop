import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

await client.connect();
const rows = await client.query(
  "SELECT key, value_json, updated_at FROM site_settings",
);
console.log(JSON.stringify(rows.rows, null, 2));
await client.end();
