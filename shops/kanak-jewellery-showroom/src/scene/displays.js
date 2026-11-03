// Display stands for jewellery: velvet busts for necklaces, T-bar stands for earrings, tikkas and naths, ring
// blocks and bangle cradles. Each stand is built at the current batch frame (origin on the shelf, +z towards
// the visitor) and returns the matrix that places the piece (built in millimetres) on it.
import * as THREE from 'three';
import { bustGeometry, BUST } from '../jewel/shapes.js';

const MM = 0.001;
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const S = (s) => new THREE.Matrix4().makeScale(s, s, s);
const Rx = (a) => new THREE.Matrix4().makeRotationX(a);
const mul = (...m) => m.reduce((a, b) => a.multiply(b), new THREE.Matrix4());

let bustCache = null;
function bust(coarse) {
  if (!bustCache) {
    const [g, cap] = bustGeometry(coarse ? 28 : 40, coarse ? 22 : 30);
    g.scale(MM, MM, MM);
    cap.scale(MM, MM, MM);
    bustCache = [g, cap];
  }
  return bustCache.map((g) => g.clone());
}
/** Bust lift: the bust's base sits on the shelf. */
export const BUST_LIFT = -BUST.bottom * MM;

function tStand(B, gold, velvet, h, w) {
  B.cyl(velvet, 0.026, 0.03, 0.008, 0, 0.004, 0, 20);
  B.cyl(gold, 0.0028, 0.0028, h, 0, h / 2 + 0.006, -0.004, 8);
  B.box(gold, w, 0.004, 0.004, 0, h + 0.004, -0.004);
  for (const s of [-1, 1]) B.sph(gold, 0.004, (s * w) / 2, h + 0.004, -0.004, 1, 1, 1, 8);
}

/**
 * Builds the stand for a product and returns the piece matrix (relative to the current frame).
 * info: { type, bounds (Box3, mm), anchors, coarse }; mode: 'case' | 'niche' | 'counter' | 'pillar' | 'column'
 */
export function stand(B, info, mode, keys) {
  const { gold, velvet } = keys;
  const a = info.anchors || {};
  switch (info.type) {
    case 'necklace':
    case 'pendant': {
      // a bust does not fit under a counter's glass (the catalogue keeps necklaces out of counters)
      if (mode === 'counter') return mul(T(0, 0.004, 0), Rx(-Math.PI / 2), S(MM * 0.5));
      for (const g of bust(info.coarse)) {
        g.translate(0, BUST_LIFT, 0);
        B.geo(velvet, g);
      }
      return mul(T(0, BUST_LIFT, 0), S(MM));
    }
    case 'earrings': {
      const drop = -(info.bounds ? info.bounds.min.y : -20) * MM;
      const h = Math.max(0.075, drop + 0.03);
      const w = (a.gap || 24) * MM + 0.024;
      tStand(B, gold, velvet, h, w);
      return mul(T(0, h + 0.002, 0.0), S(MM));
    }
    case 'tikka':
    case 'nath': {
      const drop = -(info.bounds ? info.bounds.min.y : -60) * MM;
      const h = Math.max(0.09, drop + 0.035);
      tStand(B, gold, velvet, h, 0.03);
      return mul(T(0, h + 0.004, 0.0), S(MM));
    }
    case 'ring': {
      const low = -(info.bounds ? info.bounds.min.y : -10) * MM;
      // velvet slot block; the ring stands in it facing the visitor, its lower half sunk in the slot
      const g = new THREE.BoxGeometry(0.05, 0.026, 0.034);
      g.translate(0, 0.013, 0);
      B.geo(velvet, g);
      return mul(T(0, 0.026 + low * 0.45, 0), S(MM));
    }
    case 'bangle':
    case 'bracelet': {
      if (mode === 'counter') {
        // lying flat on the velvet
        const zmin = info.bounds ? -info.bounds.min.z : 4;
        return mul(T(0, zmin * MM + 0.001, 0), Rx(-Math.PI / 2), S(MM));
      }
      const low = -(info.bounds ? info.bounds.min.y : -32) * MM;
      B.box(velvet, 0.08, 0.014, 0.05, 0, 0.007, 0);
      return mul(T(0, 0.014 + low, 0), S(MM));
    }
    default:
      return mul(T(0, 0.02, 0), S(MM));
  }
}
