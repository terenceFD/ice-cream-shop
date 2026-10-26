import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  toNumber,
  toInt,
  toNonNegativeInt,
  toPositiveInt,
  toRoundedNumber,
  toFixedNumber,
  toIntString,
} from "../shared/numbers.ts";

const EXPECTED_NAN_CASES = [
  undefined,
  null,
  NaN,
  Infinity,
  -Infinity,
  {},
  [],
  true,
  false,
  "",
  "   ",
  "abc",
  "12abc",
  "0x1A",
  "0o17",
  "0b101",
  "Infinity",
  "-Infinity",
  "1,000",
  "1.000.000",
  "e5",
  new Date(),
  () => {},
];

describe("toNumber", () => {
  it("never returns NaN for garbage input", () => {
    for (const input of EXPECTED_NAN_CASES) {
      const result = toNumber(input, -1);
      assert.ok(
        Number.isFinite(result),
        `toNumber(${String(input)}) should be finite, got ${result}`,
      );
      assert.equal(result, -1);
    }
  });

  it("defaults to 0 when no fallback is given", () => {
    for (const input of EXPECTED_NAN_CASES) {
      assert.equal(toNumber(input), 0);
    }
  });

  it("passes through valid numbers", () => {
    assert.equal(toNumber(0), 0);
    assert.equal(toNumber(42), 42);
    assert.equal(toNumber(-3.5), -3.5);
    assert.equal(toNumber(1e10), 1e10);
  });

  it("converts numeric strings, including padded and decimal text", () => {
    assert.equal(toNumber("42"), 42);
    assert.equal(toNumber(" 42 "), 42);
    assert.equal(toNumber("42\u00A0"), 42);
    assert.equal(toNumber("-7"), -7);
    assert.equal(toNumber("3.14"), 3.14);
    assert.equal(toNumber(".5"), 0.5);
    assert.equal(toNumber("+3"), 3);
    assert.equal(toNumber("007"), 7);
  });
});

describe("toInt", () => {
  it("never returns NaN", () => {
    for (const input of EXPECTED_NAN_CASES) {
      assert.ok(Number.isFinite(toInt(input, -1)));
      assert.equal(toInt(input, -1), -1);
    }
  });

  it("truncates decimals instead of rounding", () => {
    assert.equal(toInt("3.9"), 3);
    assert.equal(toInt(-3.9), -3);
    assert.equal(toInt("2.5"), 2);
  });
});

describe("toNonNegativeInt", () => {
  it("clamps negatives and rejects garbage", () => {
    assert.equal(toNonNegativeInt(-5), 0);
    assert.equal(toNonNegativeInt("-2"), 0);
    assert.equal(toNonNegativeInt("4.7"), 4);
    assert.equal(toNonNegativeInt("abc", 9), 9);
    assert.ok(Number.isFinite(toNonNegativeInt(undefined)));
  });
});

describe("toPositiveInt", () => {
  it("clamps to at least 1 and rejects garbage", () => {
    assert.equal(toPositiveInt(0), 1);
    assert.equal(toPositiveInt(-3), 1);
    assert.equal(toPositiveInt("2.8"), 2);
    assert.equal(toPositiveInt("abc", 5), 5);
    assert.ok(Number.isFinite(toPositiveInt(null)));
  });
});

describe("toRoundedNumber / toFixedNumber", () => {
  it("round instead of returning NaN", () => {
    assert.equal(toRoundedNumber("2.6"), 3);
    assert.equal(toRoundedNumber("abc", 7), 7);
    assert.equal(toFixedNumber("3.14159", 2), 3.14);
    assert.equal(toFixedNumber("nonsense", 2, 1.5), 1.5);
    assert.ok(Number.isFinite(toFixedNumber(Infinity)));
  });
});

describe("toIntString", () => {
  it('never returns the string "NaN"', () => {
    for (const input of EXPECTED_NAN_CASES) {
      assert.notEqual(toIntString(input), "NaN");
      assert.equal(toIntString(input), "0");
    }
  });

  it("returns a clean integer string for numeric text", () => {
    assert.equal(toIntString("12"), "12");
    assert.equal(toIntString("12.9"), "12");
    assert.equal(toIntString("-4"), "-4");
    assert.equal(toIntString("abc", "N/A"), "N/A");
  });
});
