// The interface every data source implements. The API only talks to a repository, so a real backend
// (our Node server, Supabase or DGCC) replaces StaticRepository by adding one file and changing DATA_SOURCE.

/**
 * @typedef {object} StoreFile
 * @property {object} store  name, tagline, hours, address, services
 * @property {object[]} zones sections: id, name, short, rect, view, anchor, blurb
 * @property {string[]} tour  section ids in tour order
 * @property {Record<string, string>} tourText
 */

/**
 * @typedef {object} EyeTestConfig
 * @property {string} timezone always Asia/Kolkata
 * @property {number} durationMinutes
 * @property {{open: string, close: string}} openingHours HH:MM
 * @property {string[]} slotTimes HH:MM start times
 * @property {number} bookingWindowDays how many days ahead, counting today
 * @property {number} leadTimeMinutes slots starting sooner than this are not offered
 * @property {string[]} closedDates YYYY-MM-DD
 * @property {number[]} closedWeekdays 0 is Sunday
 */

/**
 * @typedef {object} Repository
 * @property {string} name 'static' or 'http'
 * @property {() => Promise<StoreFile>} getStore
 * @property {() => Promise<{products: object[]}>} getCatalogue
 * @property {() => Promise<object>} getMerchandising
 * @property {() => Promise<object>} getLenses
 * @property {() => Promise<EyeTestConfig>} getEyeTestConfig
 * @property {(order: object) => Promise<{persisted: boolean}>} saveOrder priced order with contact and delivery details
 * @property {(booking: object) => Promise<{persisted: boolean}>} saveBooking
 */

/** Method names every repository must have. The contract test checks them. */
export const REPOSITORY_METHODS = [
  'getStore',
  'getCatalogue',
  'getMerchandising',
  'getLenses',
  'getEyeTestConfig',
  'saveOrder',
  'saveBooking',
];
