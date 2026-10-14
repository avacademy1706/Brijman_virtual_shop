// Frame geometry and materials, shared by the showroom shelves, the product viewer and the try-on.
// Units are metres. A frame is built around the centre of its bridge, lens centres at y = 0, front facing +Z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { BM } from '../core/bm.js';
import '../data/frames.js';
import { sizeOf } from '../../shared/fit.js';

const V2 = THREE.Vector2,
  V3 = THREE.Vector3;

/* ---------- Geometry helpers ---------- */
function offsetPts(pts, d) {
  const n = pts.length,
    out = new Array(n);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n],
      p1 = pts[i],
      p2 = pts[(i + 1) % n];
    let tx = p2.x - p0.x,
      ty = p2.y - p0.y;
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    out[i] = new V2(p1.x + ty * d, p1.y - tx * d);
  }
  return out;
}
function mergeList(list) {
  if (!list.length) return null;
  const gs = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes))
      if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k);
    return n;
  });
  const out = mergeGeometries(gs, false);
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

// Temple path offsets from the hinge (x outwards, y, z backwards), as drawn for the shelves.
const TEMPLE_PATH = [
  [0, 0, 0],
  [0.003, 0, -0.02],
  [0.0055, -0.0008, -0.075],
  [0.006, -0.0035, -0.112],
  [0.0052, -0.015, -0.131],
  [0.0042, -0.031, -0.142],
];
const pathLength = (pts) => {
  let l = 0;
  for (let i = 1; i < pts.length; i++)
    l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
  return l;
};
const TEMPLE_NOMINAL = pathLength(TEMPLE_PATH);

/**
 * Builds a frame from an archetype (shared/frame-archetypes.js, metres).
 * Optional `a.templeLen` (metres) sets the real temple length along its path; without it the shelf drawing is used.
 * With `split`, also returns the front, temples and lenses separately, the hinge points and the outer width.
 * With `detail: 'low'`, uses fewer outline, tube and temple segments (about 40 % of the triangles) for distant
 * shelf frames on phones; the product viewer and the try-on always use full detail.
 * @param {object} a archetype
 * @param {{split?: boolean, detail?: 'low'|'full'}} [opt]
 */
