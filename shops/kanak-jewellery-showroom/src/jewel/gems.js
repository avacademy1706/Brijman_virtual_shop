// Gem cut geometry. Every cut is built at unit girdle width (1 along x), table facing +y, girdle centred on y = 0,
// as flat-shaded triangles with a per-facet id (the gem shader uses it for scintillation). Instances scale
// uniformly to the stone's size in millimetres; the cut's own length-to-width ratio lives in the geometry.
import * as THREE from 'three';

const TAU = Math.PI * 2;

/* ---------- Outlines: girdle point for an angle, at unit width ---------- */
const OUTLINE = {
  round: (t) => [0.5 * Math.cos(t), 0.5 * Math.sin(t)],
  oval: (t) => [0.5 * Math.cos(t), 0.36 * Math.sin(t)],
  // pear: rounded end towards -z, point towards +z
  pear: (t) => {
    const c = Math.cos(t),
      s = Math.sin(t);
    const w = 0.5 * (1 - 0.32 * Math.max(0, s)) * (0.88 + 0.12 * Math.abs(c));
    const len = s > 0 ? 0.62 : 0.42;
    const pinch = s > 0 ? Math.pow(Math.abs(c), 1.0 + 1.6 * s) : Math.abs(c);
    return [Math.sign(c) * w * pinch * 1.0, s * len];
  },
  marquise: (t) => {
    const c = Math.cos(t),
      s = Math.sin(t);
    return [Math.sign(c) * 0.5 * Math.pow(Math.abs(c), 0.62), 0.25 * s * (1 - 0.2 * Math.abs(c))];
  },
  cushion: (t) => superellipse(t, 0.5, 0.5, 3.2),
  princess: (t) => superellipse(t, 0.5, 0.5, 9),
  heart: (t) => {
    // a rounded heart, lobes at -z, point at +z
    const c = Math.cos(t),
      s = Math.sin(t);
    const lobe = s < 0 ? 1 - 0.18 * Math.pow(Math.abs(Math.cos(t * 2)), 6) * (Math.abs(c) < 0.3 ? 1 : 0) : 1;
    const point = s > 0 ? Math.pow(Math.abs(c), 0.5 + 1.2 * s) : 1;
    return [c * 0.5 * point * lobe, s * (s > 0 ? 0.55 : 0.4) * lobe];
  },
};
function superellipse(t, a, b, n) {
  const c = Math.cos(t),
    s = Math.sin(t);
  return [a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)];
}

