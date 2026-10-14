// Request plumbing shared by the routes: JSON body parsing with size and type checks, 405 handling and ETags.
import { LIMITS } from '../../shared/constants.js';
import { fieldErrors } from '../../shared/schemas.js';
import { ok, fail, CACHE_PUBLIC } from './respond.js';

/** Reads a request body as text, giving up (null) once it passes `limit` bytes. */
async function readLimited(req, limit) {
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let off = 0;
  for (const ch of chunks) {
    all.set(ch, off);
    off += ch.byteLength;
  }
  return new TextDecoder().decode(all);
}

const tooLarge = (c) =>
  fail(c, 413, 'payload_too_large', 'The request body is larger than ' + LIMITS.bodyBytes / 1024 + ' KB.');

/**
 * Middleware for POST routes: requires JSON, checks the size before parsing, parses, then validates with a zod
 * schema. The validated body is available as `c.get('body')`.
 * @param {import('zod').ZodType} schema
 */
export const jsonBody = (schema) => async (c, next) => {
  const type = c.req.header('content-type') || '';
  if (!/^application\/json\s*(;|$)/i.test(type))
    return fail(
      c,
      415,
      'unsupported_media_type',
      'Send the body as JSON with the header Content-Type: application/json.',
    );
  const declared = Number(c.req.header('content-length'));
  if (declared > LIMITS.bodyBytes) return tooLarge(c);
  const raw = await readLimited(c.req.raw, LIMITS.bodyBytes);
  if (raw === null) return tooLarge(c);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return fail(c, 400, 'malformed_json', 'The request body is not valid JSON.');
  }
  const result = schema.safeParse(parsed);
  if (!result.success) return fail(c, 422, 'validation_failed', 'Some details need fixing.', fieldErrors(result.error));
  c.set('body', result.data);
  await next();
};

/**
 * Registers handlers for one path, and answers 405 (with an Allow header) for any other method.
 * @param {import('hono').Hono} app
 * @param {string} path
 * @param {Record<string, Function[]>} handlers for example `{ GET: [handler] }`
 */
export function route(app, path, handlers) {
  for (const [method, list] of Object.entries(handlers)) app.on(method, path, ...list);
  const allow = Object.keys(handlers)
    .concat(handlers.GET ? ['HEAD'] : [])
    .join(', ');
  app.all(path, (c) =>
    fail(c, 405, 'method_not_allowed', 'This address accepts ' + allow + ' only.', null, { Allow: allow }),
  );
}

/**
 * Sends a cacheable payload with an ETag, or 304 Not Modified when the client already has it.
 * @param {import('hono').Context} c
 * @param {{data: unknown, etag: string}} value
 */
export function cached(c, value) {
  const tags = (c.req.header('if-none-match') || '').split(',').map((t) => t.trim().replace(/^W\//, ''));
  if (tags.includes(value.etag)) {
    c.header('ETag', value.etag);
    c.header('Cache-Control', CACHE_PUBLIC);
    return c.body(null, 304);
  }
  return ok(c, value.data, { cache: CACHE_PUBLIC, headers: { ETag: value.etag } });
}
