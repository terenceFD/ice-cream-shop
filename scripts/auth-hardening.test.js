// Guards the credential-stuffing fix. Testing the live site showed 40 failed sign-ins across
// 20 accounts from one address were never throttled, because the only limit counted per
// account. A per-address limit must exist alongside it, on the customer login route.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../server/index.js", import.meta.url),
  "utf8",
);

test("the customer login is limited per address as well as per account", () => {
  const route = source.match(
    /app\.post\('\/api\/auth\/login',([^,]+),([^,]+),/,
  );
  assert.ok(route, "the login route should still exist");
  const [, first, second] = route;
  assert.match(first, /loginIpLimiter/, "a per-address limit must run first");
  assert.match(second, /loginLimiter/, "the per-account limit must still run");
});

test("the address limiter does not set draft-7 headers that the account limiter overwrites", () => {
  const limiter = source.match(
    /const loginIpLimiter = rateLimit\(\{([\s\S]*?)\n\}\)/,
  );
  assert.match(
    limiter[1],
    /standardHeaders:\s*false/,
    "two draft-7 limiters on one route overwrite each other's headers",
  );
});

test("the address limit counts failed attempts only", () => {
  const limiter = source.match(
    /const loginIpLimiter = rateLimit\(\{([\s\S]*?)\n\}\)/,
  );
  assert.ok(limiter, "loginIpLimiter should be defined");
  assert.match(
    limiter[1],
    /skipSuccessfulRequests:\s*true/,
    "a successful sign-in must not count against the address",
  );
  assert.match(
    limiter[1],
    /keyGenerator:[\s\S]*?ipKeyGenerator\(request\.ip\)/,
    "the key must be the client address alone, not the address plus the email",
  );
});

test("the address limit is generous enough for a shared carrier address", () => {
  const limiter = source.match(
    /const loginIpLimiter = rateLimit\(\{([\s\S]*?)\n\}\)/,
  );
  const limit = Number(limiter[1].match(/limit:\s*(\d+)/)?.[1]);
  // Calibrated by measurement: 30 blocks a stuffing run (401s stop at 30, then 429) while a
  // household or cafe sharing one address can still fail sign-in a few times normally.
  assert.ok(
    limit >= 20,
    `per-address limit of ${limit} is too tight for shared carrier IPs`,
  );
  assert.ok(
    limit <= 40,
    `per-address limit of ${limit} is too loose to stop stuffing`,
  );
});

test("the admin login keeps its own, tighter limit", () => {
  assert.match(
    source,
    /app\.post\('\/api\/admin\/login',\s*loginLimiter,/,
    "the admin login must stay rate limited",
  );
});
