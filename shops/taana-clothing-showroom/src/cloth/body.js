// Body model shared by the cloth simulation, the mannequin and the camera try-on.
// Coordinates are metres in a camera-aligned frame: x to the viewer's right, y up, z towards the viewer.
// "Left" and "right" always mean the person's own left and right (MediaPipe convention).
import { COLL, CGROUP as G } from './sim.js';

export const SEG = {
  TORSO: 0,
  PELVIS: 1,
  UARM_L: 2,
  FARM_L: 3,
  UARM_R: 4,
  FARM_R: 5,
  THIGH_L: 6,
  SHIN_L: 7,
  THIGH_R: 8,
  SHIN_R: 9,
  HEAD: 10,
};
export const JOINTS = [
  'nose',
  'lShoulder',
  'rShoulder',
  'lElbow',
  'rElbow',
  'lWrist',
  'rWrist',
  'lHip',
  'rHip',
  'lKnee',
  'rKnee',
  'lAnkle',
  'rAnkle',
];

const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const vec = { v3, add, sub, mul, dot, cross, len, norm, mid, lerp3 };

/** Average adult proportions (metres). shoulderW is the distance between shoulder joints. */
export function defaultMeasurements(kind = 'female') {
  const m =
    kind === 'male'
      ? { shoulderW: 0.37, torsoLen: 0.53, hipJointW: 0.2, upperArm: 0.3, foreArm: 0.26, thigh: 0.44, shin: 0.43 }
      : kind === 'child'
        ? { shoulderW: 0.25, torsoLen: 0.36, hipJointW: 0.15, upperArm: 0.2, foreArm: 0.18, thigh: 0.3, shin: 0.29 }
        : { shoulderW: 0.33, torsoLen: 0.5, hipJointW: 0.19, upperArm: 0.28, foreArm: 0.24, thigh: 0.42, shin: 0.41 };
  return withShape(m, kind);
}

/** Fill in the torso cross-sections from the joint measurements. */
export function withShape(m, kind = 'female') {
  const s = m.shoulderW;
  const female = kind !== 'male';
  return Object.assign({}, m, {
    kind,
    chestA: s * (female ? 0.47 : 0.5),
    chestB: s * (female ? 0.36 : 0.36),
    waistA: s * (female ? 0.39 : 0.45),
    waistB: s * (female ? 0.29 : 0.31),
    hipA: s * (female ? 0.56 : 0.5),
    hipB: s * (female ? 0.38 : 0.36),
    neckR: s * 0.15,
    headR: s * 0.29,
    upperArmR: s * 0.13,
    foreArmR: s * 0.105,
    thighR: s * 0.2,
    shinR: s * 0.135,
  });
}

/** Estimate measurements from a tracked pose (joint positions in metres). */
export function measurementsFromPose(J, kind = 'female') {
  const sw = len(sub(J.lShoulder, J.rShoulder));
  const tl = len(sub(mid(J.lShoulder, J.rShoulder), mid(J.lHip, J.rHip)));
  const ua = (len(sub(J.lElbow, J.lShoulder)) + len(sub(J.rElbow, J.rShoulder))) / 2;
  const fa = (len(sub(J.lWrist, J.lElbow)) + len(sub(J.rWrist, J.rElbow))) / 2;
  const m = {
    shoulderW: clamp(sw, 0.22, 0.5),
    torsoLen: clamp(tl, 0.32, 0.65),
    hipJointW: clamp(len(sub(J.lHip, J.rHip)), 0.13, 0.3),
    upperArm: clamp(ua, 0.18, 0.36),
    foreArm: clamp(fa, 0.16, 0.32),
    thigh: 0.42,
    shin: 0.41,
  };
  return withShape(m, kind);
}

/**
 * Canonical rest pose ("A-pose", facing the viewer). Torso frame origin is the midpoint between the shoulder joints.
 * @param {number} armAngle arm angle from straight down, in radians
 */
export function restPose(m, armAngle = 0.32) {
  const sx = m.shoulderW / 2;
  // Facing the viewer, the person's left shoulder is on the viewer's right (+x).
  const lS = v3(sx, 0, 0),
    rS = v3(-sx, 0, 0);
  const dl = [Math.sin(armAngle), -Math.cos(armAngle), 0],
    dr = [-Math.sin(armAngle), -Math.cos(armAngle), 0];
  const lE = add(lS, mul(dl, m.upperArm)),
    rE = add(rS, mul(dr, m.upperArm));
  const lW = add(lE, mul(dl, m.foreArm)),
    rW = add(rE, mul(dr, m.foreArm));
  const hx = m.hipJointW / 2;
  const lH = v3(hx, -m.torsoLen, 0),
    rH = v3(-hx, -m.torsoLen, 0);
  const lK = add(lH, v3(0.01, -m.thigh, 0)),
    rK = add(rH, v3(-0.01, -m.thigh, 0));
  const lA = add(lK, v3(0, -m.shin, -0.01)),
    rA = add(rK, v3(0, -m.shin, -0.01));
  return {
    nose: v3(0, m.shoulderW * 0.62, m.shoulderW * 0.18),
    lShoulder: lS,
    rShoulder: rS,
    lElbow: lE,
    rElbow: rE,
    lWrist: lW,
    rWrist: rW,
    lHip: lH,
    rHip: rH,
    lKnee: lK,
    rKnee: rK,
    lAnkle: lA,
    rAnkle: rA,
  };
}

