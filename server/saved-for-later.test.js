import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import Database from "better-sqlite3";
import bcrypt from "bcrypt";

const projectRoot = new URL("../", import.meta.url);

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
}

async function getAvailablePort() {
  const server = createServer();
  const port = await listen(server);
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function waitForHealth(baseUrl, child, getStderr) {
  const deadline = Date.now() + 20_000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(`API process exited early: ${getStderr()}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(
    `API did not become ready: ${lastError?.message || getStderr()}`,
  );
}

async function call(baseUrl, path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

// A bag saved from the cart page has to survive the round trip: it is written, read back,
// refused when unauthenticated, and refuses nonsense input rather than storing it.
test(
  "a bag can be saved for later, listed, and deleted",
  { timeout: 45_000 },
  async () => {
    const directory = mkdtempSync(join(tmpdir(), "ice-cream-saved-cart-"));
    const apiPort = await getAvailablePort();
    const databasePath = join(directory, "saved-cart.sqlite");
    const child = spawn(process.execPath, ["server/index.js"], {
      cwd: projectRoot,
      stdio: ["ignore", "ignore", "pipe"],
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_BACKEND: "sqlite",
        DATABASE_PATH: databasePath,
        PORT: String(apiPort),
        JWT_SECRET: "saved-cart-test-secret-with-at-least-32-characters",
        SMTP_HOST: "",
        SMTP_USER: "",
        SMTP_PASSWORD: "",
      },
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const baseUrl = `http://127.0.0.1:${apiPort}`;

    try {
      await waitForHealth(baseUrl, child, () => stderr);

      const email = "bag-customer@example.test";
      const password = "A secure bag password 2026";
      const database = new Database(databasePath);
      database
        .prepare(
          "INSERT INTO customers (name, email, password_hash) VALUES (?, ?, ?)",
        )
        .run("Bag Customer", email, await bcrypt.hash(password, 4));
      database.close();

      const login = await call(baseUrl, "/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      assert.equal(login.status, 200, stderr);
      const token = login.body.token;
      assert.ok(token);

      // Refused without a session.
      const anonymous = await call(baseUrl, "/api/customer/saved-carts", {
        method: "POST",
        body: {
          items: [
            { productId: "menu:ice-cream:birthday-cake-remix", quantity: 2 },
          ],
        },
      });
      assert.equal(anonymous.status, 401);

      // Nonsense is rejected, not stored.
      for (const items of [
        [],
        [{ productId: "menu:ice-cream:birthday-cake-remix", quantity: 0 }],
        [{ productId: "menu:ice-cream:birthday-cake-remix", quantity: -3 }],
        [{ productId: "", quantity: 1 }],
        [{ productId: 42, quantity: 1 }],
      ]) {
        const rejected = await call(baseUrl, "/api/customer/saved-carts", {
          method: "POST",
          token,
          body: { label: "Bad bag", items },
        });
        assert.equal(
          rejected.status,
          400,
          `items ${JSON.stringify(items)} should be refused`,
        );
      }

      // A bag saved from the cart page, with no order behind it.
      const saved = await call(baseUrl, "/api/customer/saved-carts", {
        method: "POST",
        token,
        body: {
          label: "Birthday Cake Remix",
          items: [
            { productId: "menu:ice-cream:birthday-cake-remix", quantity: 2 },
          ],
        },
      });
      assert.equal(saved.status, 201, stderr);
      assert.equal(saved.body.savedCart.label, "Birthday Cake Remix");
      assert.deepEqual(saved.body.savedCart.items, [
        { productId: "menu:ice-cream:birthday-cake-remix", quantity: 2 },
      ]);
      assert.equal(saved.body.savedCart.sourceOrderId, null);

      // The same bag content can be saved again (a different moment in time).
      const second = await call(baseUrl, "/api/customer/saved-carts", {
        method: "POST",
        token,
        body: {
          label: "Another bag",
          items: [{ productId: "flavor:1", quantity: 1 }],
        },
      });
      assert.equal(second.status, 201);

      const listed = await call(baseUrl, "/api/customer/saved-carts", {
        token,
      });
      assert.equal(listed.status, 200);
      assert.equal(listed.body.savedCarts.length, 2);
      assert.equal(
        listed.body.savedCarts[0].label,
        "Another bag",
        "newest first",
      );
      assert.equal(listed.body.savedCarts[1].label, "Birthday Cake Remix");

      // Another customer cannot see or delete these.
      const otherEmail = "other-bag-customer@example.test";
      const other = new Database(databasePath);
      other
        .prepare(
          "INSERT INTO customers (name, email, password_hash) VALUES (?, ?, ?)",
        )
        .run("Other Customer", otherEmail, await bcrypt.hash(password, 4));
      other.close();
      const otherLogin = await call(baseUrl, "/api/auth/login", {
        method: "POST",
        body: { email: otherEmail, password },
      });
      assert.equal(otherLogin.status, 200);
      const foreignList = await call(baseUrl, "/api/customer/saved-carts", {
        token: otherLogin.body.token,
      });
      assert.equal(
        foreignList.body.savedCarts.length,
        0,
        "bags are private to their account",
      );
      const foreignDelete = await call(
        baseUrl,
        `/api/customer/saved-carts/${saved.body.savedCart.id}`,
        {
          method: "DELETE",
          token: otherLogin.body.token,
        },
      );
      assert.equal(foreignDelete.status, 404);

      const removed = await call(
        baseUrl,
        `/api/customer/saved-carts/${saved.body.savedCart.id}`,
        {
          method: "DELETE",
          token,
        },
      );
      assert.equal(removed.status, 204);
      const afterDelete = await call(baseUrl, "/api/customer/saved-carts", {
        token,
      });
      assert.equal(afterDelete.body.savedCarts.length, 1);
    } finally {
      if (child.exitCode === null) {
        child.kill();
        await new Promise((resolve) => child.once("exit", resolve));
      }
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
