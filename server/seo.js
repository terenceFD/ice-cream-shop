import { readFile } from 'node:fs/promises'
import {
  DEFAULT_IMAGE,
  FLAVOR_PATH,
  PUBLIC_PAGES,
  SITE_NAME,
  metaForFlavor,
  metaForPath,
  pageTitle,
} from '../src/seo/pageMeta.js'
import { photoSrcSet } from '../shared/photoSizes.js'
// The home page's first slider photo. index.html preloads it; the '/' page head should not
// repeat that tag, so it is not requested twice.
const HOME_HERO_PHOTO = '/ice-images/ice-9.jpg'
const HOME_PHOTO_PRELOAD = /[ \t]*<link rel="preload" as="image"[^>]*\/ice-images\/ice-9\.[^>]*>\s*\n?/g

// index.html marks the default head tags with <!--seo--> … <!--/seo--> so each page can swap in its own.
const SEO_BLOCK = /<!--seo-->[\s\S]*?<!--\/seo-->/
const LEGACY_SEO_BODY = /<!--seo-body-->[\s\S]*?<!--\/seo-body-->/
const FLAVOR_CACHE_MS = 60_000
const PRIVATE_DISALLOW = ['/admin', '/account', '/cart', '/checkout', '/payment', '/api/']

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeXml(value) {
  return escapeHtml(value).replaceAll("'", '&apos;')
}

// Keeps a stray "</script>" inside data from closing the JSON-LD block.
function jsonLd(data) {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
}

function absolute(base, path) {
  return /^https?:\/\//i.test(path) ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

function preloadPhotoTag({ src, sizes, media }) {
  const srcSet = photoSrcSet(src)
  const mediaAttribute = media ? ` media="${escapeHtml(media)}"` : ''
  return srcSet
    ? `<link rel="preload" as="image" href="${escapeHtml(src)}" imagesrcset="${escapeHtml(srcSet)}" imagesizes="${escapeHtml(sizes)}"${mediaAttribute} fetchpriority="high" />`
    : `<link rel="preload" as="image" href="${escapeHtml(src)}"${mediaAttribute} fetchpriority="high" />`
}

function headTags(meta, base, structuredData) {
  const url = absolute(base, meta.path)
  const image = absolute(base, meta.image || DEFAULT_IMAGE)
  const title = pageTitle(meta.title)
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="robots" content="${meta.index ? 'index, follow, max-image-preview:large' : 'noindex, nofollow'}" />`,
    meta.index && `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta property="og:locale:alternate" content="fr_FR" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    // The page's main photo is otherwise found only after the app's code has run.
    meta.photo && meta.photo.src !== HOME_HERO_PHOTO && preloadPhotoTag(meta.photo),
    ...structuredData.map(jsonLd),
  ]
  return tags.filter(Boolean).join('\n    ')
}

// The promotion bar sits above the header. Sending the active promotion with the page lets the
// bar be drawn with the first paint, instead of pushing the whole page down once the app has
// asked the API for it. A JSON data block is never run, so the Content-Security-Policy still holds.
const PROMOTION_CACHE_MS = 30 * 1000

// The app is drawn by JavaScript, so <div id="root"></div> ships empty: a crawler that
// does not run scripts (and a screen reader before hydration) sees a page with no <h1>
// and no text. Every indexable page gets a small, readable fallback inside <noscript>:
// the page's own title as the single <h1>, its description, and links to the main pages.
// <noscript> content is never rendered for JavaScript users, so nothing is duplicated on
// screen and the app's own <h1> stays the only one in the live DOM.
const FALLBACK_PAGES = [
  ['/', 'Home'],
  ['/menu/all', 'Full menu'],
  ['/flavors', 'Flavors'],
  ['/custom-cake', 'Custom cakes'],
  ['/events', 'Event orders'],
  ['/locations', 'Locations'],
  ['/contact', 'Contact'],
  ['/faq', 'FAQ'],
]

// A plain-language heading per page, without the "| Cold Stone Creamery Cameroon" suffix
// the <title> carries for search results.
const PRERENDER_HEADINGS = {
  '/': 'Ice cream mixed to order in Cameroon',
  '/menu/all': 'Every item on the menu',
  '/menu': 'The menu, by category',
  '/flavors': 'Ice cream flavours',
  '/custom-cake': 'Order a custom ice cream cake',
  '/events': 'Catering for events and parties',
  '/locations': 'Our branches in Douala and Yaoundé',
  '/contact': 'Contact Cold Stone Creamery Cameroon',
  '/faq': 'Ordering, delivery and discounts',
}

// Inlined so the static copy renders before the app's stylesheet arrives.
const FALLBACK_STYLE =
  'max-width:64rem;margin:0 auto;padding:2rem 1.25rem 3rem;font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;color:#092a53'

const MAX_LISTED_FLAVORS = 24

