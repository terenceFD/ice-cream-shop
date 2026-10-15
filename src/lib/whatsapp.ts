// WhatsApp click-to-chat links (https://wa.me). They open WhatsApp with a message already typed,
// on phones and on computers with WhatsApp Web, without any WhatsApp Business API account.

/** Turns a Cameroon phone number in any common format into the digits WhatsApp expects (2376XXXXXXXX). */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const withoutZeros = digits.replace(/^00/, "");
  if (/^237[26]\d{8}$/.test(withoutZeros)) return withoutZeros;
  if (/^[26]\d{8}$/.test(withoutZeros)) return `237${withoutZeros}`;
  // Other countries: accept a plausible international number as given.
  return /^\d{8,15}$/.test(withoutZeros) ? withoutZeros : null;
}

export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  const number = whatsappNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;
}

/** The message staff send a customer about their order's current step. */
export function orderUpdateMessage(order: { id: number; customerName?: string; fulfillmentType?: string; storeName?: string }, stage: string): string {
  const name = (order.customerName || "").split(/\s+/)[0] || "there";
  const pickup = order.fulfillmentType === "pickup";
  const step: Record<string, string> = {
    accepted: `your order #${order.id} has been accepted and the store will start on it shortly.`,
    preparing: `your order #${order.id} is being prepared right now.`,
    ready: pickup
      ? `your order #${order.id} is ready for pickup${order.storeName ? ` at ${order.storeName}` : ""}.`
      : `your order #${order.id} is packed and waiting for the rider.`,
    out_for_delivery: `your order #${order.id} is out for delivery. Please keep your phone close.`,
    delivered: `your order #${order.id} has been delivered. Enjoy, and thank you for choosing us!`,
  };
  return `Hello ${name}, this is Cold Stone Creamery: ${step[stage] || `here is an update about your order #${order.id}.`}`;
}
