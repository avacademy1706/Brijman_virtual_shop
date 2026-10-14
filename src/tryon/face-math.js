// Face measurement and pose maths for the try-on. Pure functions with no DOM, three.js or MediaPipe, so every step is
// unit-tested with synthetic faces built from MediaPipe's canonical face model.
//
// Coordinate frames
// - Landmarks: MediaPipe normalised image coordinates. x right, y down (0..1); z depth with smaller = closer to camera,
//   on roughly the same scale as x.
// - World: video pixels. X right, Y up, Z towards the camera: Q = (x·W, (1 − y)·H, −z·W). The try-on renders this space
//   with an orthographic camera, so no field-of-view assumption is needed.
// - Canonical: MediaPipe's canonical face, in centimetres (shared/canonical-face.js). Same axes as world.
import { canonical } from '../../shared/canonical-face.js';

/** Landmark indices (MediaPipe Face Mesh with iris refinement, 478 points). */
export const LM = Object.freeze({
  noseBridge: 168, // between the eyes; the frame's bridge sits just below it
  noseUpper: 6,
  noseTip: 1,
  forehead: 151,
  chin: 152,
  templeR: 234, // subject's right cheek/temple line (image left)
  templeL: 454,
  eyeOuterR: 33,
  eyeInnerR: 133,
  eyeInnerL: 362,
  eyeOuterL: 263,
  lidUpR: 159,
  lidLowR: 145,
  lidUpL: 386,
  lidLowL: 374,
  cheekR: 50,
  cheekL: 280,
  // Iris rings: centre, then four points around it. Opposite pairs (1↔3) give the horizontal diameter.
  irisR: [468, 469, 470, 471, 472],
  irisL: [473, 474, 475, 476, 477],
});

/** Average horizontal visible iris diameter of adults, in mm. The fit guide is an estimate because of this. */
export const IRIS_DIAMETER_MM = 11.7;

/** Landmarks that barely move with expression (forehead, nose, eye corners, cheekbones, temples): used for the pose. */
export const RIGID = [
  10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 33, 133, 362, 263, 130, 359, 234, 454, 127, 356, 93, 323, 116, 345, 123,
  352, 108, 337, 67, 297, 103, 332, 54, 284, 21, 251, 50, 280,
];

/** Canonical face width between the temple landmarks (234–454), in canonical centimetres. */
export const CANONICAL_FACE_WIDTH = dist(canonical(LM.templeR), canonical(LM.templeL));

/* ---------- Small vector helpers (arrays of 3) ---------- */
export function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

/**
 * Converts MediaPipe landmarks to world points (video pixels, Y up, Z towards the camera).
 * @param {Array<{x: number, y: number, z: number}>} lms
 * @param {number} W video width in pixels
 * @param {number} H video height in pixels
 * @returns {number[][]}
 */
export function toWorld(lms, W, H) {
  return lms.map((p) => [p.x * W, (1 - p.y) * H, -p.z * W]);
}

/** Mean horizontal iris diameter of both eyes, in world pixels. */
export function irisDiameterPx(Q) {
  const r = dist(Q[LM.irisR[1]], Q[LM.irisR[3]]);
  const l = dist(Q[LM.irisL[1]], Q[LM.irisL[3]]);
  return (r + l) / 2;
}

/** Face width between the temple landmarks, in world pixels. */
export const faceWidthPx = (Q) => dist(Q[LM.templeR], Q[LM.templeL]);

/** Face width in mm, from one frame: the face-to-iris ratio times the average iris size. */
export function faceWidthMmFrom(Q) {
  const iris = irisDiameterPx(Q);
  return iris > 0 ? (faceWidthPx(Q) / iris) * IRIS_DIAMETER_MM : NaN;
}

/** Eye openness: lid gap over eye width, the smaller of both eyes. Below about 0.12 the eye is closing. */
export function eyeOpenness(Q) {
  const r = dist(Q[LM.lidUpR], Q[LM.lidLowR]) / dist(Q[LM.eyeOuterR], Q[LM.eyeInnerR]);
  const l = dist(Q[LM.lidUpL], Q[LM.lidLowL]) / dist(Q[LM.eyeOuterL], Q[LM.eyeInnerL]);
  return Math.min(r, l);
}

