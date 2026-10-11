import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import Stripe from 'stripe'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  database,
  deleteDiscountCode,
  deleteMenuCategory,
  findCustomMenuItem,
  findFlavor,
  getValidDiscountCode,
  listDiscountCodes,
  listMenuCategories,
  listMenuInventory,
  listCustomMenuItems,
  listFlavors,
  saveDiscountCode,
  saveMenuCategory,
  saveCustomMenuItem,
  saveFlavor,
  updateMenuInventory,
  updateCustomMenuItem,
  deleteCustomMenuItem,
} from './database.js'
import {
  EmailConfigurationError,
  sendCakeRequestNotification,
  sendContactReply,
  sendNewOrderNotification,
  sendOrderStatusUpdate,
} from './email.js'
import { cameroonDeliveryLocations, coldStoneMenuCategories, findMenuItem, getMenuItemId } from '../src/data.js'

const app = express()
app.set('trust proxy', 1)
const port = Number(process.env.PORT || 3001)
const jwtSecret = process.env.JWT_SECRET
let stripeClient
const frontendOrigins = [
  ...(process.env.FRONTEND_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(','),
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.RENDER_EXTERNAL_URL ? [process.env.RENDER_EXTERNAL_URL] : []),
  ...(process.env.RENDER_EXTERNAL_HOSTNAME ? [`https://${process.env.RENDER_EXTERNAL_HOSTNAME}`] : []),
]
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map((origin) => new URL(origin).origin)
const uploadDirectory = fileURLToPath(new URL('./uploads/', import.meta.url))
const contentSecurityDirectives = helmet.contentSecurityPolicy.getDefaultDirectives()
contentSecurityDirectives['img-src'] = ["'self'", 'data:', 'https://images.unsplash.com']
contentSecurityDirectives['style-src'] = ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']
contentSecurityDirectives['font-src'] = ["'self'", 'data:', 'https://fonts.gstatic.com']

if (!jwtSecret || jwtSecret.length < 32 || jwtSecret.startsWith('replace-with-')) {
  throw new Error('Set JWT_SECRET to a random value of at least 32 characters in your environment.')
}

class PasswordVerificationError extends Error {
  constructor(cause) {
    super('Unable to verify the stored password hash.', { cause })
    this.name = 'PasswordVerificationError'
  }
}

async function verifyPassword(password, passwordHash) {
  try {
    return await bcrypt.compare(password, passwordHash)
  } catch (error) {
    throw new PasswordVerificationError(error)
  }
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: contentSecurityDirectives,
  },
}))
app.use(cors({
  origin(origin, callback) {
    if (!origin || frontendOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    callback(new Error('Origin is not allowed by CORS'))
  },
}))
app.use('/uploads', express.static(uploadDirectory, { fallthrough: false, index: false }))

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secretKey) return null
  if (!stripeClient) stripeClient = new Stripe(secretKey)
  return stripeClient
}

function recordPaidCheckout(session) {
  if (session.payment_status !== 'paid') return false
  const orderId = Number(session.metadata?.orderId)
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    throw new Error('Stripe checkout session has no valid order reference.')
  }
  const payment = database.prepare(`
    SELECT order_id, status FROM payments
    WHERE order_id = ? AND stripe_checkout_session_id = ?
  `).get(orderId, session.id)
  if (!payment) throw new Error('Payment record for Stripe checkout session was not found.')
  if (payment.status === 'paid') return true
  if (payment.status !== 'pending') throw new Error('Payment is no longer pending for this order.')

  const updatePayment = database.prepare(`
    UPDATE payments
    SET status = 'paid', stripe_payment_intent_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE order_id = ? AND stripe_checkout_session_id = ? AND status = 'pending'
  `)
  const updateOrder = database.prepare(`
    UPDATE orders SET status = CASE WHEN status = 'pending_payment' THEN 'processing' ELSE status END
    WHERE id = ?
  `)
  let paymentRecorded = false
  let earnedPoints = 0
  database.transaction(() => {
    const result = updatePayment.run(
      typeof session.payment_intent === 'string' ? session.payment_intent : null,
      orderId,
      session.id,
    )
    if (result.changes === 0) return
    paymentRecorded = true
    const items = database.prepare('SELECT flavor_id AS flavorId, menu_item_id AS menuItemId, quantity FROM order_items WHERE order_id = ?').all(orderId)
    const decrementStock = database.prepare(`
      UPDATE flavors
      SET stock = stock - ?, reserved_stock = reserved_stock - ?
      WHERE id = ? AND stock >= ? AND reserved_stock >= ?
    `)
    for (const item of items) {
      if (item.flavorId !== null) {
        const stockResult = decrementStock.run(item.quantity, item.quantity, item.flavorId, item.quantity, item.quantity)
        if (stockResult.changes === 0) throw new Error('Reserved flavor inventory is no longer available.')
      } else if (item.menuItemId) {
        const stockResult = database.prepare(`
          UPDATE menu_inventory
          SET stock = stock - ?, reserved_stock = reserved_stock - ?
          WHERE item_id = ? AND stock >= ? AND reserved_stock >= ?
        `).run(item.quantity, item.quantity, item.menuItemId, item.quantity, item.quantity)
        if (stockResult.changes === 0) throw new Error('Reserved menu inventory is no longer available.')
      }
    }
    database.prepare(`
      UPDATE discount_codes SET uses = uses + 1, reserved_uses = MAX(0, reserved_uses - 1)
      WHERE id = (SELECT discount_code_id FROM orders WHERE id = ?)
    `).run(orderId)
    const order = database.prepare(`
      SELECT customer_id AS customerId, subtotal_cents AS subtotalCents,
        discount_cents AS discountCents
      FROM orders WHERE id = ?
    `).get(orderId)
    if (order.customerId) {
      earnedPoints = Math.floor(Math.max(0, order.subtotalCents - order.discountCents) / 100)
      if (earnedPoints > 0) {
        database.prepare('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?')
          .run(earnedPoints, order.customerId)
        database.prepare(`
          INSERT OR IGNORE INTO loyalty_ledger (customer_id, order_id, points_delta, entry_type)
          VALUES (?, ?, ?, 'earned')
        `).run(order.customerId, orderId, earnedPoints)
      }
    }
    updateOrder.run(orderId)
  })()
  if (paymentRecorded) {
    const order = database.prepare(`
      SELECT customer_email AS customerEmail, customer_name AS customerName,
        total_cents AS totalCents, currency, fulfillment_type AS fulfillmentType,
        scheduled_for AS scheduledFor, delivery_fee AS deliveryFee
      FROM orders WHERE id = ?
    `).get(orderId)
    const items = database.prepare(`
      SELECT flavor_name AS flavorName, quantity, line_total_cents AS lineTotalCents
      FROM order_items WHERE order_id = ? ORDER BY id
    `).all(orderId)
    sendOrderStatusUpdate({
      to: order.customerEmail,
      recipientName: order.customerName,
      orderId,
      status: 'preparing',
      totalCents: order.totalCents,
      currency: order.currency,
      items,
      earnedPoints,
      fulfillmentType: order.fulfillmentType,
      scheduledFor: order.scheduledFor,
      deliveryFee: order.deliveryFee,
    }).catch((error) => {
      console.error(`Unable to send payment confirmation for order #${orderId}:`, error.message)
    })
  }
  return true
}

function recordFailedCheckout(session) {
  const orderId = Number(session.metadata?.orderId)
  if (!Number.isSafeInteger(orderId) || orderId < 1) return
  database.transaction(() => {
    const result = database.prepare(`
      UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ? AND stripe_checkout_session_id = ? AND status = 'pending'
    `).run(orderId, session.id)
    if (result.changes === 0) return
    const items = database.prepare('SELECT flavor_id AS flavorId, menu_item_id AS menuItemId, quantity FROM order_items WHERE order_id = ?').all(orderId)
    for (const item of items) {
      if (item.flavorId !== null) {
        database.prepare(`
          UPDATE flavors SET reserved_stock = MAX(0, reserved_stock - ?)
          WHERE id = ?
        `).run(item.quantity, item.flavorId)
      } else if (item.menuItemId) {
        database.prepare(`
          UPDATE menu_inventory SET reserved_stock = MAX(0, reserved_stock - ?)
          WHERE item_id = ?
        `).run(item.quantity, item.menuItemId)
      }
    }
    database.prepare(`
      UPDATE discount_codes SET reserved_uses = MAX(0, reserved_uses - 1)
      WHERE id = (SELECT discount_code_id FROM orders WHERE id = ?)
    `).run(orderId)
    database.prepare(`
      UPDATE orders SET status = 'payment_failed'
      WHERE id = ? AND status = 'pending_payment'
    `).run(orderId)
    const order = database.prepare(`
      SELECT customer_id AS customerId, loyalty_points_redeemed AS pointsRedeemed
      FROM orders WHERE id = ?
    `).get(orderId)
    if (order?.customerId && order.pointsRedeemed > 0) {
      database.prepare('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?')
        .run(order.pointsRedeemed, order.customerId)
      database.prepare(`
        INSERT OR IGNORE INTO loyalty_ledger (customer_id, order_id, points_delta, entry_type)
        VALUES (?, ?, ?, 'refunded')
      `).run(order.customerId, orderId, order.pointsRedeemed)
    }
  })()
}

let isReconcilingCheckouts = false

async function reconcileStaleCheckouts() {
  const stripe = getStripe()
  if (!stripe || isReconcilingCheckouts) return
  isReconcilingCheckouts = true
  try {
    const sessions = database.prepare(`
      SELECT p.stripe_checkout_session_id AS sessionId
      FROM payments p JOIN orders o ON o.id = p.order_id
      WHERE p.status = 'pending' AND o.status = 'pending_payment'
        AND o.created_at <= datetime('now', '-41 minutes')
      ORDER BY o.id LIMIT 50
    `).all()
    for (const { sessionId } of sessions) {
      try {
        let session = await stripe.checkout.sessions.retrieve(sessionId)
        if (session.status === 'open') {
          session = await stripe.checkout.sessions.expire(sessionId)
        }
        if (session.status === 'expired') {
          recordFailedCheckout(session)
        } else if (session.status === 'complete' && session.payment_status === 'paid') {
          recordPaidCheckout(session)
        }
      } catch (error) {
        console.error(`Unable to reconcile Stripe checkout ${sessionId}:`, error.message)
      }
    }
  } finally {
    isReconcilingCheckouts = false
  }
}

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (request, response) => {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!stripe || !webhookSecret) {
    response.status(503).json({ error: 'Stripe webhook is not configured.' })
    return
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(request.body, request.get('stripe-signature'), webhookSecret)
  } catch {
    response.status(400).json({ error: 'Stripe webhook signature is invalid.' })
    return
  }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      recordPaidCheckout(event.data.object)
    } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      recordFailedCheckout(event.data.object)
    }
    response.json({ received: true })
  } catch (error) {
    console.error('Unable to record Stripe checkout event:', error.message)
    response.status(500).json({ error: 'The Stripe event could not be recorded.' })
  }
})

app.use(express.json({ limit: '8mb' }))

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})

const contactReplyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})

function readBearerToken(request) {
  const authorization = request.get('authorization') || ''
  const [scheme, token] = authorization.split(' ')
  return scheme?.toLowerCase() === 'bearer' ? token : ''
}

function requireAdmin(request, response, next) {
  const token = readBearerToken(request)
  if (!token) {
    response.status(401).json({ error: 'Admin sign-in is required.' })
    return
  }

  try {
    const payload = jwt.verify(token, jwtSecret)
    if (payload.type !== 'admin') {
      response.status(401).json({ error: 'Admin session is invalid.' })
      return
    }
    const admin = database.prepare('SELECT id, name, email, profile_picture FROM admins WHERE id = ?').get(payload.sub)
    if (!admin) {
      response.status(401).json({ error: 'Admin session is no longer valid.' })
      return
    }
    request.admin = admin
    next()
  } catch {
    response.status(401).json({ error: 'Admin session is invalid or expired.' })
  }
}

