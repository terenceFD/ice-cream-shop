// Turns a recorded admin request ("PATCH /api/admin/orders/54/delivered") into a plain
// sentence for the activity log ("Marked order #{id} delivered"). Labels are English source
// text for t(); {id} is filled from the path. `area` groups entries for the log's filter.
const RULES = [
  ['POST', /^\/api\/admin\/login$/, 'Logged in', 'account'],
  ['POST', /^\/api\/admin\/logout$/, 'Logged out', 'account'],
  ['PUT', /^\/api\/admin\/email$/, 'Changed the account email', 'account'],
  ['PUT', /^\/api\/admin\/password$/, 'Changed the account password', 'account'],
  ['PUT', /^\/api\/admin\/profile-picture$/, 'Updated the profile picture', 'account'],
  ['POST', /^\/api\/admin\/security-pin$/, 'Set a security PIN', 'account'],
  ['POST', /^\/api\/admin\/security-pin\/verify$/, 'Confirmed the security PIN', 'account'],
  ['POST', /^\/api\/admin\/admins$/, 'Added an admin account', 'account'],
  ['DELETE', /^\/api\/admin\/admins\/(\d+)$/, 'Removed admin account #{id}', 'account'],

  ['POST', /^\/api\/admin\/flavors$/, 'Added a flavor', 'catalog'],
  ['PUT', /^\/api\/admin\/flavors\/(\d+)$/, 'Edited flavor #{id}', 'catalog'],
  ['DELETE', /^\/api\/admin\/flavors\/(\d+)$/, 'Deleted flavor #{id}', 'catalog'],
  ['POST', /^\/api\/admin\/menu-items$/, 'Added a menu item', 'catalog'],
  ['PUT', /^\/api\/admin\/menu-items\/(\d+)$/, 'Edited menu item #{id}', 'catalog'],
  ['DELETE', /^\/api\/admin\/menu-items\/(\d+)$/, 'Deleted menu item #{id}', 'catalog'],
  ['PUT', /^\/api\/admin\/menu-inventory$/, 'Updated menu stock', 'catalog'],
  ['POST', /^\/api\/admin\/menu-categories$/, 'Added a category', 'catalog'],
  ['PUT', /^\/api\/admin\/menu-categories\/(\d+)$/, 'Edited category #{id}', 'catalog'],
  ['DELETE', /^\/api\/admin\/menu-categories\/(\d+)$/, 'Deleted category #{id}', 'catalog'],
  ['POST', /^\/api\/admin\/uploads$/, 'Uploaded a photo', 'catalog'],

  ['PATCH', /^\/api\/admin\/orders\/(\d+)\/status$/, 'Updated the status of order #{id}', 'orders'],
  ['PATCH', /^\/api\/admin\/orders\/(\d+)\/delivered$/, 'Marked order #{id} delivered', 'orders'],
  ['DELETE', /^\/api\/admin\/orders\/(\d+)\/stale-payment$/, 'Cancelled the unpaid checkout for order #{id}', 'orders'],
  ['DELETE', /^\/api\/admin\/orders\/delivered$/, 'Cleared delivered orders', 'orders'],
  ['DELETE', /^\/api\/admin\/orders\/(\d+)$/, 'Deleted order #{id}', 'orders'],
  ['PATCH', /^\/api\/admin\/cake-requests\/(\d+)\/status$/, 'Updated cake request #{id}', 'orders'],
  ['PATCH', /^\/api\/admin\/event-orders\/(\d+)$/, 'Updated event order #{id}', 'orders'],
  ['DELETE', /^\/api\/admin\/event-orders\/(\d+)$/, 'Deleted declined event order #{id}', 'orders'],

  ['PATCH', /^\/api\/admin\/customers\/(\d+)\/ban$/, 'Changed access for customer #{id}', 'customers'],
  ['PATCH', /^\/api\/admin\/reviews\/(\d+)\/approval$/, 'Moderated review #{id}', 'customers'],
  ['DELETE', /^\/api\/admin\/reviews\/(\d+)$/, 'Rejected and deleted review #{id}', 'customers'],
  ['DELETE', /^\/api\/admin\/notifications$/, 'Cleared all messages', 'customers'],
  ['DELETE', /^\/api\/admin\/notifications\/(\d+)$/, 'Deleted message #{id}', 'customers'],
  ['PATCH', /^\/api\/admin\/notifications\/(\d+)\/read$/, 'Marked message #{id} as read', 'customers'],
  ['POST', /^\/api\/admin\/notifications\/(\d+)\/reply$/, 'Replied to message #{id}', 'customers'],

  ['POST', /^\/api\/admin\/discount-codes$/, 'Created a discount code', 'promotions'],
  ['PUT', /^\/api\/admin\/discount-codes\/(\d+)$/, 'Edited discount code #{id}', 'promotions'],
  ['DELETE', /^\/api\/admin\/discount-codes\/(\d+)$/, 'Deleted discount code #{id}', 'promotions'],
  ['POST', /^\/api\/admin\/discount-codes\/(\d+)\/notify$/, 'Sent a promotion alert for code #{id}', 'promotions'],

  ['PUT', /^\/api\/admin\/fulfillment-zones$/, 'Updated pickup and delivery areas', 'settings'],
  ['PUT', /^\/api\/admin\/fulfillment-slots$/, 'Updated pickup and delivery times', 'settings'],
]

export const ACTIVITY_AREAS = ['catalog', 'orders', 'customers', 'promotions', 'settings', 'account']

/**
 * @param {string} method
 * @param {string} path
 * @returns {{ label: string, id: string | null, area: string, known: boolean }}
 */
export function describeAdminActivity(method, path) {
  const cleanPath = String(path || '').split('?')[0].replace(/\/+$/, '')
  for (const [ruleMethod, pattern, label, area] of RULES) {
    if (ruleMethod !== String(method).toUpperCase()) continue
    const match = cleanPath.match(pattern)
    if (match) return { label, id: match[1] ?? null, area, known: true }
  }
  return { label: 'Made a change', id: null, area: 'settings', known: false }
}
