geg// Finds preload tags that the page's images never use, and compares them with the actual <img>.
const pages = ['/', '/menu', '/flavors', '/about', '/flavor/1', '/menu/all']

export default async function run(page) {
  const results = []
  for (const path of pages) {
    await page.goto(`https://ice-cream-shop-20eg.onrender.com${path}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForTimeout(6000)
    const info = await page.evaluate(() => {
      const preloads = [...document.querySelectorAll('link[rel="preload"][as="image"]')].map((l) => ({
        href: l.getAttribute('href'),
        imagesizes: l.getAttribute('imagesizes') || '',
        used: l.complete !== undefined ? undefined : undefined,
        // probe whether the browser has fetched this resource
        fetched: performance.getEntriesByName(l.href).length > 0,
      }))
      const hero = [...document.querySelectorAll('main img')]
        .filter((i) => i.srcset)
        .slice(0, 2)
        .map((i) => ({ src: i.getAttribute('src'), sizes: i.getAttribute('sizes'), current: i.currentSrc.split('/').slice(-2).join('/') }))
      return { preloads, hero }
    })
    results.push({ path, ...info })
  }
  return results
}
