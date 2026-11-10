import { z } from "zod";

// Shared Zod schemas for request bodies. The handlers in index.js used to repeat
// the same "typeof === 'string' ? trim() : ''" dance dozens of times; these
// schemas do it once, with strict parsing so unknown fields are dropped.
// Each handler still decides what an empty/invalid value means for its route.

/** Trimmed, length-capped string; "" for absent input, matching the old handlers. */
export function trimmedString(maxLength) {
  return z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : ""),
    z.string().max(maxLength),
  );
}

export const lowerTrimmedEmail = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : ""),
  z
    .string()
    .max(254)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
);

/** Parse body fields with a schema and surface problems as a single flat error. */
export function parseBody(schema, body) {
  return schema.strict().safeParse(body ?? {});
}