/**
 * Converts canonical centimetres to the user's real millimetres scale: faceScale = canonical width / real width.
 * A frame of `mm` millimetres is drawn `mm × faceScale` canonical units wide.
 * @param {number} faceWidthMm measured real face width
 */
export const faceScale = (faceWidthMm) => CANONICAL_FACE_WIDTH / faceWidthMm;

/* ---------- Calibration ---------- */
/** Plausible adult and child face widths (temple line), in mm. Samples outside are ignored. */
export const FACE_WIDTH_RANGE = [95, 175];

/**
 * Face-width calibration: median of the first `count` good frames, then a slow exponential moving average.
 * Good frames are roughly frontal with both eyes open; the caller decides that.
 */
export class FaceWidthCalibrator {
  /**
   * @param {{count?: number, tau?: number, initial?: number}} [o] tau is the EMA time constant in seconds
   */
  constructor(o = {}) {
    this.count = o.count || 30;
    this.tau = o.tau || 5;
    this.initial = o.initial || 140;
    this.reset();
  }
  reset() {
    this.samples = [];
    this.value = null;
  }
  get calibrated() {
    return this.value !== null;
  }
  /** Current estimate in mm: the calibrated value, or the median so far, or the initial guess. */
  get estimate() {
    if (this.value !== null) return this.value;
    return this.samples.length ? median(this.samples) : this.initial;
  }
  /**
   * @param {number} mm one measurement
   * @param {number} dt seconds since the previous good sample
   */
  add(mm, dt) {
    if (!(mm >= FACE_WIDTH_RANGE[0] && mm <= FACE_WIDTH_RANGE[1])) return;
    if (this.value === null) {
      this.samples.push(mm);
      if (this.samples.length >= this.count) this.value = median(this.samples);
      return;
    }
    const a = 1 - Math.exp(-Math.max(0, dt) / this.tau);
    this.value += (mm - this.value) * a;
  }
}

export function median(list) {
  const s = [...list].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/* ---------- Pose: weighted similarity Procrustes (Horn's quaternion method) ---------- */
/**
 * Finds scale s, rotation R (unit quaternion [x, y, z, w]) and translation t so that dst ≈ s·R·src + t.
 * This is the same kind of fit MediaPipe uses for its facial transformation matrix.
 * @param {number[][]} src points (canonical cm)
 * @param {number[][]} dst points (world px)
 * @returns {{s: number, q: number[], t: number[], R: number[][]}}
 */
export function procrustes(src, dst) {
  const n = src.length;
  const cs = [0, 0, 0],
    cd = [0, 0, 0];
  for (let i = 0; i < n; i++)
    for (let k = 0; k < 3; k++) {
      cs[k] += src[i][k] / n;
      cd[k] += dst[i][k] / n;
    }
  // Cross-covariance M = Σ a bᵀ with a = src − cs, b = dst − cd.
  const M = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  let ss = 0,
    sd = 0;
  for (let i = 0; i < n; i++) {
    const a = sub(src[i], cs),
      b = sub(dst[i], cd);
    ss += a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
    sd += b[0] * b[0] + b[1] * b[1] + b[2] * b[2];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) M[r][c] += a[r] * b[c];
  }
  const [[Sxx, Sxy, Sxz], [Syx, Syy, Syz], [Szx, Szy, Szz]] = M;
  const N = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
  ];
  const [w, x, y, z] = largestEigenvector4(N);
  const q = normalizeQ([x, y, z, w]);
  const R = quatToMat(q);
  // Symmetric scale estimate (Horn): independent of which set is the source.
  const s = Math.sqrt(sd / ss);
  const Rcs = mulMV(R, cs);
  const t = [cd[0] - s * Rcs[0], cd[1] - s * Rcs[1], cd[2] - s * Rcs[2]];
  return { s, q, t, R };
}

