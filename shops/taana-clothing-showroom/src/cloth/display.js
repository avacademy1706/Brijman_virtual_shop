// Display set-ups shared by the store (runtime) and the drape bake (Node): which body a product is shown on,
// the hanger rig for side-hung rails, and helpers that settle a garment into a resting drape.
import { ClothSim, FABRICS, COLL, CGROUP } from './sim.js';
import {
  defaultMeasurements,
  restPose,
  frames,
  colliders,
  torsoProfile,
  shoulderLine,
  SEG,
  toWorld,
  vec,
} from './body.js';
import { buildGarment, buildCurtain, computeTargets } from './garments.js';
import { animatedPose } from './poses.js';

export const BODY_KIND = { women: 'female', men: 'male', kids: 'child', free: 'female' };
const bodies = {};
/** Display body (mannequin measurements) for a product kind. */
export function bodyFor(kind) {
  const k = BODY_KIND[kind] || kind || 'female';
  return bodies[k] || (bodies[k] = defaultMeasurements(k));
}
/** Chest girth of a body (m). */
export function chestGirth(m) {
  const a = m.chestA,
    b = m.chestB;
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

/** Pose used for hangers: arms angled so sleeves clear the flattened body. Torso origin at (0, 0, 0). */
export const HANGER_ARM = 0.42;
export function hangerPose(m) {
  return restPose(m, HANGER_ARM);
}
/** Colliders of the hanger rig: a thin board the width of the flattened garment, shoulder bar, thin arms. */
export function hangerColliders(m, g) {
  const J = hangerPose(m),
    F = frames(J),
    T = F[SEG.TORSO];
  const C = [];
  const prof = [];
  const gi = g.girth;
  for (let i = 0; i < gi.length; i += 2) prof.push(gi[i], Math.max(m.chestA * 0.7, gi[i + 1] / 4 - 0.006), 0.016);
  if (prof.length < 6) prof.push(0, m.chestA, 0.016, m.torsoLen, m.chestA, 0.016);
  C.push({ type: COLL.TORSO, group: CGROUP.TORSO, o: T.o, x: T.x, y: T.y, z: T.z, profile: prof });
  for (const sh of shoulderLine(m))
    C.push({
      type: COLL.CAPSULE,
      group: CGROUP.SHOULDER,
      a: toWorld(T, sh.a),
      b: toWorld(T, sh.b),
      ra: sh.ra * 0.7,
      rb: sh.rb * 0.7,
    });
  const up = (p, s) => vec.add(p, vec.mul(T.y, s));
  C.push({
    type: COLL.CAPSULE,
    group: CGROUP.HEAD,
    a: up(T.o, 0.02),
    b: up(T.o, 0.12),
    ra: m.neckR * 0.8,
    rb: m.neckR * 0.8,
  });
  for (const s of ['l', 'r']) {
    C.push({ type: COLL.CAPSULE, group: CGROUP.UARM, a: J[s + 'Shoulder'], b: J[s + 'Elbow'], ra: 0.014, rb: 0.012 });
    C.push({ type: COLL.CAPSULE, group: CGROUP.FARM, a: J[s + 'Elbow'], b: J[s + 'Wrist'], ra: 0.012, rb: 0.01 });
  }
  return { J, F, C };
}

/** Settle a garment on the hanger rig. Returns positions in the hanger frame (torso origin at 0,0,0). */
export function settleOnHanger(g, fabricId, m, seconds = 2.6) {
  const sim = new ClothSim(g, FABRICS[fabricId] || FABRICS.cotton);
  sim.skin = new Float32Array(sim.n); // everything hangs freely except the pinned seams
  sim.dampPerSec = Math.min(sim.dampPerSec, 0.12);
  const { F, C } = hangerColliders(m, g);
  const tg = new Float32Array(g.rest.length);
  // start from the rest shape on the body, then move the pins to the hanger
  const Jr = restPose(m, 0.22),
    Fr = frames(Jr);
  computeTargets(g, Fr, tg);
  sim.pos.set(tg);
  sim.prev.set(tg);
  sim.target.set(tg);
  sim.targetPrev.set(tg);
  computeTargets(g, F, tg);
  sim.colliders = C;
  sim.friction = 0.5;
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    sim.setTargets(tg);
    sim.step(1 / 60, 3);
  }
  return sim.pos;
}

