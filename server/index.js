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
  addCustomerFavorite,
  createAdminAccount,
  createAdminActivity,
  createCakeRequest,
  createCheckoutOrder,
  createContactMessage,
  createPaymentRecord,
  clearDeliveredOrders,
  database,
  verifyDatabaseSchema,
  markStripeCheckoutPaymentFailed,
  deleteDiscountCode,
  deleteFailedOrder,
  deleteFlavor,
  deleteMenuCategory,
  deleteContactMessage,
  deleteContactMessages,
  deleteSavedCart,
  finalizePaidCheckout,
  finalizeZeroAmountCheckout,
  findCustomMenuItem,
  findFlavor,
  getValidDiscountCode,
  listDiscountCodes,
  listMenuCategories,
  listMenuInventory,
  listCustomMenuItems,
  listFlavors,
  markContactMessageRead,
  markContactMessageReplied,
  createMenuReview,
  registerCustomer,
  removeCustomerFavorite,
  rollbackCheckoutOrder,
  saveCustomerCart,
  saveDiscountCode,
  updateCustomerProfile,
  saveMenuCategory,
  saveCustomMenuItem,
  saveFlavor,
  setCakeRequestStatus,
  setCustomerBanStatus,
  setReviewApproval,
  updateAdminProfilePicture,
  updateFulfillmentSlots,
  updateFulfillmentZones,
  updateMenuInventory,
  updateCustomMenuItem,
  updateOrderFulfillmentStatus,
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
import { storeAdminCanAccess } from './admin-access.js'

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

function isUniqueConstraintError(error) {
  return error && (
    error.code === 'SQLITE_CONSTRAINT_UNIQUE'
    || error.code === '23505'
    || (typeof error.message === 'string' && /unique constraint/i.test(error.message))
  )
}

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secretKey) return null
  if (!stripeClient) stripeClient = new Stripe(secretKey)
  return stripeClient
}

