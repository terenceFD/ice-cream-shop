import webpush from 'web-push'

// Web Push lets the site put a notification on a customer's device, with the site's logo and
// name, even when the site is closed. Only devices of signed-in customers are ever subscribed.

export const SITE_NAME = 'Cold Stone Creamery'
const NOTIFICATION_ICON = '/icons/icon-192.png'
const NOTIFICATION_BADGE = '/icons/notification-badge.png'
const SEND_CONCURRENCY = 10

let configured = null

function readVapidConfig(environment = process.env) {
  const publicKey = environment.VAPID_PUBLIC_KEY?.trim()
  const privateKey = environment.VAPID_PRIVATE_KEY?.trim()
  const subject = environment.VAPID_SUBJECT?.trim() || 'https://ice-cream-shop-20eg.onrender.com'
  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey, subject }
}

export function pushConfiguration() {
  if (configured !== null) return configured || null
  const config = readVapidConfig()
  if (!config) {
    configured = false
    return null
  }
  try {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
    configured = config
  } catch (error) {
    console.error('Push notifications are disabled because the VAPID settings are invalid:', error.message)
    configured = false
  }
  return configured || null
}

export function isPushConfigured() {
  return Boolean(pushConfiguration())
}

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/

/** Checks a browser PushSubscription before it is stored. Returns null when it is unusable. */
export function normalizePushSubscription(body) {
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : ''
  const p256dh = typeof body?.keys?.p256dh === 'string' ? body.keys.p256dh.trim() : ''
  const auth = typeof body?.keys?.auth === 'string' ? body.keys.auth.trim() : ''
  let url
  try {
    url = new URL(endpoint)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || endpoint.length > 1000
    || !BASE64URL.test(p256dh) || p256dh.length < 40 || p256dh.length > 200
    || !BASE64URL.test(auth) || auth.length < 8 || auth.length > 100) return null
  return { endpoint, p256dh, auth }
}

const numberFormat = new Intl.NumberFormat('en-US')

function formatShortDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Douala' }).format(date)
}

export const MAX_NOTIFICATION_MESSAGE_LENGTH = 180

/** Cleans the owner's notification text: one paragraph, no control characters, sensible length. */
export function normalizeNotificationMessage(value) {
  if (typeof value !== 'string') return ''
  // Removing control characters (line breaks, tabs, invisible codes) is the point here.
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * The notification a customer sees when the owner publishes a new discount code.
 * When the owner wrote a message it is used as written; the code is added if the message leaves it out.
 */
export function buildPromotionNotification(code, customMessage = '') {
  const message = normalizeNotificationMessage(customMessage).slice(0, MAX_NOTIFICATION_MESSAGE_LENGTH)
  const amount = code.discountType === 'percent'
    ? `${code.discountValue}% off`
    : `${numberFormat.format(code.discountValue)} FCFA off`
  const details = [
    code.minimumTotal > 0 ? `on orders over ${numberFormat.format(code.minimumTotal)} FCFA` : '',
    code.expiresAt ? `until ${formatShortDate(code.expiresAt)}` : '',
  ].filter(Boolean).join(' ')
  return {
    title: `${SITE_NAME}: ${amount}`,
    body: message
      ? (message.toUpperCase().includes(code.code.toUpperCase()) ? message : `${message} Code: ${code.code}`)
      : `Use code ${code.code} at checkout${details ? ` ${details}` : ''}. Tap to order now.`,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    tag: `promotion-${code.code}`,
    url: '/menu',
  }
}

async function runWithConcurrency(items, limit, worker) {
  let index = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++]
      await worker(item)
    }
  })
  await Promise.all(runners)
}

/**
 * Sends one notification to every device of every customer account that turned alerts on.
 * Devices the browser reports as gone are removed so they are not tried again.
 */
export async function sendToAllCustomers(database, notification, { send = webpush.sendNotification } = {}) {
  if (!pushConfiguration()) return { sent: 0, removed: 0, failed: 0, skipped: true }
  const subscriptions = await database.prepare(`
    SELECT s.id, s.endpoint, s.p256dh, s.auth
    FROM push_subscriptions s JOIN customers c ON c.id = s.customer_id
    WHERE COALESCE(c.is_banned, 0) = 0
  `).all()
  const payload = JSON.stringify(notification)
  const result = { sent: 0, removed: 0, failed: 0, skipped: false }
  await runWithConcurrency(subscriptions, SEND_CONCURRENCY, async (subscription) => {
    try {
      await send(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        payload,
        { TTL: 24 * 60 * 60, urgency: 'normal', topic: notification.tag?.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || undefined },
      )
      result.sent += 1
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await database.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(subscription.id)
        result.removed += 1
      } else {
        result.failed += 1
        console.error(`Push notification to subscription #${subscription.id} failed:`, error?.statusCode || '', error?.message)
      }
    }
  })
  return result
}

export async function countCustomerSubscriptions(database) {
  const row = await database.prepare(`
    SELECT COUNT(*) AS "count"
    FROM push_subscriptions s JOIN customers c ON c.id = s.customer_id
    WHERE COALESCE(c.is_banned, 0) = 0
  `).get()
  return Number(row?.count || 0)
}
