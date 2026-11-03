// Imports jewellery 3D models (from the client's 3D team) so they replace the procedurally built pieces.
//
//   models/jewellery/<product id>.glb    (or .gltf or .obj), e.g. models/jewellery/p01.glb
//   models/jewellery/<product id>.json   optional fixes: { "units": "cm", "rotate": [90, 0, 0], "offset": [0, 0, 0],
//                                         "roles": { "Gem_Red": "main" }, "pendantOnly": true }
//
//   npm run models            import every model in models/jewellery
//   npm run models -- p01 s02 import only these
//
// For each model it: detects the units (mm, cm, m or inches) from the piece's expected size; turns rings, bangles
// and bracelets so the finger or wrist runs along z and finds the hole; puts the origin where the piece is worn
// (earlobe hook, tikka hook, nath piercing, back of the neck); sorts parts into metal, enamel, stones (by role,
// so the shopper can change them) and pearls; makes a full-detail file for the viewer and the try-on and a light
// file for the store; compresses both (meshopt); and lists them in src/data/jewellery-models.json.
// The browser then uses these files instead of building the piece (src/jewel/models.js). No secrets involved.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Document, Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { quantize } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import * as THREE from 'three';
import { mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { NY } from '../src/core/ny.js';
import '../src/data/catalogue.js';
import { BUST } from '../src/jewel/shapes.js';

export const IMPORTER_VERSION = 1;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------------------------------------------------------------- expectations per type (millimetres) */
// plausible overall size of each kind of piece, used to detect the model's units
const RANGES = {
  ring: [[14, 42]],
  earrings: [[6, 170]],
  necklace: [[100, 330]],
  pendant: [
    [10, 75],
    [100, 330],
  ],
  bangle: [[48, 100]],
  bracelet: [[38, 230]],
  tikka: [[25, 140]],
  nath: [[10, 75]],
};
const UNITS = { mm: 1, m: 1000, cm: 10, in: 25.4 };
// triangle budgets: full detail (viewer, try-on) and store (about 110 pieces are on display at once)
const FULL_TRIS = 110000;
const STORE_TRIS = {
  ring: 8000,
  earrings: 5000,
  nath: 6000,
  tikka: 8000,
  bangle: 14000,
  bracelet: 14000,
  necklace: 26000,
  pendant: 12000,
};

/* ---------------------------------------------------------------- reading */
let io = null;
async function getIO() {
  if (io) return io;
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  io = new NodeIO()
    .setLogger(new Logger(Logger.Verbosity.WARN))
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  return io;
}
function matInfo(mat) {
  if (!mat) return { name: '', color: [1, 1, 1, 1], metal: 1, rough: 0.3, alpha: false, transmission: 0 };
  const tr = mat.getExtension('KHR_materials_transmission');
  const c = mat.getBaseColorFactor();
  return {
    name: mat.getName() || '',
    color: c,
    metal: mat.getMetallicFactor(),
    rough: mat.getRoughnessFactor(),
    alpha: mat.getAlphaMode() !== 'OPAQUE' || c[3] < 0.99,
    transmission: tr ? tr.getTransmissionFactor() : 0,
  };
}
/** All triangle meshes of a glTF document in world space: [{ geo, mat, name }]. */
function partsFromDoc(doc) {
  const parts = [];
  const el = [];
  for (const scene of doc.getRoot().listScenes())
    scene.traverse((node) => {
      const mesh = node.getMesh();
      if (!mesh) return;
      const M = new THREE.Matrix4().fromArray(node.getWorldMatrix());
      for (const prim of mesh.listPrimitives()) {
        if (prim.getMode() !== 4) continue;
        const pa = prim.getAttribute('POSITION');
        if (!pa) continue;
        const n = pa.getCount();
        const pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          pa.getElement(i, el);
          pos.set([el[0], el[1], el[2]], i * 3);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const na = prim.getAttribute('NORMAL');
        if (na) {
          const nor = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) {
            na.getElement(i, el);
            nor.set([el[0], el[1], el[2]], i * 3);
          }
          g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        }
        const ia = prim.getIndices();
        g.setIndex(
          new THREE.BufferAttribute(
            ia ? Uint32Array.from(ia.getArray()) : Uint32Array.from({ length: n }, (_, i) => i),
            1,
          ),
        );
        g.applyMatrix4(M);
        parts.push({ geo: g, mat: matInfo(prim.getMaterial()), name: [node.getName(), mesh.getName()].join(' ') });
      }
    });
  return parts;
}
/** A minimal OBJ reader: vertices, faces (any polygon, triangulated as a fan), groups and materials. */
function partsFromOBJ(text) {
  const v = [];
  const groups = new Map();
  let obj = '',
    mtl = '';
  const cur = () => {
    const k = obj + '|' + mtl;
    if (!groups.has(k)) groups.set(k, { name: obj, mat: mtl, pos: [] });
    return groups.get(k);
  };
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim().split(/\s+/);
    if (t[0] === 'v') v.push([+t[1], +t[2], +t[3]]);
    else if (t[0] === 'o' || t[0] === 'g') obj = t.slice(1).join(' ');
    else if (t[0] === 'usemtl') mtl = t.slice(1).join(' ');
    else if (t[0] === 'f') {
      const idx = t.slice(1).map((s) => {
        const i = parseInt(s.split('/')[0], 10);
        return i < 0 ? v.length + i : i - 1;
      });
      const g = cur();
      for (let k = 1; k + 1 < idx.length; k++) for (const i of [idx[0], idx[k], idx[k + 1]]) g.pos.push(...v[i]);
    }
  }
  const parts = [];
  for (const g of groups.values()) {
    if (!g.pos.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(g.pos), 3));
    const w = mergeVertices(geo, 1e-6);
    parts.push({
      geo: w,
      mat: { name: g.mat, color: [1, 1, 1, 1], metal: 1, rough: 0.3, alpha: false, transmission: 0 },
      name: g.name,
    });
  }
  return parts;
}