/* ---------- Flat triangle collector ---------- */
class Facets {
  constructor() {
    this.p = [];
    this.f = [];
    this.id = 0;
  }
  tri(a, b, c, id) {
    // orient outwards (every cut here is convex around its centre)
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      uz = b[2] - a[2];
    const vx = c[0] - a[0],
      vy = c[1] - a[1],
      vz = c[2] - a[2];
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    const cx = (a[0] + b[0] + c[0]) / 3,
      cy = (a[1] + b[1] + c[1]) / 3 - this.cy,
      cz = (a[2] + b[2] + c[2]) / 3;
    if (nx * cx + ny * cy + nz * cz < 0) [b, c] = [c, b];
    this.p.push(...a, ...b, ...c);
    const fid = id == null ? this.id++ : id;
    this.f.push(fid, fid, fid);
    return fid;
  }
  quad(a, b, c, d) {
    const id = this.id++;
    this.tri(a, b, c, id);
    this.tri(a, c, d, id);
  }
  fan(ring, centre) {
    const id = this.id++;
    for (let i = 0; i < ring.length; i++) this.tri(ring[i], ring[(i + 1) % ring.length], centre, id);
  }
  poly(ring) {
    const id = this.id++;
    for (let i = 1; i + 1 < ring.length; i++) this.tri(ring[0], ring[i], ring[i + 1], id);
  }
  geometry(smooth) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('facet', new THREE.Float32BufferAttribute(this.f, 1));
    g.computeVertexNormals(); // non-indexed: one normal per triangle (flat facets)
    if (smooth) smoothNormals(g);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
/** Averages normals of coincident vertices (for domes and beads). */
function smoothNormals(g) {
  const p = g.attributes.position.array,
    n = g.attributes.normal.array;
  const key = (i) => Math.round(p[i] * 1e4) + ',' + Math.round(p[i + 1] * 1e4) + ',' + Math.round(p[i + 2] * 1e4);
  const acc = new Map();
  for (let i = 0; i < p.length; i += 3) {
    const k = key(i);
    const a = acc.get(k) || [0, 0, 0];
    a[0] += n[i];
    a[1] += n[i + 1];
    a[2] += n[i + 2];
    acc.set(k, a);
  }
  for (let i = 0; i < p.length; i += 3) {
    const a = acc.get(key(i)),
      l = Math.hypot(a[0], a[1], a[2]) || 1;
    n[i] = a[0] / l;
    n[i + 1] = a[1] / l;
    n[i + 2] = a[2] / l;
  }
}

/* ---------- Brilliant cut (round, oval, pear, marquise, cushion, princess, heart) ---------- */
function brilliant(outline, o) {
  o = Object.assign({ table: 0.56, crown: 0.15, girdle: 0.03, pavilion: 0.43, star: 0.5, lower: 0.78 }, o);
  const yG = o.girdle / 2,
    yB = -o.girdle / 2,
    yT = yG + o.crown,
    yC = yB - o.pavilion;
  const F = new Facets();
  F.cy = (yT + yC) / 2 + 0.05;
  const at = (t, f, y) => {
    const q = outline(t);
    return [q[0] * f, y, q[1] * f];
  };
  const T = [],
    S = [],
    G = [],
    B = [],
    L = [];
  const ts = o.table + (1 - o.table) * o.star;
  const yS = yG + ((yT - yG) * (1 - ts)) / (1 - o.table);
  const fL = 1 - o.lower;
  for (let i = 0; i < 8; i++) {
    const t = (i * TAU) / 8;
    T.push(at(t, o.table, yT));
    S.push(at(t + TAU / 16, ts, yS));
    L.push(at(t + TAU / 16, fL, yC + (yB - yC) * fL));
  }
  for (let j = 0; j < 16; j++) {
    const t = (j * TAU) / 16;
    G.push(at(t, 1, yG));
    B.push(at(t, 1, yB));
  }
  const C = [0, yC, 0];
  F.poly(T);
  for (let i = 0; i < 8; i++) {
    const i1 = (i + 1) % 8,
      im = (i + 7) % 8;
    F.tri(T[i], T[i1], S[i]); // star
    F.quad(T[i], S[im], G[2 * i], S[i]); // bezel (kite)
    F.tri(S[i], G[2 * i], G[2 * i + 1]); // upper girdle
    F.tri(S[i], G[2 * i + 1], G[(2 * i + 2) % 16]);
    F.tri(B[2 * i], B[2 * i + 1], L[i]); // lower girdle
    F.tri(B[2 * i + 1], B[(2 * i + 2) % 16], L[i]);
    F.quad(B[2 * i], L[im], C, L[i]); // pavilion main
  }
  for (let j = 0; j < 16; j++) F.quad(G[j], G[(j + 1) % 16], B[(j + 1) % 16], B[j]); // girdle band
  return F.geometry(false);
}

/* ---------- Step cut (emerald, baguette, asscher) ---------- */
function stepCut(w, l, corner, o) {
  o = Object.assign({ crown: [0.06, 0.05, 0.04], crownIn: [0.1, 0.1, 0.1], pav: [0.17, 0.15, 0.13, 0.12] }, o);
  // outline: rectangle w x l (x, z) with cut corners
  const ring = (inset) => {
    const a = w / 2 - inset,
      b = l / 2 - inset,
      c = Math.max(0.001, corner - inset * 0.41);
    return [
      [a, -b + c],
      [a, b - c],
      [a - c, b],
      [-a + c, b],
      [-a, b - c],
      [-a, -b + c],
      [-a + c, -b],
      [a - c, -b],
    ];
  };
  const F = new Facets();
  const yG = 0.015,
    yB = -0.015;
  let y = yG,
    inset = 0;
  let prev = ring(0).map((q) => [q[0], yG, q[1]]);
  const bottom0 = ring(0).map((q) => [q[0], yB, q[1]]);
  F.cy = -0.1;
  for (let i = 0; i < 8; i++) F.quad(prev[i], prev[(i + 1) % 8], bottom0[(i + 1) % 8], bottom0[i]);
  for (let s = 0; s < o.crown.length; s++) {
    y += o.crown[s];
    inset += o.crownIn[s] * Math.min(w, l);
    const cur = ring(inset).map((q) => [q[0], y, q[1]]);
    for (let i = 0; i < 8; i++) F.quad(prev[i], prev[(i + 1) % 8], cur[(i + 1) % 8], cur[i]);
    prev = cur;
  }
  F.poly(prev); // table
  // pavilion steps down to a keel
  prev = bottom0;
  y = yB;
  inset = 0;
  for (let s = 0; s < o.pav.length; s++) {
    y -= o.pav[s];
    inset += Math.min(w, l) * (s === o.pav.length - 1 ? 0.12 : 0.11);
    const cur = ring(inset).map((q) => [q[0], y, q[1]]);
    for (let i = 0; i < 8; i++) F.quad(prev[i], prev[(i + 1) % 8], cur[(i + 1) % 8], cur[i]);
    prev = cur;
  }
  const keel = [0, y - 0.06, 0];
  F.fan(prev, keel);
  return F.geometry(false);
}

/* ---------- Cabochon: smooth dome on a round or oval base ---------- */
function cabochon(rx, rz, height, rings, segs) {
  const F = new Facets();
  F.cy = height * 0.3;
  const pt = (k, j) => {
    const a = (j / segs) * TAU,
      t = k / rings; // 0 at the base, 1 at the top
    const r = Math.cos((t * Math.PI) / 2);
    return [Math.cos(a) * rx * r, 0.02 + Math.sin((t * Math.PI) / 2) * height, Math.sin(a) * rz * r];
  };
  for (let k = 0; k < rings; k++)
    for (let j = 0; j < segs; j++) {
      const a = pt(k, j),
        b = pt(k, j + 1),
        c = pt(k + 1, j + 1),
        d = pt(k + 1, j);
      if (k === rings - 1) F.tri(a, b, d);
      else F.quad(a, b, c, d);
    }
  // flat back
  const base = [];
  for (let j = 0; j < segs; j++) base.push([Math.cos((j / segs) * TAU) * rx, -0.02, Math.sin((j / segs) * TAU) * rz]);
  for (let j = 0; j < segs; j++) {
    const a = pt(0, j),
      b = pt(0, j + 1);
    F.quad(a, b, base[(j + 1) % segs], base[j]);
  }
  F.fan(base, [0, -0.02, 0]);
  return F.geometry(true);
}

/* ---------- Polki: a flat, uncut diamond slice with broad facets and an irregular outline ---------- */
function polki(seed, n) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  n = n || 9;
  const F = new Facets();
  F.cy = 0;
  const outer = [],
    top = [],
    back = [];
  const ph = rnd() * TAU;
  for (let i = 0; i < n; i++) {
    const a = ph + (i / n) * TAU + (rnd() - 0.5) * 0.25;
    const r = 0.5 * (0.88 + rnd() * 0.12);
    outer.push([Math.cos(a) * r, 0.02, Math.sin(a) * r]);
    back.push([Math.cos(a) * r, -0.06, Math.sin(a) * r]);
    const r2 = r * (0.55 + rnd() * 0.15);
    top.push([Math.cos(a + 0.12) * r2, 0.1 + rnd() * 0.02, Math.sin(a + 0.12) * r2]);
  }
  F.poly(top);
  for (let i = 0; i < n; i++) {
    const i1 = (i + 1) % n;
    F.quad(top[i], top[i1], outer[i1], outer[i]);
    F.quad(outer[i], outer[i1], back[i1], back[i]);
  }
  F.poly(back.slice().reverse());
  return F.geometry(false);
}

