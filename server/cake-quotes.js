import { randomUUID } from 'node:crypto'
import { suggestedDeposit } from './event-orders.js'

const CURRENCY = 'xaf'
const SIZE_SUGGESTION = { Small: 18000, Medium: 22000, Large: 25000 }

const SELECT_CAKE = `
  SELECT r.id, r.customer_id AS "customerId", r.store_id AS "storeId", s.name AS "storeName",
    s.town AS "storeTown", r.customer_name AS "customerName", r.customer_email AS "customerEmail",
    r.customer_phone AS "customerPhone", r.size, r.flavor, r.message, r.toppings,
    r.pickup_date AS "pickupDate", r.status, r.quoted_total AS "quotedTotal",
    r.deposit_amount AS "depositAmount", r.admin_note AS "adminNote", r.pay_token AS "payToken",
    r.deposit_provider AS "depositProvider", r.deposit_reference AS "depositReference",
    r.deposit_external_reference AS "depositExternalReference", r.deposit_paid_at AS "depositPaidAt",
    r.created_at AS "createdAt"
  FROM cake_requests r LEFT JOIN stores s ON s.id = r.store_id`

function present(row, { includeToken = false } = {}) {
  if (!row) return null
  let toppings = []
  try {
    toppings = JSON.parse(row.toppings || '[]')
  } catch {
    toppings = []
  }
  const quotedTotal = row.quotedTotal == null ? null : Number(row.quotedTotal)
  const depositAmount = row.depositAmount == null ? null : Number(row.depositAmount)
  const suggestedTotal = SIZE_SUGGESTION[row.size] || 22000
  return {
    id: row.id,
    customerId: row.customerId,
    storeId: row.storeId,
    storeName: row.storeName,
    storeTown: row.storeTown,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone,
    size: row.size,
    flavor: row.flavor,
    message: row.message,
    toppings,
    pickupDate: row.pickupDate,
    status: row.status,
    quotedTotal,
    depositAmount,
    adminNote: row.adminNote || '',
    depositPaidAt: row.depositPaidAt,
    createdAt: row.createdAt,
    suggestedTotal,
    suggestedDeposit: suggestedDeposit(quotedTotal || suggestedTotal),
    ...(includeToken ? { payToken: row.payToken } : {}),
  }
}

function publicCake(row) {
  const cake = present(row)
  if (!cake) return null
  const { customerEmail, customerPhone, ...safe } = cake
  return {
    ...safe,
    customerEmail: customerEmail ? `${customerEmail.slice(0, 2)}…` : '',
    customerPhone: '',
  }
}

