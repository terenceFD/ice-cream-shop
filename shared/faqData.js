import { cameroonLocations } from "./data.js";

// Shared, factual answers for the FAQ page. Kept as functions so the FAQ page
// reads them without the page component importing page-specific logic, and so
// tests can assert the summary stays truthful when the data changes.
export function deliveryAreaSummary() {
  const towns = [
    ...new Set(cameroonLocations.map((location) => location.town)),
  ];
  return `${towns.join(" and ")}, in these areas: ${cameroonLocations
    .map((location) => location.area)
    .join(", ")}.`;
}

export function deliveryFeeSummary() {
  return `${deliveryAreaSummary()} Each branch sets its own delivery fee, which checkout shows before you pay; some branches deliver free.`;
}

export function fulfillmentWindowSummary() {
  return "Choose a date and a time slot at checkout. Same-day ordering is possible when a store is open and accepting orders; otherwise the next open day. The exact windows come from the store’s own schedule.";
}
