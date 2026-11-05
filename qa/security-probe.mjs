// Authorised black-box security probe against the deployment under test.
// Read-only: no writes, no destructive actions, no credential attacks beyond small samples.
const base = "https://ice-cream-shop-20eg.onrender.com";

const results = [];
const record = (name, detail) => results.push({ name, ...detail });

async function probe(path, options = {}) {
  const started = Date.now();
  try {
    const response = await fetch(base + path, {
      redirect: "manual",
      ...options,
    });
    const text = await response.text();
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: text.slice(0, 400),
      ms: Date.now() - started,
    };
  } catch (error) {
    return { status: 0, error: error.message, ms: Date.now() - started };
  }
}

// 1. Admin API without a token.
for (const path of [
  "/api/admin/orders",
  "/api/admin/customers",
  "/api/admin/chat/threads",
  "/api/admin/payments",
  "/api/admin/restock-notifications",
]) {
  const r = await probe(path);
  record(`unauth GET ${path}`, {
    status: r.status,
    leaksData:
      /@"?\s*:|orderNumber|customerName|email/i.test(r.body || "") &&
      r.status === 200,
  });
}

// 2. The customer/order IDOR surface.
for (const path of [
  "/api/orders/1",
  "/api/orders/99999",
  "/api/account/orders",
]) {
  const r = await probe(path);
  record(`unauth GET ${path}`, {
    status: r.status,
    len: (r.body || "").length,
  });
}

// 3. Chat thread hijack: reading someone else's thread without the device cookie.
const r = await probe(
  "/api/chat/messages/11111111-1111-1111-1111-111111111111",
);
record("chat read with no cookie", {
  status: r.status,
  body: r.body?.slice(0, 120),
});

// 4. Method tampering on a read-only public endpoint.
record("DELETE /api/menu", {
  status: (await probe("/api/menu", { method: "DELETE" })).status,
});

// 5. Input reflection / XSS in search.
const xss = await probe(
  `/api/menu/search?q=${encodeURIComponent("<script>alert(1)</script>")}`,
);
record("XSS probe in search", {
  status: xss.status,
  reflected: (xss.body || "").includes("<script>alert(1)</script>"),
});

// 6. Path traversal on the static handler.
for (const path of [
  "/..%2f..%2fserver%2fdatabase.sqlite",
  "/%2e%2e/server/index.js",
]) {
  const r = await probe(path);
  record(`traversal ${path}`, {
    status: r.status,
    exposed: /better-sqlite3|require\(|import /.test(r.body || ""),
  });
}

// 7. Server file disclosure.
for (const path of [
  "/server/index.js",
  "/.env",
  "/package.json",
  "/server/database.sqlite",
]) {
  const r = await probe(path);
  record(`file ${path}`, {
    status: r.status,
    suspicious: r.status === 200 && (r.body || "").length > 20,
  });
}

// 8. Security headers on the app shell.
const shell = await probe("/");
const h = shell.headers || {};
record("headers", {
  hsts: h["strict-transport-security"] || "MISSING",
  csp: (h["content-security-policy"] || "MISSING").slice(0, 90),
  xfo: h["x-frame-options"] || "MISSING",
  nosniff: h["x-content-type-options"] || "MISSING",
  referrer: h["referrer-policy"] || "MISSING",
  permissions: (h["permissions-policy"] || "MISSING").slice(0, 60),
  xPoweredBy: h["x-powered-by"] || "(absent, good)",
  server: h["server"] || "",
  acao: h["access-control-allow-origin"] || "(absent)",
});

// 9. Rate limiting on auth.
const attempts = [];
for (let i = 0; i < 8; i += 1) {
  const r = await probe("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "probe@example.invalid",
      password: `wrong${i}`,
    }),
  });
  attempts.push(r.status);
}
record("login rate limit (8 tries)", {
  statuses: attempts,
  limited: attempts.includes(429),
});

// 10. Account enumeration: same message for unknown user?
const unknown = await probe("/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    email: "definitely-not-a-user@example.invalid",
    password: "x",
  }),
});
record("login error message", {
  status: unknown.status,
  body: unknown.body?.slice(0, 120),
});

// 11. Upload without auth.
const upload = await probe("/api/admin/upload", { method: "POST" });
record("unauth upload", { status: upload.status });

// 12. robots / sitemap.
for (const path of ["/robots.txt", "/sitemap.xml"]) {
  const r = await probe(path);
  record(path, { status: r.status, head: (r.body || "").slice(0, 160) });
}

console.log(JSON.stringify(results, null, 2));