export function buildArch(a, opt = {}) {
  const low = opt.detail === 'low';
  const N = low
    ? { outline: 28, rim: 30, radial: 4, bridge: 10, arm: 5, pad: [6, 4], temple: 12, tRadial: 4 }
    : { outline: 56, rim: 72, radial: 6, bridge: 20, arm: 8, pad: [10, 8], temple: 28, tRadial: 8 };
  const base = BM.outline(a.shape, a.A, a.B, N.outline).map((p) => new V2(p.x, p.y));
  const style = a.style,
    th = a.thick || 1;
  const rimT = style === 'acetate' ? 0.0042 * th : 0.0012;
  const depth = style === 'acetate' ? 0.0042 * th : 0.002;
  const cxR = a.dbl / 2 + a.A / 2;
  const ace = [],
    met = [],
    lens = [];
  const tAce = [],
    tMet = [];
  let maxX = -1,
    maxY = -1;
  for (const p of base) {
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const sides = {};
  for (const side of [1, -1]) {
    const pts = side === 1 ? base : base.map((p) => new V2(-p.x, p.y)).reverse();
    const m = new THREE.Matrix4()
      .makeTranslation(side * cxR, 0, 0)
      .multiply(new THREE.Matrix4().makeRotationY(side * 0.06));
    sides[side] = m;
    const lg = new THREE.ShapeGeometry(new THREE.Shape(offsetPts(pts, -0.0003)), 1);
    lg.applyMatrix4(m);
    lens.push(lg);
    if (style === 'acetate') {
      const sh = new THREE.Shape(offsetPts(pts, rimT));
      sh.holes.push(new THREE.Path(pts));
      const g = new THREE.ExtrudeGeometry(sh, {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.0007,
        bevelSize: 0.0005,
        bevelSegments: 1,
        steps: 1,
      });
      g.translate(0, 0, -depth / 2);
      g.applyMatrix4(m);
      ace.push(g);
    } else {
      const curve = new THREE.CatmullRomCurve3(
        pts.map((p) => new V3(p.x, p.y, 0)),
        true,
        'centripetal',
      );
      const g = new THREE.TubeGeometry(curve, N.rim, style === 'combo' ? 0.0007 : 0.00085, N.radial, true);
      g.applyMatrix4(m);
      met.push(g);
      if (style === 'combo') {
        const idx = BM.topArc(pts, a.B * 0.06);
        if (idx.length > 2) {
          const outer = offsetPts(pts, 0.0058);
          const shape = new THREE.Shape(idx.map((i) => outer[i]).concat(idx.map((i) => pts[i]).reverse()));
          const bd = 0.0048;
          const g2 = new THREE.ExtrudeGeometry(shape, {
            depth: bd,
            bevelEnabled: true,
            bevelThickness: 0.0006,
            bevelSize: 0.0004,
            bevelSegments: 1,
            steps: 1,
          });
          g2.translate(0, 0, -bd / 2 + 0.0008);
          g2.applyMatrix4(m);
          ace.push(g2);
        }
      }
    }
  }
  const yB = a.B * 0.12;
  if (style === 'acetate') {
    const span = a.dbl / 2 + rimT * 1.2,
      hb = 0.0052 * th,
      N = 12;
    const shp = new THREE.Shape();
    shp.moveTo(-span, yB + hb);
    for (let i = 1; i <= N; i++) {
      const x = -span + (2 * span * i) / N;
      shp.lineTo(x, yB + hb + 0.0006 * Math.cos((Math.PI * x) / (2 * span)));
    }
    for (let i = N; i >= 0; i--) {
      const x = -span + (2 * span * i) / N;
      shp.lineTo(x, yB + 0.0028 * Math.cos((Math.PI * x) / (2 * span)));
    }
    const g = new THREE.ExtrudeGeometry(shp, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.0006,
      bevelSize: 0.0004,
      bevelSegments: 1,
      steps: 1,
    });
    g.translate(0, 0, -depth / 2 + 0.0012);
    ace.push(g);
  } else {
    const c = new THREE.CatmullRomCurve3([
      new V3(-a.dbl / 2 - 0.001, yB, 0.0005),
      new V3(-a.dbl / 4, yB + 0.0028, 0.0018),
      new V3(0, yB + 0.0035, 0.0022),
      new V3(a.dbl / 4, yB + 0.0028, 0.0018),
      new V3(a.dbl / 2 + 0.001, yB, 0.0005),
    ]);
    met.push(new THREE.TubeGeometry(c, N.bridge, 0.0009, N.radial, false));
    if (a.dbridge) {
      const ty = maxY * 0.8;
      const c2 = new THREE.CatmullRomCurve3([
        new V3(-(cxR - a.A * 0.1), ty, 0.0004),
        new V3(0, ty + 0.0012, 0.0016),
        new V3(cxR - a.A * 0.1, ty, 0.0004),
      ]);
      met.push(new THREE.TubeGeometry(c2, N.bridge, 0.00085, N.radial, false));
    }
    for (const sd of [1, -1]) {
      const arm = new THREE.CatmullRomCurve3([
        new V3(sd * (a.dbl / 2 + 0.0008), yB - 0.001, -0.0005),
        new V3(sd * (a.dbl / 2 - 0.0005), yB - 0.006, -0.004),
        new V3(sd * (a.dbl / 2 - 0.0018), -a.B * 0.02, -0.0065),
      ]);
      met.push(new THREE.TubeGeometry(arm, N.arm, 0.0005, low ? 3 : 5, false));
      const pad = new THREE.SphereGeometry(0.0045, N.pad[0], N.pad[1]);
      pad.scale(0.42, 1, 0.22);
      pad.rotateZ(sd * 0.25);
      pad.translate(sd * (a.dbl / 2 - 0.0022), -a.B * 0.05, -0.0075);
      met.push(pad);
    }
  }
  const hingeY = Math.min(maxY * 0.55, a.B * 0.24);
  const hingeOff = style === 'acetate' ? rimT * 0.55 : style === 'combo' ? 0.0035 : 0.0007;
  const k = a.templeLen ? a.templeLen / TEMPLE_NOMINAL : 1;
  const hinges = [];
  for (const sd of [1, -1]) {
    const hp = new V3(sd * (maxX + hingeOff), hingeY, -depth * 0.3).applyMatrix4(sides[sd]);
    hinges.push(hp.clone());
    // x offsets keep the temple spread; y and z scale with the real temple length.
    const pts3 = TEMPLE_PATH.map(([x, y, z]) => new V3(hp.x + sd * x, hp.y + y * k, hp.z + z * k));
    const curve = new THREE.CatmullRomCurve3(pts3, false, 'centripetal');
    const tg = new THREE.TubeGeometry(
      curve,
      N.temple,
      style === 'acetate' ? 0.0015 * th : style === 'combo' ? 0.0013 : 0.0008,
      low ? N.tRadial : style === 'metal' ? 6 : 8,
      false,
    );
    if (style === 'metal') {
      met.push(tg);
      tMet.push(tg);
    } else {
      ace.push(tg);
      tAce.push(tg);
    }
    if (style === 'acetate') {
      const end = new THREE.BoxGeometry(0.0045, 0.0062, 0.007);
      end.translate(hp.x - sd * 0.0006, hp.y, hp.z - 0.002);
      ace.push(end);
    } else {
      const hinge = new THREE.BoxGeometry(0.003, 0.004, 0.005);
      hinge.translate(hp.x, hp.y, hp.z - 0.0015);
      met.push(hinge);
    }
  }
  const res = { acetate: mergeList(ace), metal: mergeList(met), lens: mergeList(lens) };
  let my = 1;
  for (const key of ['acetate', 'metal', 'lens']) if (res[key]) my = Math.min(my, res[key].boundingBox.min.y);
  res.minY = my;
  if (opt.split) {
    const without = (list, drop) => list.filter((g) => !drop.includes(g));
    const front = {
      acetate: mergeList(without(ace, tAce)),
      metal: mergeList(without(met, tMet)),
    };
    const temples = { acetate: mergeList(tAce), metal: mergeList(tMet) };
    const box = new THREE.Box3();
    for (const g of [front.acetate, front.metal]) if (g) box.union(g.boundingBox);
    res.front = front;
    res.temples = temples;
    res.hinges = hinges;
    res.outerWidth = box.max.x - box.min.x;
    res.frontBox = box;
    res.bridgeY = yB;
  }
  return res;
}

