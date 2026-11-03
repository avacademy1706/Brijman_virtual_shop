// Kit: the parts of a piece of jewellery before it becomes meshes. Builders add metal geometry (by slot), gems,
// pearls and enamel in millimetres through a transform stack (imported 3D models add whole stone groups too); realize() turns a kit into a three.js group, and
// appendKit() copies one kit into another under a matrix (the store merges hundreds of pieces this way).
//
// Slots and roles keep the geometry independent of the shopper's choices: metal slot 'm' is the chosen metal,
// gems with kind '@main' or '@accent' take the chosen stones, so changing metal or stone never rebuilds geometry.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { gemGeometry } from './gems.js';
import { metalMaterial, gemMaterial, pearlMaterial, enamelMaterial, GEMS } from './materials.js';

const _m = new THREE.Matrix4(),
  _q = new THREE.Quaternion(),
  _s = new THREE.Vector3(),
  _p = new THREE.Vector3();

export class Kit {
  constructor() {
    this.metal = {}; // slot -> [BufferGeometry]
    this.gems = []; // { kind, cut, m: Matrix4 (includes the stone size), size }
    this.pearls = []; // { kind, m }
    this.enamel = {}; // colour -> [BufferGeometry]
    // stones from imported 3D models: { kind, geo (non-indexed: position, normal, facet, sUp, sX), glints }
    this.stones = [];
    this.anchors = {};
    this.M = new THREE.Matrix4();
    this.stack = [];
  }
  push(m) {
    this.stack.push(this.M);
    this.M = this.M.clone().multiply(m);
    return this;
  }
  pop() {
    this.M = this.stack.pop();
    return this;
  }
  metalGeo(slot, g) {
    g.applyMatrix4(this.M);
    (this.metal[slot] || (this.metal[slot] = [])).push(g);
    return g;
  }
  enamelGeo(color, g) {
    g.applyMatrix4(this.M);
    (this.enamel[color] || (this.enamel[color] = [])).push(g);
    return g;
  }
  /** A stone with its girdle centre at pos, table facing up (local +y of the stone) and girdle width size (mm). */
  gem(kind, cut, size, pos, up, xdir) {
    const m = frameMatrix(pos, up || [0, 1, 0], xdir || [1, 0, 0]);
    m.multiply(_m.makeScale(size, size, size));
    const w = this.M.clone().multiply(m);
    this.gems.push({ kind, cut, m: w, size: size * scaleOf(this.M) });
  }
  /**
   * A group of stones from a 3D model, as one non-indexed geometry with a facet id per triangle and each stone's
   * own frame per vertex (sUp: towards the table, sX: across it). glints: [{ pos, size, up }], one per stone.
   */
  stoneGeo(kind, g, glints) {
    applyStone(g, this.M);
    this.stones.push({ kind, geo: g, glints: (glints || []).map((x) => moveGlint(x, this.M)) });
    return g;
  }
  pearl(kind, r, pos) {
    const m = this.M.clone().multiply(new THREE.Matrix4().makeTranslation(pos[0], pos[1], pos[2]));
    m.multiply(_m.makeScale(r, r, r));
    this.pearls.push({ kind, m });
  }
  anchor(name, pos) {
    this.anchors[name] = new THREE.Vector3(pos[0], pos[1], pos[2]).applyMatrix4(this.M);
  }
  /** Number of triangles (for budgets and tests). */
  tris() {
    let n = 0;
    for (const k in this.metal) for (const g of this.metal[k]) n += triCount(g);
    for (const k in this.enamel) for (const g of this.enamel[k]) n += triCount(g);
    for (const s of this.stones) n += triCount(s.geo);
    n += this.gems.length * 110 + this.pearls.length * 80;
    return n;
  }
  bounds() {
    const b = new THREE.Box3();
    for (const k in this.metal)
      for (const g of this.metal[k]) {
        g.computeBoundingBox();
        b.union(g.boundingBox);
      }
    for (const k in this.enamel)
      for (const g of this.enamel[k]) {
        g.computeBoundingBox();
        b.union(g.boundingBox);
      }
    for (const s of this.stones) {
      s.geo.computeBoundingBox();
      b.union(s.geo.boundingBox);
    }
    for (const s of this.gems) {
      s.m.decompose(_p, _q, _s);
      b.expandByPoint(_p.clone().addScalar(s.size * 0.5));
      b.expandByPoint(_p.clone().addScalar(-s.size * 0.5));
    }
    for (const s of this.pearls) {
      s.m.decompose(_p, _q, _s);
      b.expandByPoint(_p.clone().addScalar(_s.x));
      b.expandByPoint(_p.clone().addScalar(-_s.x));
    }
    return b;
  }
}
const triCount = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const scaleOf = (m) => Math.cbrt(Math.abs(m.determinant())) || 1;
const _n3 = new THREE.Matrix3(),
  _v = new THREE.Vector3();