/* ---------- Faceted drop (chandelier crystal, briolette) ---------- */
function briolette(segs, rows) {
  const F = new Facets();
  F.cy = 0;
  // pear-shaped body of revolution about y, point at the top, facets alternate per row
  const prof = (t) => {
    // t: 0 top, 1 bottom
    const y = 0.5 - t * 1.0;
    const r = 0.5 * Math.sin(Math.PI * Math.pow(t, 0.75)) * (0.55 + 0.45 * t);
    return [r, y];
  };
  const rowsPts = [];
  for (let k = 0; k <= rows; k++) {
    const [r, y] = prof(k / rows);
    const off = (k % 2) * (Math.PI / segs);
    const ring = [];
    for (let j = 0; j < segs; j++) {
      const a = off + (j / segs) * TAU;
      ring.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    rowsPts.push(ring);
  }
  for (let k = 0; k < rows; k++) {
    const a = rowsPts[k],
      b = rowsPts[k + 1];
    for (let j = 0; j < segs; j++) {
      F.tri(a[j], a[(j + 1) % segs], b[(j + (k % 2)) % segs]);
      F.tri(b[(j + (k % 2)) % segs], a[(j + 1) % segs], b[(j + 1 + (k % 2)) % segs]);
    }
  }
  return F.geometry(false);
}

/** Girdle point at angle t (radians, 0 = +x, pi/2 = +z) for a cut, at unit width: [x, z]. */
export function girdlePoint(cut, t) {
  if (OUTLINE[cut]) return OUTLINE[cut](t);
  if (cut === 'oval' || cut === 'cabochon-oval') return [0.5 * Math.cos(t), 0.37 * Math.sin(t)];
  if (cut === 'emerald' || cut === 'baguette' || cut === 'asscher') {
    const l = cut === 'emerald' ? 0.36 : cut === 'baguette' ? 0.18 : 0.5;
    return superellipse(t, 0.5, l, 14);
  }
  return [0.5 * Math.cos(t), 0.5 * Math.sin(t)];
}

/* ---------- Public API ---------- */
const CACHE = new Map();
/** Cut name -> shared geometry. */
export function gemGeometry(cut) {
  if (CACHE.has(cut)) return CACHE.get(cut);
  let g;
  switch (cut) {
    case 'oval':
      g = brilliant(OUTLINE.oval, { table: 0.54 });
      break;
    case 'pear':
      g = brilliant(OUTLINE.pear, { table: 0.5, crown: 0.14 });
      break;
    case 'marquise':
      g = brilliant(OUTLINE.marquise, { table: 0.5, crown: 0.12, pavilion: 0.36 });
      break;
    case 'cushion':
      g = brilliant(OUTLINE.cushion, { table: 0.58 });
      break;
    case 'princess':
      g = brilliant(OUTLINE.princess, { table: 0.66, crown: 0.11, pavilion: 0.48 });
      break;
    case 'heart':
      g = brilliant(OUTLINE.heart, { table: 0.52 });
      break;
    case 'emerald':
      g = stepCut(1, 0.72, 0.12);
      break;
    case 'baguette':
      g = stepCut(1, 0.36, 0.0001, { crown: [0.05, 0.04], crownIn: [0.12, 0.1], pav: [0.12, 0.1, 0.08] });
      break;
    case 'asscher':
      g = stepCut(1, 1, 0.2);
      break;
    case 'cabochon':
      g = cabochon(0.5, 0.5, 0.32, 6, 20);
      break;
    case 'cabochon-oval':
      g = cabochon(0.5, 0.37, 0.3, 6, 20);
      break;
    case 'polki':
      g = polki(7, 9);
      break;
    case 'polki-b':
      g = polki(31, 8);
      break;
    case 'briolette':
      g = briolette(8, 6);
      break;
    case 'round':
    default:
      g = brilliant(OUTLINE.round);
  }
  CACHE.set(cut, g);
  return g;
}
/** Depth below the girdle (unit width), so a setting can sit under the stone. */
export function pavilionDepth(cut) {
  const g = gemGeometry(cut);
  return -g.boundingBox.min.y;
}
export function crownHeight(cut) {
  const g = gemGeometry(cut);
  return g.boundingBox.max.y;
}
/** Girdle footprint (x half-width, z half-length) at unit width. */
export function girdleSize(cut) {
  const g = gemGeometry(cut);
  return [g.boundingBox.max.x, Math.max(-g.boundingBox.min.z, g.boundingBox.max.z)];
}
export const CUTS = Object.keys(OUTLINE).concat([
  'emerald',
  'baguette',
  'asscher',
  'cabochon',
  'cabochon-oval',
  'polki',
  'polki-b',
  'briolette',
]);
