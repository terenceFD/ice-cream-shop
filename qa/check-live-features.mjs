// Confirms the live site has the new shopping features.
const base = 'https://ice-cream-shop-20eg.onrender.com'
const report = {}

const menu = await (await fetch(`${base}/menu?category=Ice+Cream`)).text()
report.menu = {
  hasQuickAddScript: /to your bag/.test(menu),
  urls: [menu.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0]],
}

// The quick-add label is rendered by the app, so check the shipped bundle instead.
const entry = report.menu.urls[0]
if (entry) {
  const code = await (await fetch(`${base}/${entry}`)).text()
  report.menu.quickAddInBundle = /to your bag/.test(code)
}

const about = await (await fetch(`${base}/about`)).text()
report.aboutHeroPhotoPreloadRemoved = !/ice-9\.(jpg|webp)/.test(about)
const home = await (await fetch(`${base}/`)).text()
report.homeStillPreloadsHero = /ice-9\.(jpg|webp)/.test(home)

console.log(JSON.stringify(report, null, 1))
