function parseOrderDate(value) {
  if (!value) return null
  const normalized = String(value).replace(' ', 'T')
  const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function orderWeekday(value) {
  const date = parseOrderDate(value)
  return date ? date.getDay() : -1
}

function weekdaySortOrder(value) {
  const day = orderWeekday(value)
  return day < 0 ? 7 : (day + 6) % 7
}

export function exportOrdersCsv(orders, filename) {
  const escape = (value) => {
    const text = String(value ?? '')
    const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text
    return `"${safeText.replaceAll('"', '""')}"`
  }
  const rows = [
    [
      'Order', 'Day of week', 'Placed', 'Status', 'Fulfillment stage', 'Customer', 'Email',
      'Phone', 'Fulfillment', 'Delivery address', 'City', 'Residence', 'Postal code', 'Store', 'Store address', 'Store phone',
      'Scheduled for', 'Items', 'Subtotal', 'Discount', 'Delivery fee', 'Total', 'Currency',
      'Discount code', 'Delivered',
    ],
    ...[...orders]
      .sort((a, b) => {
        const dayDifference = weekdaySortOrder(a.createdAt) - weekdaySortOrder(b.createdAt)
        return dayDifference || ((parseOrderDate(b.createdAt)?.getTime() || 0) - (parseOrderDate(a.createdAt)?.getTime() || 0))
      })
      .map((order) => {
        const placed = parseOrderDate(order.createdAt)
        const weekday = placed?.toLocaleDateString('en', { weekday: 'long' }) || ''
        return [
          order.id,
          weekday,
          placed?.toISOString() || '',
          order.status,
          order.deliveryStage || order.fulfillmentStatus || '',
          order.customerName,
          order.customerEmail,
          order.customerPhone,
          order.fulfillmentType,
          order.deliveryAddress,
          order.deliveryCity,
          order.deliveryResidence,
          order.deliveryPostalCode,
          order.storeName,
          order.storeAddress,
          order.storePhone,
          order.scheduledFor,
          order.items.map((item) => `${item.quantity}x ${item.flavorName} (${item.unitPriceCents} ${order.currency})`).join('; '),
          order.subtotalCents,
          order.discountCents,
          order.deliveryFee,
          order.totalCents,
          order.currency,
          order.discountCode,
          parseOrderDate(order.deliveredAt)?.toISOString() || '',
        ]
      }),
  ]
  const blob = new Blob([`\uFEFF${rows.map((row) => row.map(escape).join(',')).join('\r\n')}`], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
