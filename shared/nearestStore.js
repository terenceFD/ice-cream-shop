// Which branch is closest to the customer.
//
// The browser asks for the customer's position (with their permission) and sends the
// coordinates with the chat message. This module turns those coordinates into the one
// branch that is actually nearest, so the assistant names a real shop instead of
// guessing from the neighborhood the customer typed.

const EARTH_RADIUS_KM = 6371;

// Street-level coordinates of each branch, keyed by "town|area" as written in data.js.
// A branch without an entry is never picked as "nearest" — a made-up position would
// send a customer to the wrong shop.
const BRANCH_COORDINATES = {
  "Douala|Bonanjo": { lat: 4.0476, lng: 9.6926 },
  "Douala|Bonamoussadi": { lat: 4.1003, lng: 9.7412 },
  "Douala|Bonabéri": { lat: 4.0806, lng: 9.6698 },
  "Douala|Ange Raphaël": { lat: 4.0621, lng: 9.7105 },
  "Yaoundé|Bastos": { lat: 3.8886, lng: 11.5153 },
};

/** A usable position, or null. Anything else is treated as "no location". */
export function parseCoordinates(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { lat: latitude, lng: longitude };
}

/** Great-circle distance in kilometres. */
export function distanceKm(from, to) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * The nearest branch to a position, with its distance. Branches are the ones the
 * assistant already knows (town, area, address, phone, map); a branch with no known
 * coordinates is skipped. Returns null when there is no position or no branch.
 */
export function nearestBranch(branches, position) {
  if (!position) return null;
  let best = null;
  for (const branch of branches || []) {
    const point = BRANCH_COORDINATES[`${branch.town}|${branch.area}`];
    if (!point) continue;
    const km = distanceKm(position, point);
    if (!best || km < best.km) best = { ...branch, km };
  }
  return best;
}

/** "350 m" under a kilometre, "2.4 km" above it. */
export function formatDistance(km) {
  if (!Number.isFinite(km)) return "";
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `${km.toFixed(1)} km`;
}