/* ---------------------------------------------------------------- sorting parts */
const KIND_WORDS = [
  ['polki', /polki|uncut/],
  ['kundan', /kundan/],
  ['ruby', /ruby|manik/],
  ['emerald', /emerald|panna/],
  ['sapphire', /sapphire|neelam/],
  ['pink', /pink/],
  ['yellow', /yellow sapph|pukhraj|citrine/],
  ['onyx', /onyx/],
  ['amethyst', /amethyst/],
  ['coral', /coral|moonga/],
  ['diamond', /diamond|\bdia\b|\bcz\b|zircon|brilliant|solitaire/],
];
const STONE_WORD =
  /stone|gem|diamond|\bdia\b|polki|kundan|ruby|emerald|sapphire|crystal|\bcz\b|zircon|onyx|amethyst|coral|topaz|garnet|glass|jewel|manik|panna|neelam/;
const hex = (c) =>
  '#' +
  c
    .slice(0, 3)
    .map((x) =>
      Math.round(Math.min(1, Math.max(0, x)) ** (1 / 2.2) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
function classify(part, fix) {
  const t = (part.mat.name + ' ' + part.name).toLowerCase();
  for (const key in fix.roles || {})
    if (t.includes(key.toLowerCase())) {
      const r = fix.roles[key];
      if (r === 'pearl') return { cls: 'pearl' };
      if (r === 'metal' || r === 'white' || r === 'oxidised')
        return { cls: 'metal', slot: r === 'white' ? 'w' : r === 'oxidised' ? 'ox' : 'm' };
      if (r === 'enamel') return { cls: 'enamel', color: hex(part.mat.color) };
      return { cls: 'stone', role: r, kind: null };
    }
  if (/pearl|moti/.test(t)) return { cls: 'pearl' };
  if (/enamel|meena|minakari/.test(t)) return { cls: 'enamel', color: hex(part.mat.color) };
  if (STONE_WORD.test(t) || part.mat.transmission > 0.2 || (part.mat.alpha && part.mat.metal < 0.5)) {
    const role = /main|centre|center|solitaire|\bbig\b|primary/.test(t)
      ? 'main'
      : /accent|halo|pave|side|small|secondary|melee/.test(t)
        ? 'accent'
        : /drop/.test(t)
          ? 'drop'
          : null;
    const kw = KIND_WORDS.find(([, re]) => re.test(t));
    return { cls: 'stone', role, kind: kw ? kw[0] : null };
  }
  const slot = /white|claw|prong|rhodium/.test(t) ? 'w' : /oxid|blacken/.test(t) ? 'ox' : 'm';
  return { cls: 'metal', slot };
}

/* ---------------------------------------------------------------- geometry helpers */
function boxOf(parts) {
  const b = new THREE.Box3();
  for (const p of parts) {
    p.geo.computeBoundingBox();
    b.union(p.geo.boundingBox);
  }
  return b;
}
const triCount = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
function forTris(g, fn) {
  const P = g.attributes.position.array;
  const I = g.index ? g.index.array : null;
  const n = triCount(g);
  for (let t = 0; t < n; t++) {
    const a = I ? I[t * 3] : t * 3,
      b = I ? I[t * 3 + 1] : t * 3 + 1,
      c = I ? I[t * 3 + 2] : t * 3 + 2;
    fn(t, P, a, b, c);
  }
}
/** Connected pieces of a mesh (stones, pearls): arrays of triangle indices. */
function components(g) {
  const w = mergeVertices(stripTo(g, ['position']), 1e-4);
  const I = w.index.array,
    n = I.length / 3;
  const parent = Int32Array.from({ length: w.attributes.position.count }, (_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]];
    return x;
  };
  for (let t = 0; t < n; t++) {
    const a = find(I[t * 3]),
      b = find(I[t * 3 + 1]),
      c = find(I[t * 3 + 2]);
    parent[b] = a;
    parent[find(c)] = a;
  }
  const map = new Map();
  for (let t = 0; t < n; t++) {
    const r = find(I[t * 3]);
    if (!map.has(r)) map.set(r, []);
    map.get(r).push(t);
  }
  return [...map.values()];
}
function stripTo(g, keep) {
  const c = new THREE.BufferGeometry();
  for (const k of keep) if (g.attributes[k]) c.setAttribute(k, g.attributes[k].clone());
  if (g.index) c.setIndex(g.index.clone());
  return c;
}
/** A geometry made of some triangles of g (in that order), indexed and compact. */
function subset(g, tris) {
  const P = g.attributes.position.array;
  const I = g.index ? g.index.array : null;
  const pos = new Float32Array(tris.length * 9);
  tris.forEach((t, k) => {
    for (let v = 0; v < 3; v++) {
      const i = I ? I[t * 3 + v] : t * 3 + v;
      pos.set([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], (k * 3 + v) * 3);
    }
  });
  const s = new THREE.BufferGeometry();
  s.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return s;
}
/** Table direction, an axis across the table, centre and girdle size of one stone (a non-indexed geometry). */
function stoneFrame(g) {
  const P = g.attributes.position.array;
  const n = P.length / 9;
  const A = new THREE.Vector3(),
    B = new THREE.Vector3(),
    C = new THREE.Vector3(),
    N = new THREE.Vector3();
  // facets grouped by direction: the table is the largest flat area
  const groups = [];
  for (let t = 0; t < n; t++) {
    A.fromArray(P, t * 9);
    B.fromArray(P, t * 9 + 3);
    C.fromArray(P, t * 9 + 6);
    N.subVectors(B, A).cross(C.clone().sub(A));
    const area = N.length() / 2;
    if (area < 1e-9) continue;
    N.normalize();
    let gp = groups.find((x) => x.n.dot(N) > 0.996);
    if (!gp) groups.push((gp = { n: N.clone(), area: 0, e: B.clone().sub(A) }));
    gp.area += area;
  }
  groups.sort((a, b) => b.area - a.area);
  const up = groups.length ? groups[0].n.clone() : new THREE.Vector3(0, 1, 0);
  const x = groups.length ? groups[0].e.clone() : new THREE.Vector3(1, 0, 0);
  x.addScaledVector(up, -x.dot(up));
  if (x.lengthSq() < 1e-10)
    x.set(Math.abs(up.x) < 0.9 ? 1 : 0, 0, Math.abs(up.x) < 0.9 ? 0 : 1).addScaledVector(up, -up.x);
  x.normalize();
  g.computeBoundingBox();
  const c = g.boundingBox.getCenter(new THREE.Vector3());
  let r = 0;
  for (let i = 0; i < P.length; i += 3) {
    const d = new THREE.Vector3(P[i] - c.x, P[i + 1] - c.y, P[i + 2] - c.z);
    d.addScaledVector(up, -d.dot(up));
    r = Math.max(r, d.length());
  }
  return { up, x, c, size: 2 * r };
}
/** Simplifies to about `target` triangles (meshopt), then rebuilds creased normals. */
function simplify(g, target) {
  const w = mergeVertices(stripTo(g, ['position']), 1e-4);
  const n = triCount(w);
  let out = w;
  if (n > target) {
    const [idx] = MeshoptSimplifier.simplify(
      new Uint32Array(w.index.array),
      new Float32Array(w.attributes.position.array),
      3,
      Math.max(3, Math.floor(target) * 3),
      0.02,
      [],
    );
    out = new THREE.BufferGeometry();
    out.setAttribute('position', w.attributes.position.clone());
    out.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  }
  const creased = toCreasedNormals(out.index ? out.toNonIndexed() : out, (38 * Math.PI) / 180);
  return mergeVertices(creased, 1e-5);
}
function withNormals(g) {
  if (g.attributes.normal) return g.index ? g : mergeVertices(g, 1e-6);
  const creased = toCreasedNormals(g.index ? g.toNonIndexed() : g, (38 * Math.PI) / 180);
  return mergeVertices(creased, 1e-5);
}

/** The enclosed hole of a ring, bangle or bracelet seen along z: centre (x, y) and diameter, or null. */
function findHole(parts) {
  const box = boxOf(parts);
  const N = 220;
  const w = box.max.x - box.min.x,
    h = box.max.y - box.min.y;
  const cell = Math.max(w, h) / (N - 8);
  const x0 = box.min.x - cell * 4,
    y0 = box.min.y - cell * 4;
  const grid = new Uint8Array(N * N);
  const A = [0, 0],
    B = [0, 0],
    C = [0, 0];
  for (const p of parts)
    forTris(p.geo, (t, P, a, b, c) => {
      A[0] = (P[a * 3] - x0) / cell;
      A[1] = (P[a * 3 + 1] - y0) / cell;
      B[0] = (P[b * 3] - x0) / cell;
      B[1] = (P[b * 3 + 1] - y0) / cell;
      C[0] = (P[c * 3] - x0) / cell;
      C[1] = (P[c * 3 + 1] - y0) / cell;
      const minX = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))),
        maxX = Math.min(N - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
      const minY = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))),
        maxY = Math.min(N - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
      const d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
      if (Math.abs(d) < 1e-9) {
        for (const q of [A, B, C]) {
          const ix = Math.round(q[0]),
            iy = Math.round(q[1]);
          if (ix >= 0 && iy >= 0 && ix < N && iy < N) grid[iy * N + ix] = 1;
        }
        return;
      }
      for (let iy = minY; iy <= maxY; iy++)
        for (let ix = minX; ix <= maxX; ix++) {
          const px = ix + 0.5,
            py = iy + 0.5;
          const l1 = ((B[1] - C[1]) * (px - C[0]) + (C[0] - B[0]) * (py - C[1])) / d;
          const l2 = ((C[1] - A[1]) * (px - C[0]) + (A[0] - C[0]) * (py - C[1])) / d;
          if (l1 >= -0.02 && l2 >= -0.02 && 1 - l1 - l2 >= -0.02) grid[iy * N + ix] = 1;
        }
    });
  // flood the outside from the border, then the largest remaining empty region is the hole
  const seen = new Uint8Array(N * N);
  const fill = (start) => {
    const q = [start];
    seen[start] = 1;
    const cells = [];
    while (q.length) {
      const i = q.pop();
      cells.push(i);
      const x = i % N,
        y = (i / N) | 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const j = ny * N + nx;
        if (!seen[j] && !grid[j]) {
          seen[j] = 1;
          q.push(j);
        }
      }
    }
    return cells;
  };
  fill(0);
  let best = null;
  for (let i = 0; i < N * N; i++)
    if (!grid[i] && !seen[i]) {
      const cells = fill(i);
      if (!best || cells.length > best.length) best = cells;
    }
  if (!best || best.length < 12) return null;
  let sx = 0,
    sy = 0;
  for (const i of best) {
    sx += (i % N) + 0.5;
    sy += ((i / N) | 0) + 0.5;
  }
  const area = best.length * cell * cell;
  return { x: x0 + (sx / best.length) * cell, y: y0 + (sy / best.length) * cell, dia: 2 * Math.sqrt(area / Math.PI) };
}
/** Points within `tol` of the top of the piece: their mean x and z (where a hook or piercing is). */
function topPoint(parts, tol = 0.6) {
  const box = boxOf(parts);
  let sx = 0,
    sz = 0,
    n = 0;
  for (const p of parts) {
    const P = p.geo.attributes.position.array;
    for (let i = 0; i < P.length; i += 3)
      if (P[i + 1] > box.max.y - tol) {
        sx += P[i];
        sz += P[i + 2];
        n++;
      }
  }
  return new THREE.Vector3(n ? sx / n : 0, box.max.y, n ? sz / n : 0);
}
function transformAll(parts, m) {
  for (const p of parts) p.geo.applyMatrix4(m);
}