function requireCustomer(request, response, next) {
  const token = readBearerToken(request)
  if (!token) {
    response.status(401).json({ error: 'Customer sign-in is required.' })
    return
  }
  try {
    const payload = jwt.verify(token, jwtSecret)
    if (payload.type !== 'customer') {
      response.status(401).json({ error: 'Customer session is invalid.' })
      return
    }
    const customer = database.prepare(`
      SELECT id, name, email, profile_picture AS profilePicture, phone,
        delivery_city AS deliveryCity, delivery_residence AS deliveryResidence,
        loyalty_points AS loyaltyPoints, is_banned AS isBanned
      FROM customers WHERE id = ?
    `).get(payload.sub)
    if (!customer || customer.isBanned) {
      response.status(401).json({ error: 'Customer session is no longer valid.' })
      return
    }
    request.customer = customer
    next()
  } catch {
    response.status(401).json({ error: 'Customer session is invalid or expired.' })
  }
}

function findOrderMenuItem(id) {
  const existingItem = findMenuItem(id)
  if (existingItem) return existingItem
  const customItemMatch = /^menu:custom:(\d+)$/.exec(id)
  return customItemMatch ? findCustomMenuItem(Number(customItemMatch[1])) : null
}

function normalizeFlavor(body, existing = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const detail = typeof body.detail === 'string' ? body.detail.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const image = typeof body.image === 'string' ? body.image.trim() : ''
  const price = Number(body.price)
  if (!name || !detail || !description || !image || !Number.isSafeInteger(price) || price <= 0) return null

  return {
    ...existing,
    name,
    detail,
    description,
    price,
    image,
    color: typeof body.color === 'string' ? body.color : existing.color || 'bg-[#fff1cf]',
    tag: typeof body.tag === 'string' && body.tag.trim() ? body.tag.trim() : 'New flavor',
    servings: Number.isSafeInteger(Number(body.servings)) && Number(body.servings) > 0
      ? Number(body.servings)
      : existing.servings || 2,
    allergies: Array.isArray(body.allergies)
      ? body.allergies.filter((item) => typeof item === 'string')
      : existing.allergies || [],
    origin: typeof body.origin === 'string' && body.origin.trim() ? body.origin.trim() : 'Antixor Icy',
    stock: Number.isSafeInteger(Number(body.stock)) && Number(body.stock) >= 0
      ? Number(body.stock)
      : existing.stock ?? 100,
  }
}

function listOrders({ deliveredOnly = false, storeId = null } = {}) {
  const conditions = [deliveredOnly ? "status = 'delivered'" : "status != 'delivered'"]
  const parameters = []
  if (storeId !== null) {
    conditions.push("store_id = ?")
    parameters.push(storeId)
  }
  const orders = database.prepare(`
    SELECT id, customer_name AS customerName, customer_email AS customerEmail,
      customer_phone AS customerPhone,
      delivery_city AS deliveryCity, delivery_residence AS deliveryResidence,
      store_id AS storeId, store_name AS storeName,
      store_address AS storeAddress, store_phone AS storePhone,
      subtotal_cents AS subtotalCents, discount_cents AS discountCents,
      total_cents AS totalCents, currency, status, created_at AS createdAt,
      delivered_at AS deliveredAt, fulfillment_status AS fulfillmentStatus,
      delivery_stage AS deliveryStage, fulfillment_type AS fulfillmentType,
      scheduled_for AS scheduledFor, delivery_fee AS deliveryFee,
      loyalty_points_redeemed AS loyaltyPointsRedeemed,
      discount_code AS discountCode
    FROM orders
    WHERE ${conditions.join(" AND ")}
    ORDER BY id DESC
    LIMIT 500
  `).all(...parameters)
  if (orders.length === 0) return []

  const placeholders = orders.map(() => '?').join(', ')
  const items = database.prepare(`
    SELECT order_id AS orderId, flavor_id AS flavorId, menu_item_id AS menuItemId, flavor_name AS flavorName,
      unit_price_cents AS unitPriceCents, quantity, line_total_cents AS lineTotalCents
    FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id
  `).all(...orders.map((order) => order.id))
  const itemsByOrder = new Map()
  for (const item of items) {
    const orderItems = itemsByOrder.get(item.orderId) || []
    orderItems.push(item)
    itemsByOrder.set(item.orderId, orderItems)
  }
  return orders.map((order) => ({ ...order, items: itemsByOrder.get(order.id) || [] }))
}

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.get('/api/menu', (_request, response) => {
  const inventory = new Map(listMenuInventory().map((entry) => [entry.itemId, entry]))
  const customItems = listCustomMenuItems()
  const categories = listMenuCategories().map((category) => {
    const baseCategory = category.baseTitle
      ? coldStoneMenuCategories.find((entry) => entry.title === category.baseTitle)
      : null
    const builtInItems = (baseCategory?.items || []).map((item) => {
      const id = getMenuItemId(baseCategory.title, item.name)
      const stock = inventory.get(id)
      return {
        ...item,
        id,
        itemType: 'menu',
        categoryTitle: category.title,
        stock: stock?.stock ?? 100,
        reservedStock: stock?.reservedStock ?? 0,
        isAvailable: stock?.isAvailable ?? true,
        dietaryTags: stock?.dietaryTags ?? [],
        lowStockThreshold: stock?.lowStockThreshold ?? 5,
        availableQuantity: Math.max(0, (stock?.stock ?? 100) - (stock?.reservedStock ?? 0)),
      }
    })
    return {
      ...category,
      items: [
        ...builtInItems,
        ...customItems.filter((item) => item.categoryTitle === category.title),
      ],
    }
  })
  response.json({ categories })
})

app.get('/api/fulfillment/options', (_request, response) => {
  const zones = database.prepare(`
    SELECT z.id, z.location, z.pickup_enabled AS pickupEnabled,
      z.delivery_enabled AS deliveryEnabled, z.delivery_fee AS deliveryFee,
      s.id AS storeId, s.name AS storeName, s.town AS storeTown,
      s.area AS storeArea, s.address AS storeAddress, s.phone AS storePhone,
      s.map_query AS storeMapQuery
    FROM fulfillment_zones z
    JOIN stores s ON s.fulfillment_zone_id = z.id
    WHERE z.is_active = 1 ORDER BY z.location
  `).all().map((zone) => ({
    ...zone,
    pickupEnabled: Boolean(zone.pickupEnabled),
    deliveryEnabled: Boolean(zone.deliveryEnabled),
  }))
  const slots = database.prepare(`
    SELECT id, label, start_time AS startTime, end_time AS endTime
    FROM fulfillment_slots WHERE is_active = 1 ORDER BY sort_order, id
  `).all()
  response.json({ zones, slots })
})

app.get('/api/promotions/active', (_request, response) => {
  const promotion = database.prepare(`
    SELECT code, discount_type AS discountType,
      discount_value AS discountValue, minimum_total AS minimumTotal,
      expires_at AS expiresAt
    FROM discount_codes
    WHERE is_active = 1 AND expires_at IS NOT NULL
      AND datetime(expires_at) > CURRENT_TIMESTAMP
      AND (max_uses IS NULL OR uses + reserved_uses < max_uses)
    ORDER BY datetime(expires_at), id DESC
    LIMIT 1
  `).get() || null
  response.json({ promotion })
})

app.post('/api/discount-codes/validate', (request, response) => {
  const codeText = typeof request.body.code === 'string' ? request.body.code.trim() : ''
  const subtotal = Number(request.body.subtotal)
  if (!codeText || !Number.isSafeInteger(subtotal) || subtotal < 0) {
    response.status(400).json({ error: 'Enter a discount code and a valid order subtotal.' })
    return
  }
  const code = getValidDiscountCode(codeText, subtotal)
  if (!code) {
    response.status(400).json({ error: 'That discount code is invalid, expired, inactive, or does not meet its minimum order total.' })
    return
  }
  const discountCents = code.discountType === 'percent'
    ? Math.floor(subtotal * code.discountValue / 100)
    : Math.min(subtotal, code.discountValue)
  response.json({ code: code.code, discountCents })
})

