import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "ice-cream-features-"));
const originalBackend = process.env.DATABASE_BACKEND;
const originalPath = process.env.DATABASE_PATH;
process.env.DATABASE_BACKEND = "sqlite";
process.env.DATABASE_PATH = join(directory, "features.sqlite");

const {
  database,
  subscribeNewsletter,
  unsubscribeNewsletter,
  listNewsletterSubscribers,
} = await import("./database.js");
const { isSpamSubmission, HONEYPOT_FIELD } = await import("./spam-guard.js");

after(() => {
  database.close();
  rmSync(directory, { recursive: true, force: true });
  if (originalBackend === undefined) delete process.env.DATABASE_BACKEND;
  else process.env.DATABASE_BACKEND = originalBackend;
  if (originalPath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = originalPath;
});

test("newsletter subscribe inserts, upserts and unsubscribes", async () => {
  const first = await subscribeNewsletter("new@example.com", "footer");
  assert.equal(first.created, true);
  assert.equal(first.subscriber.email, "new@example.com");
  assert.equal(first.subscriber.isSubscribed, 1);

  // A repeat signup with a different source refreshes the row instead of failing.
  const second = await subscribeNewsletter("new@example.com", "checkout");
  assert.equal(second.created, false);
  assert.equal(second.subscriber.source, "checkout");
  assert.equal(second.subscriber.isSubscribed, 1);

  // Email comparisons are case-insensitive.
  const third = await subscribeNewsletter("NEW@example.com", "footer");
  assert.equal(third.created, false);

  const listed = await listNewsletterSubscribers();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].email, "new@example.com");

  assert.equal(await unsubscribeNewsletter("new@example.com"), true);
  assert.equal(
    await unsubscribeNewsletter("new@example.com"),
    true,
    "unsubscribing twice is still success",
  );
  assert.equal(
    (await listNewsletterSubscribers()).length,
    0,
    "unsubscribed rows leave the public list",
  );
  const all = await listNewsletterSubscribers({ subscribedOnly: false });
  assert.equal(all.length, 1);
  assert.equal(all[0].isSubscribed, 0);
});

test("newsletter subscribe rejects invalid source values", async () => {
  const result = await subscribeNewsletter(
    "odd-source@example.com",
    "not-a-source",
  );
  assert.equal(
    result.subscriber.source,
    "footer",
    "unknown sources fall back to footer",
  );
});

test("honeypot flags spam; submit timing is reported but never blocks", () => {
  // A filled honeypot field is always spam.
  assert.deepEqual(
    isSpamSubmission({ [HONEYPOT_FIELD]: "http://spam.example" }),
    { spam: true, reason: "honeypot" },
  );
  assert.deepEqual(
    isSpamSubmission({ [HONEYPOT_FIELD]: "   " }),
    { spam: false, reason: "" },
    "whitespace alone is not a fill",
  );

  // No honeypot: never spam, whatever the timing. A fast human is not a bot,
  // and a silently dropped submission is worse than a rare spam row.
  const now = Date.now();
  assert.deepEqual(isSpamSubmission({ formOpenedAt: now - 500 }), {
    spam: false,
    reason: "too-fast",
  });
  assert.deepEqual(isSpamSubmission({ formOpenedAt: now - 10_000 }), {
    spam: false,
    reason: "",
  });

  // A malformed or missing timing hint does not change anything.
  assert.deepEqual(isSpamSubmission({ formOpenedAt: "not-a-number" }), {
    spam: false,
    reason: "",
  });
  assert.deepEqual(isSpamSubmission({}), { spam: false, reason: "" });
});

test("newsletter table exists with the expected columns", () => {
  const columns = new Set(
    database
      .prepare("PRAGMA table_info(newsletter_subscribers)")
      .all()
      .map((column) => column.name),
  );
  for (const expected of [
    "id",
    "email",
    "source",
    "is_subscribed",
    "created_at",
    "updated_at",
  ]) {
    assert.ok(columns.has(expected), `missing column ${expected}`);
  }
});
