// Where jewellery sits on a tracked face or hand. Pure maths (no browser APIs), so it is unit-tested.
//
// Space: the camera image in pixels with the origin at the image centre, x to the right of the *unmirrored*
// image, y up, z towards the camera. MediaPipe landmarks (x, y in 0..1, z relative depth in image widths, more
// negative = closer) are converted with toPx(). All offsets below are in millimetres and turned into pixels
// with the face or hand scale, so they follow the shopper whatever their distance from the camera.

/* ---------- vectors ---------- */
export const v = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};
/** Landmark (normalised) -> pixel space. */
export const toPx = (p, W, H) => [p.x * W - W / 2, H / 2 - p.y * H, -p.z * W];

/* ---------- face ---------- */
// Landmark indices on the MediaPipe face mesh (478 points with irises).
export const FACE = {
  rightCheek: 234, // the face's right edge (on the left of an unmirrored image)
  leftCheek: 454,
  foreheadTop: 10,
  forehead: 151,
  browsMid: 9,
  chin: 152,
  noseTip: 1,
  rightJaw: 132, // jaw line at the height of the nose, just in front of the ear
  leftJaw: 361,
  rightAla: 98, // the wings of the nose
  leftAla: 327,
};
/** Measurements of an average adult face, used to turn pixels into millimetres. */
export const FACE_MM = {
  width: 140, // between the cheek edges (landmarks 234 and 454)
  // earlobe relative to the jaw landmark: outwards, backwards (into the head), downwards
  lobeOut: 10,
  lobeBack: 16,
  lobeDown: 2,
  // a maang tikka's pendant starts this far below the top of the face mesh (about the hairline)
  tikkaDown: 8,
  // the nath pierces the side of the left nostril
  nathOut: 1.5,
  nathFwd: 1,
  // neck base (where a necklace's frame sits) below the centre between the cheek landmarks, which is close to
  // the axis the head turns about, so the necklace stays put when the head turns. The distance is a multiple of
  // the shopper's own upper-face height (hairline to nose tip), measured from camera images of real faces: it
  // follows long and short faces, and does not move when the jaw opens.
  neckPerUpperFace: 1.32,
  neckFwd: 8,
};
/**
 * Face frame from landmarks in pixel space (array of [x, y, z]).
 * Returns { o (centre), X (to the face's left), Y (up), Z (out of the face), s (px per mm), yaw, roll, pitch }.
 */
export function faceFrame(P) {
  const R = P[FACE.rightCheek],
    Lc = P[FACE.leftCheek];
  const wpx = v.len(v.sub(Lc, R));
  const X = v.norm(v.sub(Lc, R));
  let Y = v.sub(P[FACE.foreheadTop], P[FACE.chin]);
  Y = v.norm(v.sub(Y, v.mul(X, v.dot(Y, X))));
  const Z = v.cross(X, Y);
  const s = wpx / FACE_MM.width;
  const o = v.mul(v.add(R, Lc), 0.5);
  return {
    o,
    X,
    Y,
    Z,
    s,
    yaw: Math.atan2(Z[0], Z[2]),
    pitch: Math.atan2(Z[1], Math.hypot(Z[0], Z[2])),
    roll: Math.atan2(X[1], X[0]),
  };
}
/** A point offset from a landmark in the face frame (mm). */
function offset(F, p, x, y, z) {
  return v.add(p, v.add(v.mul(F.X, x * F.s), v.add(v.mul(F.Y, y * F.s), v.mul(F.Z, z * F.s))));
}
/** Anchors for face jewellery. side: which earlobe is further from the camera (fades out). */
export function faceAnchors(P) {
  const F = faceFrame(P);
  const M = FACE_MM;
  const lobeR = offset(F, P[FACE.rightJaw], -M.lobeOut, -M.lobeDown, -M.lobeBack);
  const lobeL = offset(F, P[FACE.leftJaw], M.lobeOut, -M.lobeDown, -M.lobeBack);
  // the tikka lies on the forehead: its "up" follows the forehead's slope from the brows to the hairline
  let tY = v.sub(P[FACE.foreheadTop], P[FACE.browsMid]);
  tY = v.norm(v.sub(tY, v.mul(F.X, v.dot(tY, F.X))));
  const tZ = v.cross(F.X, tY);
  const tikka = { o: v.add(P[FACE.foreheadTop], v.mul(tZ, 1.5 * F.s)), X: F.X, Y: tY, Z: tZ };
  const nath = offset(F, P[FACE.leftAla], M.nathOut, 0, M.nathFwd);
  // the neck does not turn as far as the head: it takes part of the yaw and roll
  const up = v.norm(v.lerp([0, 1, 0], F.Y, 0.35));
  const fwd0 = v.norm([F.Z[0] * 0.45, 0, Math.max(0.35, F.Z[2])]);
  const right = v.norm(v.cross(up, fwd0)); // towards the face's left side, like X
  const fwd = v.cross(right, up);
  const upperFace = Math.max(0, v.dot(v.sub(P[FACE.foreheadTop], P[FACE.noseTip]), F.Y));
  const neck = v.add(F.o, v.add(v.mul(up, -M.neckPerUpperFace * upperFace), v.mul(fwd, M.neckFwd * F.s)));
  // how much each earlobe is turned away (0 facing, 1 hidden)
  const away = Math.max(-1, Math.min(1, F.Z[0]));
  return {
    F,
    lobeR,
    lobeL,
    tikka,
    nath,
    neck: { o: neck, X: right, Y: up, Z: fwd, s: F.s },
    hideR: smooth(0.32, 0.62, -away),
    hideL: smooth(0.32, 0.62, away),
  };
}
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/* ---------- hands ---------- */
export const HAND = { wrist: 0, indexMcp: 5, middleMcp: 9, ringMcp: 13, ringPip: 14, pinkyMcp: 17 };
export const HAND_MM = {
  knuckles: 72, // index to little-finger knuckle, an average adult hand
  ringAt: 0.36, // a ring sits about a third of the way from the knuckle to the middle joint
  forearmR: 27, // half the width of the wrist for the occluder
  bangleUp: 14, // a bangle rests a little above the wrist crease
};
/**
 * Hand frame and anchors from 21 hand landmarks in pixel space.
 * handedness: 'Left' or 'Right' as MediaPipe reports it for the unmirrored image.
 */
