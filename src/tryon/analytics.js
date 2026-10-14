// Privacy-safe try-on analytics. A no-op for now; it will be wired to DGCC later.
// Allowed events and properties only: never measurements, landmarks, photos or anything that identifies a person.

const EVENTS = new Set([
  'tryon_open',
  'tryon_size_change',
  'tryon_colour_change',
  'tryon_photo',
  'tryon_add_to_bag',
  'fit_result',
]);
const PROPS = new Set(['productId', 'sizeId', 'colourIndex', 'source', 'result']);
const RESULTS = new Set(['good', 'narrow', 'wide']);

/**
 * Records a try-on event. Unknown events and properties are dropped; `fit_result` carries only good, narrow or wide.
 * @param {string} event
 * @param {Record<string, string|number>} [props]
 * @returns {{event: string, props: object}|null} what would be sent (for tests)
 */
export function track(event, props = {}) {
  if (!EVENTS.has(event)) return null;
  const clean = {};
  for (const [k, v] of Object.entries(props))
    if (PROPS.has(k) && (typeof v === 'string' || typeof v === 'number')) clean[k] = v;
  if (event === 'fit_result' && !RESULTS.has(clean.result)) return null;
  // Integration point: send `{ event, props: clean }` to DGCC here once it is configured.
  return { event, props: clean };
}