app.post('/api/checkout/session', checkoutLimiter, requireCustomer, async (request, response) => {
  const stripe = getStripe()

  const details = request.body.checkoutDetails
  const name = typeof details?.name === 'string' ? details.name.trim() : ''
  const email = typeof details?.email === 'string' ? details.email.trim().toLowerCase() : ''
  const phone = typeof details?.phone === 'string' ? details.phone.trim() : ''
  const city = typeof details?.city === 'string' ? details.city.trim() : ''
  const storeId = Number(details?.storeId)
  const residence = typeof details?.residence === 'string' ? details.residence.trim() : ''
  const fulfillmentType = details?.fulfillmentType
  const scheduledDate = typeof details?.scheduledDate === 'string' ? details.scheduledDate : ''
  const slotId = Number(details?.slotId)
  const redeemLoyaltyPoints = request.body.redeemLoyaltyPoints === true
  const discountCodeText = typeof request.body.discountCode === 'string'
    ? request.body.discountCode.trim().toUpperCase()
    : ''
  const customer = request.customer
  const store = Number.isSafeInteger(storeId) && storeId > 0
    ? database.prepare(`
      SELECT s.id, s.name, s.address, s.phone, z.id AS zoneId,
        z.pickup_enabled AS pickupEnabled, z.delivery_enabled AS deliveryEnabled,
        z.delivery_fee AS deliveryFee
      FROM stores s JOIN fulfillment_zones z ON z.id = s.fulfillment_zone_id
      WHERE s.id = ? AND z.location = ? COLLATE NOCASE AND z.is_active = 1
    `).get(storeId, city)
    : null
  const zone = store
  const slot = database.prepare(`
    SELECT id, start_time AS startTime
    FROM fulfillment_slots WHERE id = ? AND is_active = 1
  `).get(slotId)
  const canUseZone = zone && (fulfillmentType === 'pickup' ? zone.pickupEnabled : zone.deliveryEnabled)
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(scheduledDate)
  const isValidDate = Boolean(dateParts)
    && new Date(Date.UTC(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3])))
      .toISOString().slice(0, 10) === scheduledDate
  const slotDate = isValidDate && slot
    ? new Date(`${scheduledDate}T${slot.startTime}:00+01:00`)
    : null
  const deliveryFee = fulfillmentType === 'delivery' ? zone?.deliveryFee ?? 0 : 0
  const requestedItems = request.body.items
  if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
    || !phone || phone.length > 40
    || !['pickup', 'delivery'].includes(fulfillmentType)
    || !store || !canUseZone || (fulfillmentType === 'delivery' && !residence) || residence.length > 150
    || !slot || !slotDate || slotDate <= new Date() || slotDate > new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    || !Array.isArray(requestedItems) || requestedItems.length < 1 || requestedItems.length > 50) {
    response.status(400).json({ error: 'Provide valid contact, location, fulfillment type, future date, time slot, and cart details before payment.' })
    return
  }
  const scheduledFor = `${scheduledDate}T${slot.startTime}:00+01:00`

  const mergedItems = new Map()
  for (const item of requestedItems) {
    const rawId = item?.id
    const id = typeof rawId === 'string' && rawId.startsWith('menu:')
      ? rawId
      : Number(rawId)
    const quantity = Number(item?.quantity)
    if ((typeof id !== 'string' && (!Number.isSafeInteger(id) || id < 1))
      || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) {
      response.status(400).json({ error: 'The cart contains an invalid flavor or quantity.' })
      return
    }
    mergedItems.set(id, (mergedItems.get(id) || 0) + quantity)
  }
  if ([...mergedItems.values()].some((quantity) => quantity > 100)) {
    response.status(400).json({ error: 'A flavor quantity cannot exceed 100.' })
    return
  }

  const currency = 'xaf'
  const orderItems = []
  for (const [id, quantity] of mergedItems) {
    const menuItem = typeof id === 'string' ? findOrderMenuItem(id) : null
    const flavor = typeof id === 'number' ? findFlavor(id) : null
    if (!menuItem && !flavor) {
      response.status(400).json({ error: 'An item in this cart is no longer available. Refresh your bag and try again.' })
      return
    }
    const itemName = menuItem?.name || flavor.name
    const unitPrice = menuItem ? menuItem.priceXaf : flavor.price
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 1) {
      response.status(400).json({ error: `The price for ${itemName} is invalid.` })
      return
    }
    orderItems.push({
      flavorId: flavor?.id ?? null,
      menuItemId: menuItem ? id : '',
      flavorName: itemName,
      unitPriceCents: unitPrice,
      quantity,
      lineTotalCents: unitPrice * quantity,
    })
  }

  const subtotalCents = orderItems.reduce((total, item) => total + item.lineTotalCents, 0)
  let freeScoops = Math.floor(
    orderItems.filter((item) => item.flavorId !== null)
      .reduce((total, item) => total + item.quantity, 0) / 3,
  )
  let discountCents = 0
  for (const item of orderItems
    .filter((entry) => entry.flavorId !== null)
    .sort((a, b) => a.unitPriceCents - b.unitPriceCents)) {
    const freeFromFlavor = Math.min(freeScoops, item.quantity)
    freeScoops -= freeFromFlavor
    discountCents += freeFromFlavor * item.unitPriceCents
  }
  let discountCode = null
  let codeDiscountCents = 0
  if (discountCodeText) {
    discountCode = getValidDiscountCode(discountCodeText, subtotalCents)
    if (!discountCode) {
      response.status(400).json({ error: 'That discount code is invalid, expired, inactive, or does not meet its minimum order total.' })
      return
    }
    codeDiscountCents = discountCode.discountType === 'percent'
      ? Math.floor(subtotalCents * discountCode.discountValue / 100)
      : discountCode.discountValue
    discountCents = Math.min(subtotalCents, discountCents + codeDiscountCents)
  }
  let pointsRedeemed = 0
  if (redeemLoyaltyPoints) {
    if (!customer) {
      response.status(401).json({ error: 'Sign in to redeem loyalty points.' })
      return
    }
    if (discountCodeText || discountCents > 0) {
      response.status(400).json({ error: 'Loyalty points cannot be combined with other discounts.' })
      return
    }
    const maxRedeemablePoints = Math.floor(Math.min(customer.loyaltyPoints, Math.floor(subtotalCents / 10)) / 100) * 100
    if (maxRedeemablePoints < 100) {
      response.status(400).json({ error: 'At least 100 loyalty points and enough order value are required to redeem a reward.' })
      return
    }
    pointsRedeemed = maxRedeemablePoints
    discountCents = pointsRedeemed * 10
  }
  const totalCents = subtotalCents - discountCents + deliveryFee
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || (totalCents === 0 && pointsRedeemed === 0)) {
    response.status(400).json({ error: 'The order total is invalid.' })
    return
  }
  if (totalCents > 0 && !stripe) {
    response.status(503).json({ error: 'Online payments are not configured. Set STRIPE_SECRET_KEY on the server.' })
    return
  }

  let orderId
  try {
    const createOrder = database.transaction(() => {
      const reserveStock = database.prepare(`
        UPDATE flavors SET reserved_stock = reserved_stock + ?
        WHERE id = ? AND stock - reserved_stock >= ?
      `)
      const reserveMenuStock = database.prepare(`
        UPDATE menu_inventory SET reserved_stock = reserved_stock + ?
        WHERE item_id = ? AND is_available = 1 AND stock - reserved_stock >= ?
      `)
      for (const item of orderItems) {
        const result = item.flavorId !== null
          ? reserveStock.run(item.quantity, item.flavorId, item.quantity)
          : reserveMenuStock.run(item.quantity, item.menuItemId, item.quantity)
        if (result.changes === 0) {
          const error = new Error(`Not enough ${item.flavorName} in stock. Refresh your bag and try again.`)
          error.code = 'INSUFFICIENT_STOCK'
          throw error
        }
      }
      if (discountCode) {
        const reservation = database.prepare(`
          UPDATE discount_codes SET reserved_uses = reserved_uses + 1
          WHERE id = ? AND is_active = 1
            AND (expires_at IS NULL OR datetime(expires_at) > CURRENT_TIMESTAMP)
            AND (max_uses IS NULL OR uses + reserved_uses < max_uses)
        `).run(discountCode.id)
        if (!reservation.changes) {
          const error = new Error('That discount code has just reached its usage limit. Try another code.')
          error.code = 'DISCOUNT_CODE_UNAVAILABLE'
          throw error
        }
      }
      if (pointsRedeemed > 0) {
        const points = database.prepare(`
          UPDATE customers SET loyalty_points = loyalty_points - ?
          WHERE id = ? AND loyalty_points >= ?
        `).run(pointsRedeemed, customer.id, pointsRedeemed)
        if (!points.changes) {
          const error = new Error('Your loyalty balance changed. Refresh checkout and try again.')
          error.code = 'LOYALTY_BALANCE_CHANGED'
          throw error
        }
      }
      const result = database.prepare(`
        INSERT INTO orders (
          customer_id, customer_name, customer_email, customer_phone, delivery_address, delivery_city,
          store_id, store_name, store_address, store_phone,
          delivery_postal_code, delivery_residence, subtotal_cents, discount_cents, total_cents,
          currency, discount_code, discount_code_id, fulfillment_type, scheduled_for,
          delivery_fee, loyalty_points_redeemed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(customer?.id ?? null, name, email, phone, '', city,
        store.id, store.name, store.address, store.phone,
        '', residence,
        subtotalCents, discountCents, totalCents, currency, discountCode?.code || '', discountCode?.id || null,
        fulfillmentType, scheduledFor, deliveryFee, pointsRedeemed)
      const newOrderId = Number(result.lastInsertRowid)
      if (pointsRedeemed > 0) {
        database.prepare(`
          INSERT INTO loyalty_ledger (customer_id, order_id, points_delta, entry_type)
          VALUES (?, ?, ?, 'redeemed')
        `).run(customer.id, newOrderId, -pointsRedeemed)
      }
      const insertItem = database.prepare(`
        INSERT INTO order_items (
          order_id, flavor_id, menu_item_id, flavor_name, unit_price_cents, quantity, line_total_cents
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      for (const item of orderItems) {
        insertItem.run(newOrderId, item.flavorId, item.menuItemId, item.flavorName, item.unitPriceCents, item.quantity, item.lineTotalCents)
      }
      if (customer) {
        database.prepare(`
          UPDATE customers SET name = ?, phone = ?, delivery_city = ?, delivery_residence = ? WHERE id = ?
        `).run(name, phone, city, residence, customer.id)
      }
      return newOrderId
    })
    orderId = createOrder()

    const frontendUrl = new URL(process.env.FRONTEND_URL || frontendOrigins[0])
    if (!['http:', 'https:'].includes(frontendUrl.protocol)) {
      throw new Error('FRONTEND_URL must use HTTP or HTTPS.')
    }
    if (totalCents === 0) {
      database.transaction(() => {
        for (const item of orderItems) {
          if (item.flavorId !== null) {
            const result = database.prepare(`
              UPDATE flavors SET stock = stock - ?, reserved_stock = reserved_stock - ?
              WHERE id = ? AND stock >= ? AND reserved_stock >= ?
            `).run(item.quantity, item.quantity, item.flavorId, item.quantity, item.quantity)
            if (!result.changes) throw new Error('Reserved flavor inventory is no longer available.')
          } else if (item.menuItemId) {
            const result = database.prepare(`
              UPDATE menu_inventory SET stock = stock - ?, reserved_stock = reserved_stock - ?
              WHERE item_id = ? AND stock >= ? AND reserved_stock >= ?
            `).run(item.quantity, item.quantity, item.menuItemId, item.quantity, item.quantity)
            if (!result.changes) throw new Error('Reserved menu inventory is no longer available.')
          }
        }
        database.prepare(`
          UPDATE orders SET status = 'processing', fulfillment_status = 'preparing'
          WHERE id = ?
        `).run(orderId)
      })()
      const receiptOrder = database.prepare(`
        SELECT customer_email AS customerEmail, customer_name AS customerName,
          total_cents AS totalCents, currency, fulfillment_type AS fulfillmentType,
          scheduled_for AS scheduledFor, delivery_fee AS deliveryFee
        FROM orders WHERE id = ?
      `).get(orderId)
      sendOrderStatusUpdate({
        to: receiptOrder.customerEmail,
        recipientName: receiptOrder.customerName,
        orderId,
        status: 'preparing',
        totalCents: receiptOrder.totalCents,
        currency: receiptOrder.currency,
        items: orderItems,
        fulfillmentType: receiptOrder.fulfillmentType,
        scheduledFor: receiptOrder.scheduledFor,
        deliveryFee: receiptOrder.deliveryFee,
      }).catch((error) => {
        console.error(`Unable to send loyalty redemption receipt for order #${orderId}:`, error.message)
      })
      response.status(201).json({ url: `${frontendUrl.origin}/payment?loyalty_order_id=${orderId}` })
      return
    }
    let coupon
    if (discountCents > 0) {
      coupon = await stripe.coupons.create({
        amount_off: discountCents,
        currency,
        duration: 'once',
        name: pointsRedeemed > 0
          ? 'Loyalty reward'
          : discountCode ? `Order discount ${discountCode.code}` : 'Buy 2 Get 1 Free',
      })
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      expires_at: Math.floor(Date.now() / 1000) + 40 * 60,
      customer_email: email,
      client_reference_id: String(orderId),
      metadata: { orderId: String(orderId) },
      payment_intent_data: { metadata: { orderId: String(orderId) } },
      line_items: [
        ...orderItems.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency,
          unit_amount: item.unitPriceCents,
          product_data: { name: item.flavorName },
        },
        })),
        ...(deliveryFee > 0 ? [{
          quantity: 1,
          price_data: {
            currency,
            unit_amount: deliveryFee,
            product_data: { name: 'Delivery fee' },
          },
        }] : []),
      ],
      ...(coupon ? { discounts: [{ coupon: coupon.id }] } : {}),
      success_url: `${frontendUrl.origin}/payment?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl.origin}/payment?cancelled=1`,
    })
    if (!session.url) throw new Error('Stripe did not return a checkout URL.')
    database.prepare(`
      INSERT INTO payments (order_id, stripe_checkout_session_id, amount_cents, currency)
      VALUES (?, ?, ?, ?)
    `).run(orderId, session.id, totalCents, currency)
    const admins = database.prepare('SELECT email FROM admins ORDER BY id').all()
    try {
      await sendNewOrderNotification({
        recipients: admins.map((admin) => admin.email),
        orderId,
        customerName: name,
        customerEmail: email,
        storeName: store.name,
        storeAddress: store.address,
        items: orderItems,
        totalCents,
        currency,
        orderUrl: new URL('/admin/orders', frontendUrl).toString(),
      })
    } catch (emailError) {
      console.error(`Unable to send order notification for order #${orderId}:`, emailError.message)
    }
    response.status(201).json({ url: session.url })
  } catch (error) {
    if (orderId) {
      database.transaction(() => {
        const result = database.prepare(`
          UPDATE orders SET status = 'payment_failed'
          WHERE id = ? AND status = 'pending_payment'
        `).run(orderId)
        if (result.changes === 0) return
        const items = database.prepare('SELECT flavor_id AS flavorId, menu_item_id AS menuItemId, quantity FROM order_items WHERE order_id = ?').all(orderId)
        for (const item of items) {
          if (item.flavorId !== null) {
            database.prepare(`
              UPDATE flavors SET reserved_stock = MAX(0, reserved_stock - ?)
              WHERE id = ?
            `).run(item.quantity, item.flavorId)
          } else if (item.menuItemId) {
            database.prepare(`
              UPDATE menu_inventory SET reserved_stock = MAX(0, reserved_stock - ?)
              WHERE item_id = ?
            `).run(item.quantity, item.menuItemId)
          }
        }
        database.prepare(`
          UPDATE discount_codes SET reserved_uses = MAX(0, reserved_uses - 1)
          WHERE id = (SELECT discount_code_id FROM orders WHERE id = ?)
        `).run(orderId)
        const order = database.prepare(`
          SELECT customer_id AS customerId, loyalty_points_redeemed AS pointsRedeemed
          FROM orders WHERE id = ?
        `).get(orderId)
        if (order?.customerId && order.pointsRedeemed > 0) {
          database.prepare('UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?')
            .run(order.pointsRedeemed, order.customerId)
          database.prepare(`
            INSERT OR IGNORE INTO loyalty_ledger (customer_id, order_id, points_delta, entry_type)
            VALUES (?, ?, ?, 'refunded')
          `).run(order.customerId, orderId, order.pointsRedeemed)
        }
      })()
    }
    if (error.code === 'INSUFFICIENT_STOCK') {
      response.status(409).json({ error: error.message })
      return
    }
    if (error.code === 'DISCOUNT_CODE_UNAVAILABLE') {
      response.status(409).json({ error: error.message })
      return
    }
    if (error.code === 'LOYALTY_BALANCE_CHANGED') {
      response.status(409).json({ error: error.message })
      return
    }
    console.error('Unable to create Stripe checkout session:', error.message)
    response.status(502).json({ error: 'Unable to start secure checkout. Please try again.' })
  }
})

