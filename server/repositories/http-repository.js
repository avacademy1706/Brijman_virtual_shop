// Future backend over HTTP, implementing the "Backend contract" in docs/openapi.yaml. Not used unless DATA_SOURCE=http.
// BACKEND_API_URL and BACKEND_API_KEY are read on the server only. The key travels in a header, never in a URL.
import { HttpError } from '../lib/errors.js';

const TIMEOUT_MS = 5000;

/**
 * @param {{url?: string, key?: string}} [cfg] defaults to the BACKEND_API_URL and BACKEND_API_KEY env vars
 * @returns {import('./contract.js').Repository}
 */
export function createHttpRepository(cfg = {}) {
  const base = (cfg.url || process.env.BACKEND_API_URL || '').replace(/\/+$/, '');
  const key = cfg.key || process.env.BACKEND_API_KEY || '';
  if (!base || !key)
    throw new Error('HttpRepository is not configured: set BACKEND_API_URL and BACKEND_API_KEY on the server.');
  if (!/^https:\/\//.test(base) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))
    throw new Error('BACKEND_API_URL must use https (http is allowed only for localhost).');

  async function call(method, path, body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(base + path, {
        method,
        headers: Object.assign(
          { Accept: 'application/json', 'X-Api-Key': key },
          body ? { 'Content-Type': 'application/json' } : {},
        ),
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error('Backend answered ' + res.status + ' for ' + method + ' ' + path);
      return await res.json();
    } catch (err) {
      // Log the route only: never the key or the body.
      console.error(JSON.stringify({ level: 'error', msg: 'backend request failed', method, path, err: err.name }));
      throw new HttpError(503, 'backend_unavailable', 'The store system is not available right now. Try again soon.');
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    name: 'http',
    getStore: () => call('GET', '/store'),
    getCatalogue: () => call('GET', '/catalogue'),
    getMerchandising: () => call('GET', '/merchandising'),
    getLenses: () => call('GET', '/lenses'),
    getEyeTestConfig: () => call('GET', '/eye-test/config'),
    saveOrder: async (order) => {
      await call('POST', '/orders', order);
      return { persisted: true };
    },
    saveBooking: async (booking) => {
      await call('POST', '/bookings', booking);
      return { persisted: true };
    },
  };
}