async function recordPaidCheckout(session) {
  if (session.payment_status !== 'paid') return false
  const orderId = Number(session.metadata?.orderId)
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    throw new Error('Stripe checkout session has no valid order reference.')
  }
  const payment = await database.prepare(`
    SELECT order_id, status FROM payments
    WHERE order_id = ? AND stripe_checkout_session_id = ?
  `).get(orderId, session.id)
  if (!payment) throw new Error('Payment record for Stripe checkout session was not found.')
  if (payment.status === 'paid') return true
  if (payment.status !== 'pending') throw new Error('Payment is no longer pending for this order.')

  const { paymentRecorded, earnedPoints } = await finalizePaidCheckout(orderId, session)
  if (!paymentRecorded) return false

  const order = await database.prepare(`
    SELECT customer_email AS "customerEmail", customer_name AS "customerName",
      total_cents AS "totalCents", currency, fulfillment_type AS "fulfillmentType",
      scheduled_for AS "scheduledFor", delivery_fee AS "deliveryFee"
    FROM orders WHERE id = ?
  `).get(orderId)
  const items = await database.prepare(`
    SELECT flavor_name AS "flavorName", quantity, line_total_cents AS "lineTotalCents"
    FROM order_items WHERE order_id = ? ORDER BY id
  `).all(orderId)

  if (process.env.PAYMENT_CONFIRMATION_EMAILS_ENABLED === 'true') {
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

async function recordFailedCheckout(session) {
  const orderId = Number(session.metadata?.orderId)
  if (!Number.isSafeInteger(orderId) || orderId < 1) return
  await markStripeCheckoutPaymentFailed(orderId, session.id)
}

let isReconcilingCheckouts = false

async function reconcileStaleCheckouts() {
  const stripe = getStripe()
  if (!stripe || isReconcilingCheckouts) return
  isReconcilingCheckouts = true
  try {
    const sessions = await database.prepare(`
      SELECT p.stripe_checkout_session_id AS "sessionId"
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
          await recordFailedCheckout(session)
        } else if (session.status === 'complete' && session.payment_status === 'paid') {
          await recordPaidCheckout(session)
        }
      } catch (error) {
        console.error(`Unable to reconcile Stripe checkout ${sessionId}:`, error.message)
      }
    }
  } finally {
    isReconcilingCheckouts = false
  }
}

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (request, response) => {
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
      await recordPaidCheckout(event.data.object)
    } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      await recordFailedCheckout(event.data.object)
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

function requireOwner(request, response) {
  if (request.admin?.role === 'owner') return true
  response.status(403).json({ error: 'Only the owner account can access this area.' })
  return false
}

async function requireAdmin(request, response, next) {
  if (request.admin) {
    next()
    return
  }
  const token = readBearerToken(request)
  if (!token) {
    response.status(401).json({ error: 'Admin sign-in is required.' })
    return
  }

  let payload
  try {
    payload = jwt.verify(token, jwtSecret)
  } catch {
    response.status(401).json({ error: 'Admin session is invalid or expired.' })
    return
  }
  if (payload.type !== 'admin') {
    response.status(401).json({ error: 'Admin session is invalid.' })
    return
  }
  const admin = await database.prepare(`
    SELECT a.id, a.name, a.email, a.profile_picture, a.role,
      a.store_id AS "storeId", s.name AS "storeName"
    FROM admins a LEFT JOIN stores s ON s.id = a.store_id WHERE a.id = ?
  `).get(payload.sub)
  if (!admin) {
    response.status(401).json({ error: 'Admin session is no longer valid.' })
    return
  }
  if (admin.role !== 'owner' && (!Number.isSafeInteger(admin.storeId) || !admin.storeName)) {
    response.status(403).json({ error: 'This store admin account is not assigned to an active store.' })
    return
  }

  request.admin = admin
  next()
}

async function requireCustomer(request, response, next) {
  const token = readBearerToken(request)
  if (!token) {
    response.status(401).json({ error: 'Customer sign-in is required.' })
    return
  }
  let payload
  try {
    payload = jwt.verify(token, jwtSecret)
  } catch {
    response.status(401).json({ error: 'Customer session is invalid or expired.' })
    return
  }
  if (payload.type !== 'customer') {
    response.status(401).json({ error: 'Customer session is invalid.' })
    return
  }
  const customer = await database.prepare(`
    SELECT id, name, email, profile_picture AS "profilePicture", phone,
      delivery_city AS "deliveryCity", delivery_residence AS "deliveryResidence",
      loyalty_points AS "loyaltyPoints", is_banned AS "isBanned"
    FROM customers WHERE id = ?
  `).get(payload.sub)
  if (!customer || customer.isBanned) {
    response.status(401).json({ error: 'Customer session is no longer valid.' })
    return
  }
  request.customer = customer
  next()
}

async function findOrderMenuItem(id) {
  const existingItem = findMenuItem(id)
  if (existingItem) return existingItem
  const customItemMatch = /^menu:custom:(\d+)$/.exec(id)
  return customItemMatch ? await findCustomMenuItem(Number(customItemMatch[1])) : null
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

async function listOrders({ deliveredOnly = false, storeId = null } = {}) {
  const conditions = [deliveredOnly ? "status = 'delivered'" : "status != 'delivered'"]
  const parameters = []
  if (storeId !== null) {
    conditions.push("store_id = ?")
    parameters.push(storeId)
  }
  const orders = await database.prepare(`
    SELECT id, customer_name AS "customerName", customer_email AS "customerEmail",
      customer_phone AS "customerPhone",
      delivery_city AS "deliveryCity", delivery_residence AS "deliveryResidence",
      store_id AS "storeId", store_name AS "storeName",
      store_address AS "storeAddress", store_phone AS "storePhone",
      subtotal_cents AS "subtotalCents", discount_cents AS "discountCents",
      total_cents AS "totalCents", currency, status, created_at AS "createdAt",
      delivered_at AS "deliveredAt", fulfillment_status AS "fulfillmentStatus",
      delivery_stage AS "deliveryStage", fulfillment_type AS "fulfillmentType",
      scheduled_for AS "scheduledFor", delivery_fee AS "deliveryFee",
      loyalty_points_redeemed AS "loyaltyPointsRedeemed",
      discount_code AS "discountCode"
    FROM orders
    WHERE ${conditions.join(" AND ")}
    ORDER BY id DESC
    LIMIT 500
  `).all(...parameters)
  if (orders.length === 0) return []

  const placeholders = orders.map(() => '?').join(', ')
  const items = await database.prepare(`
    SELECT order_id AS "orderId", flavor_id AS "flavorId", menu_item_id AS "menuItemId",
      flavor_name AS "flavorName", unit_price_cents AS "unitPriceCents", quantity,
      line_total_cents AS "lineTotalCents"
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

app.get('/api/menu', async (_request, response) => {
  const [inventoryRows, customItems, menuCategories] = await Promise.all([
    listMenuInventory(),
    listCustomMenuItems(),
    listMenuCategories(),
  ])
  const inventory = new Map(inventoryRows.map((entry) => [entry.itemId, entry]))
  const categories = menuCategories.map((category) => {
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

app.get('/api/fulfillment/options', async (_request, response) => {
  const zones = (await database.prepare(`
    SELECT z.id, z.location, z.pickup_enabled AS "pickupEnabled",
      z.delivery_enabled AS "deliveryEnabled", z.delivery_fee AS "deliveryFee",
      s.id AS "storeId", s.name AS "storeName", s.town AS "storeTown",
      s.area AS "storeArea", s.address AS "storeAddress", s.phone AS "storePhone",
      s.map_query AS "storeMapQuery"
    FROM fulfillment_zones z
    JOIN stores s ON s.fulfillment_zone_id = z.id
    WHERE z.is_active = 1 ORDER BY z.location
  `).all()).map((zone) => ({
    ...zone,
    pickupEnabled: Boolean(zone.pickupEnabled),
    deliveryEnabled: Boolean(zone.deliveryEnabled),
  }))
  const slots = await database.prepare(`
    SELECT id, label, start_time AS "startTime", end_time AS "endTime"
    FROM fulfillment_slots WHERE is_active = 1 ORDER BY sort_order, id
  `).all()
  response.json({ zones, slots })
})

app.get('/api/promotions/active', async (_request, response) => {
  const promotion = await database.prepare(`
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

app.post('/api/discount-codes/validate', async (request, response) => {
  const codeText = typeof request.body.code === 'string' ? request.body.code.trim() : ''
  const subtotal = Number(request.body.subtotal)
  if (!codeText || !Number.isSafeInteger(subtotal) || subtotal < 0) {
    response.status(400).json({ error: 'Enter a discount code and a valid order subtotal.' })
    return
  }
  const code = await getValidDiscountCode(codeText, subtotal)
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
    ? await database.prepare(`
      SELECT s.id, s.name, s.address, s.phone, z.id AS "zoneId",
        z.pickup_enabled AS "pickupEnabled", z.delivery_enabled AS "deliveryEnabled",
        z.delivery_fee AS "deliveryFee"
      FROM stores s JOIN fulfillment_zones z ON z.id = s.fulfillment_zone_id
      WHERE s.id = ? AND z.location = ? COLLATE NOCASE AND z.is_active = 1
    `).get(storeId, city)
    : null
  const zone = store
  const slot = await database.prepare(`
    SELECT id, start_time AS "startTime"
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
    const menuItem = typeof id === 'string' ? await findOrderMenuItem(id) : null
    const flavor = typeof id === 'number' ? await findFlavor(id) : null
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
    discountCode = await getValidDiscountCode(discountCodeText, subtotalCents)
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
    orderId = await createCheckoutOrder({
      customer,
      name,
      email,
      phone,
      city,
      store,
      residence,
      fulfillmentType,
      scheduledFor,
      deliveryFee,
      orderItems,
      subtotalCents,
      discountCents,
      totalCents,
      currency,
      discountCode,
      pointsRedeemed,
    })

    const frontendUrl = new URL(process.env.FRONTEND_URL || frontendOrigins[0])
    if (!['http:', 'https:'].includes(frontendUrl.protocol)) {
      throw new Error('FRONTEND_URL must use HTTP or HTTPS.')
    }
    if (totalCents === 0) {
      await finalizeZeroAmountCheckout(orderId, orderItems)
      const receiptOrder = await database.prepare(`
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
    await createPaymentRecord({
      orderId,
      stripeCheckoutSessionId: session.id,
      amountCents: totalCents,
      currency,
    })
    const admins = await database.prepare(`
      SELECT email FROM admins WHERE role = 'owner' OR store_id = ? ORDER BY id
    `).all(store.id)
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
      await rollbackCheckoutOrder(orderId)
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
    await recordPaidCheckout(session)
    const orderId = Number(session.metadata?.orderId)
    const order = await database.prepare(`
      SELECT id, customer_name AS "customerName", customer_email AS "customerEmail",
        total_cents AS "totalCents", currency, status, created_at AS "createdAt",
        delivery_city AS "deliveryCity", store_name AS "storeName",
        store_address AS "storeAddress", store_phone AS "storePhone",
        delivery_stage AS "deliveryStage", fulfillment_type AS "fulfillmentType",
        scheduled_for AS "scheduledFor", delivery_fee AS "deliveryFee",
        loyalty_points_redeemed AS "loyaltyPointsRedeemed"
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

app.get('/api/flavors', async (_request, response, next) => {
  try {
    response.json({ flavors: await listFlavors() })
  } catch (error) {
    next(error)
  }
})

app.get('/api/flavors/:id', async (request, response, next) => {
  try {
    const flavor = await findFlavor(Number(request.params.id))
    if (!flavor) {
      response.status(404).json({ error: 'Flavor not found.' })
      return
    }
    response.json({ flavor })
  } catch (error) {
    next(error)
  }
})

app.post('/api/contact', contactLimiter, async (request, response, next) => {
  try {
    const name = typeof request.body.name === 'string' ? request.body.name.trim() : ''
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
    const phone = typeof request.body.phone === 'string' ? request.body.phone.trim() : ''
    const subject = typeof request.body.subject === 'string' ? request.body.subject.trim() : ''
    const message = typeof request.body.message === 'string' ? request.body.message.trim() : ''
    const storeId = Number(request.body.storeId)
    if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
      || phone.length > 40 || !subject || subject.length > 150 || !message || message.length > 5000
      || !Number.isSafeInteger(storeId) || storeId < 1) {
      response.status(400).json({ error: 'Provide a name, valid email, subject, message, and store. Please check the field lengths.' })
      return
    }
    const store = await database.prepare(`
      SELECT s.id FROM stores s
      JOIN fulfillment_zones z ON z.id = s.fulfillment_zone_id
      WHERE s.id = ? AND z.is_active = 1
        AND (z.pickup_enabled = 1 OR z.delivery_enabled = 1)
    `).get(storeId)
    if (!store) {
      response.status(400).json({ error: 'Choose an active store for your message.' })
      return
    }

    const { messageId } = await createContactMessage({ name, email, phone, subject, message, storeId })
    response.status(201).json({ messageId })
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
    const customer = await registerCustomer({
      name,
      email,
      passwordHash,
      profilePicture,
    })
    const token = jwt.sign({ sub: customer.id, type: 'customer' }, jwtSecret, { expiresIn: '8h' })
    response.status(201).json({
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone || '',
        deliveryCity: customer.deliveryCity || '',
        deliveryResidence: customer.deliveryResidence || '',
        profilePicture: customer.profilePicture || '',
      },
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
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
    const customer = await database.prepare('SELECT * FROM customers WHERE email = ? COLLATE NOCASE').get(email)
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

app.get('/api/auth/me', async (request, response) => {
  const token = readBearerToken(request)
  if (!token) {
    response.status(401).json({ error: 'Sign-in is required.' })
    return
  }
  let payload
  try {
    payload = jwt.verify(token, jwtSecret)
  } catch {
    response.status(401).json({ error: 'Customer session is invalid or expired.' })
    return
  }
  if (payload.type !== 'customer') {
    response.status(401).json({ error: 'Customer session is invalid.' })
    return
  }
  const customer = await database.prepare(`
    SELECT id, name, email, profile_picture AS "profilePicture", phone,
      delivery_city AS "deliveryCity", delivery_residence AS "deliveryResidence",
      loyalty_points AS "loyaltyPoints", is_banned AS "isBanned"
    FROM customers WHERE id = ?
  `).get(payload.sub)
  if (!customer || customer.isBanned) {
    response.status(401).json({ error: 'Customer session is no longer valid.' })
    return
  }
  response.json({ customer })
})

app.put('/api/auth/profile', requireCustomer, async (request, response) => {
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
  const customer = await updateCustomerProfile({
    customerId: request.customer.id,
    name,
    phone,
    deliveryCity,
    deliveryResidence,
    profilePicture: resolvedProfilePicture,
  })
  if (!customer) {
    response.status(404).json({ error: 'Customer account not found.' })
    return
  }
  response.json({
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone || '',
      deliveryCity: customer.deliveryCity || '',
      deliveryResidence: customer.deliveryResidence || '',
      profilePicture: customer.profilePicture || '',
      loyaltyPoints: customer.loyaltyPoints,
      isBanned: Boolean(customer.isBanned),
    },
  })
})

app.get('/api/customer/orders', requireCustomer, async (request, response) => {
  const orders = await database.prepare(`
    SELECT id, subtotal_cents AS "subtotalCents", discount_cents AS "discountCents",
      total_cents AS "totalCents", currency, discount_code AS "discountCode", status,
      fulfillment_status AS "fulfillmentStatus", created_at AS "createdAt",
      delivered_at AS "deliveredAt", delivery_city AS "deliveryCity",
      delivery_residence AS "deliveryResidence",
      store_id AS "storeId", store_name AS "storeName",
      store_address AS "storeAddress", store_phone AS "storePhone",
      fulfillment_type AS "fulfillmentType", scheduled_for AS "scheduledFor",
      delivery_fee AS "deliveryFee", delivery_stage AS "deliveryStage",
      loyalty_points_redeemed AS "loyaltyPointsRedeemed"
    FROM orders WHERE customer_id = ? ORDER BY id DESC LIMIT 100
  `).all(request.customer.id)
  if (!orders.length) {
    response.json({ orders: [] })
    return
  }
  const placeholders = orders.map(() => '?').join(', ')
  const items = await database.prepare(`
    SELECT order_id AS "orderId", flavor_id AS "flavorId", menu_item_id AS "menuItemId",
      flavor_name AS name, unit_price_cents AS "unitPriceCents", quantity,
      line_total_cents AS "lineTotalCents"
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

app.get('/api/customer/orders/:id', requireCustomer, async (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Order ID is invalid.' })
    return
  }
  const order = await database.prepare(`
    SELECT id, customer_name AS "customerName", customer_email AS "customerEmail",
      subtotal_cents AS "subtotalCents", discount_cents AS "discountCents",
      total_cents AS "totalCents", currency, status, created_at AS "createdAt",
      delivery_city AS "deliveryCity", store_name AS "storeName",
      store_address AS "storeAddress", store_phone AS "storePhone",
      delivery_stage AS "deliveryStage", fulfillment_type AS "fulfillmentType",
      scheduled_for AS "scheduledFor", delivery_fee AS "deliveryFee"
    FROM orders WHERE id = ? AND customer_id = ? AND loyalty_points_redeemed > 0
  `).get(id, request.customer.id)
  if (!order || order.status !== 'processing') {
    response.status(404).json({ error: 'Paid loyalty order not found.' })
    return
  }
  const items = await database.prepare(`
    SELECT flavor_id AS "flavorId", menu_item_id AS "menuItemId",
      flavor_name AS name, unit_price_cents AS "unitPriceCents", quantity,
      line_total_cents AS "lineTotalCents"
    FROM order_items WHERE order_id = ? ORDER BY id
  `).all(id)
  response.json({ order: { ...order, items } })
})

app.get('/api/customer/loyalty', requireCustomer, async (request, response) => {
  const entries = await database.prepare(`
    SELECT id, order_id AS "orderId", points_delta AS "pointsDelta",
      entry_type AS "entryType", created_at AS "createdAt"
    FROM loyalty_ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 100
  `).all(request.customer.id)
  response.json({ points: request.customer.loyaltyPoints, entries })
})

async function resolveFavoriteItem(itemId) {
  if (typeof itemId !== 'string') return null
  const flavorMatch = /^flavor:(\d+)$/.exec(itemId)
  if (flavorMatch) {
    const flavor = await findFlavor(Number(flavorMatch[1]))
    return flavor ? { ...flavor, itemId, itemType: 'flavor' } : null
  }
  const menuItem = await findOrderMenuItem(itemId)
  return menuItem ? { ...menuItem, itemId, itemType: 'menu' } : null
}

app.get('/api/reviews', async (_request, response) => {
  const reviews = await database.prepare(`
    SELECT r.rating, r.review, r.created_at AS createdAt,
      c.name AS customerName, c.profile_picture AS profilePicture,
      r.item_id AS itemId
    FROM menu_reviews r JOIN customers c ON c.id = r.customer_id
    WHERE r.is_approved = 1
    ORDER BY r.id DESC LIMIT 50
  `).all()
  const reviewsWithItems = await Promise.all(reviews.map(async (review) => ({
    ...review,
    itemName: (await resolveFavoriteItem(review.itemId))?.name || review.itemId,
  })))
  response.json({ reviews: reviewsWithItems })
})

app.get('/api/customer/favorites', requireCustomer, async (request, response) => {
  const favorites = await database.prepare(`
    SELECT item_id AS "itemId", created_at AS "createdAt" FROM customer_favorites
    WHERE customer_id = ? ORDER BY created_at DESC
  `).all(request.customer.id)
  const resolvedFavorites = await Promise.all(favorites.map(async (favorite) => {
    const item = await resolveFavoriteItem(favorite.itemId)
    return item ? { ...favorite, item } : null
  }))
  response.json({ favorites: resolvedFavorites.filter(Boolean) })
})

app.post('/api/customer/favorites', requireCustomer, async (request, response) => {
  const itemId = typeof request.body.itemId === 'string' ? request.body.itemId : ''
  if (!await resolveFavoriteItem(itemId)) {
    response.status(400).json({ error: 'Choose a current menu or shop item to save.' })
    return
  }
  await addCustomerFavorite(request.customer.id, itemId)
  response.status(201).json({ itemId })
})

app.delete('/api/customer/favorites/:itemId', requireCustomer, async (request, response) => {
  const removed = await removeCustomerFavorite(request.customer.id, request.params.itemId)
  if (!removed) {
    response.status(404).json({ error: 'Saved favorite not found.' })
    return
  }
  response.status(204).end()
})

app.get('/api/customer/saved-carts', requireCustomer, async (request, response) => {
  const savedCarts = (await database.prepare(`
    SELECT id, source_order_id AS "sourceOrderId", label,
      items_json AS "itemsJson", created_at AS "createdAt"
    FROM customer_saved_carts WHERE customer_id = ?
    ORDER BY id DESC
  `).all(request.customer.id)).map(({ itemsJson, ...savedCart }) => ({
    ...savedCart,
    items: JSON.parse(itemsJson),
  }))
  response.json({ savedCarts })
})

app.post('/api/customer/saved-carts', requireCustomer, async (request, response) => {
  const orderId = Number(request.body.orderId)
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    response.status(400).json({ error: 'Choose a valid order to save.' })
    return
  }
  const order = await database.prepare(`
    SELECT id, status FROM orders
    WHERE id = ? AND customer_id = ?
  `).get(orderId, request.customer.id)
  if (!order || !['processing', 'delivered'].includes(order.status)) {
    response.status(404).json({ error: 'A paid order belonging to your account was not found.' })
    return
  }
  const orderItems = await database.prepare(`
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

  const savedCart = await saveCustomerCart({
    customerId: request.customer.id,
    orderId,
    label: `Order #${orderId}`,
    items,
  })
  if (!savedCart) {
    response.status(409).json({ error: 'This order is already saved to your cart list.' })
    return
  }
  response.status(201).json({ savedCart })
})

app.delete('/api/customer/saved-carts/:id', requireCustomer, async (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Saved cart ID is invalid.' })
    return
  }
  const removed = await deleteSavedCart({ customerId: request.customer.id, id })
  if (!removed) {
    response.status(404).json({ error: 'Saved cart not found.' })
    return
  }
  response.status(204).end()
})

app.get('/api/menu/:itemId/reviews', async (request, response) => {
  const itemId = request.params.itemId
  if (!await resolveFavoriteItem(itemId)) {
    response.status(404).json({ error: 'Menu item not found.' })
    return
  }
  const summary = await database.prepare(`
    SELECT COUNT(*) AS reviewCount, ROUND(AVG(rating), 1) AS averageRating
    FROM menu_reviews WHERE item_id = ? AND is_approved = 1
  `).get(itemId)
  const reviews = await database.prepare(`
    SELECT r.rating, r.review, r.created_at AS createdAt,
      c.name AS customerName, c.profile_picture AS profilePicture
    FROM menu_reviews r JOIN customers c ON c.id = r.customer_id
    WHERE r.item_id = ? AND r.is_approved = 1 ORDER BY r.id DESC LIMIT 50
  `).all(itemId)
  response.json({ ...summary, reviews })
})

app.post('/api/customer/reviews', requireCustomer, async (request, response) => {
  const orderId = Number(request.body.orderId)
  const itemId = typeof request.body.itemId === 'string' ? request.body.itemId : ''
  const rating = Number(request.body.rating)
  const review = typeof request.body.review === 'string' ? request.body.review.trim() : ''
  const flavorIdMatch = /^flavor:(\d+)$/.exec(itemId)
  const flavorId = flavorIdMatch ? Number(flavorIdMatch[1]) : 0
  if (!Number.isSafeInteger(orderId) || orderId < 1 || !await resolveFavoriteItem(itemId)
    || !Number.isSafeInteger(rating) || rating < 1 || rating > 5 || review.length > 1000) {
    response.status(400).json({ error: 'Provide a purchased item, a 1–5 star rating, and a review under 1,000 characters.' })
    return
  }
  const purchase = await database.prepare(`
    SELECT o.id FROM orders o JOIN order_items i ON i.order_id = o.id
    WHERE o.id = ? AND o.customer_id = ? AND o.status IN ('processing', 'delivered')
      AND (i.menu_item_id = ? OR (? LIKE 'flavor:%' AND i.flavor_id = ?))
  `).get(orderId, request.customer.id, itemId, itemId, flavorId)
  if (!purchase) {
    response.status(403).json({ error: 'Only customers who purchased an item can review it.' })
    return
  }
  try {
    const result = await createMenuReview({
      customerId: request.customer.id,
      orderId,
      itemId,
      rating,
      review,
    })
    response.status(201).json(result)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
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
  const storeId = Number(body.storeId)
  const allowedSizes = new Set(['Small', 'Medium', 'Large'])
  const allowedToppings = new Set(['Sprinkles', 'Chocolate chips', 'Fresh fruit', 'Cookie pieces', 'Whipped cream'])
  const pickupTimestamp = /^\d{4}-\d{2}-\d{2}$/.test(pickupDate) ? Date.parse(`${pickupDate}T23:59:59+01:00`) : NaN
  if (!customerName || customerName.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
    || customerEmail.length > 254 || !customerPhone || customerPhone.length > 40
    || !allowedSizes.has(size) || !flavor || flavor.length > 80 || message.length > 200
    || toppings.length > allowedToppings.size || toppings.some((value) => !allowedToppings.has(value))
    || !Number.isSafeInteger(storeId) || storeId < 1
    || !Number.isFinite(pickupTimestamp) || pickupTimestamp < Date.now()
    || pickupTimestamp > Date.now() + 90 * 24 * 60 * 60 * 1000) {
    response.status(400).json({ error: 'Provide valid contact details and cake options with a pickup date within the next 90 days.' })
    return
  }
  const store = await database.prepare(`
    SELECT s.id, s.name FROM stores s
    JOIN fulfillment_zones z ON z.id = s.fulfillment_zone_id
    WHERE s.id = ? AND z.is_active = 1 AND z.pickup_enabled = 1
  `).get(storeId)
  if (!store) {
    response.status(400).json({ error: 'Choose an active store that accepts pickup requests.' })
    return
  }
  let customerId = null
  const token = readBearerToken(request)
  if (token) {
    try {
      const payload = jwt.verify(token, jwtSecret)
      if (payload.type !== 'customer') throw new Error('Customer session is invalid.')
      const customer = await database.prepare(`
        SELECT id FROM customers WHERE id = ?
      `).get(payload.sub)
      if (!customer) throw new Error('Customer session is no longer valid.')
      customerId = customer.id
    } catch {
      response.status(401).json({ error: 'Sign in again or submit the request without an expired account session.' })
      return
    }
  }
  const { id: requestId } = await createCakeRequest({
    customerId,
    storeId,
    customerName,
    customerEmail,
    customerPhone,
    size,
    flavor,
    message,
    toppings,
    pickupDate,
  })
  const admins = await database.prepare(`
    SELECT email FROM admins WHERE role = 'owner' OR store_id = ? ORDER BY id
  `).all(store.id)
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

app.use('/api/admin', async (request, response, next) => {
  if (request.path === '/login') {
    next()
    return
  }
  const token = readBearerToken(request)
  if (!token) {
    response.status(401).json({ error: 'Admin sign-in is required.' })
    return
  }
  let payload
  try {
    payload = jwt.verify(token, jwtSecret)
  } catch {
    response.status(401).json({ error: 'Admin session is invalid or expired.' })
    return
  }
  if (payload.type !== 'admin') {
    response.status(401).json({ error: 'Admin session is invalid.' })
    return
  }
  try {
    const admin = await database.prepare(`
      SELECT a.id, a.name, a.email, a.profile_picture, a.role,
        a.store_id AS "storeId", s.name AS "storeName"
      FROM admins a LEFT JOIN stores s ON s.id = a.store_id WHERE a.id = ?
    `).get(payload.sub)
    if (!admin) {
      response.status(401).json({ error: 'Admin session is no longer valid.' })
      return
    }
    if (admin.role !== 'owner' && (!Number.isSafeInteger(admin.storeId) || !admin.storeName)) {
      response.status(403).json({ error: 'This store admin account is not assigned to an active store.' })
      return
    }
    request.admin = admin
    if (admin.role !== 'owner' && !storeAdminCanAccess(request.method, request.path)) {
      response.status(403).json({
        error: `Store-admin access denied for ${request.method} ${request.path}.`,
      })
      return
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.on('finish', async () => {
        if (response.statusCode < 200 || response.statusCode >= 300) return
        try {
          await createAdminActivity({
            adminId: admin.id,
            adminName: admin.name,
            action: `${request.method} ${request.path}`,
            method: request.method,
            path: request.path,
          })
        } catch (error) {
          console.error('Unable to save admin activity:', error.message)
        }
      })
    }
    next()
  } catch (error) {
    next(error)
  }
})

app.post('/api/admin/login', loginLimiter, async (request, response, next) => {
  try {
    const email = typeof request.body.email === 'string' ? request.body.email.trim() : ''
    const password = typeof request.body.password === 'string' ? request.body.password : ''
    const admin = await database.prepare('SELECT * FROM admins WHERE email = ? COLLATE NOCASE').get(email)
    if (!admin || !await verifyPassword(password, admin.password_hash)) {
      response.status(401).json({ error: 'The admin email or password is incorrect.' })
      return
    }

    const token = jwt.sign({ sub: admin.id, type: 'admin' }, jwtSecret, { expiresIn: '8h' })
    const identity = await database.prepare(`
      SELECT a.id, a.name, a.email, a.profile_picture AS "profilePicture", a.role,
        a.store_id AS "storeId", s.name AS "storeName"
      FROM admins a LEFT JOIN stores s ON s.id = a.store_id WHERE a.id = ?
    `).get(admin.id)
    response.json({
      token,
      admin: identity,
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
      role: request.admin.role,
      storeId: request.admin.storeId,
      storeName: request.admin.storeName,
    },
  })
})

app.put('/api/admin/profile-picture', requireAdmin, async (request, response) => {
  const profilePicture = typeof request.body.profilePicture === 'string'
    ? request.body.profilePicture.trim()
    : ''
  if (!profilePicture.startsWith('data:image/') || profilePicture.length > 1024 * 1024) {
    response.status(400).json({ error: 'Provide a valid profile image smaller than 1 MB.' })
    return
  }

  const admin = await updateAdminProfilePicture(request.admin.id, profilePicture)
  response.json({ admin })
})

app.get('/api/admin/admins', requireAdmin, async (request, response) => {
  if (!requireOwner(request, response)) return
  const admins = await database.prepare(`
    SELECT a.id, a.name, a.email, a.role, a.store_id AS "storeId",
      s.name AS "storeName", a.profile_picture AS "profilePicture", a.created_at AS "createdAt"
    FROM admins a LEFT JOIN stores s ON s.id = a.store_id ORDER BY a.id
  `).all()
  response.json({ admins })
})

app.delete('/api/admin/admins/:id', requireAdmin, async (request, response) => {
  if (!requireOwner(request, response)) return
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Admin ID is invalid.' })
    return
  }
  if (id === request.admin.id) {
    response.status(409).json({ error: 'You cannot remove your own admin account.' })
    return
  }

  const result = await database.prepare(`
    DELETE FROM admins WHERE id = ? AND role = 'store_admin'
  `).run(id)
  if (!result.changes) {
    const admin = await database.prepare('SELECT role FROM admins WHERE id = ?').get(id)
    if (!admin) {
      response.status(404).json({ error: 'Admin account not found.' })
      return
    }
    response.status(409).json({ error: 'Owner accounts cannot be removed here.' })
    return
  }
  response.json({ deleted: true })
})

app.get('/api/admin/customers', requireAdmin, async (_request, response) => {
  const admin = _request.admin
  const storeFilter = admin.role === 'owner' ? '' : 'JOIN orders o ON o.customer_id = c.id WHERE o.store_id = ?'
  const parameters = admin.role === 'owner' ? [] : [admin.storeId]
  const customers = (await database.prepare(`
    SELECT DISTINCT c.id, c.name, c.email, c.phone, c.delivery_city AS "deliveryCity",
      c.created_at AS "createdAt", c.is_banned AS "isBanned"
    FROM customers c ${storeFilter} ORDER BY c.id DESC
  `).all(...parameters)).map((customer) => ({ ...customer, isBanned: Boolean(customer.isBanned) }))
  response.json({ customers })
})

app.patch('/api/admin/customers/:id/ban', requireAdmin, async (request, response) => {
  const id = Number(request.params.id)
  const isBanned = request.body.isBanned
  if (!Number.isSafeInteger(id) || id < 1 || typeof isBanned !== 'boolean') {
    response.status(400).json({ error: 'Provide a valid customer and ban status.' })
    return
  }
  const result = await setCustomerBanStatus(id, isBanned)
  if (!result) {
    response.status(404).json({ error: 'Customer account not found.' })
    return
  }
  response.json({ id, isBanned })
})

app.get('/api/admin/orders', requireAdmin, async (request, response) => {
  const deliveredOnly = request.query.status === 'delivered'
  if (request.query.status && !deliveredOnly) {
    response.status(400).json({ error: 'The requested order status is not supported.' })
    return
  }
  const requestedStoreId = request.query.storeId
  let storeId = requestedStoreId === undefined
    ? null
    : typeof requestedStoreId === 'string' ? Number(requestedStoreId) : NaN
  if (request.admin.role !== 'owner') storeId = request.admin.storeId
  const storeExists = storeId === null
    ? true
    : Number.isSafeInteger(storeId) && storeId > 0
      && Boolean(await database.prepare('SELECT 1 FROM stores WHERE id = ?').get(storeId))
  if (!storeExists) {
    response.status(400).json({ error: 'Choose a valid store to filter orders.' })
    return
  }
  const orders = await listOrders({ deliveredOnly, storeId })
  const count = deliveredOnly
    ? (await database.prepare(`
      SELECT COUNT(*) AS count FROM orders
      WHERE status = 'delivered' ${storeId === null ? '' : 'AND store_id = ?'}
    `).get(...(storeId === null ? [] : [storeId]))).count
    : undefined
  response.json({ orders, ...(deliveredOnly ? { count } : {}) })
})

app.get('/api/admin/stores', requireAdmin, async (request, response) => {
  const storeFilter = request.admin.role === 'owner' ? '' : 'WHERE s.id = ?'
  const stores = (await database.prepare(`
    SELECT s.id, s.name, s.town, s.area, s.address,
      z.location, z.is_active AS "isActive"
    FROM stores s JOIN fulfillment_zones z ON z.id = s.fulfillment_zone_id
    ${storeFilter}
    ORDER BY s.town, s.area
  `).all(...(request.admin.role === 'owner' ? [] : [request.admin.storeId]))).map((store) => ({ ...store, isActive: Boolean(store.isActive) }))
  response.json({ stores })
})

app.delete('/api/admin/orders/delivered', requireAdmin, async (request, response) => {
  const requestedStoreId = request.query.storeId
  const storeId = request.admin.role === 'owner'
    ? requestedStoreId === undefined
      ? null
      : typeof requestedStoreId === 'string' ? Number(requestedStoreId) : NaN
    : request.admin.storeId
  if (
    storeId !== null
    && (!Number.isSafeInteger(storeId) || storeId < 1
      || !await database.prepare('SELECT 1 FROM stores WHERE id = ?').get(storeId))
  ) {
    response.status(400).json({ error: 'Choose a valid store to clear delivered orders.' })
    return
  }
  const result = await clearDeliveredOrders(storeId)

  if (!result.deleted) {
    response.status(409).json({
      error: 'More than three delivered orders are required before clearing them.',
      count: result.count,
    })
    return
  }
  response.json({ deleted: true, count: result.count })
})

app.delete('/api/admin/orders/:id/stale-payment', requireAdmin, async (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Order ID is invalid.' })
    return
  }

  const order = await database.prepare(`
    SELECT o.status, o.created_at AS "createdAt", o.store_id AS "storeId",
      p.status AS "paymentStatus", p.stripe_checkout_session_id AS "sessionId"
    FROM orders o LEFT JOIN payments p ON p.order_id = o.id
    WHERE o.id = ?
  `).get(id)
  if (!order || (request.admin.role !== 'owner' && order.storeId !== request.admin.storeId)) {
    response.status(404).json({ error: 'Order not found.' })
    return
  }
  const createdAt = order.createdAt instanceof Date
    ? order.createdAt.getTime()
    : Date.parse(String(order.createdAt).replace(' ', 'T').replace(/(?<!Z)(?<![+-]\\d{2}:?\\d{2})$/, 'Z'))
  if (
    order.status !== 'pending_payment'
    || order.paymentStatus !== 'pending'
    || !order.sessionId
    || !Number.isFinite(createdAt)
    || Date.now() - createdAt < 3 * 60 * 1000
  ) {
    response.status(409).json({ error: 'Only unpaid orders waiting for at least three minutes can be deleted.' })
    return
  }

  const stripe = getStripe()
  if (!stripe) {
    response.status(503).json({ error: 'Stripe is not configured; this order cannot be safely verified for deletion.' })
    return
  }

  let session
  try {
    session = await stripe.checkout.sessions.retrieve(order.sessionId)
    if (
      session.metadata?.orderId !== String(id)
      || session.payment_status === 'paid'
      || session.status === 'complete'
    ) {
      response.status(409).json({ error: 'This checkout is complete or paid and cannot be deleted.' })
      return
    }
    if (session.status === 'open') {
      session = await stripe.checkout.sessions.expire(order.sessionId)
    }
  } catch (error) {
    console.error(`Unable to verify Stripe checkout ${order.sessionId} before deleting order #${id}:`, error.message)
    response.status(502).json({ error: 'Unable to verify this payment with Stripe. The order was not deleted.' })
    return
  }

  if (session.status !== 'expired' || session.payment_status === 'paid') {
    response.status(409).json({ error: 'Stripe has not confirmed that this checkout is unpaid and expired.' })
    return
  }

  const paymentFailed = await markStripeCheckoutPaymentFailed(id, session.id)
  if (!paymentFailed) {
    response.status(409).json({ error: 'The payment status changed and the order was not deleted.' })
    return
  }
  const deleteResult = await deleteFailedOrder(id)
  if (deleteResult !== 'deleted') {
    response.status(409).json({ error: 'The expired order could not be deleted. Its payment reservation has been released.' })
    return
  }
  response.json({ deleted: true })
})

app.delete('/api/admin/orders/:id', requireAdmin, async (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Order ID is invalid.' })
    return
  }

  if (request.admin.role !== 'owner') {
    const order = await database.prepare('SELECT store_id AS "storeId" FROM orders WHERE id = ?').get(id)
    if (!order || order.storeId !== request.admin.storeId) {
      response.status(404).json({ error: 'Order not found.' })
      return
    }
  }
  const deleteResult = await deleteFailedOrder(id)
  if (deleteResult === 'not_found') {
    response.status(404).json({ error: 'Order not found.' })
    return
  }
  if (deleteResult === 'not_failed') {
    response.status(409).json({ error: 'Only failed, unpaid orders can be deleted.' })
    return
  }
  response.json({ deleted: true })
})

async function updateOrderFulfillment(id, fulfillmentStatus, response, admin) {
  if (admin.role !== 'owner') {
    const order = await database.prepare('SELECT store_id AS "storeId" FROM orders WHERE id = ?').get(id)
    if (!order || order.storeId !== admin.storeId) {
      response.status(404).json({ error: 'Order not found.' })
      return
    }
  }
  const result = await updateOrderFulfillmentStatus(id, fulfillmentStatus)
  if (!result.changed) {
    if (result.notFound) {
      response.status(404).json({ error: 'Order not found.' })
      return
    }
    response.status(409).json({ error: 'Only paid, undelivered orders can be updated.' })
    return
  }

  const order = await database.prepare(`
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
  response.json({ fulfillmentStatus: result.fulfillmentStatus, deliveryStage: result.deliveryStage })
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
  await updateOrderFulfillment(id, fulfillmentStatus, response, request.admin)
})

app.patch('/api/admin/orders/:id/delivered', requireAdmin, async (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Order ID is invalid.' })
    return
  }
  await updateOrderFulfillment(id, 'delivered', response, request.admin)
})

app.get('/api/admin/payments', requireAdmin, async (request, response) => {
  const storeFilter = request.admin.role === 'owner' ? '' : 'WHERE o.store_id = ?'
  const payments = await database.prepare(`
    SELECT p.id, p.order_id AS "orderId", p.stripe_payment_intent_id AS "paymentIntentId",
      p.amount_cents AS "amountCents", p.currency, p.status, p.created_at AS "createdAt",
      o.customer_name AS "customerName", o.customer_email AS "customerEmail"
    FROM payments p JOIN orders o ON o.id = p.order_id
    ${storeFilter}
    ORDER BY p.id DESC LIMIT 500
  `).all(...(request.admin.role === 'owner' ? [] : [request.admin.storeId]))
  response.json({ payments })
})

app.get('/api/admin/notifications', requireAdmin, async (_request, response) => {
  const isOwner = _request.admin.role === 'owner'
  const storeFilter = isOwner ? 'WHERE cm.store_id IS NULL' : 'WHERE cm.store_id = ?'
  const parameters = isOwner ? [] : [_request.admin.storeId]
  const messages = (await database.prepare(`
    SELECT cm.id, cm.name, cm.email, cm.phone, cm.subject, cm.message,
      cm.is_read AS "isRead", cm.created_at AS "createdAt",
      cm.replied_at AS "repliedAt", cm.store_id AS "storeId", s.name AS "storeName"
    FROM contact_messages cm LEFT JOIN stores s ON s.id = cm.store_id
    ${storeFilter} ORDER BY cm.id DESC LIMIT 100
  `).all(...parameters)).map((item) => ({ ...item, isRead: Boolean(item.isRead) }))
  response.json({
    messages,
    unreadCount: messages.filter((item) => !item.isRead).length,
  })
})

app.patch('/api/admin/notifications/:id/read', requireAdmin, async (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Notification ID is invalid.' })
    return
  }
  const isOwner = request.admin.role === 'owner'
  const storeId = isOwner ? null : request.admin.storeId
  const updated = await markContactMessageRead(id, storeId, isOwner)
  if (!updated) {
    response.status(404).json({ error: 'Notification not found.' })
    return
  }
  response.status(204).end()
})

app.delete('/api/admin/notifications', requireAdmin, async (request, response) => {
  const isOwner = request.admin.role === 'owner'
  const storeId = isOwner ? null : request.admin.storeId
  const deletedCount = await deleteContactMessages(storeId, isOwner)
  response.json({ deletedCount })
})

app.delete('/api/admin/notifications/:id', requireAdmin, async (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Notification ID is invalid.' })
    return
  }

  const isOwner = request.admin.role === 'owner'
  const storeId = isOwner ? null : request.admin.storeId
  const deleted = await deleteContactMessage(id, storeId, isOwner)
  if (!deleted) {
    const storeFilter = isOwner ? ' AND store_id IS NULL' : ' AND store_id = ?'
    const parameters = isOwner ? [id] : [id, storeId]
    const message = await database.prepare(`SELECT id FROM contact_messages WHERE id = ?${storeFilter}`).get(...parameters)
    if (!message) {
      response.status(404).json({ error: 'Notification not found.' })
      return
    }
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

  const isOwner = request.admin.role === 'owner'
  const storeId = isOwner ? null : request.admin.storeId
  const storeFilter = isOwner ? ' AND store_id IS NULL' : ' AND store_id = ?'
  const parameters = isOwner ? [id] : [id, storeId]
  const contact = await database.prepare(`
    SELECT id, name, email, subject FROM contact_messages WHERE id = ?${storeFilter}
  `).get(...parameters)
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
    const result = await markContactMessageReplied(id, storeId, isOwner)
    if (!result) {
      response.status(404).json({ error: 'Contact message not found.' })
      return
    }
    const { repliedAt } = result
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
  if (!requireOwner(request, response)) return
  try {
    const { name, email, password, profilePicture = '' } = request.body
    const storeId = Number(request.body.storeId)
    if (typeof name !== 'string' || !name.trim() || typeof email !== 'string'
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      || typeof password !== 'string' || password.length < 8 || password.length > 128
      || !Number.isSafeInteger(storeId) || storeId < 1
      || !await database.prepare('SELECT 1 FROM stores WHERE id = ?').get(storeId)) {
      response.status(400).json({ error: 'Provide a name, valid email, password of 8 to 128 characters, and a valid store.' })
      return
    }
    if (typeof profilePicture !== 'string' || (profilePicture
      && (!profilePicture.startsWith('data:image/') || profilePicture.length > 1024 * 1024))) {
      response.status(400).json({ error: 'Profile pictures must be image data smaller than 1 MB.' })
      return
    }
    const passwordHash = await bcrypt.hash(password, 12)
    const admin = await createAdminAccount({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      profilePicture,
      storeId,
    })
    response.status(201).json({ admin })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      response.status(409).json({ error: 'An admin account already uses that email address.' })
      return
    }
    next(error)
  }
})

app.post('/api/admin/logout', requireAdmin, (_request, response) => {
  response.status(204).end()
})

app.get('/api/admin/fulfillment-settings', requireAdmin, async (_request, response) => {
  const zones = (await database.prepare(`
    SELECT z.id, z.location, z.pickup_enabled AS pickupEnabled,
      z.delivery_enabled AS deliveryEnabled, z.delivery_fee AS deliveryFee,
      z.is_active AS "isActive", s.id AS "storeId", s.name AS "storeName",
      s.address AS "storeAddress", s.phone AS "storePhone"
    FROM fulfillment_zones z JOIN stores s ON s.fulfillment_zone_id = z.id
    ORDER BY z.location
  `).all()).map((zone) => ({
    ...zone,
    pickupEnabled: Boolean(zone.pickupEnabled),
    deliveryEnabled: Boolean(zone.deliveryEnabled),
    isActive: Boolean(zone.isActive),
  }))
  const slots = (await database.prepare(`
    SELECT id, label, start_time AS startTime, end_time AS endTime,
      is_active AS "isActive", sort_order AS "sortOrder"
    FROM fulfillment_slots ORDER BY sort_order, id
  `).all()).map((slot) => ({ ...slot, isActive: Boolean(slot.isActive) }))
  response.json({ zones, slots })
})

app.put('/api/admin/fulfillment-zones', requireAdmin, async (request, response) => {
  const zones = request.body.zones
  if (!Array.isArray(zones) || zones.length > 50) {
    response.status(400).json({ error: 'Provide a valid list of delivery zones.' })
    return
  }
  const validZones = new Map((await database.prepare('SELECT id, location FROM fulfillment_zones').all()).map((zone) => [zone.id, zone]))
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
  const updated = await updateFulfillmentZones(zones)
  response.json({ zones: updated })
})

app.put('/api/admin/fulfillment-slots', requireAdmin, async (request, response) => {
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
  const updated = await updateFulfillmentSlots(slots)
  response.json({ slots: updated })
})

app.get('/api/admin/activity', requireAdmin, async (_request, response) => {
  const activity = await database.prepare(`
    SELECT id, admin_name AS adminName, action, method, path, created_at AS createdAt
    FROM admin_activity ORDER BY id DESC LIMIT 200
  `).all()
  response.json({ activity })
})

app.get('/api/admin/cake-requests', requireAdmin, async (request, response) => {
  const storeFilter = request.admin.role === 'owner' ? '' : 'WHERE store_id = ?'
  const requests = await database.prepare(`
    SELECT id, customer_name AS customerName, customer_email AS customerEmail,
      customer_phone AS "customerPhone", size, flavor, message, toppings,
      pickup_date AS "pickupDate", status, store_id AS "storeId", created_at AS "createdAt"
    FROM cake_requests ${storeFilter} ORDER BY id DESC LIMIT 200
  `).all(...(request.admin.role === 'owner' ? [] : [request.admin.storeId]))
  response.json({ requests: requests.map((item) => ({ ...item, toppings: JSON.parse(item.toppings) })) })
})

app.patch('/api/admin/cake-requests/:id/status', requireAdmin, async (request, response) => {
  const id = Number(request.params.id)
  const status = request.body.status
  if (!Number.isSafeInteger(id) || id < 1
    || !['new', 'contacted', 'confirmed', 'declined'].includes(status)) {
    response.status(400).json({ error: 'Choose a valid cake request and status.' })
    return
  }
  if (request.admin.role !== 'owner') {
    const assigned = await database.prepare(
      'SELECT 1 FROM cake_requests WHERE id = ? AND store_id = ?',
    ).get(id, request.admin.storeId)
    if (!assigned) {
      response.status(404).json({ error: 'Custom cake request not found.' })
      return
    }
  }
  const result = await setCakeRequestStatus(id, status)
  if (!result) {
    response.status(404).json({ error: 'Custom cake request not found.' })
    return
  }
  response.json({ id, status })
})

app.get('/api/admin/reviews', requireAdmin, async (request, response) => {
  const storeJoin = request.admin.role === 'owner' ? '' : 'JOIN orders o ON o.id = r.order_id'
  const storeFilter = request.admin.role === 'owner' ? '' : 'AND o.store_id = ?'
  const storeParameters = request.admin.role === 'owner' ? [] : [request.admin.storeId]
  if (request.query.countOnly === 'true') {
    const { count } = await database.prepare(`
      SELECT COUNT(*) AS count FROM menu_reviews r ${storeJoin}
      WHERE r.is_approved = 0 ${storeFilter}
    `).get(...storeParameters)
    response.json({ pendingCount: count })
    return
  }
  const status = request.query.status === 'approved' ? 1 : 0
  const reviews = await database.prepare(`
    SELECT r.id, r.order_id AS "orderId", r.item_id AS "itemId", r.rating,
      r.review, r.is_approved AS "isApproved", r.created_at AS "createdAt",
      c.name AS "customerName", c.email AS "customerEmail"
    FROM menu_reviews r JOIN customers c ON c.id = r.customer_id ${storeJoin}
    WHERE r.is_approved = ? ${storeFilter} ORDER BY r.id DESC LIMIT 200
  `).all(status, ...storeParameters)
  const resolvedReviews = await Promise.all(reviews.map(async (review) => ({
    ...review,
    isApproved: Boolean(review.isApproved),
    itemName: (await resolveFavoriteItem(review.itemId))?.name || review.itemId,
  })))
  response.json({ reviews: resolvedReviews })
})

app.patch('/api/admin/reviews/:id/approval', requireAdmin, async (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1 || typeof request.body.isApproved !== 'boolean') {
    response.status(400).json({ error: 'Provide a valid review and approval status.' })
    return
  }
  if (request.admin.role !== 'owner') {
    const assigned = await database.prepare(`
      SELECT 1 FROM menu_reviews r JOIN orders o ON o.id = r.order_id
      WHERE r.id = ? AND o.store_id = ?
    `).get(id, request.admin.storeId)
    if (!assigned) {
      response.status(404).json({ error: 'Review not found.' })
      return
    }
  }
  const result = await setReviewApproval(id, request.body.isApproved)
  if (!result) {
    response.status(404).json({ error: 'Review not found.' })
    return
  }
  response.json({ id, isApproved: request.body.isApproved })
})

app.get('/api/admin/stock-alerts', requireAdmin, async (_request, response) => {
  const [inventoryRows, customItems] = await Promise.all([
    listMenuInventory(),
    listCustomMenuItems(),
  ])
  const inventory = new Map(inventoryRows.map((entry) => [entry.itemId, entry]))
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
  for (const item of customItems) {
    if (item.availableQuantity <= item.lowStockThreshold || !item.isAvailable) {
      items.push({ itemId: item.id, name: item.name, category: item.categoryTitle, ...item })
    }
  }
  response.json({ items })
})

app.post('/api/admin/flavors', requireAdmin, async (request, response, next) => {
  try {
    const flavor = normalizeFlavor(request.body)
    if (!flavor) {
      response.status(400).json({ error: 'Provide a name, descriptions, image, and a price greater than zero.' })
      return
    }
    response.status(201).json({ flavor: await saveFlavor(flavor) })
  } catch (error) {
    next(error)
  }
})

async function normalizeCustomMenuItem(body) {
  const categoryTitle = typeof body.categoryTitle === 'string' ? body.categoryTitle.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const detail = typeof body.detail === 'string' ? body.detail.trim() : ''
  const image = typeof body.image === 'string' ? body.image.trim() : ''
  const priceXaf = Number(body.priceXaf)
  const categoryExists = (await listMenuCategories()).some((category) => category.title === categoryTitle)
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

app.get('/api/admin/menu-categories', requireAdmin, async (_request, response) => {
  response.json({ categories: await listMenuCategories() })
})

async function normalizeMenuCategory(body, existing = null) {
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const image = typeof body.image === 'string' ? body.image.trim() : ''
  const icon = typeof body.icon === 'string' && body.icon.trim() ? body.icon.trim().slice(0, 12) : '🍦'
  const categories = await listMenuCategories()
  const sortOrder = Number(body.sortOrder ?? existing?.sortOrder ?? categories.length)
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

app.post('/api/admin/menu-categories', requireAdmin, async (request, response, next) => {
  const category = await normalizeMenuCategory(request.body)
  if (!category) {
    response.status(400).json({ error: 'Provide a category name, valid image path, and non-negative order.' })
    return
  }
  try {
    response.status(201).json({ category: await saveMenuCategory(category) })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      response.status(409).json({ error: 'A category with that name already exists.' })
      return
    }
    next(error)
  }
})

app.put('/api/admin/menu-categories/:id', requireAdmin, async (request, response, next) => {
  const id = Number(request.params.id)
  const existing = (await listMenuCategories()).find((category) => category.id === id)
  if (!existing) {
    response.status(404).json({ error: 'Menu category not found.' })
    return
  }
  const category = await normalizeMenuCategory(request.body, existing)
  if (!category) {
    response.status(400).json({ error: 'Provide a category name, valid image path, and non-negative order.' })
    return
  }
  try {
    response.json({ category: await saveMenuCategory(category) })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      response.status(409).json({ error: 'A category with that name already exists.' })
      return
    }
    next(error)
  }
})

app.delete('/api/admin/menu-categories/:id', requireAdmin, async (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Menu category ID is invalid.' })
    return
  }
  const result = await deleteMenuCategory(id)
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

app.put('/api/admin/menu-inventory', requireAdmin, async (request, response) => {
  const itemId = typeof request.body.itemId === 'string' ? request.body.itemId : ''
  const stock = Number(request.body.stock)
  const lowStockThreshold = Number(request.body.lowStockThreshold)
  const isAvailable = request.body.isAvailable !== false
  const allowedDietaryTags = new Set(['vegetarian', 'vegan', 'dairy-free', 'gluten-free', 'nut-free'])
  const dietaryTags = Array.isArray(request.body.dietaryTags)
    ? [...new Set(request.body.dietaryTags)]
    : []
  const row = await database.prepare('SELECT reserved_stock AS reservedStock FROM menu_inventory WHERE item_id = ?').get(itemId)
  if (!row || !Number.isSafeInteger(stock) || stock < row.reservedStock
    || !Number.isSafeInteger(lowStockThreshold) || lowStockThreshold < 0 || lowStockThreshold > 100000) {
    response.status(400).json({ error: 'Provide a valid menu item, stock no lower than quantities reserved, and a low-stock threshold from zero to 100,000.' })
    return
  }
  if (dietaryTags.some((tag) => !allowedDietaryTags.has(tag))) {
    response.status(400).json({ error: 'One or more dietary tags are not supported.' })
    return
  }
  const updated = await updateMenuInventory(itemId, { stock, isAvailable, dietaryTags, lowStockThreshold })
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

app.get('/api/admin/discount-codes', requireAdmin, async (_request, response) => {
  response.json({ discountCodes: await listDiscountCodes() })
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

app.post('/api/admin/discount-codes', requireAdmin, async (request, response, next) => {
  const code = normalizeDiscountCode(request.body)
  if (!code) {
    response.status(400).json({ error: 'Provide a unique code, valid discount amount, minimum total, and optional expiry.' })
    return
  }
  try {
    response.status(201).json({ discountCode: await saveDiscountCode(code) })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      response.status(409).json({ error: 'That discount code already exists.' })
      return
    }
    next(error)
  }
})

app.put('/api/admin/discount-codes/:id', requireAdmin, async (request, response, next) => {
  const id = Number(request.params.id)
  const existing = (await listDiscountCodes()).find((code) => code.id === id)
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
    response.json({ discountCode: await saveDiscountCode(code) })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      response.status(409).json({ error: 'That discount code already exists.' })
      return
    }
    next(error)
  }
})

app.delete('/api/admin/discount-codes/:id', requireAdmin, async (request, response) => {
  if (!(await deleteDiscountCode(Number(request.params.id)))) {
    response.status(404).json({ error: 'Discount code not found.' })
    return
  }
  response.status(204).end()
})

app.get('/api/admin/reports', requireAdmin, async (request, response) => {
  const storeFilter = request.admin.role === 'owner' ? '' : 'WHERE store_id = ?'
  const storeParameters = request.admin.role === 'owner' ? [] : [request.admin.storeId]
  const summary = await database.prepare(`
    SELECT COUNT(*) AS "orderCount",
      COALESCE(SUM(CASE WHEN status IN ('processing', 'delivered') THEN total_cents ELSE 0 END), 0) AS sales,
      COALESCE(AVG(CASE WHEN status IN ('processing', 'delivered') THEN total_cents END), 0) AS "averageOrder",
      COALESCE(SUM(CASE WHEN status NOT IN ('payment_failed') THEN 1 ELSE 0 END), 0) AS "placedCount"
    FROM orders ${storeFilter}
  `).get(...storeParameters)
  const popularItems = await database.prepare(`
    SELECT flavor_name AS name, SUM(quantity) AS quantity, SUM(line_total_cents) AS sales
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status IN ('processing', 'delivered')
      ${request.admin.role === 'owner' ? '' : 'AND o.store_id = ?'}
    GROUP BY flavor_name ORDER BY quantity DESC LIMIT 10
  `).all(...storeParameters)
  const lowStock = request.admin.role === 'owner' ? await database.prepare(`
    SELECT "itemId", name, stock, "reservedStock", "isAvailable", "availableQuantity" FROM (
    SELECT item_id AS "itemId", item_id AS name, stock,
      reserved_stock AS "reservedStock", is_available AS "isAvailable",
      stock - reserved_stock AS "availableQuantity"
      FROM menu_inventory WHERE stock - reserved_stock <= 5
      UNION ALL
    SELECT 'flavor:' || id AS "itemId", name, stock,
      reserved_stock AS "reservedStock", 1 AS "isAvailable",
      stock - reserved_stock AS "availableQuantity"
      FROM flavors WHERE stock - reserved_stock <= 5
    ) ORDER BY availableQuantity, itemId LIMIT 30
  `).all() : []
  const recentSales = await database.prepare(`
    SELECT date(created_at) AS date, SUM(total_cents) AS sales, COUNT(*) AS orders
    FROM orders WHERE status IN ('processing', 'delivered')
      ${request.admin.role === 'owner' ? '' : 'AND store_id = ?'}
      AND created_at >= datetime('now', '-30 days')
    GROUP BY date(created_at) ORDER BY date
  `).all(...storeParameters)
  response.json({
    summary,
    popularItems,
    ...(request.admin.role === 'owner' ? { lowStock } : {}),
    recentSales,
  })
})

app.post('/api/admin/menu-items', requireAdmin, async (request, response, next) => {
  const itemDetails = await normalizeCustomMenuItem(request.body)
  if (!itemDetails) {
    response.status(400).json({ error: 'Choose a category and provide a name, description, valid image path, and whole-number price greater than zero.' })
    return
  }
  try {
    const item = await saveCustomMenuItem(itemDetails)
    response.status(201).json({ item })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      response.status(409).json({ error: 'A menu item with that name already exists in this category.' })
      return
    }
    next(error)
  }
})

app.put('/api/admin/menu-items/:id', requireAdmin, async (request, response, next) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Menu item ID is invalid.' })
    return
  }
  if (!await findCustomMenuItem(id)) {
    response.status(404).json({ error: 'Menu item not found.' })
    return
  }
  const itemDetails = await normalizeCustomMenuItem(request.body)
  if (!itemDetails) {
    response.status(400).json({ error: 'Choose a category and provide a name, description, valid image path, and whole-number price greater than zero.' })
    return
  }
  const existingItem = await findCustomMenuItem(id)
  if (itemDetails.stock < existingItem.reservedStock) {
    response.status(409).json({ error: 'Stock cannot be lower than the quantity reserved for pending checkouts.' })
    return
  }
  try {
    response.json({ item: await updateCustomMenuItem(id, itemDetails) })
  } catch (error) {
    if (error.code === 'STOCK_RESERVED') {
      response.status(409).json({ error: error.message })
      return
    }
    if (isUniqueConstraintError(error)) {
      response.status(409).json({ error: 'A menu item with that name already exists in this category.' })
      return
    }
    next(error)
  }
})

app.delete('/api/admin/menu-items/:id', requireAdmin, async (request, response, next) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Menu item ID is invalid.' })
    return
  }
  try {
    const result = await deleteCustomMenuItem(id)
    if (result === 'not_found') {
      response.status(404).json({ error: 'Menu item not found.' })
      return
    }
    if (result === 'reserved') {
      response.status(409).json({ error: 'This item has stock reserved for pending checkouts and cannot be deleted yet.' })
      return
    }
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.put('/api/admin/flavors/:id', requireAdmin, async (request, response, next) => {
  try {
    const existing = await findFlavor(Number(request.params.id))
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
    response.json({ flavor: await saveFlavor({ ...flavor, id: existing.id }) })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/admin/flavors/:id', requireAdmin, async (request, response, next) => {
  try {
    const flavor = await findFlavor(Number(request.params.id))
    if (flavor?.reservedStock > 0) {
      response.status(409).json({ error: 'This flavor has inventory reserved for a pending checkout and cannot be deleted yet.' })
      return
    }
    const deleted = await deleteFlavor(Number(request.params.id))
    if (!deleted) {
      response.status(404).json({ error: 'Flavor not found.' })
      return
    }
    response.status(204).end()
  } catch (error) {
    next(error)
  }
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

try {
  await verifyDatabaseSchema()
} catch (error) {
  console.error('Database schema verification failed:', error)
  await database.close()
  throw error
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
  server.close(async () => {
    try {
      await database.close()
      process.exit(0)
    } catch (error) {
      console.error('Unable to close database connections:', error)
      process.exit(1)
    }
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
