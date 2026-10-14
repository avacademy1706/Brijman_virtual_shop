// Eye-test slots and demo bookings.
import { getJSON, postJSON } from './http.js';

/**
 * GET /api/v1/eye-test/slots. Only future slots come back, grouped by IST date.
 * @param {number} [days] 1 to 14
 * @returns {Promise<{timezone: string, durationMinutes: number, days: Array<{date: string, slots: Array<{start: string, time: string}>}>}>}
 */
export async function getSlots(days) {
  const { data } = await getJSON('/eye-test/slots?days=' + (days || 7));
  return data;
}

/**
 * POST /api/v1/eye-test/bookings.
 * @param {{slotStart: string, name: string, mobile: string, consent: true}} booking
 */
export async function bookEyeTest(booking) {
  const { data } = await postJSON('/eye-test/bookings', booking);
  return data;
}