/** Transforms a model stone geometry, including its per-vertex stone frames. */
function applyStone(g, m) {
  g.applyMatrix4(m);
  _n3.getNormalMatrix(m);
  for (const k of ['sUp', 'sX']) {
    const a = g.attributes[k];
    if (!a) continue;
    for (let i = 0; i < a.count; i++) {
      _v.fromBufferAttribute(a, i).applyMatrix3(_n3).normalize();
      a.setXYZ(i, _v.x, _v.y, _v.z);
    }
    a.needsUpdate = true;
  }
  return g;
}
function moveGlint(x, m) {
  _n3.getNormalMatrix(m);
  return {
    pos: x.pos.clone().applyMatrix4(m),
    size: x.size * scaleOf(m),
    up: x.up.clone().applyMatrix3(_n3).normalize(),
  };
}

/** Matrix placing local +y along `up` and local +x as close to `xdir` as possible, at pos. */
export function frameMatrix(pos, up, xdir) {
  const Y = new THREE.Vector3(up[0], up[1], up[2]).normalize();
  let X = new THREE.Vector3(xdir[0], xdir[1], xdir[2]);
  X.addScaledVector(Y, -X.dot(Y));
  if (X.lengthSq() < 1e-8) X = Math.abs(Y.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  X.addScaledVector(Y, -X.dot(Y)).normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y);
  const m = new THREE.Matrix4().makeBasis(X, Y, Z);
  m.setPosition(pos[0], pos[1], pos[2]);
  return m;
}
export const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
export const R = (rx, ry, rz) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0));
export const S = (s, sy, sz) => new THREE.Matrix4().makeScale(s, sy == null ? s : sy, sz == null ? s : sz);
export const mul = (...ms) => ms.reduce((a, b) => a.multiply(b), new THREE.Matrix4());

/**
 * Copies `src` into `dst` under matrix `m` (geometry is cloned). With `o` ({ metal, stones, whiteClaws }) the
 * metal slots and stone roles are resolved to concrete metals and stones on the way, so pieces in different
 * metals can share one kit (the store merges a whole room this way).
 */
export function appendKit(dst, src, m, o) {
  const M = dst.M.clone().multiply(m);
  for (const k in src.metal) {
    const key = o ? resolveMetal(k, o) : k;
    for (const g of src.metal[k]) (dst.metal[key] || (dst.metal[key] = [])).push(g.clone().applyMatrix4(M));
  }
  for (const k in src.enamel)
    for (const g of src.enamel[k]) (dst.enamel[k] || (dst.enamel[k] = [])).push(g.clone().applyMatrix4(M));
  const sc = scaleOf(M);
  for (const s of src.gems)
    dst.gems.push({
      kind: o ? resolveGem(s.kind, o.stones) : s.kind,
      cut: s.cut,
      m: M.clone().multiply(s.m),
      size: s.size * sc,
    });
  for (const s of src.pearls)
    dst.pearls.push({ kind: o ? resolvePearl(s.kind, o.stones) : s.kind, m: M.clone().multiply(s.m) });
  for (const s of src.stones)
    dst.stones.push({
      kind: o ? resolveGem(s.kind, o.stones) : s.kind,
      geo: applyStone(cloneStone(s.geo), M),
      glints: s.glints.map((x) => moveGlint(x, M)),
    });
}
function cloneStone(g) {
  const c = new THREE.BufferGeometry();
  for (const k in g.attributes) c.setAttribute(k, g.attributes[k].clone());
  return c;
}

