import nodemailer from 'nodemailer'
import { fileURLToPath } from 'node:url'

const SITE_NAME = 'Cold Stone Creamery'
const LOGO_PATH = fileURLToPath(new URL('../public/logo.png', import.meta.url))

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

export function buildBrandedEmail(message) {
  const text = typeof message.text === 'string' ? message.text : ''
  const body = message.html || `<div style="font-family:Arial,sans-serif;color:#102c50;white-space:pre-wrap">${escapeHtml(text)}</div>`
  const fromAddress = message.from.match(/<([^<>]+)>/)?.[1] || message.from
  const attachments = Array.isArray(message.attachments) ? message.attachments : []

  return {
    ...message,
    from: `${SITE_NAME} <${fromAddress}>`,
    text: text.trimEnd().endsWith(SITE_NAME) ? text : `${text.trimEnd()}\n\n${SITE_NAME}`,
    html: `<div style="font-family:Arial,sans-serif;color:#102c50;max-width:600px;margin:0 auto;padding:24px"><table role="presentation" style="width:100%;border-bottom:1px solid #e6ebf1;margin-bottom:24px;padding-bottom:16px"><tr><td style="width:64px;vertical-align:middle"><img src="cid:cold-stone-logo" alt="${SITE_NAME}" width="56" height="56" style="display:block;width:56px;height:56px;border:0;border-radius:50%"></td><td style="vertical-align:middle;padding-left:12px"><strong style="font-size:20px;color:#092a53">${SITE_NAME}</strong></td></tr></table>${body}<p style="border-top:1px solid #e6ebf1;margin-top:28px;padding-top:16px;color:#65748a;font-size:13px">${SITE_NAME}</p></div>`,
    attachments: [
      ...attachments,
      { filename: 'cold-stone-logo.png', path: LOGO_PATH, cid: 'cold-stone-logo' },
    ],
  }
}

function sendBrandedMail(transporter, message) {
  return transporter.sendMail(buildBrandedEmail(message))
}

// Mailjet's HTTPS API. Some hosts (Render's free plan among them) block every outgoing
// SMTP port, so the mail server can never be reached from there. Port 443 is always open,
// so the same Mailjet account can deliver over HTTPS instead. See
// https://dev.mailjet.com/email/guides/send-api-v31/
const MAILJET_SEND_URL = 'https://api.mailjet.com/v3.1/send'
const MAILJET_TIMEOUT_MS = 20_000

function mailjetCredentials() {
  const username = process.env.SMTP_USER?.trim()
  const password = process.env.SMTP_PASSWORD
  return username && password ? { username, password } : null
}

/** True when the Mailjet HTTPS API can be used, whatever the SMTP settings say. */
export function isMailjetApiConfigured() {
  return Boolean(mailjetCredentials())
}

function addressList(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = /^(.*?)\s*<([^<>]+)>$/.exec(entry)
      return match ? { Email: match[2].trim(), Name: match[1].trim() } : { Email: entry }
    })
}

function mailjetError(status, body) {
  const detail = body?.Messages?.[0]?.Errors?.[0]
  const error = new Error(detail?.ErrorMessage || `Mailjet refused the message (HTTP ${status}).`)
  error.responseCode = status
  error.response = `${detail?.ErrorCode || ''} ${detail?.ErrorMessage || ''}`.trim()
  return error
}