export function registerCakeQuoteRoutes(app, deps) {
  const {
    database, requireCustomer, requireAdmin, getStripe, isCamPayMobileMoneyEnabled,
    createCamPayPaymentLink, getCamPayTransaction, normalizeCameroonPhone, publicSiteUrl,
    email, describeEmailError, selectedStoreTown,
  } = deps

  const getCake = async (id) => present(await database.prepare(`${SELECT_CAKE} WHERE r.id = ?`).get(id))
  const getCakeByToken = async (token) => {
    if (typeof token !== 'string' || !token || token.length > 80) return null
    return present(await database.prepare(`${SELECT_CAKE} WHERE r.pay_token = ?`).get(token), { includeToken: true })
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

  function sendEmail(label, task) {
    if (!email.isConfigured()) return
    task().catch((error) => console.error(`Unable to send ${label}:`, describeEmailError(error)))
  }

  function adminCanSee(request, cake) {
    if (!cake) return false
    if (request.admin.role === 'store_admin') return Number(cake.storeId) === Number(request.admin.storeId)
    const town = selectedStoreTown(request.admin)
    if (request.admin.role === 'branch_admin') return cake.storeTown === request.admin.branchTown
    if (town) return cake.storeTown === town
    return true
  }

  async function markDepositPaid(id) {
    const result = await database.prepare(`
      UPDATE cake_requests SET status = 'confirmed', deposit_paid_at = ?
      WHERE id = ? AND status = 'contacted' AND deposit_amount IS NOT NULL
    `).run(new Date().toISOString(), id)
    const cake = await getCake(id)
    if (result.changes && cake) {
      console.log(`Cake request #${id}: deposit of ${cake.depositAmount} FCFA received.`)
      sendEmail(`deposit notice for cake request #${id}`, async () => email.sendCakeDepositReceived({
        recipients: await adminEmails(cake.storeId),
        request: cake,
        adminUrl: `${publicSiteUrl()}/admin/cake-requests`,
      }))
    }
    return cake
  }

  deps.onStripeCakeDepositPaid = async (session) => {
    const id = Number(session?.metadata?.cakeRequestId)
    if (!Number.isSafeInteger(id) || session.payment_status !== 'paid') return
    const cake = await getCake(id)
    if (!cake || Number(session.amount_total) !== cake.depositAmount) {
      throw new Error(`Stripe deposit for cake request #${id} did not match the quote.`)
    }
    await markDepositPaid(id)
  }

  async function startDeposit(cake, { method, phone, origin }) {
    if (cake.status !== 'contacted' || !cake.depositAmount) {
      return { error: 'This cake request is not waiting for a deposit.', status: 409 }
    }
    if (method === 'campay') {
      if (!isCamPayMobileMoneyEnabled()) {
        return { error: 'Mobile Money is not available right now. Pay by card instead.', status: 503 }
      }
      const externalReference = `cake-${cake.id}-${randomUUID()}`
      const checkout = await createCamPayPaymentLink({
        amount: cake.depositAmount,
        externalReference,
        redirectUrl: `${origin}/custom-cake?pay=${encodeURIComponent(cake.payToken || '')}&provider=campay`,
        failureRedirectUrl: `${origin}/custom-cake?pay=${encodeURIComponent(cake.payToken || '')}&provider=campay&status=failed`,
        phone: normalizeCameroonPhone(phone || cake.customerPhone),
        name: cake.customerName,
        email: cake.customerEmail,
      })
      await database.prepare(`
        UPDATE cake_requests SET deposit_provider = 'campay', deposit_reference = ?, deposit_external_reference = ?
        WHERE id = ?
      `).run(checkout.reference, externalReference, cake.id)
      return { url: checkout.url }
    }
    const stripe = getStripe()
    if (!stripe) return { error: 'Card payments are not available right now.', status: 503 }
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      customer_email: cake.customerEmail,
      client_reference_id: `cake-${cake.id}`,
      metadata: { cakeRequestId: String(cake.id) },
      payment_intent_data: { metadata: { cakeRequestId: String(cake.id) } },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: cake.depositAmount,
          product_data: { name: `Deposit for cake request #${cake.id} (${cake.size} ${cake.flavor})` },
        },
      }],
      success_url: `${origin}/custom-cake?pay=${encodeURIComponent(cake.payToken || '')}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/custom-cake?pay=${encodeURIComponent(cake.payToken || '')}&cancelled=1`,
    })
    if (!session.url) throw new Error('Stripe did not return a checkout URL.')
    await database.prepare(`
      UPDATE cake_requests SET deposit_provider = 'stripe', deposit_reference = ? WHERE id = ?
    `).run(session.id, cake.id)
    return { url: session.url }
  }

  async function confirmDeposit(cake, body) {
    if (cake.status === 'confirmed') return { cake, paid: true }
    if (cake.status !== 'contacted') return { error: 'This cake request is not waiting for a deposit.', status: 409 }
    const provider = cake.depositProvider
    let paid = false
    if (provider === 'stripe') {
      const stripe = getStripe()
      const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : cake.depositReference
      const session = stripe && sessionId ? await stripe.checkout.sessions.retrieve(sessionId) : null
      paid = Boolean(session) && session.payment_status === 'paid'
        && Number(session.metadata?.cakeRequestId) === cake.id
        && Number(session.amount_total) === Number(cake.depositAmount)
    } else if (provider === 'campay') {
      const transaction = cake.depositReference ? await getCamPayTransaction(cake.depositReference) : null
      paid = transaction?.status === 'SUCCESSFUL' && Number(transaction.amount) === Number(cake.depositAmount)
    }
    if (paid) await markDepositPaid(cake.id)
    return { cake: await getCake(cake.id), paid }
  }

  app.patch('/api/admin/cake-requests/:id', requireAdmin, async (request, response) => {
    const id = Number(request.params.id)
    const cake = Number.isSafeInteger(id) ? await getCake(id) : null
    if (!adminCanSee(request, cake)) {
      response.status(404).json({ error: 'Custom cake request not found.' })
      return
    }
    if (request.body?.action !== 'quote') {
      response.status(400).json({ error: 'Choose a valid action.' })
      return
    }
    if (!['new', 'contacted'].includes(cake.status)) {
      response.status(409).json({ error: 'This cake request already has a booked deposit or was closed.' })
      return
    }
    const quotedTotal = Number(request.body?.quotedTotal)
    const depositAmount = Number(request.body?.depositAmount)
    const adminNote = typeof request.body?.adminNote === 'string' ? request.body.adminNote.trim().slice(0, 500) : cake.adminNote
    const pickupDate = typeof request.body?.pickupDate === 'string' ? request.body.pickupDate.trim() : cake.pickupDate
    if (!Number.isSafeInteger(quotedTotal) || quotedTotal < 100 || quotedTotal > 100_000_000
      || !Number.isSafeInteger(depositAmount) || depositAmount < 100 || depositAmount > quotedTotal) {
      response.status(400).json({ error: 'Enter a total of at least 100 FCFA and a deposit between 100 FCFA and the total.' })
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate)) {
      response.status(400).json({ error: 'Choose a valid pickup date.' })
      return
    }
    const payToken = cake.payToken || randomUUID()
    await database.prepare(`
      UPDATE cake_requests
      SET status = 'contacted', quoted_total = ?, deposit_amount = ?, admin_note = ?, pickup_date = ?,
        pay_token = ?, deposit_reference = NULL, deposit_provider = NULL, deposit_external_reference = NULL
      WHERE id = ?
    `).run(quotedTotal, depositAmount, adminNote, pickupDate, payToken, id)
    const updated = await getCake(id)
    sendEmail(`cake quote #${id}`, () => email.sendCakeQuote({
      to: updated.customerEmail,
      request: updated,
      payUrl: `${publicSiteUrl()}/custom-cake?pay=${payToken}`,
    }))
    response.json({ request: updated })
  })

  app.get('/api/customer/cake-requests', requireCustomer, async (request, response) => {
    const rows = await database.prepare(`${SELECT_CAKE} WHERE r.customer_id = ? OR r.customer_email = ? ORDER BY r.id DESC LIMIT 50`)
      .all(request.customer.id, request.customer.email)
    response.json({ requests: rows.map((row) => present(row, { includeToken: true })) })
  })

  app.get('/api/cake-requests/quote/:token', async (request, response) => {
    const cake = await getCakeByToken(request.params.token)
    if (!cake || !['contacted', 'confirmed'].includes(cake.status)) {
      response.status(404).json({ error: 'This cake quote is no longer available.' })
      return
    }
    response.json({ request: publicCake(cake) })
  })

  app.post('/api/customer/cake-requests/:id/deposit', requireCustomer, async (request, response) => {
    const id = Number(request.params.id)
    const cake = Number.isSafeInteger(id) ? present(await database.prepare(`${SELECT_CAKE} WHERE r.id = ?`).get(id), { includeToken: true }) : null
    if (!cake || (Number(cake.customerId) !== Number(request.customer.id) && cake.customerEmail !== request.customer.email)) {
      response.status(404).json({ error: 'Cake request not found.' })
      return
    }
    try {
      const result = await startDeposit(cake, {
        method: request.body?.method === 'campay' ? 'campay' : 'card',
        phone: request.body?.phone,
        origin: publicSiteUrl(),
      })
      if (result.error) {
        response.status(result.status || 400).json({ error: result.error })
        return
      }
      response.json({ url: result.url })
    } catch (error) {
      console.error(`Unable to start deposit payment for cake request #${id}:`, error.message)
      response.status(502).json({ error: error.message.startsWith('Enter a valid Cameroon') ? error.message : 'The deposit payment could not be started. Please try again.' })
    }
  })

  app.post('/api/cake-requests/quote/:token/deposit', async (request, response) => {
    const cake = await getCakeByToken(request.params.token)
    if (!cake) {
      response.status(404).json({ error: 'This cake quote is no longer available.' })
      return
    }
    try {
      const result = await startDeposit(cake, {
        method: request.body?.method === 'campay' ? 'campay' : 'card',
        phone: request.body?.phone,
        origin: publicSiteUrl(),
      })
      if (result.error) {
        response.status(result.status || 400).json({ error: result.error })
        return
      }
      response.json({ url: result.url })
    } catch (error) {
      console.error(`Unable to start deposit payment for cake request #${cake.id}:`, error.message)
      response.status(502).json({ error: error.message.startsWith('Enter a valid Cameroon') ? error.message : 'The deposit payment could not be started. Please try again.' })
    }
  })

  app.post('/api/customer/cake-requests/:id/deposit/confirm', requireCustomer, async (request, response) => {
    const id = Number(request.params.id)
    const cake = Number.isSafeInteger(id) ? present(await database.prepare(`${SELECT_CAKE} WHERE r.id = ?`).get(id), { includeToken: true }) : null
    if (!cake || (Number(cake.customerId) !== Number(request.customer.id) && cake.customerEmail !== request.customer.email)) {
      response.status(404).json({ error: 'Cake request not found.' })
      return
    }
    try {
      const result = await confirmDeposit(cake, request.body)
      if (result.error) {
        response.status(result.status || 400).json({ error: result.error })
        return
      }
      response.json({ request: result.cake, paid: result.paid })
    } catch (error) {
      console.error(`Unable to confirm deposit for cake request #${id}:`, error.message)
      response.status(502).json({ error: 'The deposit could not be checked yet. Refresh the page in a minute.' })
    }
  })

  app.post('/api/cake-requests/quote/:token/deposit/confirm', async (request, response) => {
    const cake = await getCakeByToken(request.params.token)
    if (!cake) {
      response.status(404).json({ error: 'This cake quote is no longer available.' })
      return
    }
    try {
      const result = await confirmDeposit(cake, request.body)
      if (result.error) {
        response.status(result.status || 400).json({ error: result.error })
        return
      }
      response.json({ request: publicCake(result.cake), paid: result.paid })
    } catch (error) {
      console.error(`Unable to confirm deposit for cake request #${cake.id}:`, error.message)
      response.status(502).json({ error: 'The deposit could not be checked yet. Refresh the page in a minute.' })
    }
  })

  return deps
}
