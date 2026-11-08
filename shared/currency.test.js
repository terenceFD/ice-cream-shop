import test from "node:test";
import assert from "node:assert/strict";
import { convertFromXaf, SUPPORTED_CURRENCIES } from "./currency.js";

test("supports the shop, major, and reference currencies", () => {
  assert.deepEqual(
    SUPPORTED_CURRENCIES.map(({ code }) => code),
    ["xaf", "usd", "eur", "gbp", "cad", "inr", "aud", "ngn"],
  );
});

test("converts XAF to every supported display currency", () => {
  assert.equal(convertFromXaf(540, "usd"), 1);
  assert.equal(convertFromXaf(590, "eur"), 1);
  assert.equal(convertFromXaf(786, "gbp"), 1);
  assert.equal(convertFromXaf(417, "cad"), 1);
  assert.equal(convertFromXaf(625, "inr"), 100);
  assert.equal(convertFromXaf(404, "aud"), 1);
  assert.equal(convertFromXaf(441.2, "ngn"), 1000);
  assert.equal(convertFromXaf(1250, "xaf"), 1250);
});

test("keeps an unknown currency safe by returning the XAF amount", () => {
  assert.equal(convertFromXaf(1250, "unknown"), 1250);
});
