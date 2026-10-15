// The last (actions) column of the wide admin tables stays pinned to the right edge, so Edit
// and Delete are always visible even when a laptop screen has to scroll the table sideways.
// Rows need the `group` class so the pinned cell follows the row's hover colour.
export const PINNED_ACTION_HEAD = 'sticky right-0 z-10 bg-white'
export const PINNED_ACTION_CELL = 'sticky right-0 z-10 bg-white shadow-[-14px_0_14px_-14px_rgba(9,42,83,0.25)] transition group-hover:bg-[#fafbfd]'
