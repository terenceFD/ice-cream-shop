import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import bcrypt from "bcrypt";
import Database from "better-sqlite3";
import { encryptTotpSecret } from "./admin-mfa.js";

test(
  "MFA key mismatch returns 503 guidance without issuing a session or resetting MFA",
  { timeout: 30000 },
  async () => {
    const directory = mkdtempSync(join(tmpdir(), "admin-mfa-login-"));
    const path = join(directory, "test.sqlite");
    const reservation = createServer();
    reservation.listen(0, "127.0.0.1");
    await once(reservation, "listening");
    const port = reservation.address().port;
    await new Promise((resolve) => reservation.close(resolve));
    const child = spawn(process.execPath, ["server/index.js"], {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(port),
        DATABASE_BACKEND: "sqlite",
        DATABASE_PATH: path,
        JWT_SECRET: "isolated-test-session-key-with-more-than-32-characters",
        ADMIN_MFA_ENCRYPTION_KEY: "",
        STRIPE_SECRET_KEY: "",
        CAMPAY_MOBILE_MONEY_ENABLED: "false",
        SMTP_HOST: "",
        VAPID_PRIVATE_KEY: "",
        VAPID_PUBLIC_KEY: "",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let errors = "";
    child.stderr.on("data", (chunk) => {
      errors += chunk;
    });
    let database;
    const base = `http://127.0.0.1:${port}`;
    async function post(path, body) {
      const response = await fetch(base + path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    }
    try {
      let healthy = false;
      for (let i = 0; i < 150; i++) {
        if (child.exitCode !== null) throw new Error(errors);
        try {
          healthy = (await fetch(base + "/api/health")).ok;
        } catch {}
        if (healthy) break;
        await delay(100);
      }
      assert.ok(healthy, errors);
      database = new Database(path);
      const password = "Isolated test password 2026!";
      database
        .prepare(
          "INSERT INTO admins (name,email,password_hash,role,totp_enabled,totp_secret) VALUES (?,?,?,?,?,?)",
        )
        .run(
          "Test Owner",
          "owner@example.test",
          await bcrypt.hash(password, 4),
          "owner",
          1,
          encryptTotpSecret(
            "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
            "different-enrollment-key",
          ),
        );
      const login = await post("/api/admin/login", {
        email: "owner@example.test",
        password,
      });
      assert.equal(login.status, 200);
      assert.equal(login.body.mfaRequired, true);
      const result = await post("/api/admin/login/mfa/verify", {
        challengeToken: login.body.challengeToken,
        code: "123456",
      });
      assert.equal(result.status, 503);
      assert.match(
        result.body.error,
        /restore the original MFA encryption key/,
      );
      assert.equal(result.body.token, undefined);
      assert.equal(
        database.prepare("SELECT totp_enabled FROM admins").get().totp_enabled,
        1,
      );
    } finally {
      database?.close();
      child.kill();
      if (child.exitCode === null) await once(child, "exit");
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
