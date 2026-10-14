// Eye-test slots generated from data/eye-test.json in IST, and demo bookings.
import { refCode } from '../lib/hash.js';
import { invalid } from '../lib/errors.js';
import { todayIST, addDays, weekday, isDate, slotStart } from '../lib/ist.js';
import * as notifications from '../integrations/notifications.js';
import * as crm from '../integrations/crm.js';

const minutes = (hhmm) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5);

/**
 * Future slots, grouped by IST date. Days with no free slot are left out.
 * @param {import('../repositories/contract.js').Repository} repo
 * @param {{from?: string, days?: number}} q
 * @param {number} [now] epoch ms, for tests
 */
export async function listSlots(repo, q, now = Date.now()) {
  if (q.from && !isDate(q.from))
    throw invalid({ from: 'Use a real date in the format YYYY-MM-DD.' }, 'Check the date range.');
  const cfg = await repo.getEyeTestConfig();
  const today = todayIST(now);
  const lastDay = addDays(today, cfg.bookingWindowDays - 1);
  const start = q.from && q.from > today ? q.from : today;
  const open = minutes(cfg.openingHours.open),
    close = minutes(cfg.openingHours.close);
  const earliest = now + cfg.leadTimeMinutes * 60000;
  const days = [];
  for (let i = 0; i < (q.days || 7); i++) {
    const date = addDays(start, i);
    if (date > lastDay) break;
    if (cfg.closedDates.includes(date) || cfg.closedWeekdays.includes(weekday(date))) continue;
    const slots = cfg.slotTimes
      .filter((t) => minutes(t) >= open && minutes(t) + cfg.durationMinutes <= close)
      .map((t) => ({ time: t, start: slotStart(date, t) }))
      .filter((s) => Date.parse(s.start) > earliest);
    if (slots.length) days.push({ date, slots });
  }
  return { timezone: cfg.timezone, durationMinutes: cfg.durationMinutes, days };
}

/**
 * Checks the slot is real and still in the future, then returns a demo reference. Nothing is stored in static mode.
 * @param {import('../repositories/contract.js').Repository} repo
 * @param {{slotStart: string, name: string, mobile: string, consent: true}} body schema-checked
 * @param {number} [now]
 */
export async function bookSlot(repo, body, now = Date.now()) {
  const date = body.slotStart.slice(0, 10);
  const gone = { slotStart: 'This time is no longer available. Pick another slot.' };
  if (!isDate(date)) throw invalid(gone);
  const { days, durationMinutes } = await listSlots(repo, { from: date, days: 1 }, now);
  const ok = days.length && days[0].date === date && days[0].slots.some((s) => s.start === body.slotStart);
  if (!ok) throw invalid(gone);
  const bookingRef = 'BM-ET-DEMO-' + refCode(4);
  const booking = { bookingRef, slotStart: body.slotStart, durationMinutes, name: body.name, mobile: body.mobile };
  await repo.saveBooking(booking);
  await Promise.all([notifications.sendBookingUpdate(booking), crm.pushLead({ type: 'booking', ref: bookingRef })]);
  return { bookingRef, status: 'demo_not_booked', slotStart: body.slotStart, durationMinutes };
}
