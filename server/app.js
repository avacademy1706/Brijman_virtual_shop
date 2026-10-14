// The API: one Hono app under /api, shared by the Vercel Function (api/index.js), `npm run dev`, `npm run preview`
// and the tests. Same-origin only: no CORS headers are ever sent.
import { Hono } from 'hono';

import { HttpError } from './lib/errors.js';
import { fail } from './lib/respond.js';
import { getRepository } from './repositories/index.js';
import { registerCatalogueRoutes } from './routes/catalogue.js';
import { registerCommerceRoutes } from './routes/commerce.js';

const quiet = () => !!process.env.VITEST;

/**
 * Builds the API app.
 * @param {{repo?: import('./repositories/contract.js').Repository, now?: () => number}} [opts] test overrides
 */
export function createApp(opts = {}) {
  const repo = opts.repo ? () => opts.repo : getRepository;
  const now = opts.now || Date.now;
  const app = new Hono().basePath('/api');

  // Request id, standard headers and a log line with route, status, duration and id only (no bodies, no personal data).
  app.use('*', async (c, next) => {
    const id = crypto.randomUUID();
    c.set('requestId', id);
    const t0 = performance.now();
    await next();
    c.header('X-Request-Id', id);
    c.header('X-Content-Type-Options', 'nosniff');
    if (!quiet())
      console.log(
        JSON.stringify({
          rid: id,
          method: c.req.method,
          route: new URL(c.req.url).pathname,
          status: c.res.status,
          ms: Math.round(performance.now() - t0),
        }),
      );
  });

  // RATE LIMIT HOOK: an in-memory limiter is useless on serverless (every instance has its own memory).
  // Use Vercel WAF rate limiting (docs/backend-integration.md) or plug a shared store (for example Upstash) in here.
  app.use('/v1/*', async (c, next) => {
    await next();
  });

  registerCatalogueRoutes(app, { repo });
  registerCommerceRoutes(app, { repo, now });

  app.notFound((c) => fail(c, 404, 'not_found', 'No API route matches this address.'));
  app.onError((err, c) => {
    if (err instanceof HttpError) return fail(c, err.status, err.code, err.message, err.fields);
    // Log the error type and message only. Never the request body; responses never include a stack trace.
    console.error(JSON.stringify({ level: 'error', rid: c.get('requestId'), err: err.name, msg: err.message }));
    return fail(c, 500, 'internal_error', 'Something went wrong on our side. Try again in a moment.');
  });
  return app;
}

export const app = createApp();