async function sendViaMailjetApi(message) {
  const credentials = mailjetCredentials()
  if (!credentials) {
    throw new EmailConfigurationError('Email delivery requires both SMTP_USER and SMTP_PASSWORD, or neither.')
  }
  const branded = buildBrandedEmail(message)
  const from = addressList(branded.from)[0]
  const payload = {
    Messages: [{
      From: from,
      To: addressList(branded.to),
      Subject: branded.subject,
      TextPart: branded.text,
      HTMLPart: branded.html,
    }],
  }
  if (branded.cc) payload.Messages[0].Cc = addressList(branded.cc)
  if (branded.bcc) payload.Messages[0].Bcc = addressList(branded.bcc)
  if (branded.replyTo) payload.Messages[0].ReplyTo = addressList(branded.replyTo)[0]

  let response
  try {
    response = await fetch(MAILJET_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(MAILJET_TIMEOUT_MS),
    })
  } catch (error) {
    const failure = new Error(`The Mailjet API could not be reached: ${error?.message || 'network error'}`)
    failure.code = error?.name === 'TimeoutError' ? 'ETIMEDOUT' : 'ECONNECTION'
    throw failure
  }

  let body = null
  try {
    body = await response.json()
  } catch {
    // A non-JSON body is reported through the status code below.
  }
  if (!response.ok) throw mailjetError(response.status, body)
  const result = body?.Messages?.[0]
  if (result?.Status && result.Status !== 'success') throw mailjetError(response.status, body)
  return {
    messageId: result?.To?.[0]?.MessageUUID || String(result?.To?.[0]?.MessageID || ''),
    response: result?.Status || 'success',
  }
}

/**
 * Sends one branded message. SMTP is used when it is configured; otherwise the Mailjet
 * HTTPS API, which works on hosts that block SMTP ports.
 */
function deliver(message) {
  if (isEmailDeliveryConfigured()) {
    const { transporter } = createTransporter()
    return sendBrandedMail(transporter, message)
  }
  return sendViaMailjetApi(message)
}

/** The sender address every message is sent from. */
function mailFrom() {
  return { from: process.env.SMTP_FROM?.trim() || '' }
}

export class EmailConfigurationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'EmailConfigurationError'
  }
}

/**
 * Explains why the mail server refused a message, in words an owner can act on.
 * Never includes the password or SMTP key.
 */
export function describeEmailError(error) {
  const code = Number(error?.responseCode) || 0
  const text = `${error?.response || ''} ${error?.message || ''}`
  if (code === 525 || /unauthori[sz]ed ip/i.test(text)) {
    return "Mailjet blocked the website server's IP address. In Mailjet, open Account settings and check the API key restrictions."
  }
  if (code === 535 || error?.code === 'EAUTH') {
    return 'The mail server rejected the login. SMTP_USER must be the Mailjet API key and SMTP_PASSWORD the secret key, from Account settings > SMTP and SEND API settings. Do not use your Mailjet sign-in password.'
  }
  if (/sender|from address|not (a )?valid|unverified|not verified/i.test(text) && code >= 500) {
    return 'The mail server refused the sender address. Validate SMTP_FROM in Mailjet under Account settings > Sender addresses and domains.'
  }
  if (['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNREFUSED', 'ENOTFOUND', 'EDNS'].includes(error?.code)) {
    return "The website server could not reach the mail server. Some hosts, including Render's free plan, block outgoing SMTP ports. Set SMTP_USER and SMTP_PASSWORD (the Mailjet API key and secret) so mail is sent over HTTPS instead, or set SMTP_PORT to 2525, SMTP_SECURE to false, and SMTP_HOST to in-v3.mailjet.com."
  }
  if (code) return `The mail server refused the message (code ${code}).`
  return 'The mail server could not be reached.'
}

const SENDER_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isEmailDeliveryConfigured() {
  const host = process.env.SMTP_HOST?.trim()
  const port = Number(process.env.SMTP_PORT || 587)
  const from = process.env.SMTP_FROM?.trim()
  const username = process.env.SMTP_USER?.trim()
  const password = process.env.SMTP_PASSWORD

  if (!host || !from || !SENDER_ADDRESS.test(from) || !Number.isInteger(port) || port < 1 || port > 65535) {
    return false
  }
  if (Boolean(username) !== Boolean(password)) {
    return false
  }
  return true
}

/** True when mail can be sent at all: over SMTP, or over the Mailjet HTTPS API. */
export function isEmailDeliveryAvailable() {
  return isEmailDeliveryConfigured() || isMailjetApiConfigured()
}

