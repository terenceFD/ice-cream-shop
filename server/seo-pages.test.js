import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createSeo } from './seo.js'

const TEMPLATE = '<!doctype html><html lang="en"><head><!--seo--><title>x</title><!--/seo--></head><body><div id="root"></div></body></html>'

function makeSeo(listFlavors = async () => [], listMenuInventory) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-pages-'))
  const templatePath = path.join(directory, 'index.html')
  fs.writeFileSync(templatePath, TEMPLATE)
  return createSeo({
    templatePath,
    listFlavors,
    getActivePromotion: async () => null,
    siteUrl: 'https://shop.example',
    listMenuInventory,
  })
}

async function requestPage(seo, pagePath, query = {}) {
  let body = ''
  let status = 200
  const headers = {}
  const response = {
    status(code) { status = code; return this },
    set(name, value) { headers[name.toLowerCase()] = value; return this },
    type() { return this },
    send(value) { body = value },
  }
  const request = { path: pagePath, query, protocol: 'https', get: () => 'shop.example', method: 'GET' }
  await seo.sendPage(request, response, (error) => { throw error })
  return { body, status, headers }
}

test('english pages keep their titles and point at the french address', async () => {
  const { body, status } = await requestPage(makeSeo(), '/')
  assert.equal(status, 200)
  assert.match(body, /<html lang="en">/)
  assert.match(body, /<title>Cold Stone Creamery Cameroon \| Ice Cream in Douala &amp; Yaoundé<\/title>/)
  assert.match(body, /hreflang="fr" href="https:\/\/shop.example\/fr"/)
  assert.match(body, /hreflang="en" href="https:\/\/shop.example\/"/)
})

test('french pages are in the first HTML, with a french title and canonical', async () => {
  const { body } = await requestPage(makeSeo(), '/fr/locations')
  assert.match(body, /<html lang="fr">/)
  assert.match(body, /Boutiques Cold Stone au Cameroun/)
  assert.match(body, /rel="canonical" href="https:\/\/shop.example\/fr\/locations"/)
  assert.match(body, /IceCreamShop/)
  assert.match(body, /Bonanjo/)
  assert.match(body, /data-local-schema="true"/)
})

test('a cake has its own page, product data, and a place in the sitemap', async () => {
  const seo = makeSeo()
  const page = await requestPage(seo, '/treat/cakes-pies/strawberry-passion')
  assert.equal(page.status, 200)
  assert.match(page.body, /<title>Strawberry Passion \| Cold Stone Creamery Cameroon<\/title>/)
  assert.match(page.body, /"@type":"Product"/)
  assert.match(page.body, /18000/)
  assert.match(page.body, /Strawberry Passion/)
  const french = await requestPage(seo, '/fr/treat/cakes-pies/strawberry-passion')
  assert.match(french.body, /<html lang="fr">/)
  assert.match(french.body, /gâteau glacé/)
  assert.match(french.body, /Douala et Yaoundé/)
  let sitemap = ''
  const response = { type() { return this }, set() { return this }, send(value) { sitemap = value } }
  await seo.sitemap({ protocol: 'https', get: () => 'shop.example' }, response, (error) => { throw error })
  assert.match(sitemap, /https:\/\/shop.example\/treat\/cakes-pies\/strawberry-passion/)
  assert.match(sitemap, /https:\/\/shop.example\/fr\/treat\/cakes-pies\/strawberry-passion/)
  assert.match(sitemap, /hreflang="fr"/)
})

test('an old product query redirects to the product address, and a category query does not', async () => {
  const seo = makeSeo()
  const product = await requestPage(seo, '/menu', { category: 'Cakes & Pies', item: 'Strawberry Passion' })
  assert.equal(product.status, 301)
  assert.equal(product.headers.location, 'https://shop.example/treat/cakes-pies/strawberry-passion')
  const category = await requestPage(seo, '/menu', { category: 'Cakes & Pies' })
  assert.equal(category.status, 200)
  assert.match(category.body, /Menu &amp; treats/)
})

test('the faq is in the first HTML, in french on the french page', async () => {
  const seo = makeSeo()
  const english = await requestPage(seo, '/faq')
  assert.match(english.body, /data-faq-schema="true"/)
  assert.match(english.body, /How do I order\?/)
  const french = await requestPage(seo, '/fr/faq')
  assert.match(french.body, /Comment commander/)
  assert.doesNotMatch(french.body, /How do I order\?/)
})

test('unknown product addresses stay out of the index', async () => {
  const { status, body } = await requestPage(makeSeo(), '/treat/cakes-pies/not-a-cake')
  assert.equal(status, 404)
  assert.match(body, /noindex/)
})

test('sold-out catalog products stay out of the sitemap', async () => {
  const seo = makeSeo(async () => [], async () => [{
    itemId: 'menu:cakes-pies:strawberry-passion',
    isAvailable: false,
    availableQuantity: 0,
  }])
  let sitemap = ''
  const response = { type() { return this }, set() { return this }, send(value) { sitemap = value } }
  await seo.sitemap({ protocol: 'https', get: () => 'shop.example' }, response, (error) => { throw error })
  assert.doesNotMatch(sitemap, /strawberry-passion/)
  assert.match(sitemap, /\/treat\//)
})

test('search and answer crawlers may read the site; mirror tools may not', async () => {
  const seo = makeSeo()
  let robots = ''
  const response = { type() { return this }, set() { return this }, send(value) { robots = value } }
  seo.robots({ protocol: 'https', get: () => 'shop.example' }, response)
  assert.doesNotMatch(robots, /AhrefsBot|SemrushBot|GPTBot|ClaudeBot|CCBot|Bytespider/)
  assert.match(robots, /User-agent: scrapy\nDisallow: \//)
  assert.match(robots, /Disallow: \/admin/)
  assert.match(robots, /Sitemap: https:\/\/shop.example\/sitemap.xml/)
})
