import nodemailer from 'nodemailer'

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
    return "The website server could not reach the mail server. Some hosts, including Render's free plan, block ports 25, 465 and 587. Set SMTP_PORT to 2525, SMTP_SECURE to false, and SMTP_HOST to in-v3.mailjet.com."
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
  const { transporter, from } = createTransporter()
  await transporter.sendMail({
    from,
    to,
    subject: `Re: ${subject.replace(/[\r\n]+/g, ' ')}`,
    text: `Hello ${recipientName},\n\n${reply}\n\nRegards,\n${adminName}\nCold Stone Creamery`,
  })
}

export async function sendCustomerVerificationCode({ to, code }) {
  const { transporter, from } = createTransporter()
  return transporter.sendMail({
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

export async function sendNewOrderNotification({ recipients, orderId, customerName, customerEmail, storeName, storeAddress, items, totalCents, currency, orderUrl, paymentStatus = 'Awaiting payment' }) {
  if (!recipients.length) {
    throw new Error('No admin email addresses are available for order notifications.')
  }

  const { transporter, from } = createTransporter()
  const formatAmount = (amount) => new Intl.NumberFormat('en-CM', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / (currency.toLowerCase() === 'xaf' ? 1 : 100))
  const itemLines = items.map((item) =>
    `- ${item.quantity} × ${item.flavorName} (${formatAmount(item.lineTotalCents)})`
  )
  await transporter.sendMail({
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
  const { transporter, from } = createTransporter()
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
  await transporter.sendMail({
    from,
    to,
    subject: `Update on your Cold Stone Creamery order #${orderId}`,
    text: [
      `Hello ${recipientName},`,
      '',
      `Your order #${orderId} ${statusLabel}.`,
      ...receipt,
      '',
      'Thank you,',
      'Cold Stone Creamery',
    ].join('\n'),
  })
}

export async function sendReviewReminder({ to, recipientName, orderId, items = [], reviewUrl }) {
  const { transporter, from } = createTransporter()
  const itemNames = [...new Set(items.map((item) => item.flavorName).filter(Boolean))]
  await transporter.sendMail({
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
  const { transporter, from } = createTransporter()
  await transporter.sendMail({
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
  const { transporter, from } = createTransporter()
  await transporter.sendMail({
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
  const { transporter, from } = createTransporter()
  await transporter.sendMail({
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
  const { transporter, from } = createTransporter()
  await transporter.sendMail({
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
  const { transporter, from } = createTransporter()
  await transporter.sendMail({
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
  const { transporter, from } = createTransporter()
  await transporter.sendMail({
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