function createTransporter() {
  const host = process.env.SMTP_HOST?.trim()
  const port = Number(process.env.SMTP_PORT || 587)
  const from = process.env.SMTP_FROM?.trim()
  const username = process.env.SMTP_USER?.trim()
  const password = process.env.SMTP_PASSWORD

  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new EmailConfigurationError('Email delivery is not configured. Set SMTP_HOST, SMTP_PORT, and SMTP_FROM.')
  }
  if (!SENDER_ADDRESS.test(from)) {
    throw new EmailConfigurationError('SMTP_FROM must be a full email address validated as a sender in Mailjet.')
  }
  if (Boolean(username) !== Boolean(password)) {
    throw new EmailConfigurationError('Email delivery requires both SMTP_USER and SMTP_PASSWORD, or neither.')
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    ...(username ? { auth: { user: username, pass: password } } : {}),
  })
  return { transporter, from }
}

export async function sendContactReply({ to, recipientName, subject, reply, adminName }) {
  const { from } = mailFrom()
  await deliver( {
    from,
    to,
    subject: `Re: ${subject.replace(/[\r\n]+/g, ' ')}`,
    text: `Hello ${recipientName},\n\n${reply}\n\nRegards,\n${adminName}\nCold Stone Creamery`,
  })
}

export async function sendCustomerVerificationCode({ to, code }) {
  const { from } = mailFrom()
  return deliver( {
    from: `Cold Stone Creamery <${from}>`,
    to,
    subject: 'Your Cold Stone Creamery verification code',
    text: [
      'Use this code to verify your email address and finish creating your Cold Stone Creamery account:',
      '',
      code,
      '',
      'This code expires in 10 minutes. If you did not request it, you can ignore this email.',
    ].join('\n'),
    html: `<div style="font-family:Arial,sans-serif;color:#102c50;max-width:480px;margin:auto;padding:24px"><h1 style="font-size:21px;color:#092a53">Verify your email</h1><p>Enter this code to finish creating your Cold Stone Creamery account:</p><p style="display:inline-block;padding:14px 22px;border-radius:12px;background:#f3f6fa;color:#092a53;font-size:30px;font-weight:800;letter-spacing:10px">${code}</p><p style="color:#65748a">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`,
  })
}

export async function sendPasswordResetCode({ to, code }) {
  const { from } = mailFrom()
  return deliver( {
    from: `Cold Stone Creamery <${from}>`,
    to,
    subject: 'Your Cold Stone Creamery password reset code',
    text: [
      'Use this code to reset your Cold Stone Creamery account password:',
      '',
      code,
      '',
      'This code expires in 10 minutes. If you did not request a password reset, you can ignore this email and your password stays as it is.',
    ].join('\n'),
    html: `<div style="font-family:Arial,sans-serif;color:#102c50;max-width:480px;margin:auto;padding:24px"><h1 style="font-size:21px;color:#092a53">Reset your password</h1><p>Enter this code to reset your Cold Stone Creamery account password:</p><p style="display:inline-block;padding:14px 22px;border-radius:12px;background:#f3f6fa;color:#092a53;font-size:30px;font-weight:800;letter-spacing:10px">${code}</p><p style="color:#65748a">This code expires in 10 minutes. If you did not request a password reset, you can ignore this email and your password stays as it is.</p></div>`,
  })
}

export async function sendNewOrderNotification({ recipients, orderId, customerName, customerEmail, storeName, storeAddress, items, totalCents, currency, orderUrl, paymentStatus = 'Awaiting payment' }) {
  if (!recipients.length) {
    throw new Error('No admin email addresses are available for order notifications.')
  }

  const { from } = mailFrom()
  const formatAmount = (amount) => new Intl.NumberFormat('en-CM', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / (currency.toLowerCase() === 'xaf' ? 1 : 100))
  const itemLines = items.map((item) =>
    `- ${item.quantity} × ${item.flavorName} (${formatAmount(item.lineTotalCents)})`
  )
  await deliver( {
    from,
    to: recipients,
    subject: `New order #${orderId} placed`,
    text: [
      'A new order has been placed at Cold Stone Creamery.',
      '',
      `Order: #${orderId}`,
      `Payment status: ${paymentStatus}`,
      `Customer: ${customerName}`,
      `Customer email: ${customerEmail}`,
      `Assigned store: ${storeName}${storeAddress ? ` · ${storeAddress}` : ''}`,
      '',
      'Items:',
      ...itemLines,
      '',
      `Order total: ${formatAmount(totalCents)}`,
      '',
      'Open this order in the admin dashboard:',
      orderUrl,
    ].join('\n'),
  })
}

