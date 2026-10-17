// Occasions a customer can request on /events. The header dropdown and the event form share this list.
export const EVENT_OCCASIONS = [
  {
    id: "birthday",
    label: "Birthday party",
    detail: "Cakes, scoops and a party order",
    image: "/menu-official/cakes/birthday-cakes.webp",
  },
  {
    id: "office",
    label: "Office event",
    detail: "Treats for a team or meeting",
    image: "/ice-images/ice-5.webp",
  },
  {
    id: "wedding",
    label: "Wedding",
    detail: "A celebration order for the day",
    image: "/cake-images/cake-2.webp",
  },
  {
    id: "school",
    label: "School event",
    detail: "Scoops for a class or school day",
    image: "/ice-images/ice-8.webp",
  },
  {
    id: "religious",
    label: "Religious celebration",
    detail: "Ice cream for the gathering",
    image: "/cake-images/cake-11.webp",
  },
  {
    id: "other",
    label: "Other event",
    detail: "Tell us what you are planning",
    image: "/cream/cream%204.webp",
  },
]

export const EVENT_TYPE_IDS = EVENT_OCCASIONS.map((event) => event.id)

export function isEventType(value) {
  return typeof value === "string" && EVENT_TYPE_IDS.includes(value)
}

export function eventOccasion(id) {
  return EVENT_OCCASIONS.find((event) => event.id === id) || null
}