app.get('/api/payment/session/:sessionId', async (request, response) => {
  const stripe = getStripe()
  if (!stripe) {
    response.status(503).json({ error: 'Online payments are not configured.' })
    return
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(request.params.sessionId)
    if (session.payment_status !== 'paid') {
      response.status(409).json({ error: 'Stripe has not confirmed this payment yet.' })
      return
    }
    recordPaidCheckout(session)
    const orderId = Number(session.metadata?.orderId)
    const order = database.prepare(`
      SELECT id, customer_name AS customerName, customer_email AS customerEmail,
        total_cents AS totalCents, currency, status, created_at AS createdAt,
        delivery_city AS deliveryCity, store_name AS storeName,
        store_address AS storeAddress, store_phone AS storePhone,
        delivery_stage AS deliveryStage, fulfillment_type AS fulfillmentType,
        scheduled_for AS scheduledFor, delivery_fee AS deliveryFee,
        loyalty_points_redeemed AS loyaltyPointsRedeemed
      FROM orders WHERE id = ?
    `).get(orderId)
    if (!order) {
      response.status(404).json({ error: 'The order for this payment was not found.' })
      return
    }
    response.json({ order })
  } catch (error) {
    if (error.statusCode === 404 || error.type === 'StripeInvalidRequestError') {
      response.status(404).json({ error: 'Stripe checkout session was not found.' })
      return
    }
    console.error('Unable to verify Stripe payment:', error.message)
    response.status(502).json({ error: 'Unable to verify payment. Please refresh or contact support.' })
  }
})

app.get('/api/flavors', (_request, response) => {
  response.json({ flavors: listFlavors() })
})

app.get('/api/flavors/:id', (request, response) => {
  const flavor = findFlavor(Number(request.params.id))
  if (!flavor) {
    response.status(404).json({ error: 'Flavor not found.' })
    return
  }
  response.json({ flavor })
})

app.post('/api/contact', contactLimiter, (request, response, next) => {
  try {
    const name = typeof request.body.name === 'string' ? request.body.name.trim() : ''
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
    const phone = typeof request.body.phone === 'string' ? request.body.phone.trim() : ''
    const subject = typeof request.body.subject === 'string' ? request.body.subject.trim() : ''
    const message = typeof request.body.message === 'string' ? request.body.message.trim() : ''
    if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
      || phone.length > 40 || !subject || subject.length > 150 || !message || message.length > 5000) {
      response.status(400).json({ error: 'Provide a name, valid email, subject, and message. Please check the field lengths.' })
      return
    }

    const result = database.prepare(`
      INSERT INTO contact_messages (name, email, phone, subject, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, email, phone, subject, message)
    response.status(201).json({ messageId: Number(result.lastInsertRowid) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/register', signupLimiter, async (request, response, next) => {
  try {
    const name = typeof request.body.name === 'string' ? request.body.name.trim() : ''
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
    const password = typeof request.body.password === 'string' ? request.body.password : ''
    const profilePicture = typeof request.body.profilePicture === 'string' ? request.body.profilePicture.trim() : ''
    if (!name || name.length > 100 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || password.length < 8 || password.length > 128
      || (profilePicture && (!profilePicture.startsWith('data:image/') || profilePicture.length > 1024 * 1024))) {
      response.status(400).json({ error: 'Provide your name, a valid email, and a password of 8 to 128 characters, with an optional valid profile image under 1 MB.' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const result = database.prepare(`
      INSERT INTO customers (name, email, password_hash, profile_picture)
      VALUES (?, ?, ?, ?)
    `).run(name, email, passwordHash, profilePicture)
    const customer = {
      id: Number(result.lastInsertRowid),
      name,
      email,
      phone: '',
      deliveryCity: '',
      deliveryResidence: '',
      profilePicture,
    }
    const token = jwt.sign({ sub: customer.id, type: 'customer' }, jwtSecret, { expiresIn: '8h' })
    response.status(201).json({ token, customer })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      response.status(409).json({ error: 'An account already uses that email address.' })
      return
    }
    next(error)
  }
})

app.post('/api/auth/login', loginLimiter, async (request, response, next) => {
  try {
    const email = typeof request.body.email === 'string' ? request.body.email.trim() : ''
    const password = typeof request.body.password === 'string' ? request.body.password : ''
    const customer = database.prepare('SELECT * FROM customers WHERE email = ? COLLATE NOCASE').get(email)
    if (!customer || !await verifyPassword(password, customer.password_hash)) {
      response.status(401).json({ error: 'The email or password is incorrect.' })
      return
    }
    if (customer.is_banned) {
      response.status(403).json({ error: 'This customer account has been banned. Contact the store for assistance.' })
      return
    }

    const token = jwt.sign({ sub: customer.id, type: 'customer' }, jwtSecret, { expiresIn: '8h' })
    response.json({
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        profilePicture: customer.profile_picture || '',
        phone: customer.phone,
        deliveryCity: customer.delivery_city,
        deliveryResidence: customer.delivery_residence,
      },
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/auth/me', (request, response) => {
  const token = readBearerToken(request)
  if (!token) {
    response.status(401).json({ error: 'Sign-in is required.' })
    return
  }
  try {
    const payload = jwt.verify(token, jwtSecret)
    if (payload.type !== 'customer') {
      response.status(401).json({ error: 'Customer session is invalid.' })
      return
    }
    const customer = database.prepare(`
      SELECT id, name, email, profile_picture AS profilePicture, phone,
        delivery_city AS deliveryCity, delivery_residence AS deliveryResidence,
        loyalty_points AS loyaltyPoints, is_banned AS isBanned
      FROM customers WHERE id = ?
    `).get(payload.sub)
    if (!customer || customer.isBanned) {
      response.status(401).json({ error: 'Customer session is no longer valid.' })
      return
    }
    response.json({ customer })
  } catch {
    response.status(401).json({ error: 'Customer session is invalid or expired.' })
  }
})

app.put('/api/auth/profile', requireCustomer, (request, response) => {
  const name = typeof request.body.name === 'string' ? request.body.name.trim() : ''
  const phone = typeof request.body.phone === 'string' ? request.body.phone.trim() : ''
  const deliveryCity = typeof request.body.deliveryCity === 'string' ? request.body.deliveryCity.trim() : ''
  const deliveryResidence = typeof request.body.deliveryResidence === 'string' ? request.body.deliveryResidence.trim() : ''
  const hasProfilePicture = Object.prototype.hasOwnProperty.call(request.body, 'profilePicture')
  const profilePicture = typeof request.body.profilePicture === 'string' ? request.body.profilePicture.trim() : ''
  if (!name || name.length > 100 || phone.length > 40
    || (deliveryCity && !cameroonDeliveryLocations.some((location) => location.value === deliveryCity))
    || deliveryResidence.length > 150
    || (profilePicture && (!profilePicture.startsWith('data:image/') || profilePicture.length > 1024 * 1024))) {
    response.status(400).json({ error: 'Provide a valid name, phone number, delivery location, and optional profile image under 1 MB.' })
    return
  }

  const resolvedProfilePicture = hasProfilePicture ? profilePicture : request.customer.profilePicture || ''
  database.prepare(`
    UPDATE customers
    SET name = ?, phone = ?, delivery_city = ?, delivery_residence = ?, profile_picture = ?
    WHERE id = ?
  `).run(name, phone, deliveryCity, deliveryResidence, resolvedProfilePicture, request.customer.id)
  response.json({
    customer: {
      ...request.customer,
      name,
      phone,
      deliveryCity,
      deliveryResidence,
      profilePicture: resolvedProfilePicture,
    },
  })
})

app.get('/api/customer/orders', requireCustomer, (request, response) => {
  const orders = database.prepare(`
    SELECT id, subtotal_cents AS subtotalCents, discount_cents AS discountCents,
      total_cents AS totalCents, currency, discount_code AS discountCode, status,
      fulfillment_status AS fulfillmentStatus, created_at AS createdAt,
      delivered_at AS deliveredAt, delivery_city AS deliveryCity,
      delivery_residence AS deliveryResidence,
      store_id AS storeId, store_name AS storeName,
      store_address AS storeAddress, store_phone AS storePhone,
      fulfillment_type AS fulfillmentType, scheduled_for AS scheduledFor,
      delivery_fee AS deliveryFee, delivery_stage AS deliveryStage,
      loyalty_points_redeemed AS loyaltyPointsRedeemed
    FROM orders WHERE customer_id = ? ORDER BY id DESC LIMIT 100
  `).all(request.customer.id)
  if (!orders.length) {
    response.json({ orders: [] })
    return
  }
  const placeholders = orders.map(() => '?').join(', ')
  const items = database.prepare(`
    SELECT order_id AS orderId, flavor_id AS flavorId, menu_item_id AS menuItemId,
      flavor_name AS name, unit_price_cents AS unitPriceCents, quantity,
      line_total_cents AS lineTotalCents
    FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id
  `).all(...orders.map((order) => order.id))
  const itemsByOrder = new Map()
  for (const item of items) {
    const current = itemsByOrder.get(item.orderId) || []
    current.push(item)
    itemsByOrder.set(item.orderId, current)
  }
  response.json({ orders: orders.map((order) => ({
    ...order,
    items: (itemsByOrder.get(order.id) || []).map((item) => ({
      ...item,
      productId: item.menuItemId || (item.flavorId ? `flavor:${item.flavorId}` : ''),
    })),
  })) })
})

app.get('/api/customer/orders/:id', requireCustomer, (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Order ID is invalid.' })
    return
  }
  const order = database.prepare(`
    SELECT id, customer_name AS customerName, customer_email AS customerEmail,
      subtotal_cents AS subtotalCents, discount_cents AS discountCents,
      total_cents AS totalCents, currency, status, created_at AS createdAt,
      delivery_city AS deliveryCity, store_name AS storeName,
      store_address AS storeAddress, store_phone AS storePhone,
      delivery_stage AS deliveryStage, fulfillment_type AS fulfillmentType,
      scheduled_for AS scheduledFor, delivery_fee AS deliveryFee
    FROM orders WHERE id = ? AND customer_id = ? AND loyalty_points_redeemed > 0
  `).get(id, request.customer.id)
  if (!order || order.status !== 'processing') {
    response.status(404).json({ error: 'Paid loyalty order not found.' })
    return
  }
  const items = database.prepare(`
    SELECT flavor_id AS flavorId, menu_item_id AS menuItemId,
      flavor_name AS name, unit_price_cents AS unitPriceCents, quantity,
      line_total_cents AS lineTotalCents
    FROM order_items WHERE order_id = ? ORDER BY id
  `).all(id)
  response.json({ order: { ...order, items } })
})

app.get('/api/customer/loyalty', requireCustomer, (request, response) => {
  const entries = database.prepare(`
    SELECT id, order_id AS orderId, points_delta AS pointsDelta,
      entry_type AS entryType, created_at AS createdAt
    FROM loyalty_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 100
  `).all(request.customer.id)
  response.json({ points: request.customer.loyaltyPoints, entries })
})

function resolveFavoriteItem(itemId) {
  if (typeof itemId !== 'string') return null
  const flavorMatch = /^flavor:(\d+)$/.exec(itemId)
  if (flavorMatch) {
    const flavor = findFlavor(Number(flavorMatch[1]))
    return flavor ? { ...flavor, itemId, itemType: 'flavor' } : null
  }
  const menuItem = findOrderMenuItem(itemId)
  return menuItem ? { ...menuItem, itemId, itemType: 'menu' } : null
}

app.get('/api/reviews', (_request, response) => {
  const reviews = database.prepare(`
    SELECT r.rating, r.review, r.created_at AS createdAt,
      c.name AS customerName, c.profile_picture AS profilePicture,
      r.item_id AS itemId
    FROM menu_reviews r JOIN customers c ON c.id = r.customer_id
    WHERE r.is_approved = 1
    ORDER BY r.id DESC LIMIT 50
  `).all().map((review) => ({
    ...review,
    itemName: resolveFavoriteItem(review.itemId)?.name || review.itemId,
  }))
  response.json({ reviews })
})

app.get('/api/customer/favorites', requireCustomer, (request, response) => {
  const favorites = database.prepare(`
    SELECT item_id AS itemId, created_at AS createdAt FROM customer_favorites
    WHERE customer_id = ? ORDER BY created_at DESC
  `).all(request.customer.id)
  response.json({
    favorites: favorites.flatMap((favorite) => {
      const item = resolveFavoriteItem(favorite.itemId)
      return item ? [{ ...favorite, item }] : []
    }),
  })
})

app.post('/api/customer/favorites', requireCustomer, (request, response) => {
  const itemId = typeof request.body.itemId === 'string' ? request.body.itemId : ''
  if (!resolveFavoriteItem(itemId)) {
    response.status(400).json({ error: 'Choose a current menu or shop item to save.' })
    return
  }
  database.prepare('INSERT OR IGNORE INTO customer_favorites (customer_id, item_id) VALUES (?, ?)')
    .run(request.customer.id, itemId)
  response.status(201).json({ itemId })
})

app.delete('/api/customer/favorites/:itemId', requireCustomer, (request, response) => {
  const result = database.prepare('DELETE FROM customer_favorites WHERE customer_id = ? AND item_id = ?')
    .run(request.customer.id, request.params.itemId)
  if (!result.changes) {
    response.status(404).json({ error: 'Saved favorite not found.' })
    return
  }
  response.status(204).end()
})

app.get('/api/customer/saved-carts', requireCustomer, (request, response) => {
  const savedCarts = database.prepare(`
    SELECT id, source_order_id AS sourceOrderId, label,
      items_json AS itemsJson, created_at AS createdAt
    FROM customer_saved_carts WHERE customer_id = ?
    ORDER BY id DESC
  `).all(request.customer.id).map(({ itemsJson, ...savedCart }) => ({
    ...savedCart,
    items: JSON.parse(itemsJson),
  }))
  response.json({ savedCarts })
})

app.post('/api/customer/saved-carts', requireCustomer, (request, response) => {
  const orderId = Number(request.body.orderId)
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    response.status(400).json({ error: 'Choose a valid order to save.' })
    return
  }
  const order = database.prepare(`
    SELECT id, status FROM orders
    WHERE id = ? AND customer_id = ?
  `).get(orderId, request.customer.id)
  if (!order || !['processing', 'delivered'].includes(order.status)) {
    response.status(404).json({ error: 'A paid order belonging to your account was not found.' })
    return
  }
  const orderItems = database.prepare(`
    SELECT flavor_id AS flavorId, menu_item_id AS menuItemId, quantity
    FROM order_items WHERE order_id = ? ORDER BY id
  `).all(orderId)
  if (!orderItems.length) {
    response.status(409).json({ error: 'This order has no items to save.' })
    return
  }
  const items = orderItems.map((item) => ({
    productId: item.menuItemId || (item.flavorId ? `flavor:${item.flavorId}` : ''),
    quantity: item.quantity,
  }))
  if (items.some((item) => !item.productId || !Number.isSafeInteger(item.quantity) || item.quantity < 1)) {
    response.status(409).json({ error: 'This order contains items that cannot be saved.' })
    return
  }

  database.prepare(`
    INSERT OR IGNORE INTO customer_saved_carts (customer_id, source_order_id, label, items_json)
    VALUES (?, ?, ?, ?)
  `).run(request.customer.id, orderId, `Order #${orderId}`, JSON.stringify(items))
  const savedCart = database.prepare(`
    SELECT id, source_order_id AS sourceOrderId, label,
      items_json AS itemsJson, created_at AS createdAt
    FROM customer_saved_carts WHERE customer_id = ? AND source_order_id = ?
  `).get(request.customer.id, orderId)
  response.status(201).json({
    savedCart: {
      id: savedCart.id,
      sourceOrderId: savedCart.sourceOrderId,
      label: savedCart.label,
      items: JSON.parse(savedCart.itemsJson),
      createdAt: savedCart.createdAt,
    },
  })
})

app.delete('/api/customer/saved-carts/:id', requireCustomer, (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Saved cart ID is invalid.' })
    return
  }
  const result = database.prepare(
    'DELETE FROM customer_saved_carts WHERE id = ? AND customer_id = ?',
  ).run(id, request.customer.id)
  if (!result.changes) {
    response.status(404).json({ error: 'Saved cart not found.' })
    return
  }
  response.status(204).end()
})

