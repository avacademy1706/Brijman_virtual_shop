// Camera pose tracking for the try-on: MediaPipe Pose Landmarker (self-hosted WASM and model), mapped into the
// cloth system's metric frame, smoothed with One Euro filters, with missing joints filled in.
//
// Frame: x to the viewer's right in the *unmirrored* camera image, y up, z towards the camera, in metres.
// The overlay renders with an orthographic camera whose frustum is the video frame times `scale` (metres per
// pixel), so a joint at (X, Y) lands exactly on the pixel MediaPipe reported.
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { measurementsFromPose, vec } from '../cloth/body.js';

export const MP_VERSION = '1.0.1';
const BASE = (import.meta.env && import.meta.env.BASE_URL) || '/';
const IDX = {
  nose: 0,
  lShoulder: 11,
  rShoulder: 12,
  lElbow: 13,
  rElbow: 14,
  lWrist: 15,
  rWrist: 16,
  lHip: 23,
  rHip: 24,
  lKnee: 25,
  rKnee: 26,
  lAnkle: 27,
  rAnkle: 28,
};
const NAMES = Object.keys(IDX);

/* ---------------- One Euro filter (Casiez et al.): low lag when moving, low jitter when still ---------------- */
class OneEuro {
  constructor(minCutoff = 1.0, beta = 0.05, dCutoff = 1.0) {
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
  filter(v, dt) {
    if (this.x === null || !(dt > 0)) {
      this.x = v;
      this.dx = 0;
      return v;
    }
    const dv = (v - this.x) / dt;
    this.dx += OneEuro.alpha(dt, this.dCutoff) * (dv - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(dt, cutoff) * (v - this.x);
    return this.x;
  }
  reset() {
    this.x = null;
  }
}

/** Load the landmarker. Tries the GPU delegate first, then the CPU. */
const modelUrl = (m) => BASE + 'models/pose_landmarker_' + m + '.task';
/** True if a model file is actually served (not a 404 or an HTML fallback page). */
async function modelAvailable(m) {
  try {
    const r = await fetch(modelUrl(m), { method: 'HEAD' });
    return r.ok && !/text\/html/.test(r.headers.get('content-type') || '');
  } catch (e) {
    return false;
  }
}
export async function createLandmarker(model = 'lite', masks = true, delegates = ['GPU', 'CPU']) {
  const fileset = await FilesetResolver.forVisionTasks(BASE + 'vendor/mediapipe/' + MP_VERSION + '/wasm');
  const make = (delegate, m) =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelUrl(m), delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      // masks are used for a few frames to measure the shopper's width, then switched off
      outputSegmentationMasks: masks,
    });
  const models = [];
  for (const m of model === 'full' ? ['full', 'lite'] : ['lite']) if (await modelAvailable(m)) models.push(m);
  if (!models.length) throw new Error('No pose model is served at ' + modelUrl('lite') + '. Run npm run setup:tryon.');
  let lastErr = null;
  for (const m of models)
    for (const d of delegates) {
      try {
        const lm = await make(d, m);
        return { landmarker: lm, delegate: d, model: m };
      } catch (e) {
        lastErr = e;
      }
    }
  throw lastErr || new Error('Pose model could not load');
}

/**
 * Turns landmarker results into smoothed joints in metres.
 * update() returns null while nobody is in view.
 */
