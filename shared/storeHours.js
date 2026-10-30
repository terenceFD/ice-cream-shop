// Shop opening hours for the storefront.
//
// The branches on the Locations page are public listings, so their hours are not published
// anywhere. These are the shop defaults used by the site: a pickup or delivery order made
// during opening hours counts as "as soon as possible", anything after the last order cut-off
// is scheduled for the next opening. A branch can be given its own hours with `hours`.
export const DEFAULT_STORE_HOURS = {
  openMinutes: 10 * 60, // 10:00
  closeMinutes: 21 * 60 + 30, // 21:30
  // The kitchen stops taking walk-in style orders 45 minutes before closing.
  lastOrderMinutes: 21 * 60,
};

// Times are read and written in Douala/Yaoundé time, which never changes offset.
export const STORE_TIME_ZONE = "Africa/Douala";

function minutesOf(hours, key) {
  const value = Number(hours?.[key]);
  return Number.isInteger(value) && value >= 0 && value < 24 * 60
    ? value
    : DEFAULT_STORE_HOURS[key];
}

export function storeHours(location) {
  return {
    openMinutes: minutesOf(location?.hours, "openMinutes"),
    closeMinutes: minutesOf(location?.hours, "closeMinutes"),
    lastOrderMinutes: minutesOf(location?.hours, "lastOrderMinutes"),
  };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Minute of the day and day of the week for a moment in Cameroon local time.
export function localClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: STORE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(date);
  const read = (type) => parts.find((part) => part.type === type)?.value || "";
  return {
    minutes: (Number(read("hour")) % 24) * 60 + Number(read("minute")),
    weekday: WEEKDAYS.indexOf(read("weekday")),
  };
}

export function formatClock(minutes) {
  const safe = (((Number(minutes) || 0) % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

// "today" / "tomorrow" / the weekday name for a day offset from today.
export function dayLabel(offset, language = "en") {
  if (offset <= 0) return language === "fr" ? "aujourd'hui" : "today";
  if (offset === 1) return language === "fr" ? "demain" : "tomorrow";
  // Only today and tomorrow are used by the storefront, so a longer offset is never shown.
  return "tomorrow";
}

// The state a shopper cares about right now: are we serving, and can an order start now?
export function storeOpenState(location, now = new Date()) {
  const hours = storeHours(location);
  const { minutes } = localClock(now);
  const beforeOpen = minutes < hours.openMinutes;
  const afterClose = minutes >= hours.closeMinutes;
  const acceptingOrders =
    !beforeOpen && !afterClose && minutes < hours.lastOrderMinutes;
  return {
    ...hours,
    minutes,
    beforeOpen,
    afterClose,
    open: !beforeOpen && !afterClose,
    acceptingOrders,
    // True while the shop is open but only for collection, not for new orders.
    lastCall: acceptingOrders && minutes >= hours.lastOrderMinutes - 60,
    opensAt: formatClock(hours.openMinutes),
    closesAt: formatClock(hours.closeMinutes),
    lastOrderAt: formatClock(hours.lastOrderMinutes),
    // When the next order taken today can be ready, or the next opening if we are closed.
    nextOpening:
      beforeOpen || afterClose ? formatClock(hours.openMinutes) : null,
    nextOpeningDay: afterClose ? dayLabel(1) : dayLabel(0),
  };
}

// The first ready time for an order "as soon as possible", in minutes from opening.
// Orders are prepared on the half hour once the shop has been open for 30 minutes.
export function firstReadyMinutes(location) {
  return storeHours(location).openMinutes + 30;
}
