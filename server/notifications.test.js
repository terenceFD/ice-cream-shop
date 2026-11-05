// Binds the customer-notification promises to tests that fail when they stop being true.
//
// Two gaps were found by auditing the checkout flow:
//   1. an order created but not yet paid notified nobody, so a shopper who closed the
//      payment page had no record the order existed;
//   2. the payment receipt sat behind PAYMENT_CONFIRMATION_EMAILS_ENABLED, which was
//      never set, so a charged customer received no receipt.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ORDER_NOTIFICATION_STATUSES,
  buildOrderStatusNotification,
} from "./push.js";

test("every step a customer can ask about has a notification", () => {
  for (const status of [
    "reserved",
    "confirmed",
    "accepted",
    "preparing",
    "ready",
    "out_for_delivery",
    "delivered",
  ]) {
    assert.ok(
      ORDER_NOTIFICATION_STATUSES.includes(status),
      `missing notification for "${status}"`,
    );
  }
});

test("an unpaid, just-created order notifies the customer", () => {
  const notification = buildOrderStatusNotification({
    orderId: 42,
    status: "reserved",
    fulfillmentType: "delivery",
    storeName: "Bonapriso",
  });
  assert.ok(notification, "a reserved order must not be silent");
  assert.match(notification.title, /Order #42/);
  assert.match(notification.body, /reserved your treats/i);
  // It must not claim the order is placed, because the payment is not done yet.
  assert.match(notification.body, /not placed until you do/i);
});

test("a confirmed (paid) order notifies the customer", () => {
  const notification = buildOrderStatusNotification({
    orderId: 42,
    status: "confirmed",
    fulfillmentType: "delivery",
    storeName: "Bonapriso",
  });
  assert.ok(notification);
  assert.match(notification.body, /Payment received/i);
});

test("pickup and delivery are worded differently where it matters", () => {
  const pickup = buildOrderStatusNotification({
    orderId: 7,
    status: "ready",
    fulfillmentType: "pickup",
    storeName: "Akwa",
  });
  const delivery = buildOrderStatusNotification({
    orderId: 7,
    status: "ready",
    fulfillmentType: "delivery",
    storeName: "Akwa",
  });
  assert.match(pickup.body, /ready for pickup at Akwa/i);
  assert.match(delivery.body, /waiting for the rider/i);
});

test("one notification per order replaces the previous one", () => {
  const first = buildOrderStatusNotification({
    orderId: 42,
    status: "reserved",
    fulfillmentType: "delivery",
    storeName: "Bonapriso",
  });
  const second = buildOrderStatusNotification({
    orderId: 42,
    status: "confirmed",
    fulfillmentType: "delivery",
    storeName: "Bonapriso",
  });
  assert.equal(first.tag, second.tag);
});

test("an unknown status is never invented", () => {
  assert.equal(
    buildOrderStatusNotification({ orderId: 1, status: "no_such_status" }),
    null,
  );
});

test("checkout notifies the customer when it creates the order", () => {
  // The reserved notification is only useful if the checkout actually sends it.
  const source = readFileSync(new URL("./index.js", import.meta.url), "utf8");
  const checkoutCall = /notifyCustomerOfOrderStatus\(orderId, 'reserved'\)/;
  assert.match(source, checkoutCall);
});

test("the payment receipt is not behind a feature flag any more", () => {
  const source = readFileSync(new URL("./index.js", import.meta.url), "utf8");
  // The gate must be gone from executable code, not just renamed: a charged customer
  // always gets a receipt.
  const executable = source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  assert.doesNotMatch(
    executable,
    /PAYMENT_CONFIRMATION_EMAILS_ENABLED/,
    "the receipt must not depend on an environment flag",
  );
  // And the receipt itself must still be sent after a payment is recorded.
  assert.match(executable, /sendOrderStatusUpdate\(\{/);
});
