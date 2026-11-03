// An outfit: one or more simulated garment layers on one body, plus their meshes.
// Used by the live mannequins in the store, the mannequin viewer in the product sheet and the camera try-on.
// The caller supplies the body pose each frame (joints in metres); the outfit steps the cloth and updates meshes.
import * as THREE from 'three';
import { ClothSim, FABRICS } from './sim.js';
import { frames, colliders } from './body.js';
import { buildGarment, computeTargets } from './garments.js';
import { ClothMesh, fabricMaterials } from './render.js';

const matCache = new Map();
/** Shared outer/inner materials for a look (fabric, print, colours, border) at a texture size. */
export function materialsFor(spec, texSize = 512) {
  const key = [
    spec.fabric,
    spec.pattern,
    spec.base,
    spec.accent,
    spec.border ? spec.border.color + spec.border.width : '',
    texSize,
    spec.template === 'dupatta',
  ].join('|');
  let m = matCache.get(key);
  if (!m) {
    m = fabricMaterials(spec.fabric, spec.pattern, spec.base, spec.accent, {
      border: spec.border,
      doubleSide: spec.template === 'dupatta',
      texSize,
    });
    matCache.set(key, m);
  }
  return m;
}

export class Outfit {
  /**
   * @param {object} o
   * @param {object} o.m body measurements
   * @param {Array} o.pieces [{ spec }] specs from NY.specFor(), layered in order (outer pieces last)
   * @param {number} [o.res] cloth resolution (1 = full)
   * @param {number} [o.substeps]
   * @param {number} [o.texSize]
   * @param {number} [o.maxSpeed] particle speed limit in m/s (low for camera tracking, which can glitch;
   *   higher for the mannequin viewer, where a hard spin should fling the hem out)
   */
  constructor(o) {
    this.m = o.m;
    this.res = o.res || 1;
    this.substeps = o.substeps || 3;
    this.maxSpeed = o.maxSpeed || 3;
    this.texSize = o.texSize || 512;
    this.group = new THREE.Group();
    this.pieces = [];
    this.legs = o.legs !== false;
    this.fresh = true;
    for (const pc of o.pieces) this.addPiece(pc.spec);
  }
  addPiece(spec) {
    const g = buildGarment(spec, this.m, { res: this.res, armAngle: 0.22 });
    const sim = new ClothSim(g, FABRICS[spec.fabric] || FABRICS.cotton);
    sim.margin = this.margin();
    sim.maxSpeed = this.maxSpeed;
    const mesh = new ClothMesh(g, materialsFor(spec, this.texSize));
    if (g.trims.length) mesh.addTrims(spec.trim);
    mesh.group.visible = false;
    this.group.add(mesh.group);
    const piece = { spec, g, sim, mesh, tg: new Float32Array(g.rest.length), layer: spec.layer || 0 };
    this.pieces.push(piece);
    this.fresh = true;
    return piece;
  }
  /** Collision margin: coarser cloth needs more room so flat triangles don't cut into the body. */
  margin() {
    return 0.006 + Math.max(0, 1 - this.res) * 0.014;
  }
  /** Replace a piece (different garment or size). */
  setPiece(i, spec) {
    const old = this.pieces[i];
    if (old) {
      this.group.remove(old.mesh.group);
      old.mesh.dispose();
    }
    const g = buildGarment(spec, this.m, { res: this.res, armAngle: 0.22 });
    const sim = new ClothSim(g, FABRICS[spec.fabric] || FABRICS.cotton);
    sim.margin = this.margin();
    sim.maxSpeed = this.maxSpeed;
    const mesh = new ClothMesh(g, materialsFor(spec, this.texSize));
    if (g.trims.length) mesh.addTrims(spec.trim);
    mesh.group.visible = false;
    this.group.add(mesh.group);
    this.pieces[i] = { spec, g, sim, mesh, tg: new Float32Array(g.rest.length), layer: spec.layer || 0, fresh: true };
  }
  removePiece(i) {
    const old = this.pieces[i];
    if (!old) return;
    this.group.remove(old.mesh.group);
    old.mesh.dispose();
    this.pieces.splice(i, 1);
  }
  /** Change colours or print without rebuilding the cloth. */
  setLook(i, spec) {
    const pc = this.pieces[i];
    if (!pc) return;
    const mats = materialsFor(spec, this.texSize);
    pc.mesh.outer.material = mats.outer;
    if (pc.mesh.inner) pc.mesh.inner.material = mats.inner;
    if (pc.mesh.trimMesh && spec.trim) pc.mesh.trimMesh.material.color.set(spec.trim);
    pc.spec = spec;
  }
  /** New body measurements: rebuild every piece for the new body. */
  setBody(m) {
    this.m = m;
    const specs = this.pieces.map((p) => p.spec);
    specs.forEach((s, i) => this.setPiece(i, s));
    this.fresh = true;
  }
  /** Jump all cloth to the body (after a pose jump or tracking loss). */
  reset() {
    this.fresh = true;
  }
  /**
   * Advance the simulation.
   * @param {object} J joints (metres)
   * @param {number} dt seconds
   * @param {object} [o] { vis (joint visibility), pad (extra collider padding), legs }
   */
  step(J, dt, o = {}) {
    const F = frames(J);
    const C = colliders(J, this.m, F, { legs: o.legs ?? this.legs });
    let Co = null;
    for (const pc of this.pieces) {
      computeTargets(pc.g, F, pc.tg);
      if (this.fresh || pc.fresh) {
        pc.sim.pos.set(pc.tg);
        pc.sim.prev.set(pc.tg);
        pc.sim.target.set(pc.tg);
        pc.sim.targetPrev.set(pc.tg);
        pc.fresh = false;
        pc.mesh.group.visible = true;
      }
      pc.sim.setTargets(pc.tg);
      if (pc.layer) Co = Co || colliders(J, this.m, F, { legs: o.legs ?? this.legs, pad: 0.014, armPad: 0.03 });
      pc.sim.colliders = pc.layer ? Co : C;
      pc.sim.step(dt, o.substeps || this.substeps);
      if (pc.sim.broken()) pc.fresh = true;
    }
    this.fresh = false;
    return F;
  }
  /** Shift every piece rigidly (keeps the drape when the body jumps). */
  translate(dx, dy, dz) {
    for (const pc of this.pieces) pc.sim.translate(dx, dy, dz);
  }
  /** Copy simulated positions into the meshes. */
  sync() {
    for (const pc of this.pieces) pc.mesh.update(pc.sim.pos);
  }
  /** Particles across all pieces (for quality decisions). */
  get particles() {
    return this.pieces.reduce((a, p) => a + p.sim.n, 0);
  }
  dispose() {
    for (const pc of this.pieces) pc.mesh.dispose();
    this.pieces = [];
  }
}