/**
 * The archetype resized to a real frame size: lens width and height scale together, the bridge and temple are real.
 * @param {string} archId
 * @param {{lens: number, bridge: number, temple: number}} size in mm
 */
export function archForSize(archId, size) {
  const a = BM.ARCH[archId];
  const k = size.lens / 1000 / a.A;
  return Object.assign({}, a, {
    A: size.lens / 1000,
    B: a.B * k,
    dbl: size.bridge / 1000,
    templeLen: size.temple / 1000,
  });
}

const SIZED = new Map();
/**
 * Geometry for a product at a real size, cached. Includes the split parts, hinges and outer width.
 * @param {object} p product
 * @param {string} [sizeId] defaults to the product's default size
 */
export function frameGeometry(p, sizeId) {
  const s = sizeOf(p, sizeId) || { lens: p.size[0], bridge: p.size[1], temple: p.size[2] };
  const key = p.arch + '|' + s.lens + '|' + s.bridge + '|' + s.temple;
  if (!SIZED.has(key)) SIZED.set(key, buildArch(archForSize(p.arch, s), { split: true }));
  return SIZED.get(key);
}

/** Outer width of the frame front in mm at a size, from the real geometry. */
export const frameOuterWidthMm = (p, sizeId) => frameGeometry(p, sizeId).outerWidth * 1000;