// Largest eigenvector of a symmetric 4×4 matrix, by Jacobi rotations (exact and branch-free enough for 4×4).
function largestEigenvector4(A) {
  const a = A.map((r) => r.slice());
  const V = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
  for (let sweep = 0; sweep < 30; sweep++) {
    let off = 0;
    for (let p = 0; p < 3; p++) for (let r = p + 1; r < 4; r++) off += a[p][r] * a[p][r];
    if (off < 1e-20) break;
    for (let p = 0; p < 3; p++)
      for (let r = p + 1; r < 4; r++) {
        if (Math.abs(a[p][r]) < 1e-30) continue;
        const theta = (a[r][r] - a[p][p]) / (2 * a[p][r]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1),
          s = t * c;
        for (let k = 0; k < 4; k++) {
          const akp = a[k][p],
            akr = a[k][r];
          a[k][p] = c * akp - s * akr;
          a[k][r] = s * akp + c * akr;
        }
        for (let k = 0; k < 4; k++) {
          const apk = a[p][k],
            ark = a[r][k];
          a[p][k] = c * apk - s * ark;
          a[r][k] = s * apk + c * ark;
        }
        for (let k = 0; k < 4; k++) {
          const vkp = V[k][p],
            vkr = V[k][r];
          V[k][p] = c * vkp - s * vkr;
          V[k][r] = s * vkp + c * vkr;
        }
      }
  }
  let best = 0;
  for (let i = 1; i < 4; i++) if (a[i][i] > a[best][best]) best = i;
  return [V[0][best], V[1][best], V[2][best], V[3][best]];
}

export function normalizeQ(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

/** Rotation matrix (rows) from a unit quaternion [x, y, z, w]. */
export function quatToMat([x, y, z, w]) {
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
}

export const mulMV = (R, v) => [
  R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2],
  R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2],
  R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2],
];

/** Head yaw and pitch in degrees from a pose rotation (0, 0 = facing the camera). */
export function yawPitch(R) {
  // The canonical face looks along +Z; its forward direction in world is the third column of R.
  const f = [R[0][2], R[1][2], R[2][2]];
  return {
    yaw: (Math.atan2(f[0], f[2]) * 180) / Math.PI,
    pitch: (Math.atan2(-f[1], Math.hypot(f[0], f[2])) * 180) / Math.PI,
  };
}

/** A frame good enough for calibration: face within ±15° of frontal and both eyes open. */
export function goodForCalibration(Q, R) {
  const { yaw, pitch } = yawPitch(R);
  return Math.abs(yaw) < 15 && Math.abs(pitch) < 15 && eyeOpenness(Q) > 0.12;
}

/* ---------- Where the frame sits, in canonical space ---------- */
/** Placement constants. Starting values; tune with real customers. */
export const FIT = Object.freeze({
  vertexDistanceMm: 12, // back of the lens to the front of the cornea
  corneaAheadOfLidMm: 1, // cornea apex in front of the upper-lid landmark
  bridgeClearanceMm: 1.5, // bridge in front of the nose surface
  pupilAboveLensCentreMm: 2, // pupils sit a little above the lens centre in most frames
  pantoscopicTiltDeg: 9,
  nudgeLimitMm: 3,
});

/**
 * Canonical position of the frame origin (the centre of the bridge, at lens-centre height) and the tilt.
 * @param {{faceScale: number, bridgeYmm: number, nudgeMm?: number}} o
 *   bridgeYmm: height of the bridge above the lens centre line in the frame model, in mm
 * @returns {{position: number[], tiltDeg: number}}
 */
export function framePlacement({ faceScale: fs, bridgeYmm, nudgeMm = 0 }) {
  const eR = mid(canonical(LM.eyeOuterR), canonical(LM.eyeInnerR));
  const eL = mid(canonical(LM.eyeOuterL), canonical(LM.eyeInnerL));
  const pupilY = (eR[1] + eL[1]) / 2;
  const lidZ = Math.max(canonical(LM.lidUpR)[2], canonical(LM.lidUpL)[2]);
  const nudge = Math.max(-FIT.nudgeLimitMm, Math.min(FIT.nudgeLimitMm, nudgeMm));
  const y = pupilY - FIT.pupilAboveLensCentreMm * fs + nudge * fs;
  // Lens plane: vertex distance in front of the cornea.
  const lensZ = lidZ + (FIT.corneaAheadOfLidMm + FIT.vertexDistanceMm) * fs;
  // The bridge must clear the nose at its height.
  const bridgeZ = noseSurfaceZ(y + bridgeYmm * fs) + FIT.bridgeClearanceMm * fs;
  return { position: [0, y, Math.max(lensZ, bridgeZ)], tiltDeg: FIT.pantoscopicTiltDeg };
}

