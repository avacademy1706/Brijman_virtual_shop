// Razorpay seam. Does nothing until RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set on the server.
// See docs/backend-integration.md for the planned flow.
import { createHmac, timingSafeEqual } from 'node:crypto';

const configured = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

/**
 * Creates a payment for an order. Returns `{ skipped: true }` until Razorpay is connected.
 * @param {object} order priced order
 */
export async function createPayment(order) {
  void order;
  if (!configured()) return { skipped: true, reason: 'not_configured' };
  // Connect here: create a Razorpay order with the server-computed total (in paise) and return its id.
  return { skipped: true, reason: 'not_implemented' };
}

/**
 * Checks a Razorpay webhook signature: HMAC-SHA256 of the raw body with RAZORPAY_WEBHOOK_SECRET, in hex.
 * @param {string} rawBody the body exactly as received, before JSON parsing
 * @param {string} signature value of the X-Razorpay-Signature header
 */
export function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return { skipped: true, reason: 'not_configured' };
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature || ''), 'utf8');
  return { valid: a.length === b.length && timingSafeEqual(a, b) };
}
