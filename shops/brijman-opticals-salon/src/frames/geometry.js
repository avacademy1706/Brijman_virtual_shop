// Frame geometry and materials, shared by the salon (instanced on shelves), the 3D viewer and the camera try-on.
// Every frame is built from its archetype in src/data/frames.js at the archetype's canonical size (metres) and
// scaled to the product's real lens width, so a 52 mm lens is 52 mm wide wherever it is shown.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { NY } from '../core/ny.js';
import '../data/frames.js';

const V2 = THREE.Vector2,
  V3 = THREE.Vector3;

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
    if (!n.attributes.uv)
      n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
    return n;
  });
  const out = mergeGeometries(gs, false);
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/**
 * Geometry of one archetype: { acetate, metal, lens } (merged BufferGeometries or null), minY, and the anchor
 * points the try-on needs (bridge contact point, hinge positions), all in metres at the archetype's size.
 * Front faces +z, temples run back along -z, lens centres at y = 0.
 */
export function buildArch(a) {
  const base = NY.outline(a.shape, a.A, a.B, 56).map((p) => new V2(p.x, p.y));
  const style = a.style,
    th = a.thick || 1;
  const rimT = style === 'acetate' ? 0.0042 * th : 0.0012;
  const depth = style === 'acetate' ? 0.0042 * th : 0.002;
  const cxR = a.dbl / 2 + a.A / 2;
  const ace = [],
    met = [],
    lens = [];
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
      const g = new THREE.TubeGeometry(curve, 72, style === 'combo' ? 0.0007 : 0.00085, 6, true);
      g.applyMatrix4(m);
      met.push(g);
      if (style === 'combo') {
        const idx = NY.topArc(pts, a.B * 0.06);
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
    met.push(new THREE.TubeGeometry(c, 20, 0.0009, 6, false));
    if (a.dbridge) {
      const ty = maxY * 0.8;
      const c2 = new THREE.CatmullRomCurve3([
        new V3(-(cxR - a.A * 0.1), ty, 0.0004),
        new V3(0, ty + 0.0012, 0.0016),
        new V3(cxR - a.A * 0.1, ty, 0.0004),
      ]);
      met.push(new THREE.TubeGeometry(c2, 20, 0.00085, 6, false));
    }
    for (const sd of [1, -1]) {
      const arm = new THREE.CatmullRomCurve3([
        new V3(sd * (a.dbl / 2 + 0.0008), yB - 0.001, -0.0005),
        new V3(sd * (a.dbl / 2 - 0.0005), yB - 0.006, -0.004),
        new V3(sd * (a.dbl / 2 - 0.0018), -a.B * 0.02, -0.0065),
      ]);
      met.push(new THREE.TubeGeometry(arm, 8, 0.0005, 5, false));
      const pad = new THREE.SphereGeometry(0.0045, 10, 8);
      pad.scale(0.42, 1, 0.22);
      pad.rotateZ(sd * 0.25);
      pad.translate(sd * (a.dbl / 2 - 0.0022), -a.B * 0.05, -0.0075);
      met.push(pad);
    }
  }
  const hingeY = Math.min(maxY * 0.55, a.B * 0.24);
  // end pieces carry the hinges a few millimetres beyond the rims, as on real frames
  const hingeOff = NY.hingeOffset(a);
  const hinges = [];
  for (const sd of [1, -1]) {
    const hp = new V3(sd * (maxX + hingeOff), hingeY, -depth * 0.3).applyMatrix4(sides[sd]);
    const rimPt = new V3(sd * maxX, hingeY, -depth * 0.3).applyMatrix4(sides[sd]);
    hinges.push(hp.clone());
    const pts3 = [
      hp,
      new V3(hp.x + sd * 0.003, hp.y, hp.z - 0.02),
      new V3(hp.x + sd * 0.0055, hp.y - 0.0008, hp.z - 0.075),
      new V3(hp.x + sd * 0.006, hp.y - 0.0035, hp.z - 0.112),
      new V3(hp.x + sd * 0.0052, hp.y - 0.015, hp.z - 0.131),
      new V3(hp.x + sd * 0.0042, hp.y - 0.031, hp.z - 0.142),
    ];
    const curve = new THREE.CatmullRomCurve3(pts3, false, 'centripetal');
    const tg = new THREE.TubeGeometry(
      curve,
      28,
      style === 'acetate' ? 0.0015 * th : style === 'combo' ? 0.0013 : 0.0008,
      style === 'metal' ? 6 : 8,
      false,
    );
    if (style === 'metal') met.push(tg);
    else ace.push(tg);
    const span = Math.abs(hp.x - rimPt.x);
    if (style === 'acetate') {
      const end = new THREE.BoxGeometry(span + 0.002, 0.0062, 0.007);
      end.translate((hp.x + rimPt.x) / 2, hp.y, hp.z - 0.002);
      ace.push(end);
    } else {
      const bar = new THREE.BoxGeometry(span + 0.001, style === 'combo' ? 0.0042 : 0.0016, 0.0016);
      bar.translate((hp.x + rimPt.x) / 2, hp.y, (hp.z + rimPt.z) / 2);
      (style === 'combo' ? ace : met).push(bar);
      const hinge = new THREE.BoxGeometry(0.003, 0.004, 0.005);
      hinge.translate(hp.x, hp.y, hp.z - 0.0015);
      met.push(hinge);
    }
  }
  const res = { acetate: mergeList(ace), metal: mergeList(met), lens: mergeList(lens) };
  let my = 1;
  for (const k of ['acetate', 'metal', 'lens']) if (res[k]) my = Math.min(my, res[k].boundingBox.min.y);
  res.minY = my;
  // where the frame rests on the nose (the underside of the bridge) and the hinges, for the try-on
  res.bridge = new V3(0, style === 'acetate' ? yB : yB - 0.001, 0);
  res.hinges = hinges;
  res.width = 2 * (maxX + hingeOff + cxR);
  return res;
}
const ARCHGEO = {};
/** Cached geometry for an archetype id (see NY.ARCH). */
export const archGeo = (id) => ARCHGEO[id] || (ARCHGEO[id] = buildArch(NY.ARCH[id]));
/** Scale from archetype size to a product's lens width (optionally a size 'S' | 'M' | 'L'). */
export function frameScale(p, size) {
  const lens = size && NY.sizeOf ? NY.sizeOf(p, size)[0] : p.size[0];
  return lens / 1000 / NY.ARCH[p.arch].A;
}