/* ---------------------------------------------------------------- one model */
/**
 * Prepares one model. Returns { full, store, info } where full and store are { metal, enamel, stones, pearls }
 * groups in millimetres in the piece's frame (see FRAMES in src/jewel/build.js).
 */
export function prepareModel(parts, product, fix = {}) {
  const type = product.type;
  const notes = [];
  if (!parts.length) throw new Error('no triangle meshes found');
  // 1. units
  let box = boxOf(parts);
  let maxDim = Math.max(...box.getSize(new THREE.Vector3()).toArray());
  let unit = fix.units;
  if (!unit) {
    const ranges = RANGES[type] || [[5, 400]];
    const fits = (k) => ranges.some(([a, b]) => maxDim * UNITS[k] >= a && maxDim * UNITS[k] <= b);
    unit = ['mm', 'm', 'cm', 'in'].find(fits);
    if (!unit) {
      const mid = Math.sqrt(ranges[0][0] * ranges[0][1]);
      unit = Object.keys(UNITS).sort(
        (a, b) => Math.abs(Math.log((maxDim * UNITS[a]) / mid)) - Math.abs(Math.log((maxDim * UNITS[b]) / mid)),
      )[0];
      notes.push('size did not match a ' + type + ' in any unit; using ' + unit);
    }
  }
  const s = UNITS[unit] * (fix.scale || 1);
  transformAll(parts, new THREE.Matrix4().makeScale(s, s, s));
  // 2. orientation
  if (fix.rotate) {
    const [rx, ry, rz] = fix.rotate.map((d) => (d * Math.PI) / 180);
    transformAll(parts, new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ')));
  } else if (type === 'ring' || type === 'bangle' || type === 'bracelet') {
    // the finger or wrist runs along the thinnest direction of a ring or bangle: turn it onto z
    const sz = boxOf(parts).getSize(new THREE.Vector3());
    if (sz.x < sz.y && sz.x < sz.z) transformAll(parts, new THREE.Matrix4().makeRotationY(Math.PI / 2));
    else if (sz.y < sz.x && sz.y < sz.z) transformAll(parts, new THREE.Matrix4().makeRotationX(Math.PI / 2));
  }
  // 3. classify
  const groups = { metal: {}, enamel: {}, stones: new Map(), pearls: [] };
  for (const p of parts) p.k = classify(p, fix);
  // 4. origin where the piece is worn, and anchors
  const anchors = {};
  let earringGap = null;
  box = boxOf(parts);
  if (type === 'ring' || type === 'bangle' || type === 'bracelet') {
    const hole = findHole(parts.filter((p) => p.k.cls === 'metal' || p.k.cls === 'enamel'));
    if (hole) {
      // rings: the head sits above the hole (+y)
      if (type === 'ring' && box.max.y - hole.y < hole.y - box.min.y) {
        transformAll(parts, new THREE.Matrix4().makeRotationZ(Math.PI));
        hole.x = -hole.x;
        hole.y = -hole.y;
      }
      box = boxOf(parts);
      transformAll(parts, new THREE.Matrix4().makeTranslation(-hole.x, -hole.y, -(box.min.z + box.max.z) / 2));
      anchors.innerDia = +hole.dia.toFixed(2);
    } else {
      notes.push('no closed hole found; centred on the bounding box');
      const c = box.getCenter(new THREE.Vector3());
      transformAll(parts, new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
    }
  } else if (type === 'necklace' || (type === 'pendant' && !fix.pendantOnly && maxDim * s >= 90)) {
    // rest the necklace on the display bust (BUST in src/jewel/shapes.js): the sides of the loop sit where the
    // neck has widened to the loop's width, centred front to back
    const cx = (box.min.x + box.max.x) / 2;
    const hw = (box.max.x - box.min.x) / 2;
    let sy = 0,
      sz = 0,
      n = 0;
    for (const p of parts) {
      const P = p.geo.attributes.position.array;
      for (let i = 0; i < P.length; i += 3)
        if (Math.abs(P[i] - cx) > hw * 0.9) {
          sy += P[i + 1];
          sz += P[i + 2];
          n++;
        }
    }
    const yRest = restHeight(hw);
    transformAll(parts, new THREE.Matrix4().makeTranslation(-cx, yRest - sy / n, -sz / n));
    // front to back: the chain at the back of the neck touches the bust's back
    const b2 = boxOf(parts);
    let zb = Infinity,
      yb = 0;
    for (const p of parts) {
      const P = p.geo.attributes.position.array;
      for (let i = 0; i < P.length; i += 3)
        if (P[i + 1] > b2.max.y - 15 && P[i + 2] < zb) {
          zb = P[i + 2];
          yb = P[i + 1];
        }
    }
    if (zb < Infinity) transformAll(parts, new THREE.Matrix4().makeTranslation(0, 0, -(BUST.rz(yb, true) + 2.5) - zb));
  } else {
    if (type === 'earrings') {
      // a pair side by side: keep one earring (the one on +x) and remember the spacing
      const split = pairSplit(parts, box);
      if (split != null) {
        const left = new THREE.Box3(),
          right = new THREE.Box3();
        for (const p of parts) {
          const keep = [],
            drop = [];
          forTris(p.geo, (t, P, a, b, c) => {
            const cx = (P[a * 3] + P[b * 3] + P[c * 3]) / 3;
            (cx > split ? keep : drop).push(t);
          });
          const kept = subset(p.geo, keep),
            other = subset(p.geo, drop);
          kept.computeBoundingBox();
          other.computeBoundingBox();
          if (keep.length) right.union(kept.boundingBox);
          if (drop.length) left.union(other.boundingBox);
          p.geo = keep.length ? mergeVertices(kept, 1e-6) : null;
        }
        for (let i = parts.length - 1; i >= 0; i--) if (!parts[i].geo) parts.splice(i, 1);
        earringGap = +(right.getCenter(new THREE.Vector3()).x - left.getCenter(new THREE.Vector3()).x).toFixed(2);
      }
    }
    // hanging pieces: the piercing, hook or bail. Keep the artist's origin when it is clearly placed there (near
    // the top of the piece); otherwise take the highest point, a little lower for an earring's stud or hook
    const b1 = boxOf(parts);
    const h = b1.max.y - b1.min.y;
    const own = b1.containsPoint(new THREE.Vector3(0, 0, 0)) && b1.max.y - 0 < h * 0.35 && earringGap == null;
    if (!own) {
      const t = topPoint(parts);
      t.y -= type === 'earrings' ? Math.min(4, h * 0.12) : type === 'tikka' ? Math.min(3, h * 0.05) : 0.5;
      transformAll(parts, new THREE.Matrix4().makeTranslation(-t.x, -t.y, -t.z));
    } else notes.push('kept the model origin as the ' + (type === 'earrings' ? 'piercing' : 'hook') + ' point');
    const b2 = boxOf(parts);
    anchors.bottom = +b2.min.y.toFixed(2);
    if (type === 'tikka') anchors.chain = +estimateChain(parts, b2).toFixed(1);
  }
  if (fix.offset) transformAll(parts, new THREE.Matrix4().makeTranslation(...fix.offset));
  // 5. groups
  for (const p of parts) {
    const k = p.k;
    if (k.cls === 'metal') (groups.metal[k.slot] || (groups.metal[k.slot] = [])).push(p.geo);
    else if (k.cls === 'enamel') (groups.enamel[k.color] || (groups.enamel[k.color] = [])).push(p.geo);
    else if (k.cls === 'pearl') {
      for (const tris of components(p.geo)) {
        const g = subset(p.geo, tris);
        g.computeBoundingBox();
        const c = g.boundingBox.getCenter(new THREE.Vector3());
        const sz = g.boundingBox.getSize(new THREE.Vector3());
        groups.pearls.push([c.x, c.y, c.z, (sz.x + sz.y + sz.z) / 6].map((v) => +v.toFixed(3)));
      }
    } else {
      const list = [];
      for (const tris of components(p.geo)) {
        const g = subset(p.geo, tris);
        list.push({ g, f: stoneFrame(g) });
      }
      const key = k.role || '?' + (k.kind || 'stone');
      if (!groups.stones.has(key)) groups.stones.set(key, { role: k.role, kind: k.kind, list: [] });
      groups.stones.get(key).list.push(...list);
    }
  }
  assignRoles(groups.stones, product, notes);
  const size = boxOf(parts).getSize(new THREE.Vector3());
  const info = {
    type,
    unit,
    size: size.toArray().map((v) => +v.toFixed(1)),
    anchors,
    gap: earringGap,
    pendantOnly: type === 'pendant' && (fix.pendantOnly || maxDim * s < 90),
    stones: [...groups.stones.values()].map((x) => ({ role: x.role, count: x.list.length })),
    pearls: groups.pearls.length,
    notes,
  };
  return { groups, info };
}
/** Height on the display bust where a loop of half-width hw (mm) comes to rest. */
function restHeight(hw) {
  const target = hw - 1.5;
  for (let y = 40; y > -150; y -= 0.5) if (BUST.rx(y) >= target) return y;
  return -150;
}
/** Earrings modelled as a pair: the x position of the empty gap between them, or null. */
function pairSplit(parts, box) {
  const w = box.max.x - box.min.x;
  const bins = Math.max(8, Math.round(w / 0.5));
  const occ = new Uint8Array(bins);
  for (const p of parts)
    forTris(p.geo, (t, P, a, b, c) => {
      const lo = Math.min(P[a * 3], P[b * 3], P[c * 3]),
        hi = Math.max(P[a * 3], P[b * 3], P[c * 3]);
      for (
        let i = Math.floor(((lo - box.min.x) / w) * (bins - 1));
        i <= Math.ceil(((hi - box.min.x) / w) * (bins - 1));
        i++
      )
        if (i >= 0 && i < bins) occ[i] = 1;
    });
  let best = null;
  for (let i = Math.floor(bins * 0.25); i < Math.ceil(bins * 0.75); i++) {
    if (occ[i]) continue;
    let j = i;
    while (j < bins && !occ[j]) j++;
    if (!best || j - i > best[1] - best[0]) best = [i, j];
    i = j;
  }
  if (!best || ((best[1] - best[0]) * w) / bins < 2) return null;
  return box.min.x + (((best[0] + best[1]) / 2) * w) / (bins - 1);
}
/** How long a tikka's chain is: from the hook down to where the piece widens into the pendant. */
function estimateChain(parts, box) {
  for (let y = box.max.y - 1; y > box.min.y; y -= 1) {
    let lo = Infinity,
      hi = -Infinity;
    for (const p of parts) {
      const P = p.geo.attributes.position.array;
      for (let i = 0; i < P.length; i += 3)
        if (P[i + 1] <= y + 1 && P[i + 1] > y) {
          lo = Math.min(lo, P[i]);
          hi = Math.max(hi, P[i]);
        }
    }
    if (hi - lo > 6) return Math.max(5, box.max.y - y - 2);
  }
  return Math.max(5, (box.max.y - box.min.y) * 0.5);
}
/** Gives every stone group a role (main, accent, drop) so the shopper can change it, or a fixed kind. */
function assignRoles(stones, product, notes) {
  const roles = product.stones.filter((s) => s.role).map((s) => ({ role: s.role, kind: s.kind }));
  const open = [...stones.values()].filter((x) => !x.role);
  for (const g of open) {
    const byKind =
      g.kind && roles.find((r) => r.kind === g.kind && ![...stones.values()].some((x) => x.role === r.role));
    if (byKind) g.role = byKind.role;
  }
  const still = [...stones.values()].filter((x) => !x.role);
  if (still.length) {
    // the group with the biggest stones is the main stone, the rest are accents
    still.sort((a, b) => avgSize(b) - avgSize(a));
    still.forEach((g, i) => {
      g.role = i === 0 && ![...stones.values()].some((x) => x.role === 'main') ? 'main' : 'accent';
      if (g.kind && !roles.some((r) => r.role === g.role)) g.fixed = g.kind;
    });
    notes.push('stone roles guessed: ' + still.map((g) => g.role + ' x' + g.list.length).join(', '));
  }
}
const avgSize = (g) => g.list.reduce((a, s) => a + s.f.size, 0) / Math.max(1, g.list.length);

/* ---------------------------------------------------------------- writing */
function buildDoc(groups, info, product, detail) {
  const doc = new Document().setLogger(new Logger(Logger.Verbosity.WARN));
  const buf = doc.createBuffer();
  const scene = doc.createScene('piece');
  const pieceNode = doc.createNode('piece').setExtras({
    kanak: IMPORTER_VERSION,
    id: product.id,
    type: info.type,
    anchors: info.anchors,
    gap: info.gap,
    pendantOnly: info.pendantOnly,
  });
  scene.addChild(pieceNode);
  let tris = 0;
  const addMesh = (name, geo, extras) => {
    const pos = new Float32Array(geo.attributes.position.array);
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf));
    if (geo.attributes.normal)
      prim.setAttribute(
        'NORMAL',
        doc.createAccessor().setType('VEC3').setArray(new Float32Array(geo.attributes.normal.array)).setBuffer(buf),
      );
    const n = geo.attributes.position.count;
    const idx = geo.index ? geo.index.array : Uint32Array.from({ length: n }, (_, i) => i);
    prim.setIndices(
      doc
        .createAccessor()
        .setType('SCALAR')
        .setArray(n < 65535 ? new Uint16Array(idx) : new Uint32Array(idx))
        .setBuffer(buf),
    );
    prim.setMaterial(doc.createMaterial(name));
    tris += idx.length / 3;
    const node = doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim));
    if (extras) node.setExtras(extras);
    pieceNode.addChild(node);
  };
  const budget = detail === 'store' ? STORE_TRIS[info.type] || 10000 : FULL_TRIS;
  let metalTris = 0;
  for (const k in groups.metal) for (const g of groups.metal[k]) metalTris += triCount(g);
  for (const k in groups.enamel) for (const g of groups.enamel[k]) metalTris += triCount(g);
  let stoneTris = 0;
  for (const g of groups.stones.values()) for (const s of g.list) stoneTris += triCount(s.g);
  const ratio = Math.min(1, Math.max(0.05, (budget - Math.min(stoneTris, budget * 0.5)) / Math.max(1, metalTris)));
  const shape = (g) => (ratio < 1 ? simplify(g, triCount(g) * ratio) : withNormals(g));
  const merged = (list) => (list.length === 1 ? list[0] : mergeGeoms(list));
  for (const k in groups.metal) addMesh('metal-' + k, shape(merged(groups.metal[k])));
  for (const k in groups.enamel) addMesh('enamel-' + k.slice(1), shape(merged(groups.enamel[k])));
  // store files keep at most 600 stones per group, the largest first
  for (const g of groups.stones.values()) {
    let list = g.list;
    if (detail === 'store' && list.length > 600) list = [...list].sort((a, b) => b.f.size - a.f.size).slice(0, 600);
    const geos = [];
    const frames = [];
    let tri = 0;
    for (const s of list) {
      geos.push(s.g);
      const n = triCount(s.g);
      frames.push(
        [tri, n, ...s.f.up.toArray(), ...s.f.x.toArray(), ...s.f.c.toArray(), s.f.size].map((v, i) =>
          i < 2 ? v : +v.toFixed(4),
        ),
      );
      tri += n;
    }
    const all = mergeGeoms(geos);
    addMesh('stones-' + (g.fixed ? 'kind-' + g.fixed : g.role), mergeVertices(all, 1e-6), { stones: frames });
  }
  if (groups.pearls.length) pieceNode.addChild(doc.createNode('pearls').setExtras({ pearls: groups.pearls }));
  return { doc, tris };
}
function mergeGeoms(list) {
  let n = 0;
  for (const g of list) n += g.index ? g.index.count : g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.set(ng.attributes.position.array, o);
    o += ng.attributes.position.array.length;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return m;
}
async function writeGLB(doc) {
  const IO = await getIO();
  doc
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await doc.transform(quantize({ quantizePosition: 14, quantizeNormal: 10 }));
  return IO.writeBinary(doc);
}