/** Nose surface depth at a canonical height, interpolated along the nose ridge (168 → 6 → 197 → 195 → 5 → 4). */
export function noseSurfaceZ(y) {
  const ridge = [168, 6, 197, 195, 5, 4].map(canonical); // top to bottom
  if (y >= ridge[0][1]) return ridge[0][2];
  for (let i = 0; i < ridge.length - 1; i++) {
    const a = ridge[i],
      b = ridge[i + 1];
    if (y <= a[1] && y >= b[1]) return a[2] + ((a[1] - y) / (a[1] - b[1])) * (b[2] - a[2]);
  }
  return ridge[ridge.length - 1][2];
}

/* ---------- Head occluder ---------- */
/** Occluder constants: temples vanish this far behind the hinge; the face front stays this far behind the lenses. */
export const OCCLUDER = Object.freeze({ templeHideMm: 30, frontGapMm: 8, depthRatio: 1.25, heightRatio: 1.15 });

/**
 * An ellipsoid that writes depth only, in canonical units. Its front stays behind the frame front, and its surface
 * crosses the temple line `templeHideMm` behind the hinges, so temples disappear from there on.
 * @param {{faceScale: number, faceWidthMm: number, templeXmm: number, hingeBackMm: number, frontZ: number, centreY: number}} o
 *   templeXmm: temple distance from the centre line; hingeBackMm: hinge depth behind the frame front
 * @returns {{centre: number[], radii: number[]}} canonical units
 */
export function occluderEllipsoid({ faceScale: fs, faceWidthMm, templeXmm, hingeBackMm, frontZ, centreY }) {
  const front = frontZ - OCCLUDER.frontGapMm * fs; // ellipsoid front (x = 0)
  const hide = frontZ - (hingeBackMm + OCCLUDER.templeHideMm) * fs; // surface depth at the temple line
  const xt = templeXmm * fs;
  const gap = front - hide; // how far the surface drops between x = 0 and x = xt
  // Find rx with rz = depthRatio·rx and rz·(1 − sqrt(1 − (xt/rx)²)) = gap.
  const drop = (rx) => OCCLUDER.depthRatio * rx * (1 - Math.sqrt(Math.max(0, 1 - (xt / rx) ** 2)));
  let lo = xt * 1.0001,
    hi = xt * 20;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (drop(m) > gap) lo = m;
    else hi = m;
  }
  const rx = Math.max((lo + hi) / 2, (faceWidthMm / 2) * fs);
  const rz = rx * OCCLUDER.depthRatio;
  return { centre: [0, centreY, front - rz], radii: [rx, rx * OCCLUDER.heightRatio, rz] };
}

/**
 * True when the line from `p` towards the viewer (direction `d`, unit) passes through the ellipsoid, so `p` is hidden.
 * Used by the tests to prove what the occluder hides.
 */
export function occludedBy(e, p, d) {
  const o = [(p[0] - e.centre[0]) / e.radii[0], (p[1] - e.centre[1]) / e.radii[1], (p[2] - e.centre[2]) / e.radii[2]];
  const v = [d[0] / e.radii[0], d[1] / e.radii[1], d[2] / e.radii[2]];
  const a = v[0] ** 2 + v[1] ** 2 + v[2] ** 2;
  const b = 2 * (o[0] * v[0] + o[1] * v[1] + o[2] * v[2]);
  const c = o[0] ** 2 + o[1] ** 2 + o[2] ** 2 - 1;
  if (c <= 0) return true; // inside
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const t2 = (-b + Math.sqrt(disc)) / (2 * a);
  return t2 > 0 && (-b - Math.sqrt(disc)) / (2 * a) > 0;
}
