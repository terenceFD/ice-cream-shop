// Page titles and descriptions for search engines and link previews.
// Shared by the browser (updates the page head while navigating) and the server
// (writes the head into the HTML it sends, so crawlers that do not run JavaScript see it too).

export const SITE_NAME = 'Cold Stone Creamery Cameroon'
export const DEFAULT_DESCRIPTION =
  'An independent guide to Cold Stone Creamery in Cameroon: publicly listed branches in Douala and Yaoundé, the global treat menu, and an online ice cream shop.'
export const DEFAULT_IMAGE = '/images/og-image.jpg'

/** Pages search engines should list. */
export const PUBLIC_PAGES = {
  '/': {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
  },
  '/menu': {
    title: 'Menu & treats',
    description:
      'Browse Cold Stone treat categories: signature ice cream creations, cakes and pies, milkshakes and smoothies, sorbet and seasonal favorites.',
  },
  '/flavors': {
    title: 'Online shop catalog',
    description:
      'Order ice cream flavors online in Cameroon. Prices in FCFA, with pickup or delivery from listed stores and a three-scoop offer.',
  },
  '/custom-cake': {
    title: 'Custom ice cream cake requests',
    description: 'Request a custom ice cream cake for birthdays and celebrations: choose a size, flavor, toppings and a pickup date.',
  },
  '/events': {
    title: 'Party and event ice cream orders',
    description: 'Order ice cream in bulk for birthdays, office events and weddings in Cameroon. Get a quote, pay a deposit online, and we deliver or you pick up.',
  },
  '/about': {
    title: 'About this guide',
    description:
      'Learn about the Cold Stone signature experience, ice cream mixed to order on a frozen granite stone, and what this independent guide covers.',
  },
  '/locations': {
    title: 'Cold Stone locations in Cameroon',
    description:
      'Publicly listed Cold Stone Creamery locations in Douala and Yaoundé, with addresses, landmarks, phone numbers and map links.',
  },
  '/contact': {
    title: 'Contact a store',
    description: 'Have a question for a store? Choose its branch and send a message directly to that store’s team.',
  },
}

/** Pages that exist but should stay out of search results. */
const PRIVATE_PAGES = {
  '/cart': 'Your shopping bag',
  '/checkout': 'Checkout',
  '/payment': 'Payment',
  '/login': 'Log in',
  '/signup': 'Create an account',
  '/account/orders': 'My account',
}
const PRIVATE_PREFIXES = ['/admin']

export const FLAVOR_PATH = /^\/flavor\/(\d+)\/?$/

export function pageTitle(title) {
  return title === SITE_NAME ? title : `${title} | ${SITE_NAME}`
}

function normalize(pathname) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
}

/**
 * Metadata for a route other than a flavor page.
 * `found` is false for addresses the app does not have, so the server can answer 404.
 */
export function metaForPath(pathname) {
  const path = normalize(pathname)
  const page = PUBLIC_PAGES[path]
  if (page) return { ...page, index: true, found: true, path }
  if (PRIVATE_PAGES[path]) return { title: PRIVATE_PAGES[path], description: DEFAULT_DESCRIPTION, index: false, found: true, path }
  if (PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return { title: 'Store admin', description: DEFAULT_DESCRIPTION, index: false, found: true, path }
  }
  return { title: 'Page not found', description: DEFAULT_DESCRIPTION, index: false, found: false, path }
}

// Search results show roughly 160 characters; cut at a word so the snippet reads cleanly.
function clip(text, max = 160) {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`
}

/** Metadata for a flavor's own page. */
export function metaForFlavor(flavor) {
  const summary = [flavor.detail, flavor.description].filter(Boolean).join('. ')
  return {
    title: `${flavor.name} ice cream`,
    description: clip(summary || DEFAULT_DESCRIPTION),
    image: flavor.image || DEFAULT_IMAGE,
    index: true,
    found: true,
    path: `/flavor/${flavor.id}`,
  }
}
