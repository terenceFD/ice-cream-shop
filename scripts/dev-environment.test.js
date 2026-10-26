import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { developmentEnvironment } from "./dev-environment.js";

function withEnvFile(content, check) {
  const directory = mkdtempSync(join(tmpdir(), "ice-cream-dev-env-"));
  try {
    const path = join(directory, ".env");
    writeFileSync(path, content);
    check(path);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("development honors an explicit PostgreSQL backend in .env", () => {
  withEnvFile(
    "DATABASE_BACKEND=postgres\nDATABASE_URL=postgres://example/test",
    (path) => {
      const env = developmentEnvironment({}, path);
      assert.equal(env.DATABASE_BACKEND, "postgres");
      assert.equal(env.DATABASE_URL, "postgres://example/test");
    },
  );
});

test("shell backend takes precedence over .env without mutating the input", () => {
  withEnvFile("DATABASE_BACKEND=postgres", (path) => {
    const input = { DATABASE_BACKEND: "sqlite" };
    assert.equal(
      developmentEnvironment(input, path).DATABASE_BACKEND,
      "sqlite",
    );
    assert.deepEqual(input, { DATABASE_BACKEND: "sqlite" });
  });
});

test("development still defaults to SQLite even when only a live URL is present", () => {
  withEnvFile("DATABASE_URL=postgres://example/test", (path) => {
    assert.equal(developmentEnvironment({}, path).DATABASE_BACKEND, "sqlite");
  });
});
