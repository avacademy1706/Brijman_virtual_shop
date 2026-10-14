// India Standard Time helpers. IST is UTC+05:30 all year, so a fixed offset is exact and the server's own
// timezone (UTC on Vercel) never matters.
import { IST_OFFSET, IST_OFFSET_MINUTES } from '../../shared/constants.js';

const DAY = 86400000;

/**
 * Today's date in IST as YYYY-MM-DD.
 * @param {number} [now] epoch ms
 */
export function todayIST(now = Date.now()) {
  return new Date(now + IST_OFFSET_MINUTES * 60000).toISOString().slice(0, 10);
}

/**
 * Adds whole days to a YYYY-MM-DD date.
 * @param {string} date
 * @param {number} n
 */
export function addDays(date, n) {
  return new Date(Date.parse(date + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
}

/** Day of the week for a YYYY-MM-DD date: 0 is Sunday. */
export const weekday = (date) => new Date(date + 'T00:00:00Z').getUTCDay();

/** True when the string is a real calendar date in YYYY-MM-DD form. */
export function isDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(s + 'T00:00:00Z');
  return !isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

/** Slot start as an ISO string with the IST offset, for example 2026-10-15T10:30:00+05:30. */
export const slotStart = (date, time) => date + 'T' + time + ':00' + IST_OFFSET;