/* ---------- Materials ---------- */
const mk = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
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
/** Tortoiseshell acetate texture (dark havana or light honey). */
function texTort(light) {
  const S = 512,
    c = mk(S, S),
    g = c.getContext('2d'),
    R = rng(light ? 21 : 11);
  g.fillStyle = light ? '#d2a05c' : '#86501f';
  g.fillRect(0, 0, S, S);
  const blob = (x, y, r, col, a) => {
    for (const ox of [0, -S, S])
      for (const oy of [0, -S, S]) {
        if (x + ox < -r || x + ox > S + r || y + oy < -r || y + oy > S + r) continue;
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        gr.addColorStop(0, rgba(col, a));
        gr.addColorStop(0.6, rgba(col, a * 0.6));
        gr.addColorStop(1, rgba(col, 0));
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x + ox, y + oy, r, 0, 6.283);
        g.fill();
      }
  };
  for (let i = 0; i < 70; i++) blob(R() * S, R() * S, 30 + R() * 70, light ? '#e6be7e' : '#a8682c', 0.5);
  for (let i = 0; i < 150; i++) blob(R() * S, R() * S, 8 + R() * 38, light ? '#7a4a1e' : '#2a1408', 0.55 + R() * 0.35);
  for (let i = 0; i < 240; i++) blob(R() * S, R() * S, 2 + R() * 6, light ? '#5a3410' : '#1a0c04', 0.6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(30, 30);
  return t;
}
let FM = null;
/** The frame materials (created once). Colours come from instance colours or from clones. */
export function frameMaterials() {
  if (FM) return FM;
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const tort = texTort(false),
    tortL = texTort(true);
  FM = {
    solid: phys({ color: 0xffffff, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
    matte: std({ color: 0xffffff, roughness: 0.72 }),
    tort: phys({ color: 0xffffff, map: tort, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
    tortL: phys({ color: 0xffffff, map: tortL, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
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
  return FM;
}
/** The parts of a product in a colour: [{ part: 'acetate' | 'metal' | 'lens', kind (material key), color }]. */
export function partsFor(p, col) {
  const G = archGeo(p.arch),
    out = [];
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
/**
 * A stand-alone frame (THREE.Group) in a colour and size, with its own material clones, at real size in metres.
 * o.lensOpacity overrides the tint opacity (the try-on keeps eyes visible through sunglasses).
 * Call dispose() on the result's userData when done.
 */
export function frameGroup(p, ci, size, o) {
  o = o || {};
  const G = archGeo(p.arch),
    M = frameMaterials(),
    col = NY.colorOf(p, ci);
  const group = new THREE.Group();
  const mats = [];
  for (const pt of partsFor(p, col)) {
    const mat = M[pt.kind].clone();
    mat.color.copy(pt.color);
    if (pt.part === 'lens' && o.lensOpacity != null && pt.kind !== 'lensClear') mat.opacity = o.lensOpacity;
    mats.push(mat);
    const mesh = new THREE.Mesh(G[pt.part], mat);
    mesh.name = 'frame-' + pt.part;
    if (pt.part === 'lens') mesh.renderOrder = 2;
    group.add(mesh);
  }
  group.scale.setScalar(frameScale(p, size));
  group.userData.dispose = () => mats.forEach((m) => m.dispose());
  group.userData.geo = G;
  return group;
}