app.get('/api/menu/:itemId/reviews', (request, response) => {
  const itemId = request.params.itemId
  if (!resolveFavoriteItem(itemId)) {
    response.status(404).json({ error: 'Menu item not found.' })
    return
  }
  const summary = database.prepare(`
    SELECT COUNT(*) AS reviewCount, ROUND(AVG(rating), 1) AS averageRating
    FROM menu_reviews WHERE item_id = ? AND is_approved = 1
  `).get(itemId)
  const reviews = database.prepare(`
    SELECT r.rating, r.review, r.created_at AS createdAt,
      c.name AS customerName, c.profile_picture AS profilePicture
    FROM menu_reviews r JOIN customers c ON c.id = r.customer_id
    WHERE r.item_id = ? AND r.is_approved = 1 ORDER BY r.id DESC LIMIT 50
  `).all(itemId)
  response.json({ ...summary, reviews })
})

app.post('/api/customer/reviews', requireCustomer, (request, response) => {
  const orderId = Number(request.body.orderId)
  const itemId = typeof request.body.itemId === 'string' ? request.body.itemId : ''
  const rating = Number(request.body.rating)
  const review = typeof request.body.review === 'string' ? request.body.review.trim() : ''
  const flavorIdMatch = /^flavor:(\d+)$/.exec(itemId)
  const flavorId = flavorIdMatch ? Number(flavorIdMatch[1]) : 0
  if (!Number.isSafeInteger(orderId) || orderId < 1 || !resolveFavoriteItem(itemId)
    || !Number.isSafeInteger(rating) || rating < 1 || rating > 5 || review.length > 1000) {
    response.status(400).json({ error: 'Provide a purchased item, a 1–5 star rating, and a review under 1,000 characters.' })
    return
  }
  const purchase = database.prepare(`
    SELECT o.id FROM orders o JOIN order_items i ON i.order_id = o.id
    WHERE o.id = ? AND o.customer_id = ? AND o.status IN ('processing', 'delivered')
      AND (i.menu_item_id = ? OR (? LIKE 'flavor:%' AND i.flavor_id = ?))
  `).get(orderId, request.customer.id, itemId, itemId, flavorId)
  if (!purchase) {
    response.status(403).json({ error: 'Only customers who purchased an item can review it.' })
    return
  }
  try {
    const result = database.prepare(`
      INSERT INTO menu_reviews (customer_id, order_id, item_id, rating, review)
      VALUES (?, ?, ?, ?, ?)
    `).run(request.customer.id, orderId, itemId, rating, review)
    response.status(201).json({ reviewId: Number(result.lastInsertRowid), pendingApproval: true })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      response.status(409).json({ error: 'You have already reviewed this item for this order.' })
      return
    }
    throw error
  }
})

app.post('/api/cake-requests', contactLimiter, async (request, response) => {
  const body = request.body
  const customerName = typeof body.name === 'string' ? body.name.trim() : ''
  const customerEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const customerPhone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const size = body.size
  const flavor = typeof body.flavor === 'string' ? body.flavor.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const toppings = Array.isArray(body.toppings) ? [...new Set(body.toppings.filter((value) => typeof value === 'string'))] : []
  const pickupDate = typeof body.pickupDate === 'string' ? body.pickupDate : ''
  const allowedSizes = new Set(['Small', 'Medium', 'Large'])
  const allowedToppings = new Set(['Sprinkles', 'Chocolate chips', 'Fresh fruit', 'Cookie pieces', 'Whipped cream'])
  const pickupTimestamp = /^\d{4}-\d{2}-\d{2}$/.test(pickupDate) ? Date.parse(`${pickupDate}T23:59:59+01:00`) : NaN
  if (!customerName || customerName.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
    || customerEmail.length > 254 || !customerPhone || customerPhone.length > 40
    || !allowedSizes.has(size) || !flavor || flavor.length > 80 || message.length > 200
    || toppings.length > allowedToppings.size || toppings.some((value) => !allowedToppings.has(value))
    || !Number.isFinite(pickupTimestamp) || pickupTimestamp < Date.now()
    || pickupTimestamp > Date.now() + 90 * 24 * 60 * 60 * 1000) {
    response.status(400).json({ error: 'Provide valid contact details and cake options with a pickup date within the next 90 days.' })
    return
  }
  let customerId = null
  const token = readBearerToken(request)
  if (token) {
    try {
      const payload = jwt.verify(token, jwtSecret)
      if (payload.type !== 'customer') throw new Error('Customer session is invalid.')
      const customer = database.prepare(`
        SELECT id FROM customers WHERE id = ?
      `).get(payload.sub)
      if (!customer) throw new Error('Customer session is no longer valid.')
      customerId = customer.id
    } catch {
      response.status(401).json({ error: 'Sign in again or submit the request without an expired account session.' })
      return
    }
  }
  const result = database.prepare(`
    INSERT INTO cake_requests (customer_id, customer_name, customer_email, customer_phone, size, flavor, message, toppings, pickup_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(customerId, customerName, customerEmail, customerPhone, size, flavor, message, JSON.stringify(toppings), pickupDate)
  const requestId = Number(result.lastInsertRowid)
  const admins = database.prepare('SELECT email FROM admins ORDER BY id').all()
  try {
    await sendCakeRequestNotification({
      recipients: admins.map((admin) => admin.email),
      requestId, customerName, customerEmail, customerPhone, size, flavor, message, toppings, pickupDate,
    })
  } catch (error) {
    console.error(`Unable to email custom cake request #${requestId}:`, error.message)
  }
  response.status(201).json({ requestId, message: 'Your cake request was sent to the store.' })
})

app.post('/api/auth/logout', (_request, response) => {
  response.status(204).end()
})

app.use('/api/admin', (request, response, next) => {
  if (request.method === 'GET' || request.method === 'HEAD') {
    next()
    return
  }
  const token = readBearerToken(request)
  try {
    const payload = jwt.verify(token, jwtSecret)
    if (payload.type !== 'admin') {
      next()
      return
    }
    const admin = database.prepare('SELECT id, name FROM admins WHERE id = ?').get(payload.sub)
    if (!admin) {
      next()
      return
    }
    response.on('finish', () => {
      if (response.statusCode < 200 || response.statusCode >= 300) return
      try {
        database.prepare(`
          INSERT INTO admin_activity (admin_id, admin_name, action, method, path)
          VALUES (?, ?, ?, ?, ?)
        `).run(admin.id, admin.name, `${request.method} ${request.path}`, request.method, request.path)
      } catch (error) {
        console.error('Unable to save admin activity:', error.message)
      }
    })
  } catch {
    // The route-level authentication middleware returns the appropriate error.
  }
  next()
})

