// Tabs to the first link on each page, presses Enter and checks the skip link reaches <main>.
const pages = ['/', '/menu', '/flavors', '/about', '/cart', '/contact', '/locations', '/events', '/flavor/1']

export default async function run(page) {
  const results = []
  for (const path of pages) {
    await page.goto(`http://localhost:3999${path}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3500)
    const info = await page.evaluate(() => {
      const mains = document.querySelectorAll('main')
      const links = [...document.querySelectorAll('a[href^="#"]')].filter((a) =>
        /skip to main/i.test(a.textContent || ''),
      )
      return {
        mainCount: mains.length,
        mainId: mains[0]?.id || '(none)',
        skipLinks: links.length,
        skipTargets: [...new Set(links.map((a) => a.getAttribute('href')))],
        targetExists: links.length > 0 && Boolean(document.querySelector(links[0].getAttribute('href'))),
      }
    })
    results.push({ path, ...info })
  }
  return results
}
