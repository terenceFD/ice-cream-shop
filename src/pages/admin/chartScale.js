// Round axis for the admin charts: the top of the axis is a "nice" number (1, 2, 2.5, 3 or 5
// times a power of ten, per gridline) so the labels read 2K, 4K, 6K, 8K instead of 1.8K, 3.5K.
// `integer` keeps every step a whole number, for counts such as orders.

/**
 * @param {number} value the largest value to show
 * @param {{ ticks?: number, integer?: boolean }} [options]
 * @returns {{ max: number, step: number }}
 */
export function niceAxis(value, { ticks = 4, integer = false } = {}) {
  const raw = Math.max(value, 0) / ticks
  if (raw <= 0) return { max: ticks, step: 1 }
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const multipliers = integer && magnitude < 10 ? [1, 2, 3, 5, 10] : [1, 2, 2.5, 3, 5, 10]
  let step = multipliers.map((multiplier) => multiplier * magnitude).find((candidate) => candidate >= raw)
  if (integer) step = Math.max(1, Math.ceil(step))
  return { max: step * ticks, step }
}