/**
 * Settle one or more layered pieces on a mannequin in a static pose.
 * pieces: [{ g, fabric, layer }] ; returns an array of positions (world space of the pose, feet on y = 0).
 */
export function settleOnBody(pieces, m, opts = {}) {
  const mode = opts.mode || 'still';
  const pose = (t) => animatedPose(m, t, { mode, yaw: opts.yaw || 0 });
  const sims = pieces.map((pc) => {
    const sim = new ClothSim(pc.g, FABRICS[pc.fabric] || FABRICS.cotton);
    return { pc, sim, tg: new Float32Array(pc.g.rest.length) };
  });
  let J = pose(0),
    F = frames(J);
  for (const s of sims) {
    computeTargets(s.pc.g, F, s.tg);
    s.sim.pos.set(s.tg);
    s.sim.prev.set(s.tg);
    s.sim.target.set(s.tg);
    s.sim.targetPrev.set(s.tg);
  }
  const steps = Math.round((opts.seconds || 2.4) * 60);
  for (let i = 0; i < steps; i++) {
    const t = i / 60;
    J = pose(t);
    F = frames(J);
    const C = colliders(J, m, F),
      Co = colliders(J, m, F, { pad: 0.014, armPad: 0.03 });
    for (const s of sims) {
      computeTargets(s.pc.g, F, s.tg);
      s.sim.setTargets(s.tg);
      s.sim.colliders = s.pc.layer ? Co : C;
      s.sim.step(1 / 60, 3);
    }
  }
  return { positions: sims.map((s) => s.sim.pos), J };
}

/** Build the cloth for a catalogue product (NY data) at its display size and resolution. */
export function displayGarment(NY, p, ci, res, kindBody) {
  const m = kindBody || bodyFor(p.kind);
  const si = NY.recommendSize(p, chestGirth(m));
  const spec = NY.specFor(p, si, ci);
  const g = buildGarment(spec, m, { res, armAngle: 0.22 });
  return { g, spec, m, si };
}

/** Resolve a look ({ kind, pieces: [[pid, ci], ...], drape }) to garments on its body. */
export function lookGarments(NY, look, res) {
  const m = bodyFor(look.kind);
  return look.pieces.map(([pid, ci], i) => {
    const p = NY.byId[pid];
    const si = NY.recommendSize(p, chestGirth(m));
    const spec = NY.specFor(p, si, ci);
    if (p.type === 'dupatta' && look.drape) spec.drape = look.drape;
    if (i > 0 && !spec.layer) spec.layer = 1;
    const g = buildGarment(spec, m, { res, armAngle: 0.22 });
    return { p, ci, si, spec, g, layer: spec.layer || 0, fabric: p.fabric };
  });
}

/** Static mannequin looks in the store (baked at build time). Keys are stable names. */
export function staticLooks(NY) {
  const M = NY.MERCH,
    out = [];
  const kindOf = (pid) => (NY.byId[pid].kind === 'free' ? 'women' : NY.byId[pid].kind);
  M.chikanForms.forEach((pc, i) => out.push({ key: 'chikan' + i, kind: kindOf(pc[0]), pieces: [pc] }));
  out.push({ key: 'westernForm', kind: kindOf(M.westernForm[0]), pieces: [M.westernForm] });
  out.push({ key: 'basicsForm', kind: kindOf(M.basicsForm[0]), pieces: [M.basicsForm] });
  out.push({
    key: 'dupattaForm',
    kind: kindOf(M.dupattaForm.base[0]),
    pieces: [M.dupattaForm.base, M.dupattaForm.top],
  });
  return out;
}
/** Products shown on hangers (rails and face-outs). */
export function hangerProducts(NY) {
  return NY.PRODUCTS.filter((p) => p.type !== 'dupatta');
}
export const RES = { hanger: 0.8, look: 0.9, curtain: 1 };
export const CURTAIN = { w: 1.22, h: 2.12 };
/** Settle a fitting-room curtain (one drape reused for every cubicle). */
export function settleCurtain(seconds = 3) {
  const g = buildCurtain(CURTAIN.w, CURTAIN.h, RES.curtain);
  const sim = new ClothSim(g, FABRICS.linen);
  sim.colliders = [];
  for (let i = 0; i < seconds * 60; i++) sim.step(1 / 60, 3);
  return { g, pos: sim.pos };
}
