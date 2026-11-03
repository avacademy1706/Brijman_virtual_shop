// Where glasses sit on a tracked face, and how big the face is in millimetres. Pure maths (no browser APIs), so
// it is unit-tested.
//
// Space: the camera image in pixels with the origin at the image centre, x to the right of the *unmirrored*
// image, y up, z towards the camera. MediaPipe landmarks (x, y in 0..1, z relative depth in image widths, more
// negative = closer) are converted with toPx(). Offsets are in millimetres and turned into pixels with the face
// scale, so the glasses follow the shopper at any distance from the camera.
//
// Scale. The face width between the cheek landmarks is steady from frame to frame but differs from person to
// person; the iris is about 11.7 mm across in almost every adult, so it calibrates the face width in millimetres.
// The try-on averages the ratio between the two while the shopper faces the camera (see Calibrator below).

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
// Landmark indices on the MediaPipe face mesh (478 points with irises). "Right" is the shopper's right, which is
// on the left of an unmirrored image.
export const FACE = {
  rightCheek: 234,
  leftCheek: 454,
  rightTemple: 127,
  leftTemple: 356,
  foreheadTop: 10,
  chin: 152,
  bridge: 168, // top of the nose between the eyes, where a frame's bridge rests
  noseTip: 1,
  rightEyeOuter: 33,
  rightEyeInner: 133,
  leftEyeInner: 362,
  leftEyeOuter: 263,
  rightPupil: 468,
  rightIrisA: 469,
  rightIrisB: 471,
  leftPupil: 473,
  leftIrisA: 474,
  leftIrisB: 476,
};
/** Average adult measurements, in millimetres. */
export const FACE_MM = {
  cheeks: 140, // between landmarks 234 and 454 (only used until the irises calibrate the scale)
  iris: 11.7, // visible iris diameter
  vertex: 12, // the back of the lens sits this far in front of the eye
  lift: 1.5, // the middle of the lens sits this far above the pupil
};
/**
 * Face frame from landmarks in pixel space (array of [x, y, z]).
 * Returns { o (between the cheek landmarks), X (to the face's left), Y (up), Z (out of the face), s (px per mm
 * from the average cheek width), yaw, pitch, roll }.
 */
export function faceFrame(P) {
  const R = P[FACE.rightCheek],
    Lc = P[FACE.leftCheek];
  const wpx = v.len(v.sub(Lc, R));
  const X = v.norm(v.sub(Lc, R));
  let Y = v.sub(P[FACE.foreheadTop], P[FACE.chin]);
  Y = v.norm(v.sub(Y, v.mul(X, v.dot(Y, X))));
  const Z = v.cross(X, Y);
  return {
    o: v.mul(v.add(R, Lc), 0.5),
    X,
    Y,
    Z,
    s: wpx / FACE_MM.cheeks,
    cheeksPx: wpx,
    yaw: Math.atan2(Z[0], Z[2]),
    pitch: Math.atan2(Z[1], Math.hypot(Z[0], Z[2])),
    roll: Math.atan2(X[1], X[0]),
  };
}
/** Raw measurements from one frame, in pixels: iris diameter, temple width, pupil distance and the cheek width. */
export function facePx(P) {
  const irisR = v.len(v.sub(P[FACE.rightIrisA], P[FACE.rightIrisB]));
  const irisL = v.len(v.sub(P[FACE.leftIrisA], P[FACE.leftIrisB]));
  return {
    iris: (irisR + irisL) / 2,
    irisBalance: Math.min(irisR, irisL) / Math.max(irisR, irisL, 1e-6),
    temples: v.len(v.sub(P[FACE.leftTemple], P[FACE.rightTemple])),
    pd: v.len(v.sub(P[FACE.leftPupil], P[FACE.rightPupil])),
    cheeks: v.len(v.sub(P[FACE.leftCheek], P[FACE.rightCheek])),
  };
}
/** True when a frame is good for measuring: facing the camera, both irises clearly seen. */
export function canMeasure(F, px) {
  return (
    Math.abs(F.yaw) < 0.26 && Math.abs(F.pitch) < 0.3 && Math.abs(F.roll) < 0.25 && px.irisBalance > 0.8 && px.iris > 6
  );
}
/**
 * Where the glasses go: the frame's origin (between the lens centres, on the front of the lenses) and its axes.
 * s: px per mm (calibrated). Returns { o, X, Y, Z, s }.
 */
export function glassesPose(P, F, s) {
  const mid = v.lerp(P[FACE.rightPupil], P[FACE.leftPupil], 0.5);
  // depth: the lenses sit in front of the eyes, and never inside the bridge of the nose
  const eyeDepth = v.dot(v.sub(mid, F.o), F.Z);
  const bridgeDepth = v.dot(v.sub(P[FACE.bridge], F.o), F.Z);
  const depth = Math.max(eyeDepth + FACE_MM.vertex * s, bridgeDepth);
  // the point between the pupils, moved onto the lens plane and lifted a little
  const off = depth - eyeDepth;
  const o = v.add(mid, v.add(v.mul(F.Z, off), v.mul(F.Y, FACE_MM.lift * s)));
  return { o, X: F.X, Y: F.Y, Z: F.Z, s };
}
/** Everything the try-on needs from one frame of landmarks (pixel space). */
export function faceAnchors(P) {
  const F = faceFrame(P);
  const px = facePx(P);
  return { F, px, P };
}

/**
 * Turns pixels into millimetres for one shopper. While they face the camera, the ratio between the iris scale
 * (px per mm from an 11.7 mm iris) and the cheek scale is averaged; after that, the steadier cheek width gives the
 * scale in every frame, even when the head turns. Face width and PD are averaged the same way.
 */
export class Calibrator {
  constructor() {
    this.reset();
  }
  reset() {
    this.k = 1; // iris scale / cheek scale
    this.n = 0;
    this.face = 0;
    this.pd = 0;
  }
  /** Adds a frame; returns the px-per-mm scale to use for it. */
  update(F, px) {
    if (canMeasure(F, px)) {
      const sIris = px.iris / FACE_MM.iris;
      const k = sIris / F.s;
      if (k > 0.6 && k < 1.6) {
        const a = this.n < 10 ? 1 / (this.n + 1) : 0.06;
        this.k += (k - this.k) * a;
        const face = px.temples / sIris,
          pd = px.pd / sIris;
        this.face = this.n ? this.face + (face - this.face) * a : face;
        this.pd = this.n ? this.pd + (pd - this.pd) * a : pd;
        this.n++;
      }
    }
    return F.s * this.k;
  }
  /** True once enough frames have been measured for a size suggestion. */
  get ready() {
    return this.n >= 24;
  }
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
