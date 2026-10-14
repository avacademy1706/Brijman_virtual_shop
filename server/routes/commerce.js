// Cart quotes, demo orders, eye-test slots and demo bookings. Every response here is no-store.
import {
  CartQuoteSchema,
  OrderSchema,
  BookingSchema,
  SlotsQuerySchema,
  IdempotencyKeySchema,
  fieldErrors,
} from '../../shared/schemas.js';
import { ok, fail } from '../lib/respond.js';
import { route, jsonBody } from '../lib/http.js';
import { quote } from '../services/quote-service.js';
import { placeOrder } from '../services/order-service.js';
import { listSlots, bookSlot } from '../services/eye-test-service.js';

/**
 * @param {import('hono').Hono} app
 * @param {{repo: () => import('../repositories/contract.js').Repository, now: () => number}} deps
 */
export function registerCommerceRoutes(app, { repo, now }) {
  route(app, '/v1/cart/quote', {
    POST: [jsonBody(CartQuoteSchema), async (c) => ok(c, await quote(repo(), c.get('body').lines))],
  });

  route(app, '/v1/orders', {
    POST: [
      async (c, next) => {
        const key = c.req.header('idempotency-key');
        if (key !== undefined && !IdempotencyKeySchema.safeParse(key).success)
          return fail(c, 422, 'validation_failed', 'Idempotency-Key must be a UUID.', {
            'Idempotency-Key': 'Use a UUID.',
          });
        await next();
      },
      jsonBody(OrderSchema),
      async (c) => {
        const key = c.req.header('idempotency-key');
        const order = await placeOrder(repo(), c.get('body'), key);
        return ok(c, order, { status: 201, headers: key ? { 'Idempotency-Key': key } : {} });
      },
    ],
  });

  route(app, '/v1/eye-test/slots', {
    GET: [
      async (c) => {
        const q = SlotsQuerySchema.safeParse(c.req.query());
        if (!q.success) return fail(c, 422, 'validation_failed', 'Check the date range.', fieldErrors(q.error));
        return ok(c, await listSlots(repo(), q.data, now()));
      },
    ],
  });

  route(app, '/v1/eye-test/bookings', {
    POST: [jsonBody(BookingSchema), async (c) => ok(c, await bookSlot(repo(), c.get('body'), now()), { status: 201 })],
  });
}
