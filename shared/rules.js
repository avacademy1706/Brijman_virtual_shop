// Field rules for prescriptions, contact details and addresses. Pure functions, no DOM or Node APIs.
// The zod schemas in schemas.js and the browser forms both use these, so there is one source of rules.

/** Prescription limits. */
export const RX = Object.freeze({
  sph: [-20, 12],
  cyl: [-6, 0],
  axis: [1, 180],
  add: [0.75, 3.5],
  pd: [50, 76],
});

const quarter = (v) => Math.abs(v * 4 - Math.round(v * 4)) < 1e-6;
const blank = (v) => v === undefined || v === null || v === '';
const num = (v) => (typeof v === 'number' ? v : parseFloat(v));

/**
 * Checks a prescription. Values may be numbers or the strings typed into the form.
 * @param {{r?: object, l?: object, pd?: number|string}} rx
 * @param {boolean} needAdd true for bifocal and progressive lenses
 * @returns {Array<{path: string, message: string}>} problems, in reading order; empty when valid
 */
export function rxProblems(rx, needAdd) {
  const out = [];
  rx = rx || {};
  for (const eye of ['r', 'l']) {
    const E = eye === 'r' ? 'Right' : 'Left',
      v = rx[eye] || {};
    if (blank(v.sph)) {
      out.push({ path: eye + '.sph', message: E + ' eye: enter SPH (use 0.00 if blank on your prescription).' });
      continue;
    }
    const sph = num(v.sph);
    if (isNaN(sph) || sph < RX.sph[0] || sph > RX.sph[1] || !quarter(sph))
      out.push({ path: eye + '.sph', message: E + ' eye: SPH runs from -20.00 to +12.00 in 0.25 steps.' });
    const cyl = blank(v.cyl) ? 0 : num(v.cyl);
    if (isNaN(cyl) || cyl < RX.cyl[0] || cyl > RX.cyl[1] || !quarter(cyl))
      out.push({ path: eye + '.cyl', message: E + ' eye: CYL runs from -6.00 to 0.00 in 0.25 steps.' });
    else if (cyl !== 0) {
      const ax = blank(v.axis) ? NaN : num(v.axis);
      if (isNaN(ax) || ax < RX.axis[0] || ax > RX.axis[1] || Math.round(ax) !== ax)
        out.push({ path: eye + '.axis', message: E + ' eye: AXIS is a whole number from 1 to 180 when CYL is set.' });
    }
    if (needAdd) {
      const ad = blank(v.add) ? NaN : num(v.add);
      if (isNaN(ad) || ad < RX.add[0] || ad > RX.add[1] || !quarter(ad))
        out.push({
          path: eye + '.add',
          message: E + ' eye: ADD runs from +0.75 to +3.50 for bifocal and progressive lenses.',
        });
    }
  }
  const pd = blank(rx.pd) ? NaN : num(rx.pd);
  if (isNaN(pd) || pd < RX.pd[0] || pd > RX.pd[1]) out.push({ path: 'pd', message: 'PD: enter a value from 50 to 76 mm.' });
  return out;
}

/**
 * Turns a valid form prescription into the numbers the API expects. Call rxProblems first.
 * @param {object} rx
 * @param {boolean} needAdd
 */
export function normalizeRx(rx, needAdd) {
  const eye = (v) => {
    const cyl = blank(v.cyl) ? 0 : num(v.cyl);
    const o = { sph: num(v.sph), cyl, axis: cyl === 0 ? null : num(v.axis) };
    if (needAdd) o.add = num(v.add);
    return o;
  };
  return { r: eye(rx.r || {}), l: eye(rx.l || {}), pd: num(rx.pd) };
}

/* ---------- Contact details and address ---------- */
export const MSG = Object.freeze({
  name: 'Enter your name, 2 to 60 characters.',
  mobile: 'Enter a 10-digit Indian mobile number that starts with 6, 7, 8 or 9.',
  email: 'Enter a valid email address, or leave it empty.',
  line1: 'Enter your house number and street, 3 to 120 characters.',
  city: 'Enter your town or city.',
  pin: 'Enter a 6-digit PIN code.',
  consent: 'Tick the box to agree, so we can process your request.',
});

/** Removes spaces, dashes and a +91, 91 or 0 prefix from a typed mobile number. */
export function normalizeMobile(s) {
  let d = String(s == null ? '' : s).replace(/[\s\-().]/g, '');
  if (d.startsWith('+91')) d = d.slice(3);
  else if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

const text = (s) => typeof s === 'string' && s === s.trim();
export const isName = (s) => text(s) && s.length >= 2 && s.length <= 60 && !/[<>{}]/.test(s);
export const isMobile = (s) => typeof s === 'string' && /^[6-9]\d{9}$/.test(s);
export const isEmail = (s) => typeof s === 'string' && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
export const isLine1 = (s) => text(s) && s.length >= 3 && s.length <= 120;
export const isCity = (s) => text(s) && s.length >= 2 && s.length <= 60;
export const isPin = (s) => typeof s === 'string' && /^[1-9]\d{5}$/.test(s);
