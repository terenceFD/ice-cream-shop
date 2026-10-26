import { randomUUID } from 'node:crypto'
import { toInt, toNumber } from '../shared/numbers.ts'

// Party and event orders: a signed-in customer requests a bulk order for an event, the store sends
// a quote with a deposit, the customer pays the deposit online, and the store confirms the event.

export const EVENT_TYPES = ['birthday', 'office', 'wedding', 'school', 'religious', 'other']
export const EVENT_STATUSES = ['new', 'quoted', 'deposit_paid', 'confirmed', 'completed', 'declined', 'cancelled']
export const EVENT_DEPOSIT_PERCENT = 30
export const EVENT_MIN_TOTAL_QUANTITY = 10
export const EVENT_MIN_LEAD_DAYS = 2
export const EVENT_MAX_LEAD_DAYS = 180
const CURRENCY = 'xaf'

const SELECT_EVENT_ORDER = `
  SELECT e.id, e.customer_id AS "customerId", e.store_id AS "storeId", s.name AS "storeName",
    s.town AS "storeTown",
    e.event_type AS "eventType", e.event_date AS "eventDate", e.event_time AS "eventTime",
    e.guest_count AS "guestCount", e.fulfillment_type AS "fulfillmentType",
    e.delivery_address AS "deliveryAddress", e.items_json AS "itemsJson", e.notes,
    e.customer_name AS "customerName", e.customer_email AS "customerEmail", e.customer_phone AS "customerPhone",
    e.estimated_total AS "estimatedTotal", e.quoted_total AS "quotedTotal", e.deposit_amount AS "depositAmount",
    e.status, e.admin_note AS "adminNote", e.deposit_provider AS "depositProvider",
    e.deposit_paid_at AS "depositPaidAt", e.created_at AS "createdAt", e.updated_at AS "updatedAt"
  FROM event_orders e LEFT JOIN stores s ON s.id = e.store_id`

function present(row) {
  if (!row) return null
  let items = []
  try {
    items = JSON.parse(row.itemsJson || '[]')
  } catch {
    items = []
  }
  const { itemsJson: _itemsJson, ...rest } = row
  return {
    ...rest,
    items,
    guestCount: Number(row.guestCount),
    estimatedTotal: Number(row.estimatedTotal),
    quotedTotal: row.quotedTotal == null ? null : Number(row.quotedTotal),
    depositAmount: row.depositAmount == null ? null : Number(row.depositAmount),
    suggestedDeposit: suggestedDeposit(Number(row.quotedTotal ?? row.estimatedTotal)),
  }
}

/** 30% of the total, rounded up to the next 100 FCFA. */
export function suggestedDeposit(total) {
  if (!Number.isFinite(total) || total <= 0) return 0
  return Math.min(total, Math.ceil((total * EVENT_DEPOSIT_PERCENT) / 100 / 100) * 100)
}

function todayInDouala(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(date)
}

export function eventTypeLabel(type) {
  return {
    birthday: 'Birthday party', office: 'Office event', wedding: 'Wedding', school: 'School event',
    religious: 'Religious celebration', other: 'Event',
  }[type] || 'Event'
}

/**
 * Checks an event request and prices its items from the current menu.
 * Returns { error } or { value } where value holds everything needed to save it.
 */
