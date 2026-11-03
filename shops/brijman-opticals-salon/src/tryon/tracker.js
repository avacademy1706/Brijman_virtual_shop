// Camera tracking for the try-on: MediaPipe Face Landmarker (478 points with irises), self-hosted (the WASM
// runtime and the model are served by this site; nothing is fetched from a CDN at runtime). The model loads only
// when the try-on starts the camera.
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { toPx, faceAnchors, VecFilter, FACE } from './anchors.js';

export const MP_VERSION = '1.0.1';
const BASE = (import.meta.env && import.meta.env.BASE_URL) || '/';
export const MODEL_FILES = { face: 'face_landmarker.task' };
const modelUrl = (k) => BASE + 'models/' + MODEL_FILES[k];

/** True if the model file is actually served (not a 404 or an HTML fallback page). */
async function modelAvailable(k) {
  try {
    const r = await fetch(modelUrl(k), { method: 'HEAD' });
    return r.ok && !/text\/html/.test(r.headers.get('content-type') || '');
  } catch (e) {
    return false;
  }
}
let filesetP = null;
const fileset = () =>
  filesetP || (filesetP = FilesetResolver.forVisionTasks(BASE + 'vendor/mediapipe/' + MP_VERSION + '/wasm'));

export class ModelMissing extends Error {
  constructor(k) {
    super('The ' + k + ' tracking model is not installed. Run npm run setup:tryon.');
    this.kind = k;
    this.code = 'model-missing';
  }
}
async function create() {
  if (!(await modelAvailable('face'))) throw new ModelMissing('face');
  const fs = await fileset();
  let last = null;
  for (const delegate of ['GPU', 'CPU']) {
    try {
      return await FaceLandmarker.createFromOptions(fs, {
        baseOptions: { modelAssetPath: modelUrl('face'), delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error('Tracking model could not load');
}

// the landmarks the try-on uses, filtered together
const IDX = [...new Set(Object.values(FACE))];

/** Runs the face landmarker on video frames and returns smoothed anchors. */
export class Tracker {
  constructor() {
    this.face = null;
    this.loading = null;
    this.filter = new VecFilter(IDX.length * 3, 1.2, 0.03);
    this.lastT = 0;
    this.lost = 0;
  }
  async ensure() {
    if (this.face) return;
    if (!this.loading)
      this.loading = create().then(
        (m) => {
          this.face = m;
          return m;
        },
        (e) => {
          this.loading = null;
          throw e;
        },
      );
    await this.loading;
  }
  reset() {
    this.filter.reset();
    this.lastT = 0;
  }
  /** One video frame. Returns { face: anchors | null, raw }. */
  update(video, now) {
    const W = video.videoWidth,
      H = video.videoHeight;
    const dt = this.lastT ? Math.max(0.001, (now - this.lastT) / 1000) : 1 / 30;
    this.lastT = now;
    const out = { face: null, raw: null };
    if (!this.face) return out;
    let r = null;
    try {
      r = this.face.detectForVideo(video, now);
    } catch (e) {
      console.warn(e);
    }
    const lm = r && r.faceLandmarks && r.faceLandmarks[0];
    out.raw = lm || null;
    if (lm && lm.length > 477) {
      this.lost = 0;
      const flat = [];
      for (const i of IDX) flat.push(...toPx(lm[i], W, H));
      const f = this.filter.filter(flat, dt);
      const P = [];
      IDX.forEach((idx, k) => (P[idx] = [f[k * 3], f[k * 3 + 1], f[k * 3 + 2]]));
      out.face = faceAnchors(P);
    } else if (++this.lost > 3) this.filter.reset();
    return out;
  }
}
