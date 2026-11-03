// Camera tracking for the try-on: MediaPipe Face Landmarker (earrings, necklaces, maang tikka, nath) and Hand
// Landmarker (rings, bangles, bracelets), self-hosted (WASM runtime and models are served by this site, nothing
// is fetched from a CDN at runtime). Each model loads only when something that needs it is being worn.
import { FilesetResolver, FaceLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';
import { toPx, faceAnchors, handAnchors, VecFilter, FACE, HAND } from './anchors.js';

export const MP_VERSION = '1.0.1';
const BASE = (import.meta.env && import.meta.env.BASE_URL) || '/';
export const MODEL_FILES = { face: 'face_landmarker.task', hand: 'hand_landmarker.task' };
const modelUrl = (k) => BASE + 'models/' + MODEL_FILES[k];

/** True if a model file is actually served (not a 404 or an HTML fallback page). */
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
async function create(kind) {
  if (!(await modelAvailable(kind))) throw new ModelMissing(kind);
  const fs = await fileset();
  let last = null;
  for (const delegate of ['GPU', 'CPU']) {
    try {
      if (kind === 'face')
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
      return await HandLandmarker.createFromOptions(fs, {
        baseOptions: { modelAssetPath: modelUrl('hand'), delegate },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error('Tracking model could not load');
}

const FACE_IDX = Object.values(FACE);
const HAND_IDX = Object.values(HAND);

/** Runs the landmarkers on video frames and returns smoothed anchors. */
export class Tracker {
  constructor() {
    this.face = null;
    this.hand = null;
    this.loading = {};
    this.fFace = new VecFilter(FACE_IDX.length * 3, 1.4, 0.035);
    this.fHand = new VecFilter(HAND_IDX.length * 3, 1.6, 0.05);
    this.lastT = 0;
    this.lostFace = 0;
    this.lostHand = 0;
  }
  /** Loads the models the worn pieces need. needs: { face, hand } */
  async ensure(needs) {
    const jobs = [];
    for (const k of ['face', 'hand'])
      if (needs[k] && !this[k]) {
        if (!this.loading[k])
          this.loading[k] = create(k).then(
            (m) => {
              this[k] = m;
              return m;
            },
            (e) => {
              this.loading[k] = null;
              throw e;
            },
          );
        jobs.push(this.loading[k]);
      }
    await Promise.all(jobs);
  }
  reset() {
    this.fFace.reset();
    this.fHand.reset();
    this.lastT = 0;
  }
  /** One video frame. Returns { face: anchors | null, hand: anchors | null }. */
  update(video, now, needs) {
    const W = video.videoWidth,
      H = video.videoHeight;
    const dt = this.lastT ? Math.max(0.001, (now - this.lastT) / 1000) : 1 / 30;
    this.lastT = now;
    const out = { face: null, hand: null, raw: {} };
    if (needs.face && this.face) {
      let r = null;
      try {
        r = this.face.detectForVideo(video, now);
      } catch (e) {
        console.warn(e);
      }
      const lm = r && r.faceLandmarks && r.faceLandmarks[0];
      out.raw.face = lm || null;
      if (lm) {
        this.lostFace = 0;
        const flat = [];
        for (const i of FACE_IDX) flat.push(...toPx(lm[i], W, H));
        const f = this.fFace.filter(flat, dt);
        const P = [];
        FACE_IDX.forEach((idx, k) => (P[idx] = [f[k * 3], f[k * 3 + 1], f[k * 3 + 2]]));
        out.face = faceAnchors(P);
      } else if (++this.lostFace > 3) this.fFace.reset();
    }
    if (needs.hand && this.hand) {
      let r = null;
      try {
        r = this.hand.detectForVideo(video, now);
      } catch (e) {
        console.warn(e);
      }
      const lm = r && r.landmarks && r.landmarks[0];
      out.raw.hand = lm || null;
      if (lm) {
        this.lostHand = 0;
        const flat = [];
        for (const i of HAND_IDX) flat.push(...toPx(lm[i], W, H));
        const f = this.fHand.filter(flat, dt);
        const P = [];
        HAND_IDX.forEach((idx, k) => (P[idx] = [f[k * 3], f[k * 3 + 1], f[k * 3 + 2]]));
        const label = r.handedness && r.handedness[0] && r.handedness[0][0] ? r.handedness[0][0].categoryName : 'Left';
        out.hand = handAnchors(P, label);
      } else if (++this.lostHand > 3) this.fHand.reset();
    }
    return out;
  }
}