/** Orthonormal frames per body segment. Each frame: { o, x, y, z } (arrays). */
export function frames(J) {
  const mS = mid(J.lShoulder, J.rShoulder),
    mH = mid(J.lHip, J.rHip);
  const X = norm(sub(J.lShoulder, J.rShoulder)); // towards the person's left
  let Y = sub(mS, mH);
  Y = norm(sub(Y, mul(X, dot(Y, X))));
  const Z = norm(cross(X, Y)); // person's front
  const torso = { o: mS, x: X, y: Y, z: Z };
  let Xp = norm(sub(J.lHip, J.rHip));
  let Yp = norm(sub(Y, mul(Xp, dot(Y, Xp))));
  const pelvis = { o: mH, x: Xp, y: Yp, z: norm(cross(Xp, Yp)) };
  const limb = (a, b, refZ) => {
    const y = norm(sub(a, b)); // points from the distal joint back up the limb (so -y goes down the limb)
    let z = sub(refZ, mul(y, dot(refZ, y)));
    if (len(z) < 1e-4) z = sub(X, mul(y, dot(X, y)));
    z = norm(z);
    return { o: a, x: norm(cross(y, z)), y, z };
  };
  return [
    torso,
    pelvis,
    limb(J.lShoulder, J.lElbow, Z),
    limb(J.lElbow, J.lWrist, Z),
    limb(J.rShoulder, J.rElbow, Z),
    limb(J.rElbow, J.rWrist, Z),
    limb(J.lHip, J.lKnee, Z),
    limb(J.lKnee, J.lAnkle, Z),
    limb(J.rHip, J.rKnee, Z),
    limb(J.rKnee, J.rAnkle, Z),
    { o: J.nose, x: X, y: Y, z: Z },
  ];
}

export const toLocal = (F, p) => {
  const d = sub(p, F.o);
  return [dot(d, F.x), dot(d, F.y), dot(d, F.z)];
};
export const toWorld = (F, l) => [
  F.o[0] + F.x[0] * l[0] + F.y[0] * l[1] + F.z[0] * l[2],
  F.o[1] + F.x[1] * l[0] + F.y[1] * l[1] + F.z[1] * l[2],
  F.o[2] + F.x[2] * l[0] + F.y[2] * l[1] + F.z[2] * l[2],
];

/** Torso cross-section profile: rows of (v down from shoulder line, half-width, half-depth). */
export function torsoProfile(m) {
  const T = m.torsoLen,
    k = m.shoulderW / 0.33;
  return [
    -0.04 * k,
    m.chestA * 0.5,
    m.chestB * 0.5, // rounded top under the shoulder capsules
    0.0,
    m.chestA * 0.86,
    m.chestB * 0.72,
    0.08,
    m.chestA * 0.97,
    m.chestB * 0.92,
    T * 0.32,
    m.chestA,
    m.chestB,
    T * 0.62,
    m.waistA,
    m.waistB,
    T * 0.86,
    m.hipA * 0.95,
    m.hipB * 0.98,
    T * 1.02,
    m.hipA,
    m.hipB,
    T * 1.12,
    m.hipA * 0.93,
    m.hipB * 0.95,
  ];
}

/** The two shoulder capsules in the torso frame (shared by the colliders and the mannequin mesh). */
export function shoulderLine(m) {
  const sx = m.shoulderW / 2,
    k = m.shoulderW / 0.33;
  return [1, -1].map((s) => ({
    a: [s * 0.045 * k, 0.045 * k, -0.004],
    b: [s * sx, -0.005, 0],
    ra: m.neckR * 1.0,
    rb: m.upperArmR * 1.25,
  }));
}

/** Height of the top of the shoulder (torso frame) at a horizontal offset x from the centre line. */
export function shoulderTop(m, x) {
  const sx = m.shoulderW / 2,
    k = m.shoulderW / 0.33;
  const ax = Math.abs(x);
  const t = Math.min(1, Math.max(0, (ax - 0.045 * k) / (sx - 0.045 * k)));
  const s = t * t * (3 - 2 * t);
  return (0.045 * k + m.neckR) * (1 - s) + (m.upperArmR * 1.25 - 0.005) * s - Math.max(0, ax - sx) * 0.6;
}

