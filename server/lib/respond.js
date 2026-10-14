// Response helpers: the success and error envelopes, and the cache policies.

export const CACHE_PUBLIC = 'public, s-maxage=300, stale-while-revalidate=86400';
export const NO_STORE = 'no-store';

/**
 * Success envelope `{ data, meta }`.
 * @param {import('hono').Context} c
 * @param {unknown} data
 * @param {{cache?: string, status?: number, meta?: object, headers?: Record<string, string>}} [opt]
 */
export function ok(c, data, opt = {}) {
  c.header('Cache-Control', opt.cache || NO_STORE);
  for (const [k, v] of Object.entries(opt.headers || {})) c.header(k, v);
  return c.json({ data, meta: Object.assign({ requestId: c.get('requestId') }, opt.meta) }, opt.status || 200);
}

/**
 * Error envelope `{ error: { code, message, fields? } }`.
 * @param {import('hono').Context} c
 * @param {number} status
 * @param {string} code
 * @param {string} message
 * @param {Record<string, string>} [fields]
 * @param {Record<string, string>} [headers]
 */
export function fail(c, status, code, message, fields, headers) {
  c.header('Cache-Control', NO_STORE);
  for (const [k, v] of Object.entries(headers || {})) c.header(k, v);
  const error = { code, message };
  if (fields && Object.keys(fields).length) error.fields = fields;
  return c.json({ error }, status);
}