export async function validateEventRequest(body, { resolveItem, findStore }) {
  const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max + 1) : '')
  const eventType = body?.eventType
  const eventDate = text(body?.eventDate, 10)
  const eventTime = text(body?.eventTime, 5)
  const guestCount = toInt(body?.guestCount, NaN)
  const fulfillmentType = body?.fulfillmentType
  const deliveryAddress = text(body?.deliveryAddress, 200)
  const notes = text(body?.notes, 500)
  const customerPhone = text(body?.phone, 40)
  const storeId = toInt(body?.storeId, NaN)
  const rawItems = Array.isArray(body?.items) ? body.items : []

  if (!EVENT_TYPES.includes(eventType)) return { error: 'Choose the type of event.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || eventDate < todayInDouala(EVENT_MIN_LEAD_DAYS) || eventDate > todayInDouala(EVENT_MAX_LEAD_DAYS)) {
    return { error: `Choose an event date between ${EVENT_MIN_LEAD_DAYS} and ${EVENT_MAX_LEAD_DAYS} days from today.` }
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(eventTime)) return { error: 'Choose the time of the event.' }
  if (!Number.isSafeInteger(guestCount) || guestCount < 5 || guestCount > 2000) return { error: 'Enter between 5 and 2,000 guests.' }
  if (!['delivery', 'pickup'].includes(fulfillmentType)) return { error: 'Choose delivery or pickup.' }
  if (fulfillmentType === 'delivery' && (deliveryAddress.length < 5 || deliveryAddress.length > 200)) {
    return { error: 'Enter the delivery address for the event.' }
  }
  if (!customerPhone || customerPhone.length > 40 || !/\d{6,}/.test(customerPhone.replace(/\D/g, ''))) {
    return { error: 'Enter a phone number the store can call about the event.' }
  }
  if (notes.length > 500) return { error: 'Keep the notes under 500 characters.' }
  if (!Number.isSafeInteger(storeId) || storeId < 1) return { error: 'Choose the store that will prepare the order.' }
  const store = await findStore(storeId, fulfillmentType)
  if (!store) return { error: `Choose an active store that offers ${fulfillmentType}.` }
  if (!rawItems.length || rawItems.length > 30) return { error: 'Add between 1 and 30 different items.' }

  const merged = new Map()
  for (const entry of rawItems) {
    const quantity = toInt(entry?.quantity, NaN)
    if (typeof entry?.itemId !== 'string' || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) {
      return { error: 'Each item needs a quantity between 1 and 1,000.' }
    }
    merged.set(entry.itemId, (merged.get(entry.itemId) || 0) + quantity)
  }
  const items = []
  for (const [itemId, quantity] of merged) {
    const item = await resolveItem(itemId)
    const unitPrice = toNumber(item?.priceXaf ?? item?.price, NaN)
    if (!item || !Number.isSafeInteger(unitPrice) || unitPrice < 1) return { error: 'One of the items is no longer on the menu.' }
    items.push({ itemId, name: item.name, quantity, unitPrice, lineTotal: unitPrice * quantity })
  }
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
  if (totalQuantity < EVENT_MIN_TOTAL_QUANTITY) {
    return { error: `Event orders start at ${EVENT_MIN_TOTAL_QUANTITY} items in total. For smaller orders, use the regular shop.` }
  }
  const estimatedTotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
  return {
    value: {
      eventType, eventDate, eventTime, guestCount, fulfillmentType,
      deliveryAddress: fulfillmentType === 'delivery' ? deliveryAddress : '',
      notes, customerPhone, storeId, storeName: store.name, items, estimatedTotal,
    },
  }
}