export function handAnchors(P, handedness) {
  const w = P[HAND.wrist],
    i5 = P[HAND.indexMcp],
    m9 = P[HAND.middleMcp],
    r13 = P[HAND.ringMcp],
    r14 = P[HAND.ringPip],
    p17 = P[HAND.pinkyMcp];
  const knucklesPx = v.len(v.sub(i5, p17));
  const s = knucklesPx / HAND_MM.knuckles;
  // Palm normal. For a real right hand seen by the camera, (index - wrist) x (pinky - wrist) points out of the
  // palm. MediaPipe labels hands as if the image were mirrored, so in an unmirrored frame a real right hand is
  // reported as 'Left' and a real left hand as 'Right'.
  let n = v.norm(v.cross(v.sub(i5, w), v.sub(p17, w)));
  if (handedness === 'Right') n = v.mul(n, -1);
  const back = v.mul(n, -1); // the back of the hand
  // ring
  const fAxis = v.norm(v.sub(r14, r13));
  const ringPos = v.lerp(r13, r14, HAND_MM.ringAt);
  let up = v.sub(back, v.mul(fAxis, v.dot(back, fAxis)));
  up = v.norm(up);
  // finger width: about 0.28 of the knuckle span
  const fingerPx = knucklesPx * 0.28;
  // forearm and bangle
  const arm = v.norm(v.sub(w, m9));
  const bangle = v.add(w, v.mul(arm, HAND_MM.bangleUp * s));
  let bUp = v.sub(back, v.mul(arm, v.dot(back, arm)));
  bUp = v.norm(bUp);
  return {
    s,
    palmFacing: n[2] > 0, // the palm faces the camera
    ring: { o: ringPos, axis: fAxis, up, fingerPx },
    bangle: { o: bangle, axis: arm, up: bUp },
    finger: { a: r13, b: r14, r: fingerPx / 2 },
    forearm: { a: w, b: v.add(w, v.mul(arm, 120 * s)), r: HAND_MM.forearmR * s },
  };
}

/* ---------- smoothing ---------- */
/** One Euro filter (Casiez et al.): steady when still, quick when moving. */
export class OneEuro {
  constructor(minCutoff = 1.2, beta = 0.04, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = null;
    this.dx = 0;
  }
  static alpha(dt, cutoff) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  filter(val, dt) {
    if (this.x === null || !(dt > 0)) {
      this.x = val;
      this.dx = 0;
      return val;
    }
    const dv = (val - this.x) / dt;
    this.dx += OneEuro.alpha(dt, this.dCutoff) * (dv - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(dt, cutoff) * (val - this.x);
    return this.x;
  }
  reset() {
    this.x = null;
  }
}
/** Filters a vector of numbers with one One Euro filter per component. */
export class VecFilter {
  constructor(n, minCutoff, beta) {
    this.f = Array.from({ length: n }, () => new OneEuro(minCutoff, beta));
  }
  filter(a, dt) {
    return a.map((x, i) => this.f[i].filter(x, dt));
  }
  reset() {
    for (const f of this.f) f.reset();
  }
}

/* ---------- earring swing ---------- */
/**
 * A damped pendulum for a hanging earring: the earlobe's sideways and forward acceleration (mm/s^2) swings it.
 * length: pivot to the centre of mass (mm). Angles in radians: sway (side to side), tilt (front to back).
 */
export class Swing {
  constructor(length) {
    this.L = Math.max(4, length || 18);
    this.sway = 0;
    this.tilt = 0;
    this.vs = 0;
    this.vt = 0;
  }
  step(ax, az, dt) {
    const g = 9810,
      L = this.L,
      c = 4.5;
    const n = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const as = (-g / L) * Math.sin(this.sway) - c * this.vs - (ax / L) * Math.cos(this.sway);
      const at = (-g / L) * Math.sin(this.tilt) - c * this.vt - (az / L) * Math.cos(this.tilt);
      this.vs += as * h;
      this.vt += at * h;
      this.sway += this.vs * h;
      this.tilt += this.vt * h;
    }
    const lim = 0.7;
    this.sway = Math.max(-lim, Math.min(lim, this.sway));
    this.tilt = Math.max(-lim, Math.min(lim, this.tilt));
    return this;
  }
  reset() {
    this.sway = this.tilt = this.vs = this.vt = 0;
  }
}
