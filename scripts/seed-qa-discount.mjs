// Seed the dev database with the fixtures the QA battery needs: one discount
// code. Idempotent — it skips the insert when the code already exists.
import { database } from "../server/database.js";

const exists = database
  .prepare("SELECT 1 FROM discount_codes WHERE code = 'WEEKEND'")
  .get();
if (!exists) {
  database
    .prepare(
      "INSERT INTO discount_codes (code, discount_type, discount_value, minimum_total, is_active) VALUES ('WEEKEND','percent',10,0,1)",
    )
    .run();
  console.log("WEEKEND seeded");
} else {
  console.log("WEEKEND already present");
}
