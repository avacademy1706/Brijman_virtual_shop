// Body measurements from the shopper's own numbers (height, chest, waist, hip in cm), so the mannequin viewer
// and the size advice match their body. Pure JavaScript; values stay on the device.
import { defaultMeasurements } from './body.js';

const KIND = { women: 'female', men: 'male', kids: 'child', free: 'female' };
/** Approximate standing height (m) of a measurement set: floor to the top of the head. */
export function heightOf(m) {
  return m.thigh + m.shin + 0.07 + m.torsoLen + m.shoulderW * 0.62 + m.headR * 1.08;
}
/** Half-axes of an ellipse with perimeter P and aspect k = b / a (Ramanujan). */
function axes(P, k) {
  const a = P / (Math.PI * (3 * (1 + k) - Math.sqrt((3 + k) * (1 + 3 * k))));
  return [a, a * k];
}
/**
 * @param {string} kind 'women' | 'men' | 'kids'
 * @param {object} u { height, chest, waist, hip } in centimetres (any may be missing)
 * @returns measurements for body.js, or null if nothing usable was given
 */
export function bodyFromMeasurements(kind, u) {
  if (!u) return null;
  const base = defaultMeasurements(KIND[kind] || 'female');
  const h = +u.height,
    c = +u.chest,
    w = +u.waist,
    hp = +u.hip;
  if (!h && !c) return null;
  const s = h >= 90 && h <= 220 ? h / 100 / heightOf(base) : 1;
  const m = Object.assign({}, base);
  for (const k of [
    'shoulderW',
    'torsoLen',
    'hipJointW',
    'upperArm',
    'foreArm',
    'thigh',
    'shin',
    'neckR',
    'headR',
    'upperArmR',
    'foreArmR',
    'thighR',
    'shinR',
  ])
    m[k] = base[k] * s;
  const female = kind !== 'men';
  if (c >= 50 && c <= 160) {
    const [a, b] = axes(c / 100, female ? 0.77 : 0.72);
    // broader chests carry broader shoulders, but less than proportionally
    m.shoulderW = m.shoulderW * Math.pow(a / (base.chestA * s), 0.45);
    m.chestA = a;
    m.chestB = b;
  } else {
    m.chestA = base.chestA * s;
    m.chestB = base.chestB * s;
  }
  // waist and hip: measured if given, otherwise in proportion to the chest
  if (w >= 40 && w <= 160) [m.waistA, m.waistB] = axes(w / 100, female ? 0.74 : 0.69);
  else {
    m.waistA = (base.waistA * m.chestA) / base.chestA;
    m.waistB = (base.waistB * m.chestB) / base.chestB;
  }
  if (hp >= 50 && hp <= 180) [m.hipA, m.hipB] = axes(hp / 100, 0.68);
  else {
    m.hipA = (base.hipA * m.chestA) / base.chestA;
    m.hipB = (base.hipB * m.chestB) / base.chestB;
  }
  m.kind = base.kind;
  m.custom = true;
  return m;
}
