export function getCameroonDate(daysFromToday = 0) {
  if (!Number.isSafeInteger(daysFromToday)) {
    throw new Error("Date offset must be a whole number of days.");
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Douala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  const date = new Date(
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day) + daysFromToday,
    ),
  );
  return date.toISOString().slice(0, 10);
}
