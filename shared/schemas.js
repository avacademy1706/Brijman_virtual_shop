// Request schemas for the API, used by the server and the browser. Objects are strict: unknown keys are rejected.
import { z } from 'zod';

import { LIMITS, IST_OFFSET } from './constants.js';
import { MSG, isName, isMobile, isEmail, isLine1, isCity, isPin } from './rules.js';

const id = z.string().regex(/^[a-z]\d{2}$/, 'Unknown product.');

/** Lens configuration for frames, sun lens choice for sunglasses, or pack choice for contacts and care. */
export const LensConfigSchema = z.union([
  z.strictObject({
    type: z.enum(['zero', 'sv', 'bf', 'pg']),
    index: z.enum(['156', '160', '167', '174']),
    coats: z.array(z.string().max(8)).max(4).optional(),
    rx: z.enum(['later', 'now', 'test']).optional(),
  }),
  z.strictObject({
    sunlens: z.enum(['plano', 'rxsun']),
    rx: z.enum(['later', 'now', 'test']).optional(),
  }),
  z.strictObject({ pack: z.number().int().min(0).max(20) }),
]);

export const CartLineSchema = z.strictObject({
  productId: id,
  colourIndex: z.number().int().min(0).max(20),
  config: LensConfigSchema,
  qty: z.number().int().min(1).max(LIMITS.maxItemQty),
});

export const CartQuoteSchema = z.strictObject({
  lines: z.array(CartLineSchema).min(1, 'Your bag is empty.').max(LIMITS.maxLines),
});

const step = (v) => Math.abs(v * 4 - Math.round(v * 4)) < 1e-6;
const EyeSchema = z.strictObject({
  sph: z.number().min(-20).max(12).refine(step),
  cyl: z.number().min(-6).max(0).refine(step),
  axis: z.number().int().min(1).max(180).nullable(),
  add: z.number().min(0.75).max(3.5).refine(step).optional(),
});
/** Numeric prescription as sent with an order. Lens-specific rules (AXIS, ADD) are checked by the order service. */
export const PrescriptionSchema = z.strictObject({ r: EyeSchema, l: EyeSchema, pd: z.number().min(50).max(76) });

export const ContactSchema = z.strictObject({
  name: z.string().max(60).refine(isName, MSG.name),
  mobile: z.string().max(10).refine(isMobile, MSG.mobile),
  email: z.string().max(254).refine(isEmail, MSG.email).optional(),
});

export const DeliverySchema = z.discriminatedUnion('method', [
  z.strictObject({
    method: z.literal('home'),
    line1: z.string().max(120).refine(isLine1, MSG.line1),
    city: z.string().max(60).refine(isCity, MSG.city),
    pin: z.string().max(6).refine(isPin, MSG.pin),
  }),
  z.strictObject({ method: z.literal('store') }),
]);

export const OrderLineSchema = z.strictObject({ ...CartLineSchema.shape, prescription: PrescriptionSchema.optional() });

export const OrderSchema = z.strictObject({
  lines: z.array(OrderLineSchema).min(1, 'Your bag is empty.').max(LIMITS.maxLines),
  contact: ContactSchema,
  delivery: DeliverySchema,
  consent: z.literal(true, { error: MSG.consent }),
});

const slotRe = new RegExp('^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:00' + IST_OFFSET.replace('+', '\\+') + '$');
export const BookingSchema = z.strictObject({
  slotStart: z.string().regex(slotRe, 'Pick a time from the list.'),
  name: ContactSchema.shape.name,
  mobile: ContactSchema.shape.mobile,
  consent: z.literal(true, { error: MSG.consent }),
});

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date format YYYY-MM-DD.');
export const SlotsQuerySchema = z.object({
  from: dateStr.optional(),
  days: z.coerce.number().int().min(1).max(LIMITS.maxSlotDays).optional(),
});

export const ProductsQuerySchema = z.object({
  zone: z.string().max(20).optional(),
  q: z.string().max(80).optional(),
  shape: z.string().max(20).optional(),
  material: z.string().max(40).optional(),
  polarised: z.enum(['true', 'false']).optional(),
  maxPrice: z.coerce.number().int().min(0).max(1000000).optional(),
  type: z.enum(['frame', 'contacts', 'care']).optional(),
});

/** Idempotency-Key header value: a UUID. */
export const IdempotencyKeySchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Idempotency-Key must be a UUID.');

/**
 * Flattens a zod error into `{ "path.to.field": "message" }`, keeping the first message for each path.
 * @param {import('zod').ZodError} error
 * @returns {Record<string, string>}
 */
export function fieldErrors(error) {
  const out = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