export async function sendOrderStatusUpdate({
  to,
  recipientName,
  orderId,
  status,
  totalCents,
  currency = 'xaf',
  items = [],
  earnedPoints = 0,
  fulfillmentType,
  scheduledFor,
  deliveryFee = 0,
  trackUrl,
}) {
  const statusLabels = {
    accepted: 'has been accepted',
    preparing: 'is being prepared',
    ready: 'is ready',
    out_for_delivery: 'is out for delivery',
    delivered: 'has been delivered',
  }
  const statusLabel = statusLabels[status]
  if (!statusLabel) throw new Error('The requested order status cannot be emailed.')
  const { from } = mailFrom()
  const formatAmount = (amount) => new Intl.NumberFormat('en-CM', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / (currency.toLowerCase() === 'xaf' ? 1 : 100))
  const receipt = Number.isSafeInteger(totalCents)
    ? [
        '',
        'Digital receipt',
        ...items.map((item) => `- ${item.quantity} × ${item.flavorName}: ${formatAmount(item.lineTotalCents)}`),
        ...(deliveryFee > 0 ? [`Delivery fee: ${formatAmount(deliveryFee)}`] : []),
        ...(scheduledFor ? [`${fulfillmentType === 'pickup' ? 'Pickup' : 'Delivery'} scheduled for: ${new Date(scheduledFor).toLocaleString('en-CM', { timeZone: 'Africa/Douala' })}`] : []),
        `Total paid: ${formatAmount(totalCents)}`,
        ...(earnedPoints > 0 ? [`Loyalty points earned: ${earnedPoints}`] : []),
      ]
    : []
  await deliver( {
    from,
    to,
    subject: `Update on your Cold Stone Creamery order #${orderId}`,
    text: [
      `Hello ${recipientName},`,
      '',
      `Your order #${orderId} ${statusLabel}.`,
      ...receipt,
      '',
      ...(trackUrl
        ? [
            // One tap back into the bag, with the order's items already in it. The link is
            // signed, so it works for a guest who never made an account.
            'Order the same again:',
            trackUrl,
            '',
          ]
        : []),
      'Thank you,',
      'Cold Stone Creamery',
    ].join('\n'),
  })
}

export async function sendReviewReminder({ to, recipientName, orderId, items = [], reviewUrl, orderUrl }) {
  const { from } = mailFrom()
  const itemNames = [...new Set(items.map((item) => item.flavorName).filter(Boolean))]
  await deliver( {
    from,
    to,
    subject: `How was your Cold Stone Creamery order #${orderId}?`,
    text: [
      `Hello ${recipientName},`,
      '',
      `We hope you enjoyed order #${orderId}${itemNames.length ? ` (${itemNames.join(', ')})` : ''}.`,
      'Would you rate it? It takes about 10 seconds and helps other customers choose their treats.',
      '',
      `Rate your order: ${reviewUrl}`,
      ...(orderUrl ? ['', 'Liked it? Order the same again:', orderUrl] : []),
      '',
      'Thank you,',
      'Cold Stone Creamery',
    ].join('\n'),
  })
}

const formatXaf = (amount) => `${new Intl.NumberFormat('en-US').format(Number(amount) || 0)} FCFA`
const eventItemLines = (order) => (order.items || []).map((item) => `- ${item.quantity} × ${item.name} (${formatXaf(item.lineTotal)})`)
const eventSummary = (order) => [
  `Event: ${order.eventType} on ${order.eventDate} at ${order.eventTime}`,
  `Guests: ${order.guestCount}`,
  `${order.fulfillmentType === 'pickup' ? 'Pickup at' : 'Delivery from'}: ${order.storeName || 'store'}${order.deliveryAddress ? ` to ${order.deliveryAddress}` : ''}`,
]

