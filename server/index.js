import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import Stripe from 'stripe'
import { database, findFlavor, listFlavors, saveFlavor } from './database.js'
import { sendContactReply, sendNewOrderNotification } from './email.js'

const app = express()
const port = Number(process.env.PORT || 3001)
const jwtSecret = process.env.JWT_SECRET
let stripeClient
const frontendOrigins = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())

if (!jwtSecret || jwtSecret.length < 32 || jwtSecret.startsWith('replace-with-')) {
  throw new Error('Set JWT_SECRET to a random value of at least 32 characters in your environment.')
}

app.use(helmet())
app.use(cors({
  origin(origin, callback) {
    if (!origin || frontendOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    callback(new Error('Origin is not allowed by CORS'))
  },
}))

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
  database.transaction(() => {
    const result = updatePayment.run(
      typeof session.payment_intent === 'string' ? session.payment_intent : null,
      orderId,
      session.id,
    )
    if (result.changes === 0) return
    const items = database.prepare('SELECT flavor_id AS flavorId, quantity FROM order_items WHERE order_id = ?').all(orderId)
    const decrementStock = database.prepare(`
      UPDATE flavors
      SET stock = stock - ?, reserved_stock = reserved_stock - ?
      WHERE id = ? AND stock >= ? AND reserved_stock >= ?
    `)
    for (const item of items) {
      if (item.flavorId === null) continue
      const stockResult = decrementStock.run(item.quantity, item.quantity, item.flavorId, item.quantity, item.quantity)
      if (stockResult.changes === 0) throw new Error('Reserved flavor inventory is no longer available.')
    }
    updateOrder.run(orderId)
  })()
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
    const items = database.prepare('SELECT flavor_id AS flavorId, quantity FROM order_items WHERE order_id = ?').all(orderId)
    for (const item of items) {
      if (item.flavorId !== null) {
        database.prepare(`
          UPDATE flavors SET reserved_stock = MAX(0, reserved_stock - ?)
          WHERE id = ?
        `).run(item.quantity, item.flavorId)
      }
    }
    database.prepare(`
      UPDATE orders SET status = 'payment_failed'
      WHERE id = ? AND status = 'pending_payment'
    `).run(orderId)
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

app.use(express.json({ limit: '2mb' }))

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
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

function normalizeFlavor(body, existing = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const detail = typeof body.detail === 'string' ? body.detail.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const image = typeof body.image === 'string' ? body.image.trim() : ''
  const price = Number(body.price)
  if (!name || !detail || !description || !image || !Number.isFinite(price) || price <= 0) return null

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

function listOrders({ deliveredOnly = false } = {}) {
  const orders = database.prepare(`
    SELECT id, customer_name AS customerName, customer_email AS customerEmail,
      customer_phone AS customerPhone, delivery_address AS deliveryAddress,
      delivery_city AS deliveryCity, delivery_postal_code AS deliveryPostalCode,
      subtotal_cents AS subtotalCents, discount_cents AS discountCents,
      total_cents AS totalCents, currency, status, created_at AS createdAt,
      delivered_at AS deliveredAt
    FROM orders
    WHERE ${deliveredOnly ? "status = 'delivered'" : "status != 'delivered'"}
    ORDER BY id DESC
    LIMIT 500
  `).all()
  if (orders.length === 0) return []

  const placeholders = orders.map(() => '?').join(', ')
  const items = database.prepare(`
    SELECT order_id AS orderId, flavor_id AS flavorId, flavor_name AS flavorName,
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

app.post('/api/checkout/session', checkoutLimiter, async (request, response) => {
  const stripe = getStripe()
  if (!stripe) {
    response.status(503).json({ error: 'Online payments are not configured. Set STRIPE_SECRET_KEY on the server.' })
    return
  }

  const details = request.body.checkoutDetails
  const name = typeof details?.name === 'string' ? details.name.trim() : ''
  const email = typeof details?.email === 'string' ? details.email.trim().toLowerCase() : ''
  const phone = typeof details?.phone === 'string' ? details.phone.trim() : ''
  const address = typeof details?.address === 'string' ? details.address.trim() : ''
  const city = typeof details?.city === 'string' ? details.city.trim() : ''
  const postalCode = typeof details?.postalCode === 'string' ? details.postalCode.trim() : ''
  const requestedItems = request.body.items
  if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
    || !phone || phone.length > 40 || !address || address.length > 200
    || !city || city.length > 100 || !postalCode || postalCode.length > 30
    || !Array.isArray(requestedItems) || requestedItems.length < 1 || requestedItems.length > 50) {
    response.status(400).json({ error: 'Provide valid contact, delivery, and cart details before payment.' })
    return
  }

  const mergedItems = new Map()
  for (const item of requestedItems) {
    const id = Number(item?.id)
    const quantity = Number(item?.quantity)
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) {
      response.status(400).json({ error: 'The cart contains an invalid flavor or quantity.' })
      return
    }
    mergedItems.set(id, (mergedItems.get(id) || 0) + quantity)
  }
  if ([...mergedItems.values()].some((quantity) => quantity > 100)) {
    response.status(400).json({ error: 'A flavor quantity cannot exceed 100.' })
    return
  }

  const orderItems = []
  for (const [id, quantity] of mergedItems) {
    const flavor = findFlavor(id)
    if (!flavor) {
      response.status(400).json({ error: 'A flavor in this cart is no longer available. Refresh your bag and try again.' })
      return
    }
    const unitPriceCents = Math.round(flavor.price * 100)
    if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents < 1) {
      response.status(400).json({ error: `The price for ${flavor.name} is invalid.` })
      return
    }
    orderItems.push({
      flavorId: flavor.id,
      flavorName: flavor.name,
      unitPriceCents,
      quantity,
      lineTotalCents: unitPriceCents * quantity,
    })
  }

  const cartCount = orderItems.reduce((total, item) => total + item.quantity, 0)
  const subtotalCents = orderItems.reduce((total, item) => total + item.lineTotalCents, 0)
  let freeScoops = Math.floor(cartCount / 3)
  let discountCents = 0
  for (const item of [...orderItems].sort((a, b) => a.unitPriceCents - b.unitPriceCents)) {
    const freeFromFlavor = Math.min(freeScoops, item.quantity)
    freeScoops -= freeFromFlavor
    discountCents += freeFromFlavor * item.unitPriceCents
  }
  const totalCents = subtotalCents - discountCents
  if (!Number.isSafeInteger(totalCents) || totalCents < 1) {
    response.status(400).json({ error: 'The order total is invalid.' })
    return
  }

  let orderId
  try {
    const createOrder = database.transaction(() => {
      const reserveStock = database.prepare(`
        UPDATE flavors SET reserved_stock = reserved_stock + ?
        WHERE id = ? AND stock - reserved_stock >= ?
      `)
      for (const item of orderItems) {
        const result = reserveStock.run(item.quantity, item.flavorId, item.quantity)
        if (result.changes === 0) {
          const error = new Error(`Not enough ${item.flavorName} in stock. Refresh your bag and try again.`)
          error.code = 'INSUFFICIENT_STOCK'
          throw error
        }
      }
      const result = database.prepare(`
        INSERT INTO orders (
          customer_name, customer_email, customer_phone, delivery_address, delivery_city,
          delivery_postal_code, subtotal_cents, discount_cents, total_cents
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, email, phone, address, city, postalCode, subtotalCents, discountCents, totalCents)
      const newOrderId = Number(result.lastInsertRowid)
      const insertItem = database.prepare(`
        INSERT INTO order_items (
          order_id, flavor_id, flavor_name, unit_price_cents, quantity, line_total_cents
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
      for (const item of orderItems) {
        insertItem.run(newOrderId, item.flavorId, item.flavorName, item.unitPriceCents, item.quantity, item.lineTotalCents)
      }
      return newOrderId
    })
    orderId = createOrder()

    const frontendUrl = new URL(process.env.FRONTEND_URL || frontendOrigins[0])
    if (!['http:', 'https:'].includes(frontendUrl.protocol)) {
      throw new Error('FRONTEND_URL must use HTTP or HTTPS.')
    }
    let coupon
    if (discountCents > 0) {
      coupon = await stripe.coupons.create({
        amount_off: discountCents,
        currency: 'usd',
        duration: 'once',
        name: 'Buy 2 Get 1 Free',
      })
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      expires_at: Math.floor(Date.now() / 1000) + 40 * 60,
      customer_email: email,
      client_reference_id: String(orderId),
      metadata: { orderId: String(orderId) },
      payment_intent_data: { metadata: { orderId: String(orderId) } },
      line_items: orderItems.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: 'usd',
          unit_amount: item.unitPriceCents,
          product_data: { name: item.flavorName },
        },
      })),
      ...(coupon ? { discounts: [{ coupon: coupon.id }] } : {}),
      success_url: `${frontendUrl.origin}/payment?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl.origin}/payment?cancelled=1`,
    })
    if (!session.url) throw new Error('Stripe did not return a checkout URL.')
    database.prepare(`
      INSERT INTO payments (order_id, stripe_checkout_session_id, amount_cents, currency)
      VALUES (?, ?, ?, ?)
    `).run(orderId, session.id, totalCents, 'usd')
    const admins = database.prepare('SELECT email FROM admins ORDER BY id').all()
    try {
      await sendNewOrderNotification({
        recipients: admins.map((admin) => admin.email),
        orderId,
        customerName: name,
        customerEmail: email,
        items: orderItems,
        totalCents,
        currency: 'usd',
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
        const items = database.prepare('SELECT flavor_id AS flavorId, quantity FROM order_items WHERE order_id = ?').all(orderId)
        for (const item of items) {
          if (item.flavorId !== null) {
            database.prepare(`
              UPDATE flavors SET reserved_stock = MAX(0, reserved_stock - ?)
              WHERE id = ?
            `).run(item.quantity, item.flavorId)
          }
        }
      })()
    }
    if (error.code === 'INSUFFICIENT_STOCK') {
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
        total_cents AS totalCents, currency, status, created_at AS createdAt
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

app.post('/api/auth/register', loginLimiter, async (request, response, next) => {
  try {
    const name = typeof request.body.name === 'string' ? request.body.name.trim() : ''
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
    const password = typeof request.body.password === 'string' ? request.body.password : ''
    if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || password.length < 8 || password.length > 128) {
      response.status(400).json({ error: 'Provide your name, a valid email, and a password of 8 to 128 characters.' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const result = database.prepare(
      'INSERT INTO customers (name, email, password_hash) VALUES (?, ?, ?)'
    ).run(name, email, passwordHash)
    const customer = { id: Number(result.lastInsertRowid), name, email }
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
    if (!customer || !await bcrypt.compare(password, customer.password_hash)) {
      response.status(401).json({ error: 'The email or password is incorrect.' })
      return
    }

    const token = jwt.sign({ sub: customer.id, type: 'customer' }, jwtSecret, { expiresIn: '8h' })
    response.json({
      token,
      customer: { id: customer.id, name: customer.name, email: customer.email },
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
    const customer = database.prepare('SELECT id, name, email FROM customers WHERE id = ?').get(payload.sub)
    if (!customer) {
      response.status(401).json({ error: 'Customer session is no longer valid.' })
      return
    }
    response.json({ customer })
  } catch {
    response.status(401).json({ error: 'Customer session is invalid or expired.' })
  }
})

app.post('/api/auth/logout', (_request, response) => {
  response.status(204).end()
})

app.post('/api/admin/login', loginLimiter, async (request, response, next) => {
  try {
    const email = typeof request.body.email === 'string' ? request.body.email.trim() : ''
    const password = typeof request.body.password === 'string' ? request.body.password : ''
    const admin = database.prepare('SELECT * FROM admins WHERE email = ? COLLATE NOCASE').get(email)
    if (!admin || !await bcrypt.compare(password, admin.password_hash)) {
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

app.get('/api/admin/admins', requireAdmin, (_request, response) => {
  const admins = database.prepare(`
    SELECT id, name, email, profile_picture AS profilePicture, created_at AS createdAt
    FROM admins ORDER BY id
  `).all()
  response.json({ admins })
})

app.get('/api/admin/orders', requireAdmin, (request, response) => {
  const deliveredOnly = request.query.status === 'delivered'
  if (request.query.status && !deliveredOnly) {
    response.status(400).json({ error: 'The requested order status is not supported.' })
    return
  }
  response.json({ orders: listOrders({ deliveredOnly }) })
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

app.patch('/api/admin/orders/:id/delivered', requireAdmin, (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(400).json({ error: 'Order ID is invalid.' })
    return
  }
  const result = database.prepare(`
    UPDATE orders SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'processing'
  `).run(id)
  if (result.changes === 0) {
    const order = database.prepare('SELECT status FROM orders WHERE id = ?').get(id)
    if (!order) {
      response.status(404).json({ error: 'Order not found.' })
      return
    }
    response.status(409).json({ error: 'Only paid orders can be marked as delivered.' })
    return
  }
  response.json({ delivered: true })
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

app.use((error, _request, response, _next) => {
  console.error(error)
  if (!response.headersSent) response.status(500).json({ error: 'An unexpected server error occurred.' })
})

const server = app.listen(port, () => {
  console.log(`Antixor Icy API listening on http://localhost:${port}`)
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