/**
 * Server-rendered content for the page, visible to crawlers that do not run JavaScript.
 *
 * The app is drawn by React into <div id="root"></div>, so without this the HTML carries
 * a title and a description but no content at all: no <h1>, no text, no internal links.
 * Search engines that execute scripts see the real page, but link previews, some
 * crawlers and the first paint do not.
 *
 * This renders the page's own heading, summary, real flavour names and prices (when
 * `flavors` is given), and links to the rest of the site. It lives inside <noscript>,
 * so it is never shown to someone whose browser runs the app — there is no duplicate
 * <h1> in the live DOM and no flash of unstyled duplicate text.
 */
// Real products, so the static copy is useful text rather than a placeholder: crawlers
// see the flavour names and XAF prices the menu page also shows.
function flavorListHtml(flavors, base) {
  if (!flavors.length) return ''
  const items = flavors
    .slice(0, MAX_LISTED_FLAVORS)
    .map((flavor) => {
      const name = `<a href="${escapeHtml(absolute(base, `/flavor/${flavor.id}`))}">${escapeHtml(flavor.name)}</a>`
      const price = flavor.price
        ? ` — ${escapeHtml(`${Math.round(Number(flavor.price)).toLocaleString('en-US')} FCFA`)}`
        : ''
      const soldOut = flavor.availableQuantity > 0 ? '' : ' <em>(sold out)</em>'
      return `<li style="margin:0 0 .35rem;break-inside:avoid">${name}${price}${soldOut}</li>`
    })
    .join('')
  return (
    `<h2 style="font-size:1.15rem;margin:1.75rem 0 .5rem">Flavours and prices</h2>` +
    `<ul style="margin:0;padding-left:1.25rem;columns:2;column-gap:2rem">${items}</ul>`
  )
}

function prerenderedContent({ meta, base, flavors = [] }) {
  if (!meta.index) return ''
  const heading = PRERENDER_HEADINGS[meta.path] || SITE_NAME
  const links = FALLBACK_PAGES.filter(([path]) => path !== meta.path)
    .map(([path, label]) => `<li><a href="${escapeHtml(absolute(base, path))}">${escapeHtml(label)}</a></li>`)
    .join('')
  const productList = flavorListHtml(flavors, base)

  return (
    `<noscript><div style="${FALLBACK_STYLE}">` +
    // Not the <title>: that string is built for a search result and repeats the brand.
    // The heading should say what the page is, in the words a reader would use.
    `<h1 style="font-size:1.85rem;line-height:1.2;margin:0 0 .75rem">${escapeHtml(heading)}</h1>` +
    `<p style="margin:0 0 1rem;font-size:1.05rem">${escapeHtml(meta.description)}</p>` +
    // The meta description already ends with "order online..." on some pages, so this
    // line only adds what it does not say.
    `<p style="margin:0 0 .5rem">This site needs JavaScript to take an order; ` +
    `every page below opens without it.</p>` +
    productList +
    `<h2 style="font-size:1.15rem;margin:1.75rem 0 .5rem">Pages</h2>` +
    `<ul style="margin:0;padding-left:1.25rem">${links}</ul>` +
    `</div></noscript>`
  )
}



function promotionDataTag(promotion) {
  const json = JSON.stringify({ promotion: promotion || null }).replace(/</g, '\\u003c')
  return `<script type="application/json" id="initial-promotion">${json}</script>`
}

