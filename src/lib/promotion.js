export const PROMOTION_DISMISSED_KEY = "cold-stone-promotion-dismissed";

export function readInitialPromotion() {
  try {
    const data = document.getElementById("initial-promotion")?.textContent;
    return data ? JSON.parse(data).promotion || null : null;
  } catch {
    return null;
  }
}

export function initialPromotionIsVisible() {
  const promotion = readInitialPromotion();
  const expiresAt = Date.parse(promotion?.expiresAt);
  if (!promotion || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }
  try {
    return sessionStorage.getItem(PROMOTION_DISMISSED_KEY) !== promotion.code;
  } catch {
    return true;
  }
}