export class PoseTracker {
  constructor() {
    this.filters = {};
    for (const n of NAMES) this.filters[n] = [new OneEuro(1.4, 0.6), new OneEuro(1.4, 0.6), new OneEuro(0.8, 0.2)];
    this.scaleF = new OneEuro(0.6, 0.0);
    this.scale = 0.002;
    this.lastT = 0;
    this.samples = [];
    this.lost = 0;
    this.vis = {};
    this.widthSamples = [];
    this.wantWidths = true;
    // Absolute scale. MediaPipe's world landmarks assume an average-sized body, so their metres can be off by
    // 20-40 % for tall, short, broad or slim people. A height prior (the shopper's own height when they saved it)
    // measured against the body's length in pixels corrects that; `corr` multiplies the world-based scale.
    this.corr = 1;
    this.height = 1.6;
    this.scaleSamples = [];
  }
  /** Set the height used to fix the absolute scale (metres) and the kind of body (affects proportions). */
  setHeight(h, kind) {
    this.height = h;
    this.kind = kind;
  }
  reset() {
    for (const n of NAMES) for (const f of this.filters[n]) f.reset();
    this.scaleF.reset();
    this.samples = [];
    this.scaleSamples = [];
  }
  /**
   * @param {object} res PoseLandmarkerResult
   * @param {number} W video width (px)
   * @param {number} H video height (px)
   * @param {number} t timestamp (ms)
   */
  update(res, W, H, t) {
    const dt = this.lastT ? Math.min(0.2, Math.max(0.001, (t - this.lastT) / 1000)) : 1 / 30;
    this.lastT = t;
    const lm = res && res.landmarks && res.landmarks[0];
    const wl = res && res.worldLandmarks && res.worldLandmarks[0];
    if (!lm || !wl) {
      this.lost += dt;
      if (this.lost > 0.6) this.reset();
      return null;
    }
    this.lost = 0;
    const P = (i) => [lm[i].x * W, lm[i].y * H, lm[i].z * W];
    const Wp = (i) => [wl[i].x, wl[i].y, wl[i].z];
    const vis = {};
    for (const n of NAMES) {
      const L = lm[IDX[n]];
      vis[n] = Math.min(L.visibility ?? 1, L.presence ?? 1);
    }
    this.vis = vis;
    if (vis.lShoulder < 0.4 || vis.rShoulder < 0.4) return null;
    // metres per pixel from the shoulders (3D distance in both spaces), smoothed
    const ls = P(IDX.lShoulder),
      rs = P(IDX.rShoulder);
    const dImg = Math.hypot(ls[0] - rs[0], ls[1] - rs[1], (ls[2] - rs[2]) * 0.5);
    const dW = vec.len(vec.sub(Wp(IDX.lShoulder), Wp(IDX.rShoulder)));
    if (dImg > 4 && dW > 0.15) this.scaleW = this.scaleF.filter(dW / dImg, dt);
    if (this.scaleW) this.scale = this.scaleW * this.corr;
    const s = this.scale;
    // scale samples for the height prior: nose to ankles (full body) or shoulders to hips (upper body)
    if (this.scaleW && this.scaleSamples.length < 60) {
      const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] - b[2]) * 0.5);
      const child = this.kind === 'child';
      if (vis.nose > 0.6 && vis.lAnkle > 0.6 && vis.rAnkle > 0.6) {
        const px = d3(P(IDX.nose), mid(P(IDX.lAnkle), P(IDX.rAnkle)));
        if (px > 20) this.scaleSamples.push(((child ? 0.86 : 0.88) * this.height) / px / this.scaleW);
      } else if (vis.lHip > 0.6 && vis.rHip > 0.6) {
        const px = d3(mid(ls, rs), mid(P(IDX.lHip), P(IDX.rHip)));
        if (px > 20) this.scaleSamples.push(((child ? 0.29 : 0.3) * this.height) / px / this.scaleW);
      }
    }
    const J = {};
    for (const n of NAMES) {
      const p = P(IDX[n]);
      const f = this.filters[n];
      J[n] = [f[0].filter((p[0] - W / 2) * s, dt), f[1].filter(-(p[1] - H / 2) * s, dt), f[2].filter(-p[2] * s, dt)];
    }
    // calibration samples (world landmarks, metric) while the shoulders and hips are clearly visible
    if (vis.lHip > 0.6 && vis.rHip > 0.6 && this.samples.length < 45) {
      const S = {};
      for (const n of NAMES) S[n] = Wp(IDX[n]);
      this.samples.push(S);
    }
    const mask = res.segmentationMasks && res.segmentationMasks[0];
    if (mask) {
      if (this.wantWidths && vis.lHip > 0.6 && vis.rHip > 0.6 && this.widthSamples.length < 10) {
        try {
          const w = measureWidths(mask, lm, W, this.scaleW || s);
          if (w) this.widthSamples.push(w);
        } catch (e) {
          /* mask unavailable on this device */
        }
      }
      try {
        mask.close();
      } catch (e) {
        /* already released */
      }
    }
    return this.complete(J, vis);
  }
  /** Fill in joints the camera cannot see, assuming an upright body. */
  complete(J, vis, m) {
    m = m || this.m;
    const out = Object.assign({}, J);
    const sMid = vec.mid(J.lShoulder, J.rShoulder);
    const sw = vec.len(vec.sub(J.lShoulder, J.rShoulder));
    const torso = m ? m.torsoLen : sw * 1.45;
    const ok = (n) => vis[n] > 0.5;
    let down = [0, -1, 0];
    if (ok('lHip') && ok('rHip')) {
      const hMid = vec.mid(J.lHip, J.rHip);
      const d = vec.sub(hMid, sMid);
      if (vec.len(d) > sw * 0.6) down = vec.norm(d);
    }
    const X = vec.norm(vec.sub(J.lShoulder, J.rShoulder));
    const hipW = m ? m.hipJointW : sw * 0.55;
    for (const s of ['l', 'r']) {
      const sg = s === 'l' ? 1 : -1;
      if (!ok(s + 'Hip') || !(ok('lHip') && ok('rHip')))
        out[s + 'Hip'] = vec.add(vec.add(sMid, vec.mul(down, torso)), vec.mul(X, (sg * hipW) / 2));
      const thigh = m ? m.thigh : sw * 1.25,
        shin = m ? m.shin : sw * 1.22;
      if (!ok(s + 'Knee')) out[s + 'Knee'] = vec.add(out[s + 'Hip'], vec.mul(down, thigh));
      if (!ok(s + 'Ankle')) out[s + 'Ankle'] = vec.add(out[s + 'Knee'], vec.mul(down, shin));
      const ua = m ? m.upperArm : sw * 0.85,
        fa = m ? m.foreArm : sw * 0.75;
      if (!ok(s + 'Elbow'))
        out[s + 'Elbow'] = vec.add(out[s + 'Shoulder'], vec.add(vec.mul(down, ua * 0.95), vec.mul(X, sg * ua * 0.28)));
      if (!ok(s + 'Wrist'))
        out[s + 'Wrist'] = vec.add(out[s + 'Elbow'], vec.add(vec.mul(down, fa * 0.95), vec.mul(X, sg * fa * 0.2)));
      // keep the limbs at their measured lengths so the sleeves don't stretch with tracking noise
      if (m) {
        out[s + 'Elbow'] = clampLen(out[s + 'Shoulder'], out[s + 'Elbow'], m.upperArm);
        out[s + 'Wrist'] = clampLen(out[s + 'Elbow'], out[s + 'Wrist'], m.foreArm);
      }
    }
    if (!ok('nose')) out.nose = vec.add(sMid, vec.mul(down, -sw * 0.62));
    return out;
  }
  /** Torso half-widths (m) at chest, waist and hip from the person's silhouette, or null. */
  widths() {
    if (this.widthSamples.length < 6) return null;
    const c = this.corr;
    const med = (k) => {
      const v = this.widthSamples
        .map((w) => w[k] * c)
        .filter((x) => x > 0)
        .sort((a, b) => a - b);
      return v.length ? v[v.length >> 1] : 0;
    };
    return { chest: med('chest'), waist: med('waist'), hip: med('hip') };
  }
  /** Fix the absolute scale from the height prior (median of the samples). Returns the correction factor. */
  calibrateScale() {
    if (this.scaleSamples.length < 8) return this.corr;
    const v = this.scaleSamples.slice().sort((a, b) => a - b);
    this.corr = Math.min(1.8, Math.max(0.6, v[v.length >> 1]));
    return this.corr;
  }
  /** Body measurements once enough calibration samples are in (median of each length). */
  measurements(kind) {
    if (this.samples.length < 12) return null;
    const c = this.corr;
    const ms = this.samples.map((S) => {
      const Sc = {};
      for (const k in S) Sc[k] = [S[k][0] * c, S[k][1] * c, S[k][2] * c];
      return measurementsFromPose(Sc, kind);
    });
    const med = (k) => {
      const v = ms.map((m) => m[k]).sort((a, b) => a - b);
      return v[v.length >> 1];
    };
    const m = Object.assign({}, ms[0]);
    for (const k of ['shoulderW', 'torsoLen', 'hipJointW', 'upperArm', 'foreArm']) m[k] = med(k);
    return m;
  }
}