export function registerEventOrderRoutes(app, deps) {
  const {
    database, requireCustomer, requireAdmin, getStripe, isCamPayMobileMoneyEnabled, createCamPayPaymentLink,
    getCamPayTransaction, normalizeCameroonPhone, resolveItem, publicSiteUrl, sendToCustomer, buildNotification,
    email, describeEmailError,
  } = deps

  const getEventOrder = async (id) => present(await database.prepare(`${SELECT_EVENT_ORDER} WHERE e.id = ?`).get(id))

  async function findStore(storeId, fulfillmentType) {
    return database.prepare(`
      SELECT s.id, s.name FROM stores s JOIN fulfillment_zones z ON z.id = s.fulfillment_zone_id
      WHERE s.id = ? AND z.is_active = 1 AND ${fulfillmentType === 'pickup' ? 'z.pickup_enabled = 1' : 'z.delivery_enabled = 1'}
    `).get(storeId)
  }

  async function adminEmails(storeId) {
    const rows = await database.prepare(`
      SELECT email FROM admins
      WHERE role = 'owner' OR store_id = ?
        OR (role = 'branch_admin' AND branch_town = (SELECT town FROM stores WHERE id = ?))
      ORDER BY id
    `).all(storeId, storeId)
    return rows.map((row) => row.email)
  }

  // Background notices never block or fail a request.
  function tellCustomer(order, kind) {
    if (!order?.customerId) return
    sendToCustomer(database, Number(order.customerId), buildNotification({ eventOrderId: order.id, kind }))
      .catch((error) => console.error(`Unable to send event order #${order.id} notification:`, error.message))
  }
  function sendEmail(label, task) {
    if (!email.isConfigured()) return
    task().catch((error) => console.error(`Unable to send ${label}:`, describeEmailError(error)))
  }

  async function markDepositPaid(id) {
    const result = await database.prepare(`
      UPDATE event_orders SET status = 'deposit_paid', deposit_paid_at = ?, deposit_admin_seen = 0, updated_at = ?
      WHERE id = ? AND status = 'quoted'
    `).run(new Date().toISOString(), new Date().toISOString(), id)
    const order = await getEventOrder(id)
    if (result.changes) {
      console.log(`Event order #${id}: deposit of ${order.depositAmount} FCFA received.`)
      tellCustomer(order, 'deposit_paid')
      sendEmail(`deposit notice for event order #${id}`, async () => email.sendEventDepositReceived({
        recipients: await adminEmails(order.storeId),
        order,
        adminUrl: `${publicSiteUrl()}/admin/events?event=${id}`,
      }))
    }
    return order
  }

  // Exposed for the Stripe webhook.
  deps.onStripeDepositPaid = async (session) => {
    const id = Number(session?.metadata?.eventOrderId)
    if (!Number.isSafeInteger(id) || session.payment_status !== 'paid') return
    const order = await getEventOrder(id)
    if (!order || Number(session.amount_total) !== order.depositAmount) {
      throw new Error(`Stripe deposit for event order #${id} did not match the quote.`)
    }
    await markDepositPaid(id)
  }

  app.get('/api/event-orders/config', (_request, response) => {
    response.json({
      eventTypes: EVENT_TYPES,
      depositPercent: EVENT_DEPOSIT_PERCENT,
      minTotalQuantity: EVENT_MIN_TOTAL_QUANTITY,
      minDate: todayInDouala(EVENT_MIN_LEAD_DAYS),
      maxDate: todayInDouala(EVENT_MAX_LEAD_DAYS),
    })
  })

  app.post('/api/customer/event-orders', requireCustomer, async (request, response) => {
    const { error, value } = await validateEventRequest(request.body, { resolveItem, findStore })
    if (error) {
      response.status(400).json({ error })
      return
    }
    const customer = request.customer
    const now = new Date().toISOString()
    const result = await database.prepare(`
      INSERT INTO event_orders (customer_id, store_id, event_type, event_date, event_time, guest_count,
        fulfillment_type, delivery_address, items_json, notes, customer_name, customer_email, customer_phone,
        estimated_total, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)
    `).run(customer.id, value.storeId, value.eventType, value.eventDate, value.eventTime, value.guestCount,
      value.fulfillmentType, value.deliveryAddress, JSON.stringify(value.items), value.notes,
      customer.name, customer.email, value.customerPhone, value.estimatedTotal, now, now)
    const id = Number(result.lastInsertRowid)
    const order = await getEventOrder(id)
    sendEmail(`event request notice #${id}`, async () => email.sendEventRequestNotification({
      recipients: await adminEmails(value.storeId),
      order,
      adminUrl: `${publicSiteUrl()}/admin/events?event=${id}`,
    }))
    response.status(201).json({ eventOrder: order })
  })

  app.get('/api/customer/event-orders', requireCustomer, async (request, response) => {
    const rows = await database.prepare(`${SELECT_EVENT_ORDER} WHERE e.customer_id = ? ORDER BY e.id DESC LIMIT 50`).all(request.customer.id)
    response.json({ eventOrders: rows.map(present) })
  })

  // A customer can remove a request they no longer want. A paid or booked event stays, so the store can cancel it.
  app.delete('/api/customer/event-orders/:id', requireCustomer, async (request, response) => {
    const id = Number(request.params.id)
    const order = Number.isSafeInteger(id) ? await getEventOrder(id) : null
    if (!order || Number(order.customerId) !== Number(request.customer.id)) {
      response.status(404).json({ error: 'Event order not found.' })
      return
    }
    if (!['new', 'quoted', 'declined', 'cancelled'].includes(order.status)) {
      response.status(409).json({ error: 'A booked event with a deposit cannot be deleted. Contact the store to cancel it.' })
      return
    }
    const result = await database.prepare(`
      DELETE FROM event_orders
      WHERE id = ? AND customer_id = ? AND status IN ('new', 'quoted', 'declined', 'cancelled')
    `).run(id, request.customer.id)
    if (!result.changes) {
      response.status(409).json({ error: 'This event order has changed. Refresh and try again.' })
      return
    }
    response.status(204).end()
  })

  app.post('/api/customer/event-orders/:id/deposit', requireCustomer, async (request, response) => {
    const id = Number(request.params.id)
    const order = Number.isSafeInteger(id) ? await getEventOrder(id) : null
    if (!order || Number(order.customerId) !== Number(request.customer.id)) {
      response.status(404).json({ error: 'Event order not found.' })
      return
    }
    if (order.status !== 'quoted' || !order.depositAmount) {
      response.status(409).json({ error: 'This event order is not waiting for a deposit.' })
      return
    }
    const method = request.body?.method === 'campay' ? 'campay' : 'card'
    const origin = publicSiteUrl()
    const now = new Date().toISOString()
    try {
      if (method === 'campay') {
        if (!isCamPayMobileMoneyEnabled()) {
          response.status(503).json({ error: 'Mobile Money is not available right now. Pay by card instead.' })
          return
        }
        const externalReference = `evt-${id}-${randomUUID()}`
        const checkout = await createCamPayPaymentLink({
          amount: order.depositAmount,
          externalReference,
          redirectUrl: `${origin}/events?event=${id}&provider=campay`,
          failureRedirectUrl: `${origin}/events?event=${id}&provider=campay&status=failed`,
          phone: normalizeCameroonPhone(typeof request.body?.phone === 'string' ? request.body.phone : order.customerPhone),
          name: order.customerName,
          email: order.customerEmail,
        })
        await database.prepare(`
          UPDATE event_orders SET deposit_provider = 'campay', deposit_reference = ?, deposit_external_reference = ?, updated_at = ?
          WHERE id = ?
        `).run(checkout.reference, externalReference, now, id)
        response.json({ url: checkout.url })
        return
      }
      const stripe = getStripe()
      if (!stripe) {
        response.status(503).json({ error: 'Card payments are not available right now.' })
        return
      }
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
        customer_email: order.customerEmail,
        client_reference_id: `event-${id}`,
        metadata: { eventOrderId: String(id) },
        payment_intent_data: { metadata: { eventOrderId: String(id) } },
        line_items: [{
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: order.depositAmount,
            product_data: { name: `Deposit for event order #${id} (${eventTypeLabel(order.eventType)}, ${order.eventDate})` },
          },
        }],
        success_url: `${origin}/events?event=${id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/events?event=${id}&cancelled=1`,
      })
      if (!session.url) throw new Error('Stripe did not return a checkout URL.')
      await database.prepare(`
        UPDATE event_orders SET deposit_provider = 'stripe', deposit_reference = ?, updated_at = ? WHERE id = ?
      `).run(session.id, now, id)
      response.json({ url: session.url })
    } catch (error) {
      console.error(`Unable to start deposit payment for event order #${id}:`, error.message)
      response.status(502).json({ error: error.message.startsWith('Enter a valid Cameroon') ? error.message : 'The deposit payment could not be started. Please try again.' })
    }
  })

  // Called when the customer comes back from the payment page; checks the payment with the provider.
  app.post('/api/customer/event-orders/:id/deposit/confirm', requireCustomer, async (request, response) => {
    const id = Number(request.params.id)
    const row = Number.isSafeInteger(id) ? await database.prepare(`
      SELECT customer_id AS "customerId", status, deposit_provider AS "provider", deposit_reference AS "reference",
        deposit_external_reference AS "externalReference", deposit_amount AS "depositAmount"
      FROM event_orders WHERE id = ?
    `).get(id) : null
    if (!row || Number(row.customerId) !== Number(request.customer.id)) {
      response.status(404).json({ error: 'Event order not found.' })
      return
    }
    if (row.status !== 'quoted' || !row.reference) {
      response.json({ eventOrder: await getEventOrder(id) })
      return
    }
    try {
      let paid = false
      if (row.provider === 'stripe') {
        const stripe = getStripe()
        const session = stripe ? await stripe.checkout.sessions.retrieve(row.reference) : null
        paid = Boolean(session) && session.payment_status === 'paid'
          && Number(session.metadata?.eventOrderId) === id && Number(session.amount_total) === Number(row.depositAmount)
      } else if (row.provider === 'campay') {
        const transaction = await getCamPayTransaction(row.reference)
        paid = transaction?.status === 'SUCCESSFUL' && Number(transaction.amount) === Number(row.depositAmount)
          && String(transaction.currency).toLowerCase() === CURRENCY
          && (!transaction.external_reference || transaction.external_reference === row.externalReference)
      }
      const order = paid ? await markDepositPaid(id) : await getEventOrder(id)
      response.json({ eventOrder: order, paid })
    } catch (error) {
      console.error(`Unable to confirm deposit for event order #${id}:`, error.message)
      response.status(502).json({ error: 'The deposit could not be checked yet. Refresh the page in a minute.' })
    }
  })

  function eventListScope(admin) {
    if (admin.role === 'store_admin') return { clause: 'WHERE e.store_id = ?', parameters: [admin.storeId] }
    const town = admin.role === 'branch_admin' ? admin.branchTown : admin.selectedStoreTown || null
    if (admin.role === 'owner' || admin.role === 'branch_admin') {
      return town ? { clause: 'WHERE s.town = ?', parameters: [town] } : { clause: '', parameters: [] }
    }
    return { clause: 'WHERE e.store_id = ?', parameters: [admin.storeId] }
  }

  function adminCanSeeEvent(admin, order) {
    if (!order) return false
    if (admin.role === 'store_admin') return Number(order.storeId) === Number(admin.storeId)
    if (admin.role === 'branch_admin') return order.storeTown === admin.branchTown
    if (admin.role === 'owner' && admin.selectedStoreTown) return order.storeTown === admin.selectedStoreTown
    return admin.role === 'owner'
  }

  app.get('/api/admin/event-orders/deposit-notices', requireAdmin, async (request, response) => {
    const { clause, parameters } = eventListScope(request.admin)
    const where = `${clause}${clause ? ' AND' : ' WHERE'} e.status = 'deposit_paid' AND e.deposit_admin_seen = 0`
    const notices = await database.prepare(`
      SELECT e.id, e.customer_name AS "customerName", e.deposit_amount AS "depositAmount",
        e.event_type AS "eventType", e.event_date AS "eventDate", s.name AS "storeName"
      FROM event_orders e LEFT JOIN stores s ON s.id = e.store_id
      ${where}
      ORDER BY e.deposit_paid_at DESC, e.id DESC
      LIMIT 5
    `).all(...parameters)
    response.json({
      notices: notices.map((notice) => ({ ...notice, depositAmount: Number(notice.depositAmount) || 0 })),
    })
  })

  app.patch('/api/admin/event-orders/:id/deposit-notice', requireAdmin, async (request, response) => {
    const id = Number(request.params.id)
    const order = Number.isSafeInteger(id) ? await getEventOrder(id) : null
    if (!adminCanSeeEvent(request.admin, order)) {
      response.status(404).json({ error: 'Event order not found.' })
      return
    }
    await database.prepare('UPDATE event_orders SET deposit_admin_seen = 1, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id)
    response.status(204).end()
  })

  app.get('/api/admin/event-orders', requireAdmin, async (request, response) => {
    const isTownScoped = request.admin.role === 'owner' || request.admin.role === 'branch_admin'
    const town = request.admin.role === 'branch_admin'
      ? request.admin.branchTown
      : request.admin.selectedStoreTown || null
    const storeFilter = isTownScoped
      ? town ? 'WHERE s.town = ?' : ''
      : 'WHERE e.store_id = ?'
    const parameters = isTownScoped ? town ? [town] : [] : [request.admin.storeId]
    if (request.query.countOnly === 'true') {
      const statusFilter = `${storeFilter}${storeFilter ? ' AND' : ' WHERE'} e.status IN ('new', 'deposit_paid')`
      const result = await database.prepare(`
        SELECT COUNT(*) AS count
        FROM event_orders e LEFT JOIN stores s ON s.id = e.store_id
        ${statusFilter}
      `).get(...parameters)
      response.json({ count: Number(result.count) })
      return
    }
    const rows = await database.prepare(`${SELECT_EVENT_ORDER} ${storeFilter} ORDER BY e.event_date ASC, e.id DESC LIMIT 300`)
      .all(...parameters)
    response.json({ eventOrders: rows.map(present) })
  })

  app.delete('/api/admin/event-orders/:id', requireAdmin, async (request, response) => {
    const id = Number(request.params.id)
    const order = Number.isSafeInteger(id) ? await getEventOrder(id) : null
    if (!order
      || (request.admin.role === 'store_admin' && Number(order.storeId) !== Number(request.admin.storeId))
      || (request.admin.role === 'branch_admin' && order.storeTown !== request.admin.branchTown)
      || (request.admin.role === 'owner' && request.admin.selectedStoreTown
        && order.storeTown !== request.admin.selectedStoreTown)) {
      response.status(404).json({ error: 'Event order not found.' })
      return
    }
    if (order.status !== 'declined') {
      response.status(409).json({ error: 'Only declined event orders can be deleted.' })
      return
    }
    const result = await database.prepare(`
      DELETE FROM event_orders WHERE id = ? AND status = 'declined'
    `).run(id)
    if (!result.changes) {
      response.status(409).json({ error: 'This event order has changed. Refresh and try again.' })
      return
    }
    response.status(204).end()
  })

  app.patch('/api/admin/event-orders/:id', requireAdmin, async (request, response) => {
    const id = Number(request.params.id)
    const order = Number.isSafeInteger(id) ? await getEventOrder(id) : null
    if (!order
      || (request.admin.role === 'store_admin' && Number(order.storeId) !== Number(request.admin.storeId))
      || (request.admin.role === 'branch_admin' && order.storeTown !== request.admin.branchTown)
      || (request.admin.role === 'owner' && request.admin.selectedStoreTown
        && order.storeTown !== request.admin.selectedStoreTown)) {
      response.status(404).json({ error: 'Event order not found.' })
      return
    }
    const action = request.body?.action
    const adminNote = typeof request.body?.adminNote === 'string' ? request.body.adminNote.trim().slice(0, 500) : order.adminNote || ''
    const allowedFrom = {
      quote: ['new', 'quoted'],
      decline: ['new', 'quoted'],
      confirm: ['deposit_paid'],
      complete: ['deposit_paid', 'confirmed'],
      cancel: ['new', 'quoted', 'deposit_paid', 'confirmed'],
    }
    if (!allowedFrom[action]) {
      response.status(400).json({ error: 'Choose a valid action.' })
      return
    }
    if (!allowedFrom[action].includes(order.status)) {
      response.status(409).json({ error: `This event order is ${order.status.replace('_', ' ')} and cannot be changed that way.` })
      return
    }
    const now = new Date().toISOString()
    if (action === 'quote') {
      const quotedTotal = toInt(request.body?.quotedTotal, NaN)
      const depositAmount = toInt(request.body?.depositAmount, NaN)
      if (!Number.isSafeInteger(quotedTotal) || quotedTotal < 100 || quotedTotal > 100_000_000
        || !Number.isSafeInteger(depositAmount) || depositAmount < 100 || depositAmount > quotedTotal) {
        response.status(400).json({ error: 'Enter a total of at least 100 FCFA and a deposit between 100 FCFA and the total.' })
        return
      }
      await database.prepare(`
        UPDATE event_orders SET status = 'quoted', quoted_total = ?, deposit_amount = ?, admin_note = ?,
          deposit_reference = NULL, deposit_provider = NULL, updated_at = ?
        WHERE id = ?
      `).run(quotedTotal, depositAmount, adminNote, now, id)
      const updated = await getEventOrder(id)
      tellCustomer(updated, 'quoted')
      sendEmail(`event quote #${id}`, () => email.sendEventQuote({
        to: updated.customerEmail,
        order: updated,
        payUrl: `${publicSiteUrl()}/events?event=${id}`,
      }))
      response.json({ eventOrder: updated })
      return
    }
    const nextStatus = { decline: 'declined', confirm: 'confirmed', complete: 'completed', cancel: 'cancelled' }[action]
    await database.prepare('UPDATE event_orders SET status = ?, admin_note = ?, updated_at = ? WHERE id = ?')
      .run(nextStatus, adminNote, now, id)
    const updated = await getEventOrder(id)
    if (['confirmed', 'declined', 'cancelled'].includes(nextStatus)) tellCustomer(updated, nextStatus)
    response.json({ eventOrder: updated })
  })

  return deps
}