/**
 * Collision shapes for the body, in world space, matching the mannequin.
 * opts.pad inflates everything (outer layers sit on top of the inner garment); opts.armPad adds extra
 * room around the arms for sleeves; opts.legs: false drops the legs.
 */
export function colliders(J, m, F, opts = {}) {
  const T = F[SEG.TORSO];
  const C = [];
  const pad = opts.pad || 0,
    ap = pad + (opts.armPad || 0);
  let prof = torsoProfile(m);
  if (pad) prof = prof.map((v, i) => (i % 3 === 0 ? v : v + pad));
  C.push({ type: COLL.TORSO, group: G.TORSO, o: T.o, x: T.x, y: T.y, z: T.z, profile: prof });
  // shoulders: two sloped capsules from the base of the neck out to each shoulder joint
  const up = (p, s) => add(p, mul(T.y, s));
  for (const sh of shoulderLine(m)) {
    C.push({
      type: COLL.CAPSULE,
      group: G.SHOULDER,
      a: toWorld(T, sh.a),
      b: toWorld(T, sh.b),
      ra: sh.ra + pad,
      rb: sh.rb + ap,
    });
  }
  // neck and head
  const neckBase = up(T.o, 0.02),
    neckTop = up(T.o, m.shoulderW * 0.33);
  C.push({ type: COLL.CAPSULE, group: G.HEAD, a: neckBase, b: neckTop, ra: m.neckR * 1.15 + pad, rb: m.neckR + pad });
  const head = add(up(T.o, m.shoulderW * 0.62), mul(T.z, -0.01));
  C.push({ type: COLL.SPHERE, group: G.HEAD, c: head, r: m.headR });
  // arms
  for (const s of ['l', 'r']) {
    const S = J[s + 'Shoulder'],
      E = J[s + 'Elbow'],
      W = J[s + 'Wrist'];
    C.push({ type: COLL.CAPSULE, group: G.UARM, a: S, b: E, ra: m.upperArmR + ap, rb: m.upperArmR * 0.82 + ap });
    C.push({ type: COLL.CAPSULE, group: G.FARM, a: E, b: W, ra: m.foreArmR + ap, rb: m.foreArmR * 0.72 + ap * 0.6 });
    const hand = add(W, mul(norm(sub(W, E)), 0.06));
    C.push({ type: COLL.SPHERE, group: G.FARM, c: hand, r: m.foreArmR * 0.95 + pad });
  }
  if (opts.legs !== false) {
    for (const s of ['l', 'r']) {
      const H = J[s + 'Hip'],
        K = J[s + 'Knee'],
        A = J[s + 'Ankle'];
      C.push({ type: COLL.CAPSULE, group: G.LEG, a: H, b: K, ra: m.thighR + pad, rb: m.thighR * 0.62 + pad });
      C.push({ type: COLL.CAPSULE, group: G.LEG, a: K, b: A, ra: m.shinR + pad, rb: m.shinR * 0.7 + pad });
    }
  }
  return C;
}

/** Fill in joints the camera cannot see (legs out of frame, arms hidden) from the torso. */
export function completePose(J, vis, m) {
  const F = frames(J);
  const T = F[SEG.TORSO];
  const down = mul(T.y, -1);
  const out = Object.assign({}, J);
  const need = (k) => !out[k] || (vis && vis[k] !== undefined && vis[k] < 0.35);
  for (const s of ['l', 'r']) {
    const side = s === 'l' ? 1 : -1;
    if (need(s + 'Hip')) out[s + 'Hip'] = add(add(T.o, mul(down, m.torsoLen)), mul(T.x, (side * m.hipJointW) / 2));
    if (need(s + 'Knee')) out[s + 'Knee'] = add(out[s + 'Hip'], mul(down, m.thigh));
    if (need(s + 'Ankle')) out[s + 'Ankle'] = add(out[s + 'Knee'], mul(down, m.shin));
    if (need(s + 'Elbow'))
      out[s + 'Elbow'] = add(out[s + 'Shoulder'], add(mul(down, m.upperArm * 0.95), mul(T.x, side * m.upperArm * 0.3)));
    if (need(s + 'Wrist'))
      out[s + 'Wrist'] = add(out[s + 'Elbow'], add(mul(down, m.foreArm * 0.95), mul(T.x, side * m.foreArm * 0.25)));
  }
  if (need('nose')) out.nose = add(add(T.o, mul(T.y, m.shoulderW * 0.62)), mul(T.z, m.shoulderW * 0.18));
  return out;
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