export async function sendEventRequestNotification({ recipients, order, adminUrl }) {
  if (!recipients.length) return
  const { from } = mailFrom()
  await deliver( {
    from,
    to: recipients,
    subject: `New event order request #${order.id} for ${order.eventDate}`,
    text: [
      `${order.customerName} requested an event order.`,
      '',
      ...eventSummary(order),
      `Contact: ${order.customerEmail}, ${order.customerPhone}`,
      '',
      'Items:',
      ...eventItemLines(order),
      `Estimated total: ${formatXaf(order.estimatedTotal)}`,
      ...(order.notes ? ['', `Notes: ${order.notes}`] : []),
      '',
      `Review it and send a quote: ${adminUrl}`,
    ].join('\n'),
  })
}

export async function sendEventQuote({ to, order, payUrl }) {
  const { from } = mailFrom()
  await deliver( {
    from,
    to,
    subject: `Your Cold Stone Creamery event quote #${order.id}`,
    text: [
      `Hello ${order.customerName},`,
      '',
      `Thank you for your event order request. Here is your quote:`,
      '',
      ...eventSummary(order),
      '',
      ...eventItemLines(order),
      '',
      `Total: ${formatXaf(order.quotedTotal)}`,
      `Deposit to book your date: ${formatXaf(order.depositAmount)}`,
      ...(order.adminNote ? ['', `Note from the store: ${order.adminNote}`] : []),
      '',
      `Pay the deposit to confirm: ${payUrl}`,
      '',
      'The rest is paid on the day of the event.',
      '',
      'Thank you,',
      'Cold Stone Creamery',
    ].join('\n'),
  })
}

export async function sendEventDepositReceived({ recipients, order, adminUrl }) {
  if (!recipients.length) return
  const { from } = mailFrom()
  await deliver( {
    from,
    to: recipients,
    subject: `Deposit received for event order #${order.id}`,
    text: [
      `${order.customerName} paid the ${formatXaf(order.depositAmount)} deposit for event order #${order.id}.`,
      '',
      ...eventSummary(order),
      `Total agreed: ${formatXaf(order.quotedTotal)}`,
      '',
      `Confirm the event: ${adminUrl}`,
    ].join('\n'),
  })
}

export async function sendCakeQuote({ to, request, payUrl }) {
  const { from } = mailFrom()
  await deliver( {
    from,
    to,
    subject: `Your Cold Stone Creamery cake quote #${request.id}`,
    text: [
      `Hello ${request.customerName},`,
      '',
      'Here is the quote for your custom cake request.',
      '',
      `Cake: ${request.size} ${request.flavor}`,
      `Pickup: ${request.pickupDate}${request.storeName ? ` at ${request.storeName}` : ''}`,
      `Total: ${formatXaf(request.quotedTotal)}`,
      `Deposit to book the cake: ${formatXaf(request.depositAmount)}`,
      ...(request.adminNote ? ['', `Note from the store: ${request.adminNote}`] : []),
      '',
      `Pay the deposit to confirm: ${payUrl}`,
      '',
      'The rest is paid when you pick up the cake.',
      '',
      'Thank you,',
      'Cold Stone Creamery',
    ].join('\n'),
  })
}

export async function sendCakeDepositReceived({ recipients, request, adminUrl }) {
  if (!recipients.length) return
  const { from } = mailFrom()
  await deliver( {
    from,
    to: recipients,
    subject: `Deposit received for cake request #${request.id}`,
    text: [
      `${request.customerName} paid the ${formatXaf(request.depositAmount)} deposit for cake request #${request.id}.`,
      '',
      `Cake: ${request.size} ${request.flavor}`,
      `Pickup: ${request.pickupDate}${request.storeName ? ` at ${request.storeName}` : ''}`,
      `Total agreed: ${formatXaf(request.quotedTotal)}`,
      '',
      `Open the request: ${adminUrl}`,
    ].join('\n'),
  })
}

