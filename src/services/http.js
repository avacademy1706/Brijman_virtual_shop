// Same-origin JSON client for /api/v1. 8 s timeout, typed errors, one retry for a GET that fails on the network.

/** Where the browser gets its data: 'api' (default) or 'static' (bundled JSON, no checkout or booking). Public, never a secret. */
export const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE === 'static' ? 'static' : 'api';
export const TIMEOUT_MS = 8000;

/** An API or network failure. `status` is 0 when the request never got a response. */
export class ApiError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {string} message
   * @param {Record<string, string>} [fields]
   */
  constructor(status, code, message, fields) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields || null;
  }
}

const NETWORK_MSG = 'We could not reach the showroom server. Check your connection and try again.';

async function once(method, path, body, headers) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch('/api/v1' + path, {
      method,
      headers: Object.assign({ Accept: 'application/json' }, body ? { 'Content-Type': 'application/json' } : {}, headers),
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      signal: ctrl.signal,
    });
  } catch (err) {
    const timeout = err && err.name === 'AbortError';
    throw new ApiError(0, timeout ? 'timeout' : 'network', timeout ? 'The server took too long to answer. Try again.' : NETWORK_MSG);
  } finally {
    clearTimeout(timer);
  }
  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    /* not JSON: handled below */
  }
  if (!res.ok || !json || !('data' in json)) {
    const e = (json && json.error) || {};
    throw new ApiError(res.status, e.code || 'bad_response', e.message || 'Something went wrong. Try again.', e.fields);
  }
  return { data: json.data, meta: json.meta || {}, headers: res.headers };
}

/**
 * GET a /api/v1 path. Retries once if the network fails (not on timeouts or HTTP errors).
 * @param {string} path for example '/bootstrap'
 */
export async function getJSON(path) {
  try {
    return await once('GET', path);
  } catch (err) {
    if (err instanceof ApiError && err.code === 'network') return once('GET', path);
    throw err;
  }
}

/**
 * POST JSON to a /api/v1 path. Never retried, so an order is never sent twice by this client.
 * @param {string} path
 * @param {object} body
 * @param {Record<string, string>} [headers]
 */
export function postJSON(path, body, headers) {
  return once('POST', path, body, headers);
}
