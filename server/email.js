import nodemailer from 'nodemailer'

function createTransporter() {
  const host = process.env.SMTP_HOST?.trim()
  const port = Number(process.env.SMTP_PORT || 587)
  const from = process.env.SMTP_FROM?.trim()
  const username = process.env.SMTP_USER?.trim()
  const password = process.env.SMTP_PASSWORD

  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Email delivery is not configured. Set SMTP_HOST, SMTP_PORT, and SMTP_FROM.')
  }
  if (Boolean(username) !== Boolean(password)) {
    throw new Error('Email delivery requires both SMTP_USER and SMTP_PASSWORD, or neither.')
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
    text: `Hello ${recipientName},\n\n${reply}\n\nRegards,\n${adminName}\nAntixor Icy`,
  })
}

export async function sendSignupVerificationCode({ to, code }) {
  const { transporter, from } = createTransporter()
  await transporter.sendMail({
    from,
    to,
    subject: 'Verify your email address',
    text: [
      `Your Cold Stone Cameroon verification code is ${code}.`,
      '',
      'Enter this six-digit code to finish creating your account.',
      'This code expires in 10 minutes. If you did not request it, you can ignore this email.',
    ].join('\n'),
  })
}

export async function sendNewOrderNotification({ recipients, orderId, customerName, customerEmail, items, totalCents, currency, orderUrl }) {
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
      'A new order has been placed at Antixor Icy.',
      '',
      `Order: #${orderId}`,
      'Payment status: Awaiting payment',
      `Customer: ${customerName}`,
      `Customer email: ${customerEmail}`,
      '',
      'Items:',
      ...itemLines,
      '',
      `Order total: ${formatAmount(totalCents)}`,
      '',
      `View this order in the admin dashboard: ${orderUrl}`,
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
    subject: `Update on your Antixor Icy order #${orderId}`,
    text: [
      `Hello ${recipientName},`,
      '',
      `Your order #${orderId} ${statusLabel}.`,
      ...receipt,
      '',
      'Thank you,',
      'Antixor Icy',
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
