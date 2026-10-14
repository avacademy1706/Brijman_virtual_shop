// Limits, currency and timezone shared by the browser and the API. No DOM or Node APIs here.

/** Version reported by GET /api/v1/health. */
export const API_VERSION = '1.0.0';
export const CURRENCY = 'INR';
/** All dates and times are in India Standard Time, which has no daylight saving. */
export const TIMEZONE = 'Asia/Kolkata';
export const IST_OFFSET = '+05:30';
export const IST_OFFSET_MINUTES = 330;

export const LIMITS = Object.freeze({
  /** Largest accepted request body, in bytes. */
  bodyBytes: 16 * 1024,
  /** Most lines in one bag or order. */
  maxLines: 20,
  /** Frames are always one per line, so each pair can carry its own prescription. */
  frameQty: 1,
  /** Most packs of one contact lens or care product per line. */
  maxItemQty: 12,
  /** Longest range of eye-test slots one request can ask for. */
  maxSlotDays: 14,
});