app.post('/api/admin/login', loginLimiter, async (request, response, next) => {
  try {
    const email = typeof request.body.email === 'string' ? request.body.email.trim() : ''
    const password = typeof request.body.password === 'string' ? request.body.password : ''
    const admin = database.prepare('SELECT * FROM admins WHERE email = ? COLLATE NOCASE').get(email)
    if (!admin || !await verifyPassword(password, admin.password_hash)) {
      response.status(401).json({ error: 'The admin email or password is incorrect.' })
      return
    }

    const token = jwt.sign({ sub: admin.id, type: 'admin' }, jwtSecret, { expiresIn: '8h' })
    response.json({
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email, profilePicture: admin.profile_picture },
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/admin/me', requireAdmin, (request, response) => {
  response.json({
    admin: {
      id: request.admin.id,
      name: request.admin.name,
      email: request.admin.email,
      profilePicture: request.admin.profile_picture,
    },
  })
})

app.put('/api/admin/profile-picture', requireAdmin, (request, response) => {
  const profilePicture = typeof request.body.profilePicture === 'string'
    ? request.body.profilePicture.trim()
    : ''
  if (!profilePicture.startsWith('data:image/') || profilePicture.length > 1024 * 1024) {
    response.status(400).json({ error: 'Provide a valid profile image smaller than 1 MB.' })
    return
  }

  database.prepare('UPDATE admins SET profile_picture = ? WHERE id = ?')
    .run(profilePicture, request.admin.id)
  const admin = database.prepare(`
    SELECT id, name, email, profile_picture AS profilePicture
    FROM admins WHERE id = ?
  `).get(request.admin.id)
  response.json({ admin })
})

app.get('/api/admin/admins', requireAdmin, (_request, response) => {
  const admins = database.prepare(`
    SELECT id, name, email, profile_picture AS profilePicture, created_at AS createdAt
    FROM admins ORDER BY id
  `).all()
  response.json({ admins })
})

app.get('/api/admin/customers', requireAdmin, (_request, response) => {
  const customers = database.prepare(`
    SELECT id, name, email, phone, delivery_city AS deliveryCity,
      created_at AS createdAt, is_banned AS isBanned
    FROM customers ORDER BY id DESC
  `).all().map((customer) => ({ ...customer, isBanned: Boolean(customer.isBanned) }))
  response.json({ customers })
})

app.patch('/api/admin/customers/:id/ban', requireAdmin, (request, response) => {
  const id = Number(request.params.id)
  const isBanned = request.body.isBanned
  if (!Number.isSafeInteger(id) || id < 1 || typeof isBanned !== 'boolean') {
    response.status(400).json({ error: 'Provide a valid customer and ban status.' })
    return
  }
  const result = database.prepare('UPDATE customers SET is_banned = ? WHERE id = ?')
    .run(isBanned ? 1 : 0, id)
  if (!result.changes) {
    response.status(404).json({ error: 'Customer account not found.' })
    return
  }
  response.json({ id, isBanned })
})

app.get('/api/admin/orders', requireAdmin, (request, response) => {
  const deliveredOnly = request.query.status === 'delivered'
  if (request.query.status && !deliveredOnly) {
    response.status(400).json({ error: 'The requested order status is not supported.' })
    return
  }
  const requestedStoreId = request.query.storeId
  const storeId = requestedStoreId === undefined
    ? null
    : typeof requestedStoreId === 'string' ? Number(requestedStoreId) : NaN
  if (storeId !== null && (!Number.isSafeInteger(storeId) || storeId < 1
    || !database.prepare('SELECT 1 FROM stores WHERE id = ?').get(storeId))) {
    response.status(400).json({ error: 'Choose a valid store to filter orders.' })
    return
  }
  const orders = listOrders({ deliveredOnly, storeId })
  const count = deliveredOnly
    ? database.prepare(`
      SELECT COUNT(*) AS count FROM orders
      WHERE status = 'delivered' ${storeId === null ? '' : 'AND store_id = ?'}
    `).get(...(storeId === null ? [] : [storeId])).count
    : undefined
  response.json({ orders, ...(deliveredOnly ? { count } : {}) })
})

app.get('/api/admin/stores', requireAdmin, (_request, response) => {
  const stores = database.prepare(`
    SELECT s.id, s.name, s.town, s.area, s.address,
      z.location, z.is_active AS isActive
    FROM stores s JOIN fulfillment_zones z ON z.id = s.fulfillment_zone_id
    ORDER BY s.town, s.area
  `).all().map((store) => ({ ...store, isActive: Boolean(store.isActive) }))
  response.json({ stores })
})

app.delete('/api/admin/orders/delivered', requireAdmin, (_request, response) => {
  const result = database.transaction(() => {
    const { count } = database.prepare(
      "SELECT COUNT(*) AS count FROM orders WHERE status = 'delivered'",
    ).get()
    if (count < 5) return { count, deleted: false }

    const deletedCount = database.prepare(
      "DELETE FROM orders WHERE status = 'delivered'",
    ).run().changes
    return { count: deletedCount, deleted: true }
  })()

  if (!result.deleted) {
    response.status(409).json({
      error: 'At least five delivered orders are required before clearing them.',
      count: result.count,
    })
    return
  }
  response.json({ deleted: true, count: result.count })
})

app.delete('/api/admin/orders/:id', requireAdmin, (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Order ID is invalid.' })
    return
  }

  const deleteFailedOrder = database.transaction(() => {
    const order = database.prepare(`
      SELECT o.status AS orderStatus, p.status AS paymentStatus
      FROM orders o LEFT JOIN payments p ON p.order_id = o.id
      WHERE o.id = ?
    `).get(id)
    if (!order) return 'not_found'
    if (order.orderStatus !== 'payment_failed' || (order.paymentStatus && order.paymentStatus !== 'failed')) {
      return 'not_failed'
    }

    database.prepare('DELETE FROM orders WHERE id = ?').run(id)
    return 'deleted'
  })()

  if (deleteFailedOrder === 'not_found') {
    response.status(404).json({ error: 'Order not found.' })
    return
  }
  if (deleteFailedOrder === 'not_failed') {
    response.status(409).json({ error: 'Only failed, unpaid orders can be deleted.' })
    return
  }
  response.json({ deleted: true })
})

async function updateOrderFulfillment(id, fulfillmentStatus, response) {
  const status = fulfillmentStatus === 'delivered' ? 'delivered' : 'processing'
  const legacyStatus = fulfillmentStatus === 'delivered'
    ? 'delivered'
    : fulfillmentStatus === 'ready'
      ? 'ready'
      : 'preparing'
  const result = database.prepare(`
    UPDATE orders
    SET fulfillment_status = ?, delivery_stage = ?, status = ?,
      delivered_at = CASE WHEN ? = 'delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END
    WHERE id = ? AND status = 'processing'
  `).run(legacyStatus, fulfillmentStatus, status, fulfillmentStatus, id)
  if (result.changes === 0) {
    const order = database.prepare('SELECT status FROM orders WHERE id = ?').get(id)
    if (!order) {
      response.status(404).json({ error: 'Order not found.' })
      return
    }
    response.status(409).json({ error: 'Only paid, undelivered orders can be updated.' })
    return
  }
  const order = database.prepare(`
    SELECT customer_email AS customerEmail, customer_name AS customerName
    FROM orders WHERE id = ?
  `).get(id)
  try {
    await sendOrderStatusUpdate({
      to: order.customerEmail,
      recipientName: order.customerName,
      orderId: id,
      status: fulfillmentStatus,
    })
  } catch (error) {
    console.error(`Unable to send fulfillment update for order #${id}:`, error.message)
  }
  response.json({ fulfillmentStatus: legacyStatus, deliveryStage: fulfillmentStatus })
}

app.patch('/api/admin/orders/:id/status', requireAdmin, async (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Order ID is invalid.' })
    return
  }
  const fulfillmentStatus = request.body.status
  if (!['accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered'].includes(fulfillmentStatus)) {
    response.status(400).json({ error: 'Choose an accepted, preparing, ready, out-for-delivery, or delivered fulfillment status.' })
    return
  }
  await updateOrderFulfillment(id, fulfillmentStatus, response)
})

app.patch('/api/admin/orders/:id/delivered', requireAdmin, async (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Order ID is invalid.' })
    return
  }
  await updateOrderFulfillment(id, 'delivered', response)
})

app.get('/api/admin/payments', requireAdmin, (_request, response) => {
  const payments = database.prepare(`
    SELECT p.id, p.order_id AS orderId, p.stripe_payment_intent_id AS paymentIntentId,
      p.amount_cents AS amountCents, p.currency, p.status, p.created_at AS createdAt,
      o.customer_name AS customerName, o.customer_email AS customerEmail
    FROM payments p JOIN orders o ON o.id = p.order_id
    ORDER BY p.id DESC LIMIT 500
  `).all()
  response.json({ payments })
})

app.get('/api/admin/notifications', requireAdmin, (_request, response) => {
  const messages = database.prepare(`
    SELECT id, name, email, phone, subject, message, is_read AS isRead,
      created_at AS createdAt, replied_at AS repliedAt
    FROM contact_messages ORDER BY id DESC LIMIT 100
  `).all().map((item) => ({ ...item, isRead: Boolean(item.isRead) }))
  response.json({
    messages,
    unreadCount: messages.filter((item) => !item.isRead).length,
  })
})

app.patch('/api/admin/notifications/:id/read', requireAdmin, (request, response) => {
  const result = database.prepare('UPDATE contact_messages SET is_read = 1 WHERE id = ?')
    .run(Number(request.params.id))
  if (result.changes === 0) {
    response.status(404).json({ error: 'Notification not found.' })
    return
  }
  response.status(204).end()
})

app.delete('/api/admin/notifications/:id', requireAdmin, (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Notification ID is invalid.' })
    return
  }

  const result = database.prepare(`
    DELETE FROM contact_messages WHERE id = ? AND replied_at IS NOT NULL
  `).run(id)
  if (result.changes === 0) {
    const message = database.prepare('SELECT replied_at AS repliedAt FROM contact_messages WHERE id = ?').get(id)
    if (!message) {
      response.status(404).json({ error: 'Notification not found.' })
      return
    }
    response.status(409).json({ error: 'Only replied notifications can be deleted.' })
    return
  }
  response.status(204).end()
})

app.post('/api/admin/notifications/:id/reply', requireAdmin, contactReplyLimiter, async (request, response) => {
  const id = Number(request.params.id)
  const reply = typeof request.body.reply === 'string' ? request.body.reply.trim() : ''
  if (!Number.isSafeInteger(id) || id < 1 || !reply || reply.length > 5000) {
    response.status(400).json({ error: 'Enter a reply of 1 to 5,000 characters.' })
    return
  }

  const contact = database.prepare(`
    SELECT id, name, email, subject FROM contact_messages WHERE id = ?
  `).get(id)
  if (!contact) {
    response.status(404).json({ error: 'Contact message not found.' })
    return
  }

  try {
    await sendContactReply({
      to: contact.email,
      recipientName: contact.name,
      subject: contact.subject,
      reply,
      adminName: request.admin.name,
    })
    database.prepare('UPDATE contact_messages SET is_read = 1, replied_at = CURRENT_TIMESTAMP WHERE id = ?').run(id)
    const { repliedAt } = database.prepare('SELECT replied_at AS repliedAt FROM contact_messages WHERE id = ?').get(id)
    response.json({ sent: true, repliedAt })
  } catch (error) {
    if (error.message.startsWith('Email delivery is not configured')
      || error.message.startsWith('Email delivery requires')) {
      response.status(503).json({ error: error.message })
      return
    }
    console.error('Unable to deliver admin reply email:', error.message)
    response.status(502).json({ error: 'The reply could not be sent. Check the email server settings and try again.' })
  }
})

app.post('/api/admin/admins', requireAdmin, async (request, response, next) => {
  try {
    const { name, email, password, profilePicture = '' } = request.body
    if (typeof name !== 'string' || !name.trim() || typeof email !== 'string'
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      || typeof password !== 'string' || password.length < 8 || password.length > 128) {
      response.status(400).json({ error: 'Provide a name, valid email, and password of 8 to 128 characters.' })
      return
    }
    if (typeof profilePicture !== 'string' || (profilePicture
      && (!profilePicture.startsWith('data:image/') || profilePicture.length > 1024 * 1024))) {
      response.status(400).json({ error: 'Profile pictures must be image data smaller than 1 MB.' })
      return
    }
    const passwordHash = await bcrypt.hash(password, 12)
    const result = database.prepare(`
      INSERT INTO admins (name, email, password_hash, profile_picture)
      VALUES (?, ?, ?, ?)
    `).run(name.trim(), email.trim().toLowerCase(), passwordHash, profilePicture)
    const admin = database.prepare(`
      SELECT id, name, email, profile_picture AS profilePicture
      FROM admins WHERE id = ?
    `).get(Number(result.lastInsertRowid))
    response.status(201).json({ admin })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      response.status(409).json({ error: 'An admin account already uses that email address.' })
      return
    }
    next(error)
  }
})

