function destinationNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '').replace(/^00/, '')
  if (/^237[26]\d{8}$/.test(digits)) return digits
  if (/^[26]\d{8}$/.test(digits)) return `237${digits}`
  return /^\d{8,15}$/.test(digits) ? digits : ''
}

export function isWhatsAppMessagingConfigured() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim())
}

/** Sends a WhatsApp text to a customer. Returns false when messaging is not configured. */
export async function sendWhatsAppText({ to, text }) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim()
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  const destination = destinationNumber(to)
  if (!token || !phoneNumberId || !destination || !text) return false

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: destination,
      type: 'text',
      text: { body: text.slice(0, 1000), preview_url: false },
    }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail.slice(0, 240) || `WhatsApp message failed (${response.status}).`)
  }
  return true
}
