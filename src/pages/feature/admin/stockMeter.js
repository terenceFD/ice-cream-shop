// Admin stock bars show how far an item is above its low-stock alert level, not stock
// compared with itself (which was always a full bar). The bar is full at four times the
// alert level or more, and shrinks as stock runs down towards the alert.
export const HEALTHY_STOCK_MULTIPLIER = 4

/**
 * @param {number} available units customers can still order
 * @param {number} alertAt the low-stock alert level
 * @returns {number} bar width from 0 to 100
 */
export function stockBarPercent(available, alertAt) {
  const healthyLevel = Math.max(1, alertAt) * HEALTHY_STOCK_MULTIPLIER
  return Math.min(100, Math.round((Math.max(0, available) / healthyLevel) * 100))
}