app.post('/api/admin/logout', requireAdmin, (_request, response) => {
  response.status(204).end()
})

app.get('/api/admin/fulfillment-settings', requireAdmin, (_request, response) => {
  const zones = database.prepare(`
    SELECT z.id, z.location, z.pickup_enabled AS pickupEnabled,
      z.delivery_enabled AS deliveryEnabled, z.delivery_fee AS deliveryFee,
      z.is_active AS isActive, s.id AS storeId, s.name AS storeName,
      s.address AS storeAddress, s.phone AS storePhone
    FROM fulfillment_zones z JOIN stores s ON s.fulfillment_zone_id = z.id
    ORDER BY z.location
  `).all().map((zone) => ({
    ...zone,
    pickupEnabled: Boolean(zone.pickupEnabled),
    deliveryEnabled: Boolean(zone.deliveryEnabled),
    isActive: Boolean(zone.isActive),
  }))
  const slots = database.prepare(`
    SELECT id, label, start_time AS startTime, end_time AS endTime,
      is_active AS isActive, sort_order AS sortOrder
    FROM fulfillment_slots ORDER BY sort_order, id
  `).all().map((slot) => ({ ...slot, isActive: Boolean(slot.isActive) }))
  response.json({ zones, slots })
})

app.put('/api/admin/fulfillment-zones', requireAdmin, (request, response) => {
  const zones = request.body.zones
  if (!Array.isArray(zones) || zones.length > 50) {
    response.status(400).json({ error: 'Provide a valid list of delivery zones.' })
    return
  }
  const validZones = new Map(database.prepare('SELECT id, location FROM fulfillment_zones').all().map((zone) => [zone.id, zone]))
  const seen = new Set()
  for (const zone of zones) {
    const id = Number(zone.id)
    const deliveryFee = Number(zone.deliveryFee)
    if (!validZones.has(id) || seen.has(id) || !Number.isSafeInteger(deliveryFee) || deliveryFee < 0
      || typeof zone.pickupEnabled !== 'boolean' || typeof zone.deliveryEnabled !== 'boolean'
      || typeof zone.isActive !== 'boolean' || (!zone.pickupEnabled && !zone.deliveryEnabled)) {
      response.status(400).json({ error: 'Each zone must keep at least one fulfillment option and use a valid non-negative delivery fee.' })
      return
    }
    seen.add(id)
  }
  const update = database.prepare(`
    UPDATE fulfillment_zones SET pickup_enabled = ?, delivery_enabled = ?,
      delivery_fee = ?, is_active = ? WHERE id = ?
  `)
  database.transaction(() => {
    for (const zone of zones) {
      update.run(zone.pickupEnabled ? 1 : 0, zone.deliveryEnabled ? 1 : 0,
        Number(zone.deliveryFee), zone.isActive ? 1 : 0, Number(zone.id))
    }
  })()
  response.json({ zones: zones.length })
})

app.put('/api/admin/fulfillment-slots', requireAdmin, (request, response) => {
  const slots = request.body.slots
  const timeMinutes = (value) => {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || '')
    return match ? Number(match[1]) * 60 + Number(match[2]) : -1
  }
  if (!Array.isArray(slots) || slots.length < 1 || slots.length > 20
    || slots.some((slot) => typeof slot.label !== 'string' || !slot.label.trim() || slot.label.trim().length > 60
      || timeMinutes(slot.startTime) < 0 || timeMinutes(slot.endTime) <= timeMinutes(slot.startTime)
      || typeof slot.isActive !== 'boolean')) {
    response.status(400).json({ error: 'Provide at least one valid time slot with a label and increasing 24-hour start/end times.' })
    return
  }
  const ranges = slots.map((slot) => [timeMinutes(slot.startTime), timeMinutes(slot.endTime)]).sort((a, b) => a[0] - b[0])
  if (ranges.some((range, index) => index > 0 && range[0] < ranges[index - 1][1])) {
    response.status(400).json({ error: 'Fulfillment time slots cannot overlap.' })
    return
  }
  database.transaction(() => {
    database.prepare('DELETE FROM fulfillment_slots').run()
    const insert = database.prepare(`
      INSERT INTO fulfillment_slots (label, start_time, end_time, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `)
    slots.forEach((slot, index) => insert.run(
      slot.label.trim(), slot.startTime, slot.endTime, slot.isActive ? 1 : 0, index,
    ))
  })()
  response.json({ slots: slots.length })
})

app.get('/api/admin/activity', requireAdmin, (_request, response) => {
  const activity = database.prepare(`
    SELECT id, admin_name AS adminName, action, method, path, created_at AS createdAt
    FROM admin_activity ORDER BY id DESC LIMIT 200
  `).all()
  response.json({ activity })
})

app.get('/api/admin/cake-requests', requireAdmin, (_request, response) => {
  const requests = database.prepare(`
    SELECT id, customer_name AS customerName, customer_email AS customerEmail,
      customer_phone AS customerPhone, size, flavor, message, toppings,
      pickup_date AS pickupDate, status, created_at AS createdAt
    FROM cake_requests ORDER BY id DESC LIMIT 200
  `).all().map((item) => ({ ...item, toppings: JSON.parse(item.toppings) }))
  response.json({ requests })
})

app.patch('/api/admin/cake-requests/:id/status', requireAdmin, (request, response) => {
  const id = Number(request.params.id)
  const status = request.body.status
  if (!Number.isSafeInteger(id) || id < 1
    || !['new', 'contacted', 'confirmed', 'declined'].includes(status)) {
    response.status(400).json({ error: 'Choose a valid cake request and status.' })
    return
  }
  const result = database.prepare('UPDATE cake_requests SET status = ? WHERE id = ?').run(status, id)
  if (!result.changes) {
    response.status(404).json({ error: 'Custom cake request not found.' })
    return
  }
  response.json({ id, status })
})

app.get('/api/admin/reviews', requireAdmin, (request, response) => {
  if (request.query.countOnly === 'true') {
    const { count } = database.prepare('SELECT COUNT(*) AS count FROM menu_reviews WHERE is_approved = 0').get()
    response.json({ pendingCount: count })
    return
  }
  const status = request.query.status === 'approved' ? 1 : 0
  const reviews = database.prepare(`
    SELECT r.id, r.order_id AS orderId, r.item_id AS itemId, r.rating,
      r.review, r.is_approved AS isApproved, r.created_at AS createdAt,
      c.name AS customerName, c.email AS customerEmail
    FROM menu_reviews r JOIN customers c ON c.id = r.customer_id
    WHERE r.is_approved = ? ORDER BY r.id DESC LIMIT 200
  `).all(status).map((review) => ({
    ...review,
    isApproved: Boolean(review.isApproved),
    itemName: resolveFavoriteItem(review.itemId)?.name || review.itemId,
  }))
  response.json({ reviews })
})

app.patch('/api/admin/reviews/:id/approval', requireAdmin, (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1 || typeof request.body.isApproved !== 'boolean') {
    response.status(400).json({ error: 'Provide a valid review and approval status.' })
    return
  }
  const result = database.prepare('UPDATE menu_reviews SET is_approved = ? WHERE id = ?')
    .run(request.body.isApproved ? 1 : 0, id)
  if (!result.changes) {
    response.status(404).json({ error: 'Review not found.' })
    return
  }
  response.json({ id, isApproved: request.body.isApproved })
})

app.get('/api/admin/stock-alerts', requireAdmin, (_request, response) => {
  const inventory = new Map(listMenuInventory().map((entry) => [entry.itemId, entry]))
  const items = []
  for (const category of coldStoneMenuCategories) {
    for (const item of category.items) {
      const itemId = getMenuItemId(category.title, item.name)
      const stock = inventory.get(itemId)
      if (stock && (stock.availableQuantity <= stock.lowStockThreshold || !stock.isAvailable)) {
        items.push({ itemId, name: item.name, category: category.title, ...stock })
      }
    }
  }
  for (const item of listCustomMenuItems()) {
    if (item.availableQuantity <= item.lowStockThreshold || !item.isAvailable) {
      items.push({ itemId: item.id, name: item.name, category: item.categoryTitle, ...item })
    }
  }
  response.json({ items })
})

app.post('/api/admin/flavors', requireAdmin, (request, response, next) => {
  try {
    const flavor = normalizeFlavor(request.body)
    if (!flavor) {
      response.status(400).json({ error: 'Provide a name, descriptions, image, and a price greater than zero.' })
      return
    }
    response.status(201).json({ flavor: saveFlavor(flavor) })
  } catch (error) {
    next(error)
  }
})

function normalizeCustomMenuItem(body) {
  const categoryTitle = typeof body.categoryTitle === 'string' ? body.categoryTitle.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const detail = typeof body.detail === 'string' ? body.detail.trim() : ''
  const image = typeof body.image === 'string' ? body.image.trim() : ''
  const priceXaf = Number(body.priceXaf)
  const categoryExists = listMenuCategories().some((category) => category.title === categoryTitle)
  const stock = Number(body.stock ?? 100)
  const isAvailable = body.isAvailable !== false
  const validImage = image.length <= 2000 && (
    (image.startsWith('/') && !image.startsWith('//'))
    || /^https:\/\/[^\s]+$/i.test(image)
  )
  if (!categoryExists || !name || name.length > 120 || !detail || detail.length > 500
    || !validImage || !Number.isSafeInteger(priceXaf) || priceXaf < 1
    || !Number.isSafeInteger(stock) || stock < 0) {
    return null
  }
  return { categoryTitle, name, detail, image, priceXaf, stock, isAvailable }
}

app.get('/api/admin/menu-categories', requireAdmin, (_request, response) => {
  response.json({ categories: listMenuCategories() })
})

function normalizeMenuCategory(body, existing = null) {
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const image = typeof body.image === 'string' ? body.image.trim() : ''
  const icon = typeof body.icon === 'string' && body.icon.trim() ? body.icon.trim().slice(0, 12) : '🍦'
  const sortOrder = Number(body.sortOrder ?? existing?.sortOrder ?? listMenuCategories().length)
  const validImage = !image || ((image.startsWith('/') && !image.startsWith('//')) || /^https:\/\/[^\s]+$/i.test(image))
  if (!title || title.length > 80 || description.length > 300 || !validImage
    || !Number.isSafeInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) return null
  return {
    ...(existing ? { id: existing.id, previousTitle: existing.title } : {}),
    title,
    description,
    image,
    icon,
    sortOrder,
  }
}

app.post('/api/admin/menu-categories', requireAdmin, (request, response, next) => {
  const category = normalizeMenuCategory(request.body)
  if (!category) {
    response.status(400).json({ error: 'Provide a category name, valid image path, and non-negative order.' })
    return
  }
  try {
    response.status(201).json({ category: saveMenuCategory(category) })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      response.status(409).json({ error: 'A category with that name already exists.' })
      return
    }
    next(error)
  }
})

app.put('/api/admin/menu-categories/:id', requireAdmin, (request, response, next) => {
  const id = Number(request.params.id)
  const existing = listMenuCategories().find((category) => category.id === id)
  if (!existing) {
    response.status(404).json({ error: 'Menu category not found.' })
    return
  }
  const category = normalizeMenuCategory(request.body, existing)
  if (!category) {
    response.status(400).json({ error: 'Provide a category name, valid image path, and non-negative order.' })
    return
  }
  try {
    response.json({ category: saveMenuCategory(category) })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      response.status(409).json({ error: 'A category with that name already exists.' })
      return
    }
    next(error)
  }
})

app.delete('/api/admin/menu-categories/:id', requireAdmin, (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Menu category ID is invalid.' })
    return
  }
  const result = deleteMenuCategory(id)
  if (result === 'not_found') {
    response.status(404).json({ error: 'Menu category not found.' })
    return
  }
  if (result === 'not_empty') {
    response.status(409).json({ error: 'Move or remove all menu items before deleting this category.' })
    return
  }
  response.status(204).end()
})

