// Pricing and lens rules. Pure functions used by the browser (instant estimates) and the API (the prices that count).
// Every function that needs prices takes the lens table explicitly, so editing data/lenses.json changes prices everywhere.

/**
 * @typedef {{types: Array<{id: string, n: string, p: number}>, index: Array<{id: string, n: string, p: number}>,
 *   coats: Array<{id: string, n: string, p: number, fixed?: boolean}>, sun: Array<{id: string, n: string, p: number}>,
 *   rx: Array<{id: string, n: string}>}} LensTable
 */

/**
 * The colour at an index, wrapping around the product's colour list.
 * @param {object} p product
 * @param {number} [ci] colour index
 */
export const colorOf = (p, ci) =>
  p.colors ? p.colors[(((ci || 0) % p.colors.length) + p.colors.length) % p.colors.length] : null;

/**
 * Lens options a product allows: null for contacts and care, `sun` for sunglasses, otherwise the optical lists.
 * Kids' frames take zero power or single vision only, at index 1.56 or 1.60.
 * @param {object} p product
 */
export const lensRules = (p) => {
  if (p.type !== 'frame') return null;
  if (p.sun) return { mode: 'sun' };
  const kids = p.zone === 'kids';
  return {
    mode: 'optical',
    types: kids ? ['zero', 'sv'] : ['zero', 'sv', 'bf', 'pg'],
    index: kids ? ['156', '160'] : ['156', '160', '167', '174'],
  };
};

/**
 * The configuration a product starts with in the product sheet.
 * @param {object} p product
 */
export const defaultCfg = (p) => {
  if (p.type !== 'frame') return { pack: 0 };
  if (p.sun) return { sunlens: 'plano', rx: 'later' };
  return { type: 'zero', index: '156', coats: [], rx: 'later' };
};

/** True when the chosen lenses are made to a prescription. */
export const needsRx = (p, cfg) => p.type === 'frame' && (p.sun ? cfg.sunlens === 'rxsun' : cfg.type !== 'zero');

/** True when the prescription needs an ADD value (bifocal and progressive). */
export const needsAdd = (p, cfg) => p.type === 'frame' && !p.sun && (cfg.type === 'bf' || cfg.type === 'pg');

/**
 * Unit price in whole rupees, GST included.
 * @param {object} p product
 * @param {object} cfg lens or pack configuration
 * @param {LensTable} lens
 * @returns {number}
 */
export const priceOf = (p, cfg, lens) => {
  if (p.type !== 'frame') return p.packs[cfg.pack || 0].p;
  let t = p.price;
  if (p.sun) {
    const rxsun = lens.sun.find((x) => x.id === 'rxsun');
    return t + (cfg.sunlens === 'rxsun' && rxsun ? rxsun.p : 0);
  }
  const ty = lens.types.find((x) => x.id === cfg.type) || lens.types[0];
  t += ty.p;
  if (cfg.type !== 'zero') {
    const ix = lens.index.find((x) => x.id === cfg.index);
    if (ix) t += ix.p;
  }
  for (const c of cfg.coats || []) {
    const co = lens.coats.find((x) => x.id === c);
    if (co) t += co.p;
  }
  return t;
};

/**
 * One-line description of a configuration, for the bag and checkout.
 * @param {object} p product
 * @param {object} cfg
 * @param {LensTable} lens
 * @returns {string}
 */
export const cfgSummary = (p, cfg, lens) => {
  if (p.type !== 'frame') return p.packs[cfg.pack || 0].n;
  const parts = [];
  if (p.sun)
    parts.push(cfg.sunlens === 'rxsun' ? 'Prescription sun lenses' : 'UV400 lenses' + (p.polar ? ', polarised' : ''));
  else {
    const ty = lens.types.find((x) => x.id === cfg.type);
    parts.push(ty ? ty.n : 'Zero power');
    if (cfg.type !== 'zero') {
      const ix = lens.index.find((x) => x.id === cfg.index);
      if (ix) parts.push(ix.n);
    }
    for (const c of cfg.coats || []) {
      const co = lens.coats.find((x) => x.id === c);
      if (co) parts.push(co.n);
    }
  }
  if (needsRx(p, cfg))
    parts.push(
      cfg.rx === 'now' ? 'Prescription entered' : cfg.rx === 'test' ? 'Eye test first' : 'Prescription to follow',
    );
  return parts.join(' · ');
};

/**
 * Why a configuration is not allowed for a product, or null when it is allowed.
 * The product sheet only offers allowed options; the API uses this to reject anything else.
 * @param {object} p product
 * @param {object} cfg
 * @param {LensTable} lens
 * @returns {string|null}
 */
export const cfgProblem = (p, cfg, lens) => {
  const keys = Object.keys(cfg);
  if (p.type !== 'frame') {
    if (keys.length !== 1 || keys[0] !== 'pack') return 'Choose a pack size.';
    return Number.isInteger(cfg.pack) && cfg.pack >= 0 && cfg.pack < p.packs.length
      ? null
      : 'This pack size is not available.';
  }
  if (cfg.rx !== undefined && !lens.rx.some((o) => o.id === cfg.rx)) return 'Choose how to share your prescription.';
  const rules = lensRules(p);
  if (rules.mode === 'sun') {
    if (keys.some((k) => k !== 'sunlens' && k !== 'rx') || !('sunlens' in cfg))
      return 'Sunglasses take the sun lens options only.';
    return lens.sun.some((o) => o.id === cfg.sunlens) ? null : 'This sun lens option is not available.';
  }
  if (keys.some((k) => !['type', 'index', 'coats', 'rx'].includes(k)) || !('type' in cfg) || !('index' in cfg))
    return 'Choose a lens type and index.';
  if (!rules.types.includes(cfg.type)) return 'This lens type is not available for this frame.';
  if (!rules.index.includes(cfg.index)) return 'This lens index is not available for this frame.';
  if (cfg.type === 'zero' && cfg.index !== '156') return 'Zero-power lenses use the 1.56 index.';
  const coats = cfg.coats || [];
  const optional = lens.coats.filter((c) => !c.fixed).map((c) => c.id);
  if (new Set(coats).size !== coats.length || coats.some((c) => !optional.includes(c)))
    return 'This coating is not available.';
  return null;
};
