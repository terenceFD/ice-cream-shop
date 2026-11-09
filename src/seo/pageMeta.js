// Page titles and descriptions for search engines and link previews.
// Shared by the browser (updates the page head while navigating) and the server
// (writes the head into the HTML it sends, so crawlers that do not run JavaScript see it too).
import { menuItemPublicPath } from '../../shared/data.js'
import { COMPACT_HERO_MEDIA, FLAVOR_PHOTO_SIZES, HERO_PHOTO_SIZES, HOME_SLIDE_SIZES } from '../../shared/photoSizes.js'

export const SITE_NAME = 'Cold Stone Creamery Cameroon'
export const HOME_TITLE = 'Cold Stone Creamery Cameroon | Ice Cream in Douala & Yaoundé'
export const DEFAULT_DESCRIPTION =
  'Cold Stone Creamery Cameroon: ice cream mixed to order, signature creations, cakes and shakes. Order online for pickup or delivery in Douala and Yaoundé.'
export const DEFAULT_IMAGE = '/images/og-image.jpg'

/** Pages search engines should list. */
export const PUBLIC_PAGES = {
  '/wishlist': {
    title: 'Your wishlist',
    description:
      'Save the treats you love and share the list with family or friends, so they can order your favourites straight from it.',
  },
  '/': {
    title: HOME_TITLE,
    description: DEFAULT_DESCRIPTION,
    // First slide of the home page slider (HomePage.jsx).
    photo: { src: '/ice-images/ice-3.webp', sizes: HOME_SLIDE_SIZES },
  },
  '/menu': {
    title: 'Menu & treats',
    description:
      'Browse Cold Stone treat categories: signature ice cream creations, cakes and pies, milkshakes and smoothies, sorbet and seasonal favorites.',
    photo: { src: '/ice-images/ice-4.webp', sizes: HERO_PHOTO_SIZES, media: COMPACT_HERO_MEDIA },
  },
  '/menu/all': {
    title: 'All menu items',
    description:
      'Every Cold Stone treat on one page: signature ice cream creations, ice cream cakes and pies, milkshakes, smoothies, novelties and seasonal favorites, with prices in FCFA.',
    photo: { src: '/menu-official/ice-cream/signature-creations/founders-favorite.webp', sizes: HERO_PHOTO_SIZES, media: COMPACT_HERO_MEDIA },
  },
  '/flavors': {
    title: 'Ice cream flavors',
    description:
      'Order ice cream flavors online in Cameroon. Prices in FCFA, with pickup or delivery from listed stores and a three-scoop offer.',
    photo: { src: '/images/hero-ice-cream.jpg', sizes: HERO_PHOTO_SIZES, media: COMPACT_HERO_MEDIA },
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
    title: 'About us',
    description:
      'The Cold Stone signature experience: ice cream mixed to order on a frozen granite stone, at our branches in Douala and Yaoundé.',
    photo: { src: '/ice-images/about-child.jpg', sizes: HERO_PHOTO_SIZES },
  },
  '/locations': {
    title: 'Cold Stone locations in Cameroon',
    description:
      'Cold Stone Creamery locations in Douala and Yaoundé, with addresses, landmarks, phone numbers and map links.',
  },
  '/contact': {
    title: 'Contact a store',
    description: 'Have a question for a store? Choose its branch and send a message directly to that store’s team.',
  },
  '/privacy': {
    title: 'Privacy policy',
    description:
      'What personal information we collect when you order or contact us, why we collect it, and how we protect it.',
  },
  '/terms': {
    title: 'Terms & conditions',
    description:
      'The terms that cover ordering, pickup, delivery and use of this website.',
  },
  '/refunds': {
    title: 'Refund policy',
    description:
      'When and how we refund or replace orders, including custom cakes and event orders.',
  },
  '/cookies': {
    title: 'Cookie policy',
    description:
      'This website does not use advertising or tracking cookies. What we store on your device and why.',
  },
  '/faq': {
    title: 'FAQ — ordering, delivery and discounts',
    description:
      'How to order, delivery areas and fees in Douala and Yaoundé, discount codes, loyalty points, tracking your order and what happens when something goes wrong.',
  },
}

/** Pages that exist but should stay out of search results. */
const PRIVATE_PAGES = {
  '/cart': 'Your shopping bag',
  '/checkout': 'Checkout',
  '/payment': 'Payment',
  '/track-order': 'Track your order',
  '/login': 'Log in',
  '/signup': 'Create an account',
  '/account/orders': 'My account',
  '/unsubscribe': 'Unsubscribe',
}
const PRIVATE_PREFIXES = ['/admin']

export const FLAVOR_PATH = /^\/flavor\/(\d+)\/?$/
export const TREAT_PATH = /^\/treat\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/

export function pageTitle(title) {
  return title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`
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
  // A shared wishlist link is a real page for whoever receives it, though it is
  // someone else's list: indexable, with the wishlist copy rather than a 404.
  if (/^\/wishlist\/shared\/[a-z0-9_-]+$/i.test(path)) {
    return {
      ...PUBLIC_PAGES['/wishlist'],
      title: 'A shared wishlist',
      index: true,
      found: true,
      path,
    }
  }
  const page = PUBLIC_PAGES[path]
  if (page) return { ...page, index: true, found: true, path }
  if (PRIVATE_PAGES[path]) return { title: PRIVATE_PAGES[path], description: DEFAULT_DESCRIPTION, index: false, found: true, path }
  if (PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return { title: 'Store admin', description: DEFAULT_DESCRIPTION, index: false, found: true, path }
  }
  return { title: 'Page not found', description: DEFAULT_DESCRIPTION, index: false, found: false, path }
}

// Search results show roughly 160 characters; cut at a word so the snippet reads cleanly.
export function clip(text, max = 160) {
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
    photo: flavor.image ? { src: flavor.image, sizes: FLAVOR_PHOTO_SIZES } : undefined,
    index: true,
    found: true,
    path: `/flavor/${flavor.id}`,
  }
}

/** Metadata for a cake, shake, or other menu product's own page. */
export function metaForMenuItem(category, item) {
  const price = Math.round(Number(item.priceXaf || item.price || 0))
  const priceLabel = price ? `${price.toLocaleString('en-US')} FCFA. ` : ''
  const detail = item.detail || category.description || category.title
  return {
    title: item.name,
    description: clip(`${item.name}: ${detail}. ${priceLabel}Order for pickup or delivery in Douala and Yaoundé.`),
    image: item.image || DEFAULT_IMAGE,
    index: true,
    found: true,
    path: menuItemPublicPath(category.title, item.name),
    category: category.title,
    price,
  }
}