/* ---------- Materials ---------- */
// Small canvas helpers for the tortoiseshell texture.
const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
};
function wrapDraw(S, x, y, r, fn) {
  fn(0, 0);
  const ox = x < r ? S : x > S - r ? -S : 0,
    oy = y < r ? S : y > S - r ? -S : 0;
  if (ox) fn(ox, 0);
  if (oy) fn(0, oy);
  if (ox && oy) fn(ox, oy);
}

/**
 * Procedural tortoiseshell texture (dark havana or light honey).
 * @param {boolean} light
 * @param {number} [anisotropy]
 */
export function tortTexture(light, anisotropy = 1) {
  const S = 512,
    c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'),
    R = rng(light ? 21 : 11);
  g.fillStyle = light ? '#d2a05c' : '#86501f';
  g.fillRect(0, 0, S, S);
  const blob = (x, y, r, col, a) =>
    wrapDraw(S, x, y, r, (ox, oy) => {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, rgba(col, a));
      gr.addColorStop(0.6, rgba(col, a * 0.6));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x + ox, y + oy, r, 0, 6.283);
      g.fill();
    });
  for (let i = 0; i < 70; i++) blob(R() * S, R() * S, 30 + R() * 70, light ? '#e6be7e' : '#a8682c', 0.5);
  for (let i = 0; i < 150; i++) blob(R() * S, R() * S, 8 + R() * 38, light ? '#7a4a1e' : '#2a1408', 0.55 + R() * 0.35);
  for (let i = 0; i < 240; i++) blob(R() * S, R() * S, 2 + R() * 6, light ? '#5a3410' : '#1a0c04', 0.6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Math.min(8, anisotropy);
  t.repeat.set(30, 30);
  return t;
}

/**
 * The frame materials: acetate (solid, matte, tortoise, clear), metal and the three lens kinds.
 * @param {{tort: THREE.Texture, tortL: THREE.Texture}} tex
 */
export function createFrameMaterials(tex) {
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  return {
    solid: phys({ color: 0xffffff, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
    matte: std({ color: 0xffffff, roughness: 0.72 }),
    tort: phys({ color: 0xffffff, map: tex.tort, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
    tortL: phys({ color: 0xffffff, map: tex.tortL, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
    clear: phys({ color: 0xffffff, roughness: 0.12, clearcoat: 0.6, transparent: true, opacity: 0.62 }),
    metal: std({ color: 0xffffff, roughness: 0.24, metalness: 1 }),
    lensClear: phys({
      color: 0xffffff,
      transparent: true,
      opacity: 0.16,
      roughness: 0.02,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    lensTint: phys({
      color: 0xffffff,
      transparent: true,
      opacity: 0.84,
      roughness: 0.06,
      metalness: 0.15,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    lensMirror: std({
      color: 0xffffff,
      roughness: 0.08,
      metalness: 0.95,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    }),
  };
}

/**
 * Which material and colour each part of a frame uses, for a colour entry.
 * @param {object} p product
 * @param {object} col colour from the catalogue
 * @param {object} G geometry from buildArch
 * @returns {Array<{part: 'acetate'|'metal'|'lens', kind: string, color: THREE.Color}>}
 */
export function partsFor(p, col, G) {
  const out = [];
  if (G.acetate)
    out.push({
      part: 'acetate',
      kind:
        col.k === 'tort' ? (col.tl ? 'tortL' : 'tort') : col.k === 'clear' ? 'clear' : col.matte ? 'matte' : 'solid',
      color: new THREE.Color(col.a || '#222222'),
    });
  if (G.metal) out.push({ part: 'metal', kind: 'metal', color: new THREE.Color(col.m || '#c8c8c8') });
  out.push({
    part: 'lens',
    kind: p.sun ? (col.lk === 'mirror' ? 'lensMirror' : 'lensTint') : 'lensClear',
    color: new THREE.Color(p.sun ? col.l : '#ffffff'),
  });
  return out;
}