export async function sendCakeRequestNotification({
  recipients,
  requestId,
  customerName,
  customerEmail,
  customerPhone,
  size,
  flavor,
  message,
  toppings,
  pickupDate,
}) {
  if (!recipients.length) {
    throw new Error('No admin email addresses are available for cake-request notifications.')
  }
  const { from } = mailFrom()
  await deliver( {
    from,
    to: recipients,
    subject: `Custom cake request #${requestId}`,
    text: [
      `A custom cake request (#${requestId}) was submitted.`,
      `Customer: ${customerName}`,
      `Email: ${customerEmail}`,
      `Phone: ${customerPhone}`,
      `Size: ${size}`,
      `Flavor: ${flavor}`,
      `Toppings: ${toppings.join(', ') || 'None'}`,
      `Pickup date requested: ${pickupDate}`,
      `Message: ${message || 'None'}`,
    ].join('\n'),
  })
}

// Newsletter emails. Subscribers get one branded welcome note; the owner can
// broadcast a message to everyone still subscribed. Unsubscribe links point at
// the public endpoint so a broadcast stays compliant without extra state.
const unsubscribeFooter = (siteUrl) =>
  `Unsubscribe: ${siteUrl ? `${siteUrl}/unsubscribe` : 'reply to this email and ask to be removed'}`

export async function sendNewsletterWelcome({ to, siteUrl }) {
  const { from } = mailFrom()
  const url = siteUrl || ''
  return deliver( {
    from: `Cold Stone Creamery <${from}>`,
    to,
    subject: 'You are on the list — Cold Stone Creamery',
    text: [
      'Welcome to the Cold Stone Creamery Cameroon list!',
      '',
      'You will hear from us when a new flavor lands or a members-only offer goes live — never more than a few emails a month.',
      '',
      `Start browsing: ${url}/menu`,
      unsubscribeFooter(url),
    ].join('\n'),
    html: `<div style="font-family:Arial,sans-serif;color:#102c50;max-width:480px;margin:auto;padding:24px"><h1 style="font-size:21px;color:#092a53">Welcome to the list</h1><p>You will hear from us when a new flavor lands or a members-only offer goes live — never more than a few emails a month.</p>${url ? `<p><a href="${url}/menu" style="color:#092a53">Start browsing the menu</a></p>` : ''}<p style="color:#65748a;font-size:13px">${unsubscribeFooter(url)}</p></div>`,
  })
}

export async function sendNewsletterBroadcast({ recipients, subject, message, siteUrl }) {
  const { from } = mailFrom()
  const url = siteUrl || ''
  // One connection, many recipients: nodemailer accepts an address list for to.
  return deliver( {
    from: `Cold Stone Creamery <${from}>`,
    to: recipients.join(', '),
    subject: `${subject} — Cold Stone Creamery`,
    text: [
      message,
      '',
      unsubscribeFooter(url),
    ].join('\n'),
    html: `<div style="font-family:Arial,sans-serif;color:#102c50;max-width:480px;margin:auto;padding:24px">${message
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${paragraph.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`)
      .join('')}<p style="color:#65748a;font-size:13px">${unsubscribeFooter(url)}</p></div>`,
  })
}

export async function sendAbandonedCartReminder({ to, recipientName, orderId, bagUrl }) {
  const { from } = mailFrom()
  return deliver( {
    from: `Cold Stone Creamery <${from}>`,
    to,
    subject: 'Your bag is waiting — Cold Stone Creamery',
    text: [
      `Hello ${recipientName || 'there'},`,
      '',
      `Your order #${orderId} was left at the payment step, so we kept the items aside for a short while. If you still want them, your bag is right where you left it:`,
      '',
      bagUrl || '',
      '',
      'If you changed your mind, no action is needed and nothing was charged.',
    ].join('\n'),
    html: `<div style="font-family:Arial,sans-serif;color:#102c50;max-width:480px;margin:auto;padding:24px"><h1 style="font-size:21px;color:#092a53">Your bag is waiting</h1><p>Hello ${recipientName || 'there'}, your order #${orderId} was left at the payment step, so we kept the items aside for a short while.</p>${bagUrl ? `<p><a href="${bagUrl}" style="display:inline-block;padding:12px 22px;border-radius:12px;background:#092a53;color:#ffdc32;font-weight:800;text-decoration:none">Open your bag</a></p>` : ''}<p style="color:#65748a">If you changed your mind, no action is needed and nothing was charged.</p></div>`,
  })
}
