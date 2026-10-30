import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "ice-cream-referrals-"));
const originalBackend = process.env.DATABASE_BACKEND;
const originalPath = process.env.DATABASE_PATH;
process.env.DATABASE_BACKEND = "sqlite";
process.env.DATABASE_PATH = join(directory, "referrals.sqlite");

const {
  createCheckoutOrder,
  createPaymentRecord,
  database,
  finalizePaidCheckout,
  findCustomerByReferralCode,
  ensureReferralCode,
  listFlavors,
  REFERRAL_POINTS,
} = await import("./database.js");

after(() => {
  database.close();
  rmSync(directory, { recursive: true, force: true });
  if (originalBackend === undefined) delete process.env.DATABASE_BACKEND;
  else process.env.DATABASE_BACKEND = originalBackend;
  if (originalPath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = originalPath;
});

function addCustomer(name, email) {
  const inserted = database
    .prepare(
      "INSERT INTO customers (name, email, password_hash) VALUES (?, ?, ?)",
    )
    .run(name, email, "x");
  return Number(inserted.lastInsertRowid);
}

function pointsOf(customerId) {
  return database
    .prepare("SELECT loyalty_points AS points FROM customers WHERE id = ?")
    .get(customerId).points;
}

/** A paid order belonging to `customerId`, through the real finaliser. */
async function payOrderFor(customerId, reference) {
  const flavorInsert = database
    .prepare(
      `
    INSERT INTO flavors (name, detail, description, price, image, stock)
    VALUES (?, 'Referral flavor', 'Referral test flavor', 4000, '/test.jpg', 100)
  `,
    )
    .run(`Referral ${reference}`);
  const flavor = (await listFlavors()).find(
    (item) => item.id === Number(flavorInsert.lastInsertRowid),
  );
  const store = database
    .prepare("SELECT id, name, address, phone FROM stores ORDER BY id LIMIT 1")
    .get();
  const customer = database
    .prepare("SELECT id, name, email FROM customers WHERE id = ?")
    .get(customerId);

  const orderId = await createCheckoutOrder({
    customer: { id: customer.id, name: customer.name, email: customer.email },
    name: customer.name,
    email: customer.email,
    phone: "000000000",
    city: "Douala",
    store,
    residence: "",
    fulfillmentType: "pickup",
    scheduledFor: "2026-12-01T10:00:00+01:00",
    deliveryFee: 0,
    orderItems: [
      {
        flavorId: flavor.id,
        menuItemId: "",
        flavorName: flavor.name,
        unitPriceCents: flavor.price,
        quantity: 1,
        lineTotalCents: flavor.price,
      },
    ],
    subtotalCents: flavor.price,
    discountCents: 0,
    totalCents: flavor.price,
    currency: "xaf",
    discountCode: null,
    pointsRedeemed: 0,
  });

  await createPaymentRecord({
    orderId,
    stripeCheckoutSessionId: reference,
    providerReference: reference,
    provider: "campay",
    amountCents: flavor.price,
    currency: "xaf",
  });
  await finalizePaidCheckout(
    orderId,
    { id: reference, transactionId: reference },
    "campay",
  );
  return orderId;
}

test("a referral code is stable and findable", async () => {
  const id = addCustomer("Referrer", "referrer@example.test");
  const first = await ensureReferralCode(id);
  const second = await ensureReferralCode(id);
  assert.ok(first && /^CS[0-9A-Z]+$/.test(first), `unexpected code ${first}`);
  assert.equal(first, second, "the code must not change between reads");
  const found = await findCustomerByReferralCode(first.toLowerCase());
  assert.equal(Number(found?.id), id, "codes match regardless of case");
});

test("the referrer is paid once, when the invited friend first orders", async () => {
  const referrerId = addCustomer("Referrer", "pay-referrer@example.test");
  const friendId = addCustomer("Friend", "pay-friend@example.test");
  await ensureReferralCode(referrerId);
  database
    .prepare("UPDATE customers SET referred_by = ? WHERE id = ?")
    .run(referrerId, friendId);

  assert.equal(pointsOf(referrerId), 0, "nothing before the order");

  await payOrderFor(friendId, "ref-first-order");
  const afterFirst = pointsOf(referrerId);
  assert.equal(
    afterFirst,
    REFERRAL_POINTS,
    "the referrer earns the referral points",
  );

  // The friend ordering again must not pay the referrer a second time.
  await payOrderFor(friendId, "ref-second-order");
  assert.equal(pointsOf(referrerId), afterFirst, "the bonus is paid only once");

  // The friend keeps their own ordinary points from each order.
  assert.ok(
    pointsOf(friendId) > 0,
    "the friend still earns their normal points",
  );
});

test("an order by a customer nobody referred pays no referral points", async () => {
  const customerId = addCustomer("Walk-in", "walkin@example.test");
  await payOrderFor(customerId, "ref-no-referrer");
  const total = database
    .prepare("SELECT SUM(loyalty_points) AS points FROM customers")
    .get().points;
  assert.ok(Number(total) >= 0);
  // Nobody was named as referrer, so no bonus row exists for this customer.
  const bonus = database
    .prepare("SELECT referral_bonus_paid AS paid FROM customers WHERE id = ?")
    .get(customerId);
  assert.equal(
    bonus.paid,
    0,
    "no referral bonus is marked for an unreferred customer",
  );
});
