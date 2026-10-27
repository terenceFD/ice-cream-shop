import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

test('service worker suppresses a duplicate push but shows a changed order update', async () => {
  const listeners = new Map()
  const notifications = []
  let shown = 0
  const self = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    location: { origin: 'https://example.test' },
    registration: {
      getNotifications: async ({ tag }) => notifications.filter(({ options }) => options.tag === tag),
      showNotification: async (title, options) => {
        shown += 1
        const existingIndex = notifications.findIndex(({ options: current }) => current.tag === options.tag)
        const notification = { title, body: options.body, data: options.data, options }
        if (existingIndex < 0) notifications.push(notification)
        else notifications[existingIndex] = notification
      },
    },
  }
  const serviceWorker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
  runInNewContext(serviceWorker, { self })

  const dispatchPush = async (data) => {
    let pending
    listeners.get('push')({
      data: { json: () => data },
      waitUntil: (promise) => { pending = promise },
    })
    await pending
  }

  await dispatchPush({
    title: 'Order #42 confirmed',
    body: 'Payment received.',
    tag: 'order-42',
    url: '/account/orders',
  })
  await dispatchPush({
    title: 'Order #42 confirmed',
    body: 'Payment received.',
    tag: 'order-42',
    url: '/account/orders',
  })

  assert.equal(shown, 1)
  assert.equal(notifications[0].title, 'Cold Stone Creamery: Order #42 confirmed')
  assert.equal(notifications[0].options.icon, '/logo.png')

  await dispatchPush({
    title: 'Order #42 is being prepared',
    body: 'The store is preparing your treats.',
    tag: 'order-42',
    url: '/account/orders',
  })

  assert.equal(shown, 2)
  assert.equal(notifications.length, 1)
  assert.equal(notifications[0].title, 'Cold Stone Creamery: Order #42 is being prepared')
})
