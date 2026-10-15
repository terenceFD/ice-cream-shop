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
    return "Brevo blocked the website server's IP address. In Brevo, open Settings > Security > Authorized IPs and turn off blocking for SMTP keys, or authorize the server's outbound IP addresses."
  }
  if (code === 535 || error?.code === 'EAUTH') {
    return 'The mail server rejected the login. Check that SMTP_USER is your Brevo SMTP login and SMTP_PASSWORD is a current Brevo SMTP key (not your account password).'
  }
  if (/sender|from address|not (a )?valid|unverified|not verified/i.test(text) && code >= 500) {
    return 'The mail server refused the sender address. Verify the SMTP_FROM address as a sender in Brevo (Senders, domains & dedicated IPs).'
  }
  if (['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNREFUSED', 'ENOTFOUND', 'EDNS'].includes(error?.code)) {
    return 'The website server could not reach the mail server. Check SMTP_HOST and SMTP_PORT (smtp-relay.brevo.com and 587).'
  }
  if (code) return `The mail server refused the message (code ${code}).`
  return 'The mail server could not be reached.'
}

export function isEmailDeliveryConfigured() {
  const host = process.env.SMTP_HOST?.trim()
  const port = Number(process.env.SMTP_PORT || 587)
  const from = process.env.SMTP_FROM?.trim()
  const username = process.env.SMTP_USER?.trim()
  const password = process.env.SMTP_PASSWORD

  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
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