/**
 * Measure the torso's half-width at chest, waist and hip on the segmentation mask, marching sideways from the
 * torso centre line and stopping at the silhouette edge or where an arm begins.
 */
function measureWidths(mask, lm, W, scale) {
  const mw = mask.width,
    mh = mask.height;
  const data = mask.getAsFloat32Array();
  if (!data || data.length < mw * mh) return null;
  const at = (i) => [lm[i].x * mw, lm[i].y * mh];
  const ls = at(11),
    rs = at(12),
    lh = at(23),
    rh = at(24);
  const sM = [(ls[0] + rs[0]) / 2, (ls[1] + rs[1]) / 2],
    hM = [(lh[0] + rh[0]) / 2, (lh[1] + rh[1]) / 2];
  let ax = [hM[0] - sM[0], hM[1] - sM[1]];
  const al = Math.hypot(ax[0], ax[1]);
  if (al < 10) return null;
  ax = [ax[0] / al, ax[1] / al];
  const perp = [-ax[1], ax[0]];
  const sw = Math.hypot(ls[0] - rs[0], ls[1] - rs[1]);
  const armR = sw * 0.12;
  const arms = [
    [at(11), at(13)],
    [at(13), at(15)],
    [at(12), at(14)],
    [at(14), at(16)],
  ];
  const segD = (p, a, b) => {
    const ex = b[0] - a[0],
      ey = b[1] - a[1];
    const L2 = ex * ex + ey * ey || 1;
    let t = ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(p[0] - a[0] - ex * t, p[1] - a[1] - ey * t);
  };
  const half = (f) => {
    const c = [sM[0] + (hM[0] - sM[0]) * f, sM[1] + (hM[1] - sM[1]) * f];
    const out = [];
    for (const dir of [1, -1]) {
      let d = 0;
      for (; d < sw * 1.5; d++) {
        const x = c[0] + perp[0] * d * dir,
          y = c[1] + perp[1] * d * dir;
        if (x < 0 || y < 0 || x >= mw || y >= mh) break;
        if (data[(y | 0) * mw + (x | 0)] < 0.5) break;
        const p = [x, y];
        if (arms.some(([a, b]) => segD(p, a, b) < armR)) break;
      }
      out.push(d);
    }
    // the side hidden behind an arm reads short; trust the longer, unoccluded side a little more
    return Math.max(out[0], out[1]) * 0.65 + Math.min(out[0], out[1]) * 0.35;
  };
  const k = (W / mw) * scale; // mask px -> metres
  return { chest: half(0.3) * k, waist: half(0.62) * k, hip: half(1.0) * k };
}

function clampLen(a, b, L) {
  const d = vec.sub(b, a);
  const l = vec.len(d);
  if (l < 1e-6) return b;
  const k = Math.min(1.08, Math.max(0.75, l / L));
  return vec.add(a, vec.mul(d, (L * k) / l));
}
