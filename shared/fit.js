// Frame fit guide and frame sizes. Pure functions shared by the product sheet, the try-on and the API.

/**
 * Fit thresholds in mm, comparing the frame's total outer width with the estimated face width.
 * Starting values: tune them with real customers.
 */
export const FIT_NARROW_BELOW_MM = -8;
export const FIT_WIDE_ABOVE_MM = 4;

/**
 * @param {number} frameWidthMm total outer width of the frame front
 * @param {number} faceWidthMm estimated face width at the temples
 * @returns {{result: 'narrow'|'good'|'wide', diff: number, label: string}}
 */
export function fitResult(frameWidthMm, faceWidthMm) {
  const diff = frameWidthMm - faceWidthMm;
  const result = diff < FIT_NARROW_BELOW_MM ? 'narrow' : diff > FIT_WIDE_ABOVE_MM ? 'wide' : 'good';
  const label = result === 'good' ? 'Good fit' : result === 'narrow' ? 'May feel narrow' : 'May feel wide';
  return { result, diff, label };
}

/**
 * The size whose width lands closest to the middle of the good range, or null when the current one is already best.
 * @param {Array<{id: string, widthMm: number}>} sizes
 * @param {string} currentId
 * @param {number} faceWidthMm
 */
export function suggestSize(sizes, currentId, faceWidthMm) {
  const target = faceWidthMm + (FIT_NARROW_BELOW_MM + FIT_WIDE_ABOVE_MM) / 2;
  let best = null;
  for (const s of sizes) if (!best || Math.abs(s.widthMm - target) < Math.abs(best.widthMm - target)) best = s;
  if (!best || best.id === currentId) return null;
  const cur = sizes.find((s) => s.id === currentId);
  // Only suggest a change that moves the fit into the good range or closer to it.
  if (cur && fitResult(cur.widthMm, faceWidthMm).result === 'good') return null;
  return best.id;
}

/* ---------- Sizes ---------- */
/**
 * The size entry for an id, or the default size. Non-frames have no sizes.
 * @param {object} p product
 * @param {string} [sizeId]
 */
export function sizeOf(p, sizeId) {
  if (!p || !p.sizes) return null;
  return p.sizes.find((s) => s.id === (sizeId || p.defaultSize)) || null;
}

/** "52□18-145" */
export const sizeMarking = (s) => s.lens + '□' + s.bridge + '-' + s.temple;

/** "M · 52□18-145" */
export const sizeLabel = (s) => s.id + ' · ' + sizeMarking(s);

/**
 * Generates the sample size variants from a frame's current size (which becomes M).
 * Adult optical: S, M, L. Sunglasses and Atelier: M, L. Kids: S, M.
 * @param {{zone: string, sun?: boolean, size: number[]}} p
 */
export function generateSizes(p) {
  const [lens, bridge, temple] = p.size;
  const M = { id: 'M', lens, bridge, temple };
  const L = { id: 'L', lens: lens + 2, bridge: bridge + 1, temple: Math.min(150, temple + 5) };
  if (p.zone === 'kids') return [{ id: 'S', lens: lens - 2, bridge: bridge - 1, temple: Math.max(120, temple - 5) }, M];
  if (p.zone === 'premium' || p.sun) return [M, L];
  return [{ id: 'S', lens: lens - 2, bridge: bridge - 1, temple: 140 }, M, L];
}
