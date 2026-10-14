// WhatsApp updates through WaMark. Does nothing until WAMARK_API_URL and WAMARK_API_KEY are set on the server.

const configured = () => !!(process.env.WAMARK_API_URL && process.env.WAMARK_API_KEY);

/**
 * Sends an order update to the customer's WhatsApp.
 * @param {object} order
 */
export async function sendOrderUpdate(order) {
  void order;
  if (!configured()) return { skipped: true, reason: 'not_configured' };
  return { skipped: true, reason: 'not_implemented' };
}

/**
 * Sends an eye-test booking confirmation to WhatsApp.
 * @param {object} booking
 */
export async function sendBookingUpdate(booking) {
  void booking;
  if (!configured()) return { skipped: true, reason: 'not_configured' };
  return { skipped: true, reason: 'not_implemented' };
}