/* ---------------------------------------------------------------- folder import */
export async function readParts(file) {
  const ext = extname(file).toLowerCase();
  if (ext === '.obj') return partsFromOBJ(readFileSync(file, 'utf8'));
  if (ext === '.glb' || ext === '.gltf') return partsFromDoc(await (await getIO()).read(file));
  throw new Error('unsupported file type ' + ext + ' (use .glb, .gltf or .obj)');
}
/**
 * Imports models. o: { src, out (public folder), manifest (json path), only: [ids], log }
 * Returns the manifest object.
 */
export async function importModels(o = {}) {
  const src = o.src || join(root, 'models/jewellery');
  const out = o.out || join(root, 'public/jewellery');
  const manifestPath = o.manifest || join(root, 'src/data/jewellery-models.json');
  const log = o.log || console.log;
  await getIO();
  mkdirSync(out, { recursive: true });
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
  const files = existsSync(src) ? readdirSync(src).filter((f) => /\.(glb|gltf|obj)$/i.test(f)) : [];
  if (!files.length) log('[models] no models in ' + src + ' (add <product id>.glb files there)');
  for (const f of files) {
    const id = basename(f).replace(/\.(glb|gltf|obj)$/i, '');
    if (o.only && o.only.length && !o.only.includes(id)) continue;
    const product = NY.byId[id];
    if (!product) {
      log('[models] ' + f + ': no product with id "' + id + '" in the catalogue, skipped');
      continue;
    }
    const fixPath = join(src, id + '.json');
    const fix = existsSync(fixPath) ? JSON.parse(readFileSync(fixPath, 'utf8')) : {};
    const raw = readFileSync(join(src, f));
    const hash = createHash('sha256')
      .update(raw)
      .update(JSON.stringify(fix))
      .update(String(IMPORTER_VERSION))
      .digest('hex')
      .slice(0, 10);
    if (manifest[id] && manifest[id].hash === hash && existsSync(join(out, basename(manifest[id].file)))) {
      log('[models] ' + id + ' up to date');
      continue;
    }
    try {
      const outputs = {};
      for (const detail of ['full', 'store']) {
        const parts = await readParts(join(src, f));
        const { groups, info } = prepareModel(parts, product, fix);
        const { doc, tris } = buildDoc(groups, info, product, detail);
        const glb = await writeGLB(doc);
        const name = id + '.' + hash + (detail === 'store' ? '.store' : '') + '.glb';
        writeFileSync(join(out, name), glb);
        outputs[detail] = { name, tris, bytes: glb.byteLength, info };
      }
      // remove older files of this piece
      for (const old of readdirSync(out))
        if (old.startsWith(id + '.') && old !== outputs.full.name && old !== outputs.store.name)
          unlinkSync(join(out, old));
      const info = outputs.full.info;
      manifest[id] = {
        file: 'jewellery/' + outputs.full.name,
        store: 'jewellery/' + outputs.store.name,
        hash,
        source: f,
        type: info.type,
        unit: info.unit,
        size: info.size,
        anchors: info.anchors,
        gap: info.gap,
        pendantOnly: info.pendantOnly,
        tris: outputs.full.tris,
        storeTris: outputs.store.tris,
        bytes: outputs.full.bytes,
        storeBytes: outputs.store.bytes,
        stones: info.stones,
        pearls: info.pearls,
      };
      log(
        '[models] ' +
          id +
          ' (' +
          product.name +
          '): ' +
          info.unit +
          ', ' +
          info.size.join(' x ') +
          ' mm, ' +
          Math.round(outputs.full.tris / 1000) +
          'k / ' +
          Math.round(outputs.store.tris / 1000) +
          'k triangles, ' +
          Math.round(outputs.full.bytes / 1024) +
          ' / ' +
          Math.round(outputs.store.bytes / 1024) +
          ' KB, stones ' +
          (info.stones.map((s) => s.role + ' x' + s.count).join(', ') || 'none') +
          (info.pearls ? ', pearls x' + info.pearls : '') +
          (info.notes.length ? '. Note: ' + info.notes.join('; ') : ''),
      );
    } catch (e) {
      log('[models] ' + f + ' failed: ' + e.message);
      if (o.throw) throw e;
    }
  }
  // drop entries whose source file was removed
  for (const id of Object.keys(manifest))
    if (!files.some((f) => f.replace(/\.(glb|gltf|obj)$/i, '') === id) && !(o.only && o.only.length)) {
      log('[models] ' + id + ' no longer in ' + src + '; back to the built-in piece');
      delete manifest[id];
    }
  const sorted = Object.fromEntries(
    Object.keys(manifest)
      .sort()
      .map((k) => [k, manifest[k]]),
  );
  writeFileSync(manifestPath, JSON.stringify(sorted, null, 2) + '\n');
  return sorted;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  importModels({ only }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
