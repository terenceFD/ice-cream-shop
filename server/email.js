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

export async function sendNewOrderNotification({ recipients, orderId, customerName, customerEmail, items, totalCents, currency, orderUrl }) {
  if (!recipients.length) {
    throw new Error('No admin email addresses are available for order notifications.')
  }

  const { transporter, from } = createTransporter()
  const itemLines = items.map((item) =>
    `- ${item.quantity} × ${item.flavorName} ($${(item.lineTotalCents / 100).toFixed(2)})`
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
      `Order total: ${(totalCents / 100).toFixed(2)} ${currency.toUpperCase()}`,
      '',
      `View this order in the admin dashboard: ${orderUrl}`,
    ].join('\n'),
  })
}