/** Resolves a gem kind: '@main' / '@accent' / '@drop' take the shopper's choice, anything else is literal. */
export function resolveGem(kind, stones) {
  if (kind[0] !== '@') return kind;
  const r = stones && stones[kind.slice(1)];
  return r || (kind === '@accent' ? 'diamond' : 'diamond');
}
export function resolvePearl(kind, stones) {
  if (kind[0] !== '@') return kind;
  return (stones && stones.pearl) || 'white';
}
/** Metal for a slot. 'm' is the chosen metal; 'w' is the claw metal (white on yellow and rose diamond pieces). */
export function resolveMetal(slot, o) {
  const main = o.metal || 'y22';
  if (slot === 'm') return main;
  if (slot === 'w') return o.whiteClaws && /^(y|r)/.test(main) ? 'w18' : main;
  if (slot === 'ox') return main === 'ag' ? 'ag' : 'ox';
  return slot;
}

function prep(g) {
  const n = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  if (!n.attributes.normal) n.computeVertexNormals();
  return n;
}
export function mergeAll(geos) {
  if (!geos.length) return null;
  const g = mergeGeometries(geos.map(prep), false);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

const pearlGeo = new Map();
function pearlGeometry(detail) {
  if (!pearlGeo.has(detail)) pearlGeo.set(detail, new THREE.SphereGeometry(1, detail, Math.round(detail * 0.7)));
  return pearlGeo.get(detail);
}

/**
 * Builds meshes for a kit.
 * o: { metal, stones: { main, accent, drop, pearl }, whiteClaws, env: { pmrem, cube }, pearlDetail, glints }
 * Returns a THREE.Group; group.userData.glints lists { pos, size } in the kit's units for the sparkle layer.
 */
export function realize(kit, o) {
  const grp = new THREE.Group();
  const env = o.env || {};
  for (const slot in kit.metal) {
    const g = mergeAll(kit.metal[slot]);
    if (!g) continue;
    const mesh = new THREE.Mesh(g, metalMaterial(resolveMetal(slot, o), env.pmrem));
    mesh.name = 'metal-' + slot;
    grp.add(mesh);
  }
  for (const col in kit.enamel) {
    const g = mergeAll(kit.enamel[col]);
    if (!g) continue;
    const mesh = new THREE.Mesh(g, enamelMaterial(col, env.pmrem));
    mesh.name = 'enamel-' + col;
    grp.add(mesh);
  }
  const byGem = new Map();
  for (const s of kit.gems) {
    const kind = resolveGem(s.kind, o.stones);
    const key = kind + '|' + s.cut;
    if (!byGem.has(key)) byGem.set(key, { kind, cut: s.cut, list: [] });
    byGem.get(key).list.push(s);
  }
  const glints = [];
  for (const b of byGem.values()) {
    const im = new THREE.InstancedMesh(gemGeometry(b.cut), gemMaterial(b.kind, env.cube), b.list.length);
    b.list.forEach((s, i) => im.setMatrixAt(i, s.m));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.name = 'gem-' + b.kind + '-' + b.cut;
    grp.add(im);
    const sparkly = GEMS[b.kind] && GEMS[b.kind].disp > 0.01;
    if (sparkly)
      for (const s of b.list) {
        s.m.decompose(_p, _q, _s);
        glints.push({ pos: _p.clone(), size: s.size, up: new THREE.Vector3(0, 1, 0).applyQuaternion(_q) });
      }
  }
  // stones from 3D models, merged per resolved kind and drawn with the gem shader using their own frames
  const byStone = new Map();
  for (const s of kit.stones) {
    const kind = resolveGem(s.kind, o.stones);
    if (!byStone.has(kind)) byStone.set(kind, []);
    byStone.get(kind).push(s);
  }
  for (const [kind, list] of byStone) {
    const g =
      list.length === 1
        ? list[0].geo
        : mergeGeometries(
            list.map((x) => x.geo),
            false,
          );
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, gemMaterial(kind, env.cube, true));
    mesh.name = 'stones-' + kind;
    grp.add(mesh);
    if (GEMS[kind] && GEMS[kind].disp > 0.01) for (const x of list) for (const gl of x.glints) glints.push(gl);
  }
  const byPearl = new Map();
  for (const s of kit.pearls) {
    const kind = resolvePearl(s.kind, o.stones);
    if (!byPearl.has(kind)) byPearl.set(kind, []);
    byPearl.get(kind).push(s);
  }
  for (const [kind, list] of byPearl) {
    const im = new THREE.InstancedMesh(pearlGeometry(o.pearlDetail || 16), pearlMaterial(kind, env.pmrem), list.length);
    list.forEach((s, i) => im.setMatrixAt(i, s.m));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.name = 'pearl-' + kind;
    grp.add(im);
  }
  grp.userData.glints = glints;
  return grp;
}
