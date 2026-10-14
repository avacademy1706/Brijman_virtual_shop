// Demo orders. Contact details and prescriptions are sent once and never stored in the browser.
import { postJSON } from './http.js';

/** A random UUID v4, also on plain-http LAN addresses where crypto.randomUUID is unavailable. */
export function newIdempotencyKey() {
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const x = [...b].map((v) => v.toString(16).padStart(2, '0')).join('');
  return x.slice(0, 8) + '-' + x.slice(8, 12) + '-' + x.slice(12, 16) + '-' + x.slice(16, 20) + '-' + x.slice(20);
}

/**
 * POST /api/v1/orders.
 * @param {object} order body matching OrderSchema in shared/schemas.js
 * @param {string} idempotencyKey one per checkout attempt, so a retried submit returns the same reference
 */
export async function placeOrder(order, idempotencyKey) {
  const { data } = await postJSON('/orders', order, { 'Idempotency-Key': idempotencyKey });
  return data;
}
