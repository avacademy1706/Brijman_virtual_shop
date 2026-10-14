// The saved bag. It holds only product id, colour index, frame size, lens configuration and quantity: never prices,
// contact details or prescriptions. Version 2 added the frame size; version 1 lines get the default size once.
import { cfgProblem } from '../../shared/pricing.js';
import { sizeOf } from '../../shared/fit.js';
import { LIMITS } from '../../shared/constants.js';

export const BAG_KEY = 'bm-bag-v2';
export const OLD_BAG_KEY = 'bm-bag-v1';

/**
 * Checks saved lines against the catalogue and normalises them. Lines that no longer match are dropped.
 * @param {unknown} saved parsed localStorage value
 * @param {Record<string, object>} byId catalogue by product id
 * @param {object} lens lens table
 * @returns {{lines: Array<{key: string, pid: string, ci: number, size: string|null, cfg: object, qty: number}>, dropped: number}}
 */
export function cleanBag(saved, byId, lens) {
  const lines = [];
  let dropped = 0;
  for (const l of Array.isArray(saved) ? saved : []) {
    const p = l && byId[l.pid];
    const frame = p && p.type === 'frame';
    const colours = frame ? p.colors.length : 1;
    const size = frame ? sizeOf(p, l.size) : null;
    const valid =
      p &&
      l.cfg &&
      typeof l.cfg === 'object' &&
      Number.isInteger(l.ci) &&
      l.ci >= 0 &&
      l.ci < colours &&
      (!frame || size) &&
      !cfgProblem(p, l.cfg, lens) &&
      lines.length < LIMITS.maxLines;
    if (!valid) {
      dropped++;
      continue;
    }
    const qty = frame ? 1 : Math.max(1, Math.min(LIMITS.maxItemQty, Math.round(+l.qty) || 1));
    lines.push({
      key: String(l.key || lineKey(p, l.ci, size && size.id, l.cfg)),
      pid: p.id,
      ci: l.ci,
      size: size ? size.id : null,
      cfg: l.cfg,
      qty,
    });
  }
  return { lines, dropped };
}

/**
 * Line key. Frames get a unique key per line, so each pair keeps its own prescription; packs of the same kind merge.
 * @param {object} p product
 * @param {number} ci colour index
 * @param {string|null} size frame size id
 * @param {object} cfg lens or pack configuration
 */
export function lineKey(p, ci, size, cfg) {
  const base = p.id + '|' + ci + '|' + (size || '') + '|' + JSON.stringify(cfg);
  return p.type === 'frame' ? base + '|' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : base;
}

/**
 * Reads the bag, migrating version 1 once (frames get their default size) and deleting the old key.
 * @param {{getItem: Function, setItem: Function, removeItem: Function}} storage localStorage or a stand-in
 * @param {Record<string, object>} byId
 * @param {object} lens
 */
export function readBag(storage, byId, lens) {
  const parse = (k) => {
    try {
      const v = storage.getItem(k);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  };
  let saved = parse(BAG_KEY);
  const old = parse(OLD_BAG_KEY);
  if (!saved && Array.isArray(old)) saved = old.map((l) => Object.assign({}, l, { size: null }));
  const out = cleanBag(saved, byId, lens);
  if (old !== null) {
    try {
      storage.setItem(BAG_KEY, JSON.stringify(out.lines));
      storage.removeItem(OLD_BAG_KEY);
    } catch (e) {
      /* storage unavailable */
    }
  }
  return out;
}

/**
 * Writes the bag (only the allowed fields).
 * @param {{setItem: Function}} storage
 * @param {Array<object>} lines
 */
export function writeBag(storage, lines) {
  try {
    storage.setItem(
      BAG_KEY,
      JSON.stringify(lines.map((l) => ({ key: l.key, pid: l.pid, ci: l.ci, size: l.size, cfg: l.cfg, qty: l.qty }))),
    );
  } catch (e) {
    /* storage unavailable */
  }
}
