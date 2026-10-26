import { config } from "dotenv";

// Load .env before applying the safe local default. An explicit backend in the
// shell or .env must not be silently replaced with an empty SQLite database.
export function developmentEnvironment(
  environment = process.env,
  envFile = ".env",
) {
  const loaded = { ...environment };
  config({ path: envFile, processEnv: loaded, quiet: true });
  return { ...loaded, DATABASE_BACKEND: loaded.DATABASE_BACKEND || "sqlite" };
}