export function createSeo({ templatePath, listFlavors, getActivePromotion, siteUrl }) {
  let template = null
  let flavorCache = { at: 0, flavors: [] }
  let promotionCache = { at: 0, promotion: null }

  async function getPromotion() {
    if (!getActivePromotion) return undefined
    if (Date.now() - promotionCache.at < PROMOTION_CACHE_MS) return promotionCache.promotion
    try {
      promotionCache = { at: Date.now(), promotion: await getActivePromotion() }
    } catch (error) {
      console.warn('Could not load the active promotion for the page:', error.message)
      return undefined
    }
    return promotionCache.promotion
  }

  async function getTemplate() {
    template ??= await readFile(templatePath, 'utf8')
    return template
  }

  // Flavor pages and the sitemap need the catalog; cache it briefly so crawlers do not hammer the database.
  async function getFlavors() {
    if (Date.now() - flavorCache.at < FLAVOR_CACHE_MS) return flavorCache.flavors
    try {
      flavorCache = { at: Date.now(), flavors: await listFlavors() }
    } catch (error) {
      console.warn('Could not load flavors for page metadata:', error.message)
    }
    return flavorCache.flavors
  }

  // SITE_URL pins the public address; otherwise use the address the request came in on.
  function origin(request) {
    return (siteUrl || `${request.protocol}://${request.get('host')}`).replace(/\/+$/, '')
  }

  async function sendPage(request, response, next) {
    const startedAt = performance.now()
    try {
      const base = origin(request)
      const flavorMatch = request.path.match(FLAVOR_PATH)
      let meta
      const structuredData = []

      if (flavorMatch) {
        const flavor = (await getFlavors()).find((item) => item.id === Number(flavorMatch[1]))
        if (flavor) {
          meta = metaForFlavor(flavor)
          const available = flavor.availableQuantity > 0
          meta.index = available
          structuredData.push({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: flavor.name,
            description: meta.description,
            image: absolute(base, meta.image),
            category: 'Ice cream',
            offers: {
              '@type': 'Offer',
              url: absolute(base, meta.path),
              price: Number(flavor.price),
              priceCurrency: 'XAF',
              availability: available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            },
          })
        } else {
          meta = { ...metaForPath('/__missing__'), path: request.path }
        }
      } else {
        meta = metaForPath(request.path)
      }

      if (meta.path === '/') {
        structuredData.push({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          url: `${base}/`,
          inLanguage: ['en', 'fr'],
        })
      }

      const html = await getTemplate()
      const tags = headTags(meta, base, structuredData)
      let page = html.replace(LEGACY_SEO_BODY, '')
      // index.html preloads the home slider's photo for every page. Only the home page shows that
      // photo, so on every other page the tag is dropped instead of downloading a picture nobody shows.
      if (request.path !== '/') page = page.replace(HOME_PHOTO_PRELOAD, '')
      page = SEO_BLOCK.test(page)
        ? page.replace(SEO_BLOCK, tags)
        : page.replace(/<title>[\s\S]*?<\/title>/, '').replace('</head>', `  ${tags}\n  </head>`)
      // Admin pages have no promotion bar. When the database cannot answer, the app asks the API as before.
      const promotion = request.path.startsWith('/admin') ? undefined : await getPromotion()
      if (promotion !== undefined) page = page.replace('</head>', `  ${promotionDataTag(promotion)}\n  </head>`)
      // Server-rendered content and one <h1> for readers and crawlers that do not run
      // the app. The home and flavor-list pages also list real flavours with prices, so
      // the static copy is the same catalogue a visitor sees; private pages get nothing.
      const showFlavors = meta.index && ['/', '/flavors', '/menu/all'].includes(meta.path)
      let fallbackFlavors = []
      if (showFlavors && !flavorMatch) {
        try {
          fallbackFlavors = await getFlavors()
        } catch (error) {
          // A database hiccup must not fail the page; the rest of the copy still renders.
          console.warn('Could not include flavours in the static page copy:', error.message)
        }
      }
      const fallback = prerenderedContent({ meta, base, flavors: fallbackFlavors })
      if (fallback) page = page.replace('<div id="root"></div>', `<div id="root"></div>${fallback}`)

      response
        .status(meta.found ? 200 : 404)
        .set('Cache-Control', 'no-cache')
        // How long the server spent building this page, so a slow first byte can be traced.
        .set('Server-Timing', `meta;dur=${(performance.now() - startedAt).toFixed(1)}`)
        .type('html')
        .send(page)
    } catch (error) {
      next(error)
    }
  }

  function robots(request, response) {
    const lines = [
      'User-agent: *',
      'Allow: /',
      ...PRIVATE_DISALLOW.map((path) => `Disallow: ${path}`),
      '',
      '# Aggressive scrapers and catalog mirrors are not welcome; the API also refuses their clients.',
      'User-agent: HTTrack',
      'Disallow: /',
      'User-agent: wget',
      'Disallow: /',
      'User-agent: curl',
      'Disallow: /',
      'User-agent: python-requests',
      'Disallow: /',
      'User-agent: scrapy',
      'Disallow: /',
      'User-agent: Bytespider',
      'Disallow: /',
      'User-agent: GPTBot',
      'Disallow: /',
      'User-agent: ClaudeBot',
      'Disallow: /',
      'User-agent: CCBot',
      'Disallow: /',
      'User-agent: AhrefsBot',
      'Disallow: /',
      'User-agent: SemrushBot',
      'Disallow: /',
      'User-agent: MJ12bot',
      'Disallow: /',
      'User-agent: DotBot',
      'Disallow: /',
      'User-agent: PetalBot',
      'Disallow: /',
      '',
      `Sitemap: ${origin(request)}/sitemap.xml`,
      '',
    ]
    response.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(lines.join('\n'))
  }

  async function sitemap(request, response, next) {
    try {
      const base = origin(request)
      const flavors = (await getFlavors()).filter((flavor) => flavor.availableQuantity > 0)
      const urls = [
        ...Object.keys(PUBLIC_PAGES).map((path) => ({ loc: absolute(base, path), priority: path === '/' ? '1.0' : '0.8' })),
        ...flavors.map((flavor) => ({ loc: absolute(base, `/flavor/${flavor.id}`), priority: '0.6' })),
      ]
      const body = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls.map(({ loc, priority }) => `  <url><loc>${escapeXml(loc)}</loc><priority>${priority}</priority></url>`),
        '</urlset>',
        '',
      ].join('\n')
      response.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(body)
    } catch (error) {
      next(error)
    }
  }

  return { sendPage, robots, sitemap }
}
