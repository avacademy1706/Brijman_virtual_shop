// Static geometry batching: everything built with the same material is merged into one mesh, so the whole
// salon draws in a few dozen calls. A transform stack places fixtures in their own frame.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export class Batcher {
  constructor(scene, materials, opts) {
    this.scene = scene;
    this.M = materials;
    this.opts = opts || {}; // per material key: { solid, cast, receive, order }
    this.batches = new Map();
    this.solids = [];
    this.F = new THREE.Matrix4();
    this.stack = [];
    this.hitboxes = [];
    this.hitMat = new THREE.MeshBasicMaterial({ visible: false });
  }
  push(x, z, ry, y) {
    this.stack.push(this.F);
    const m = new THREE.Matrix4().makeRotationY(ry || 0);
    m.setPosition(x, y || 0, z);
    this.F = this.F.clone().multiply(m);
    return this;
  }
  pushM(m) {
    this.stack.push(this.F);
    this.F = this.F.clone().multiply(m);
    return this;
  }
  pop() {
    this.F = this.stack.pop();
    return this;
  }
  local(x, y, z) {
    return new THREE.Vector3(x, y, z).applyMatrix4(this.F);
  }
  add(key, g) {
    if (!this.M[key]) throw new Error('No material ' + key);
    g.applyMatrix4(this.F);
    let b = this.batches.get(key);
    if (!b) {
      b = [];
      this.batches.set(key, b);
    }
    b.push(g);
    return g;
  }
  box(key, w, h, d, x, y, z, o) {
    o = o || {};
    const g = new THREE.BoxGeometry(w, h, d);
    if (o.uv !== false) boxUV(g, w, h, d, o.uvs || 1);
    if (o.rx) g.rotateX(o.rx);
    if (o.rz) g.rotateZ(o.rz);
    if (o.ry) g.rotateY(o.ry);
    g.translate(x, y, z);
    return this.add(key, g);
  }
  cyl(key, rt, rb, h, x, y, z, seg, o) {
    o = o || {};
    const g = new THREE.CylinderGeometry(rt, rb, h, seg || 24, 1, !!o.open, o.t0 || 0, o.tl || Math.PI * 2);
    if (o.rx) g.rotateX(o.rx);
    if (o.rz) g.rotateZ(o.rz);
    g.translate(x, y, z);
    return this.add(key, g);
  }
  sph(key, r, x, y, z, sx, sy, sz, seg) {
    const g = new THREE.SphereGeometry(r, seg || 16, Math.max(8, Math.round((seg || 16) * 0.6)));
    g.scale(sx || 1, sy || 1, sz || 1);
    g.translate(x, y, z);
    return this.add(key, g);
  }
  plane(key, w, h, x, y, z, rx, ry, uvs) {
    const g = new THREE.PlaneGeometry(w, h);
    if (uvs) {
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / uvs, (uv.getY(i) * h) / uvs);
    }
    if (rx) g.rotateX(rx);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    return this.add(key, g);
  }
  torus(key, R, r, x, y, z, rx, seg, arc) {
    const g = new THREE.TorusGeometry(R, r, 8, seg || 48, arc || Math.PI * 2);
    if (rx) g.rotateX(rx);
    g.translate(x, y, z);
    return this.add(key, g);
  }
  geo(key, g) {
    return this.add(key, g);
  }
  hitbox(action, x, y, z, w, h, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.hitMat);
    m.applyMatrix4(this.F.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z)));
    m.updateMatrixWorld(true);
    m.userData.action = action;
    this.hitboxes.push(m);
    return m;
  }
  flush() {
    for (const [key, geos] of this.batches) {
      if (!geos.length) continue;
      const merged = mergeGeometries(geos.map(prep), false);
      if (!merged) {
        console.warn('merge failed', key);
        continue;
      }
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const opt = this.opts[key] || {};
      const mesh = new THREE.Mesh(merged, this.M[key]);
      mesh.name = 'batch-' + key;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      if (opt.order != null) mesh.renderOrder = opt.order;
      mesh.castShadow = !!opt.cast;
      mesh.receiveShadow = !!opt.receive;
      this.scene.add(mesh);
      if (opt.solid !== false) this.solids.push(mesh);
    }
    this.batches.clear();
  }
}
function prep(g) {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k);
  if (!n.attributes.uv)
    n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
  if (!n.attributes.normal) n.computeVertexNormals();
  return n;
}
export function boxUV(g, w, h, d, s) {
  const uv = g.attributes.uv,
    dims = [
      [d, h],
      [d, h],
      [w, d],
      [w, d],
      [w, h],
      [w, h],
    ];
  for (let f = 0; f < 6; f++) {
    const du = dims[f][0],
      dv = dims[f][1];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * du) / s, (uv.getY(k) * dv) / s);
    }
  }
}
/** A wall panel with an arched opening: width w, height h, thickness t, opening width ow, springing height sp. */
export function archWall(w, h, t, ow, sp, o) {
  o = o || {};
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h);
  s.lineTo(-w / 2, h);
  s.lineTo(-w / 2, 0);
  if (ow > 0) {
    const hole = new THREE.Path();
    const r = ow / 2;
    hole.moveTo(-r, 0.0001);
    hole.lineTo(-r, sp);
    hole.absarc(0, sp, r, Math.PI, 0, true);
    hole.lineTo(r, 0.0001);
    hole.lineTo(-r, 0.0001);
    s.holes.push(hole);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: o.seg || 24 });
  // uv in metres
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / (o.uvs || 1), uv.getY(i) / (o.uvs || 1));
  return g;
}
/** Points along an arch outline (for trims): opening width ow, springing height sp, offset outwards by off. */
export function archCurve(ow, sp, off, n) {
  const r = ow / 2 + (off || 0);
  const pts = [new THREE.Vector3(-r, 0, 0), new THREE.Vector3(-r, sp, 0)];
  for (let i = 1; i < n; i++) {
    const a = Math.PI - (i / n) * Math.PI;
    pts.push(new THREE.Vector3(Math.cos(a) * r, sp + Math.sin(a) * r, 0));
  }
  pts.push(new THREE.Vector3(r, sp, 0), new THREE.Vector3(r, 0, 0));
  return pts;
}
