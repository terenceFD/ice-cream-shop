import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createSeo } from './seo.js'

const TEMPLATE = '<!doctype html><html><head><!--seo--><title>x</title><!--/seo--></head><body><div id="root"></div></body></html>'

async function render(seo, pagePath) {
  const request = { path: pagePath, protocol: 'https', get: () => 'shop.example' }
  let body = ''
  const response = { status() { return this }, set() { return this }, type() { return this }, send(value) { body = value } }
  await seo.sendPage(request, response, (error) => { throw error })
  return body
}

function makeSeo(getActivePromotion) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-'))
  const templatePath = path.join(directory, 'index.html')
  fs.writeFileSync(templatePath, TEMPLATE)
  return createSeo({ templatePath, listFlavors: async () => [], getActivePromotion })
}

test('pages carry the active promotion so its bar is drawn with the first paint', async () => {
  const promotion = { code: 'SWEET</script>', discountType: 'percent', discountValue: 20, expiresAt: '2099-01-01T00:00:00Z' }
  const page = await render(makeSeo(async () => promotion), '/menu')
  const match = page.match(/<script type="application\/json" id="initial-promotion">(.*?)<\/script>/)
  assert.ok(match, 'promotion data block missing')
  assert.ok(!match[1].includes('</script>'), 'the code must not be able to close the script tag')
  assert.deepEqual(JSON.parse(match[1]), { promotion })
})

test('pages say so when there is no promotion, and admin pages carry none', async () => {
  const seo = makeSeo(async () => null)
  assert.match(await render(seo, '/'), /id="initial-promotion">\{"promotion":null\}</)
  assert.doesNotMatch(await render(seo, '/admin/orders'), /initial-promotion/)
})

test('a database error leaves the promotion to the app instead of failing the page', async () => {
  const page = await render(makeSeo(async () => { throw new Error('offline') }), '/')
  assert.doesNotMatch(page, /initial-promotion/)
  assert.match(page, /<div id="root">/)
})

test('public pages keep their SEO metadata without serving the legacy text snapshot', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-body-'))
  const templatePath = path.join(directory, 'index.html')
  fs.writeFileSync(templatePath, `${TEMPLATE.slice(0, TEMPLATE.indexOf('</body>'))}<!--seo-body--><section id="seo-snapshot"><h1>Old visible SEO copy</h1><a href="/menu">Menu</a></section><!--/seo-body--></body></html>`)
  const seo = createSeo({ templatePath, listFlavors: async () => [], getActivePromotion: async () => null })
  const home = await render(seo, '/')
  assert.doesNotMatch(home, /seo-snapshot|Old visible SEO copy|seo-body/)
  assert.match(home, /<title>Cold Stone Creamery Cameroon \| Ice Cream in Douala &amp; Yaoundé<\/title>/)
  const menu = await render(seo, '/menu')
  assert.doesNotMatch(menu, /seo-snapshot|Old visible SEO copy|seo-body/)
  assert.match(menu, /<title>Menu &amp; treats \| Cold Stone Creamery Cameroon<\/title>/)
})
