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

// index.html marks the default head tags with <!--seo--> … <!--/seo--> so each page can swap in its own.
const SEO_BLOCK = /<!--seo-->[\s\S]*?<!--\/seo-->/
const SEO_BODY = /<!--seo-body-->[\s\S]*?<!--\/seo-body-->/
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
    meta.photo && preloadPhotoTag(meta.photo),
    ...structuredData.map(jsonLd),
  ]
  return tags.filter(Boolean).join('\n    ')
}

function pageBodySnapshot(meta) {
  if (!meta.found || !meta.index) return '<!--seo-body--><!--/seo-body-->'
  if (meta.path === '/') return null
  return `<!--seo-body-->
    <section id="seo-snapshot">
      <h1>${escapeHtml(pageTitle(meta.title))}</h1>
      <p>${escapeHtml(meta.description)}</p>
      <nav>
        <a href="/">Home</a>
        <a href="/menu">Menu</a>
        <a href="/locations">Locations</a>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
      </nav>
    </section>
    <!--/seo-body-->`
}

// The promotion bar sits above the header. Sending the active promotion with the page lets the
// bar be drawn with the first paint, instead of pushing the whole page down once the app has
// asked the API for it. A JSON data block is never run, so the Content-Security-Policy still holds.
const PROMOTION_CACHE_MS = 30 * 1000

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
      let page = SEO_BLOCK.test(html)
        ? html.replace(SEO_BLOCK, tags)
        : html.replace(/<title>[\s\S]*?<\/title>/, '').replace('</head>', `  ${tags}\n  </head>`)
      const bodySnapshot = pageBodySnapshot(meta)
      if (bodySnapshot !== null) page = page.replace(SEO_BODY, bodySnapshot)
      // Admin pages have no promotion bar. When the database cannot answer, the app asks the API as before.
      const promotion = request.path.startsWith('/admin') ? undefined : await getPromotion()
      if (promotion !== undefined) page = page.replace('</head>', `  ${promotionDataTag(promotion)}\n  </head>`)

      response
        .status(meta.found ? 200 : 404)
        .set('Cache-Control', 'no-cache')
        .type('html')
        .send(page)
    } catch (error) {
      next(error)
    }
  }

  function robots(request, response) {
    const lines = ['User-agent: *', 'Allow: /', ...PRIVATE_DISALLOW.map((path) => `Disallow: ${path}`), '', `Sitemap: ${origin(request)}/sitemap.xml`, '']
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