app.put('/api/admin/menu-inventory', requireAdmin, (request, response) => {
  const itemId = typeof request.body.itemId === 'string' ? request.body.itemId : ''
  const stock = Number(request.body.stock)
  const lowStockThreshold = Number(request.body.lowStockThreshold)
  const isAvailable = request.body.isAvailable !== false
  const allowedDietaryTags = new Set(['vegetarian', 'vegan', 'dairy-free', 'gluten-free', 'nut-free'])
  const dietaryTags = Array.isArray(request.body.dietaryTags)
    ? [...new Set(request.body.dietaryTags)]
    : []
  const row = database.prepare('SELECT reserved_stock AS reservedStock FROM menu_inventory WHERE item_id = ?').get(itemId)
  if (!row || !Number.isSafeInteger(stock) || stock < row.reservedStock
    || !Number.isSafeInteger(lowStockThreshold) || lowStockThreshold < 0 || lowStockThreshold > 100000) {
    response.status(400).json({ error: 'Provide a valid menu item, stock no lower than quantities reserved, and a low-stock threshold from zero to 100,000.' })
    return
  }
  if (dietaryTags.some((tag) => !allowedDietaryTags.has(tag))) {
    response.status(400).json({ error: 'One or more dietary tags are not supported.' })
    return
  }
  const updated = updateMenuInventory(itemId, { stock, isAvailable, dietaryTags, lowStockThreshold })
  if (!updated) {
    response.status(409).json({ error: 'Stock cannot be lower than the quantity reserved for pending checkouts.' })
    return
  }
  response.json({ itemId, stock, isAvailable, dietaryTags, lowStockThreshold })
})

app.post('/api/admin/uploads', requireAdmin, async (request, response) => {
  const dataUrl = typeof request.body.dataUrl === 'string' ? request.body.dataUrl : ''
  const match = /^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl)
  if (!match) {
    response.status(400).json({ error: 'Upload a JPEG, PNG, WebP, or GIF image.' })
    return
  }
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length < 1 || buffer.length > 5 * 1024 * 1024) {
    response.status(413).json({ error: 'Image uploads must be smaller than 5 MB.' })
    return
  }
  const signatures = {
    jpeg: buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
    png: buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    webp: buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP',
    gif: buffer.subarray(0, 3).toString() === 'GIF',
  }
  if (!signatures[match[1]]) {
    response.status(400).json({ error: 'The uploaded file does not match its image type.' })
    return
  }
  const extension = match[1] === 'jpeg' ? '.jpg' : `.${match[1]}`
  await mkdir(uploadDirectory, { recursive: true })
  const filename = `${randomUUID()}${extension}`
  await writeFile(join(uploadDirectory, filename), buffer, { flag: 'wx' })
  response.status(201).json({ image: `/uploads/${filename}` })
})

app.get('/api/admin/discount-codes', requireAdmin, (_request, response) => {
  response.json({ discountCodes: listDiscountCodes() })
})

function normalizeDiscountCode(body, existing = null) {
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  const discountType = body.discountType
  const discountValue = Number(body.discountValue)
  const minimumTotal = Number(body.minimumTotal ?? 0)
  const maxUses = body.maxUses === '' || body.maxUses == null ? null : Number(body.maxUses)
  const isAvailable = body.isActive !== false
  const expiresAt = typeof body.expiresAt === 'string' ? body.expiresAt.trim() : ''
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)
    || !['percent', 'fixed'].includes(discountType)
    || !Number.isSafeInteger(discountValue) || discountValue < 1
    || (discountType === 'percent' && discountValue > 99)
    || !Number.isSafeInteger(minimumTotal) || minimumTotal < 0
    || (maxUses !== null && (!Number.isSafeInteger(maxUses) || maxUses < 1))
    || (expiresAt && Number.isNaN(Date.parse(expiresAt)))) return null
  return {
    ...(existing ? { id: existing.id } : {}),
    code,
    discountType,
    discountValue,
    minimumTotal,
    maxUses,
    isActive: isAvailable,
    expiresAt,
  }
}

app.post('/api/admin/discount-codes', requireAdmin, (request, response, next) => {
  const code = normalizeDiscountCode(request.body)
  if (!code) {
    response.status(400).json({ error: 'Provide a unique code, valid discount amount, minimum total, and optional expiry.' })
    return
  }
  try {
    response.status(201).json({ discountCode: saveDiscountCode(code) })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      response.status(409).json({ error: 'That discount code already exists.' })
      return
    }
    next(error)
  }
})

app.put('/api/admin/discount-codes/:id', requireAdmin, (request, response, next) => {
  const id = Number(request.params.id)
  const existing = listDiscountCodes().find((code) => code.id === id)
  if (!existing) {
    response.status(404).json({ error: 'Discount code not found.' })
    return
  }
  const code = normalizeDiscountCode(request.body, existing)
  if (!code) {
    response.status(400).json({ error: 'Provide a unique code, valid discount amount, minimum total, and optional expiry.' })
    return
  }
  try {
    response.json({ discountCode: saveDiscountCode(code) })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      response.status(409).json({ error: 'That discount code already exists.' })
      return
    }
    next(error)
  }
})

app.delete('/api/admin/discount-codes/:id', requireAdmin, (request, response) => {
  if (!deleteDiscountCode(Number(request.params.id))) {
    response.status(404).json({ error: 'Discount code not found.' })
    return
  }
  response.status(204).end()
})

app.get('/api/admin/reports', requireAdmin, (_request, response) => {
  const summary = database.prepare(`
    SELECT COUNT(*) AS orderCount,
      COALESCE(SUM(CASE WHEN status IN ('processing', 'delivered') THEN total_cents ELSE 0 END), 0) AS sales,
      COALESCE(AVG(CASE WHEN status IN ('processing', 'delivered') THEN total_cents END), 0) AS averageOrder,
      COALESCE(SUM(CASE WHEN status NOT IN ('payment_failed') THEN 1 ELSE 0 END), 0) AS placedCount
    FROM orders
  `).get()
  const popularItems = database.prepare(`
    SELECT flavor_name AS name, SUM(quantity) AS quantity, SUM(line_total_cents) AS sales
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status IN ('processing', 'delivered')
    GROUP BY flavor_name ORDER BY quantity DESC LIMIT 10
  `).all()
  const lowStock = database.prepare(`
    SELECT itemId, name, stock, reservedStock, isAvailable, availableQuantity FROM (
      SELECT item_id AS itemId, item_id AS name, stock,
        reserved_stock AS reservedStock, is_available AS isAvailable,
        stock - reserved_stock AS availableQuantity
      FROM menu_inventory WHERE stock - reserved_stock <= 5
      UNION ALL
      SELECT 'flavor:' || id AS itemId, name, stock,
        reserved_stock AS reservedStock, 1 AS isAvailable,
        stock - reserved_stock AS availableQuantity
      FROM flavors WHERE stock - reserved_stock <= 5
    ) ORDER BY availableQuantity, itemId LIMIT 30
  `).all()
  const recentSales = database.prepare(`
    SELECT date(created_at) AS date, SUM(total_cents) AS sales, COUNT(*) AS orders
    FROM orders WHERE status IN ('processing', 'delivered')
      AND created_at >= datetime('now', '-30 days')
    GROUP BY date(created_at) ORDER BY date
  `).all()
  response.json({ summary, popularItems, lowStock, recentSales })
})

app.post('/api/admin/menu-items', requireAdmin, (request, response, next) => {
  const itemDetails = normalizeCustomMenuItem(request.body)
  if (!itemDetails) {
    response.status(400).json({ error: 'Choose a category and provide a name, description, valid image path, and whole-number price greater than zero.' })
    return
  }
  try {
    const item = saveCustomMenuItem(itemDetails)
    response.status(201).json({ item })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      response.status(409).json({ error: 'A menu item with that name already exists in this category.' })
      return
    }
    next(error)
  }
})

app.put('/api/admin/menu-items/:id', requireAdmin, (request, response, next) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Menu item ID is invalid.' })
    return
  }
  if (!findCustomMenuItem(id)) {
    response.status(404).json({ error: 'Menu item not found.' })
    return
  }
  const itemDetails = normalizeCustomMenuItem(request.body)
  if (!itemDetails) {
    response.status(400).json({ error: 'Choose a category and provide a name, description, valid image path, and whole-number price greater than zero.' })
    return
  }
  const existingItem = findCustomMenuItem(id)
  if (itemDetails.stock < existingItem.reservedStock) {
    response.status(409).json({ error: 'Stock cannot be lower than the quantity reserved for pending checkouts.' })
    return
  }
  try {
    response.json({ item: updateCustomMenuItem(id, itemDetails) })
  } catch (error) {
    if (error.code === 'STOCK_RESERVED') {
      response.status(409).json({ error: error.message })
      return
    }
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      response.status(409).json({ error: 'A menu item with that name already exists in this category.' })
      return
    }
    next(error)
  }
})

app.delete('/api/admin/menu-items/:id', requireAdmin, (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Menu item ID is invalid.' })
    return
  }
  const result = deleteCustomMenuItem(id)
  if (result === 'not_found') {
    response.status(404).json({ error: 'Menu item not found.' })
    return
  }
  if (result === 'reserved') {
    response.status(409).json({ error: 'This item has stock reserved for pending checkouts and cannot be deleted yet.' })
    return
  }
  response.status(204).end()
})

app.put('/api/admin/flavors/:id', requireAdmin, (request, response, next) => {
  try {
    const existing = findFlavor(Number(request.params.id))
    if (!existing) {
      response.status(404).json({ error: 'Flavor not found.' })
      return
    }
    const flavor = normalizeFlavor(request.body, existing)
    if (!flavor) {
      response.status(400).json({ error: 'Provide a name, descriptions, image, and a price greater than zero.' })
      return
    }
    if (flavor.stock < existing.reservedStock) {
      response.status(409).json({ error: 'Stock cannot be lower than the quantity reserved for pending checkouts.' })
      return
    }
    response.json({ flavor: saveFlavor({ ...flavor, id: existing.id }) })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/admin/flavors/:id', requireAdmin, (request, response) => {
  const flavor = findFlavor(Number(request.params.id))
  if (flavor?.reservedStock > 0) {
    response.status(409).json({ error: 'This flavor has inventory reserved for a pending checkout and cannot be deleted yet.' })
    return
  }
  const result = database.prepare('DELETE FROM flavors WHERE id = ?').run(Number(request.params.id))
  if (result.changes === 0) {
    response.status(404).json({ error: 'Flavor not found.' })
    return
  }
  response.status(204).end()
})

const frontendDirectory = fileURLToPath(new URL('../dist/', import.meta.url))
const frontendEntry = fileURLToPath(new URL('../dist/index.html', import.meta.url))
if (existsSync(frontendEntry)) {
  app.use(express.static(frontendDirectory, { index: false }))
  app.use((request, response, next) => {
    if (request.method !== 'GET' || request.path === '/api' || request.path.startsWith('/api/')) {
      next()
      return
    }
    response.sendFile(frontendEntry)
  })
}

app.use((error, _request, response, _next) => {
  if (error.type === 'entity.too.large') {
    response.status(413).json({ error: 'The uploaded request is too large. Images must be smaller than 5 MB.' })
    return
  }
  if (error instanceof EmailConfigurationError) {
    response.status(503).json({ error: 'Email delivery is not configured. Contact the store owner to finish setting up email delivery.' })
    return
  }
  if (error instanceof PasswordVerificationError) {
    console.error(error)
    response.status(500).json({ error: 'Sign-in could not verify the account password. Contact the store owner to check or reset the account.' })
    return
  }
  console.error(error)
  const debugMessage = error instanceof Error && error.message && (
    error.message.startsWith('Email delivery is not configured')
    || error.message.startsWith('Email delivery requires')
  )
    ? error.message
    : 'An unexpected server error occurred.'
  if (!response.headersSent) response.status(500).json({ error: debugMessage })
})

const server = app.listen(port, () => {
  console.log(`cold stone API listening on http://localhost:${port}`)
  reconcileStaleCheckouts().catch((error) => {
    console.error('Unable to reconcile expired checkouts:', error.message)
  })
  setInterval(() => {
    reconcileStaleCheckouts().catch((error) => {
      console.error('Unable to reconcile expired checkouts:', error.message)
    })
  }, 5 * 60 * 1000)
})

function shutdown() {
  server.close(() => {
    database.close()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
