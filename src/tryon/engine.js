// Try-on engine: MediaPipe face tracking and a three.js render of the frame on the face, all on the device.
// The interface (ui.js) uses only this API, so a vendor SDK could replace this file later:
//   start(source) · setFrame(productId, colourIndex, sizeId) · setNudge(mm) · snapshot() · stop() · on(event, fn)
// Events: 'progress' {loaded, total}, 'face' {visible}, 'faces' {count} (photos), 'fit' {faceWidthMm, calibrated},
//         'stats' {fps, inferMs, faceWidthMm} (debug only), 'error' {message}.
// Nothing here leaves the device: no frames, landmarks or measurements are sent or stored.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

import { BM } from '../core/bm.js';
import { canonical } from '../../shared/canonical-face.js';
import { sizeOf } from '../../shared/fit.js';
import { frameGeometry, createFrameMaterials, partsFor, tortTexture } from '../three/frame-model.js';
import {
  LM,
  RIGID,
  toWorld,
  procrustes,
  mulMV,
  faceScale,
  faceWidthMmFrom,
  goodForCalibration,
  yawPitch,
  eyeOpenness,
  FaceWidthCalibrator,
  framePlacement,
  occluderEllipsoid,
} from './face-math.js';
import { OneEuroFilter, OneEuroVector, OneEuroQuaternion } from './one-euro.js';

/** Must match node_modules/@mediapipe/tasks-vision (tests/unit/tryon-assets.test.js checks it). */
export const MEDIAPIPE_VERSION = '1.0.1';
const WASM_BASE = '/vendor/mediapipe/' + MEDIAPIPE_VERSION + '/wasm';
const MODEL_URL = '/vendor/mediapipe/models/float16-1/face_landmarker.task';

/** Tunable constants. */
export const ENGINE = Object.freeze({
  faceLostMs: 300, // hide the frame after this long without a face
  fadeMs: 150,
  lightEveryMs: 500,
  smoothing: { minCutoff: 1.0, beta: 0.04 }, // position and rotation (One Euro)
  scaleSmoothing: { minCutoff: 0.4, beta: 0.002 },
  shadowOpacity: 0.2,
  maxPixelRatio: 2,
});

const RIGID_CANONICAL = RIGID.map(canonical);
const DEBUG = typeof location !== 'undefined' && /[?&]tryon-debug\b/.test(location.search);

// MediaPipe's wasm prints informational lines such as "INFO: Created TensorFlow Lite XNNPACK delegate for CPU." through
// console.error. Drop exactly those (they start with "INFO: "), so shoppers' consoles show real errors only.
if (typeof console !== 'undefined' && !console.error.__bmFiltered) {
  const original = console.error;
  const filtered = function (...args) {
    if (typeof args[0] === 'string' && args[0].startsWith('INFO: ')) return;
    return original.apply(this, args);
  };
  filtered.__bmFiltered = true;
  console.error = filtered;
}

let shared = null; // one renderer and one landmarker for the whole page (iOS limits WebGL contexts)

/* ---------- Loading MediaPipe (self-hosted), with progress ---------- */
async function fetchWithProgress(url, onBytes) {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Could not load ' + url + ' (' + res.status + ')');
  if (!res.body || !res.body.getReader) {
    const b = new Uint8Array(await res.arrayBuffer());
    onBytes(b.length);
    return b;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    n += value.length;
    onBytes(value.length);
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

async function loadLandmarker(emit) {
  const simd = await FilesetResolver.isSimdSupported();
  const wasmName = simd ? 'vision_wasm_internal' : 'vision_wasm_nosimd_internal';
  // Sizes for the progress bar (approximate; the real byte counts drive it).
  const total = (simd ? 11.76 : 10.96) * 1e6 + 3.76e6;
  let loaded = 0;
  const tick = (b) => {
    loaded += b;
    emit('progress', { loaded: Math.min(loaded, total), total });
  };
  // Warm the HTTP cache for the wasm while downloading the model, so MediaPipe's own fetch is instant.
  const [model] = await Promise.all([
    fetchWithProgress(MODEL_URL, tick),
    fetchWithProgress(WASM_BASE + '/' + wasmName + '.wasm', tick),
  ]);
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const opts = (delegate) => ({
    baseOptions: { modelAssetBuffer: model, delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });
  let lm,
    delegate = 'GPU';
  try {
    lm = await FaceLandmarker.createFromOptions(fileset, opts('GPU'));
  } catch (e) {
    delegate = 'CPU';
    lm = await FaceLandmarker.createFromOptions(fileset, opts('CPU'));
  }
  emit('progress', { loaded: total, total });
  return { lm, delegate };
}

/* ---------- Scene ---------- */
function makeShared() {
  const canvas = document.createElement('canvas');
  canvas.className = 'tryon-canvas';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.setClearColor(0x101614, 1);
  renderer.setPixelRatio(Math.min(ENGINE.maxPixelRatio, window.devicePixelRatio || 1));

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environmentIntensity = 0.7;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8178, 0.8);
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(0, 600, 1000);
  scene.add(hemi, key, key.target);

  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, 1, 40000);
  camera.position.set(0, 0, 20000);

  // Video (or photo) background, drawn first and never depth-tested, so lenses blend over the real eyes.
  const bgMat = new THREE.MeshBasicMaterial({ toneMapped: false, depthTest: false, depthWrite: false });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat);
  bg.renderOrder = -10;
  bg.frustumCulled = false;
  scene.add(bg);

  // Head space: canonical face units, posed every frame from the landmarks.
  const head = new THREE.Group();
  head.matrixAutoUpdate = false;
  scene.add(head);
  // Invisible head that writes depth only, so temples vanish behind it.
  const occluder = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 28),
    new THREE.MeshBasicMaterial({ colorWrite: false }),
  );
  occluder.renderOrder = 0;
  head.add(occluder);
  const holder = new THREE.Group(); // frame placement (canonical) → model metres
  head.add(holder);

  const debugGeo = new THREE.BufferGeometry();
  debugGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(478 * 3), 3));
  const debugPts = new THREE.Points(
    debugGeo,
    new THREE.PointsMaterial({ color: 0x66ffcc, size: 3, sizeAttenuation: false, depthTest: false }),
  );
  debugPts.renderOrder = 10;
  debugPts.frustumCulled = false;
  debugPts.visible = DEBUG;
  scene.add(debugPts);

  const sample = document.createElement('canvas');
  const mats = createFrameMaterials({ tort: tortTexture(false, 4), tortL: tortTexture(true, 4) });
  return {
    canvas,
    renderer,
    scene,
    camera,
    bg,
    bgMat,
    head,
    occluder,
    holder,
    hemi,
    key,
    debugPts,
    sample,
    mats,
    lm: null,
  };
}

/** Blurred, dark silhouette of the frame front, for the contact shadow on the face. */
function shadowTexture(p, size) {
  const a = BM.ARCH[p.arch];
  const A = size.lens / 1000,
    B = (a.B * A) / a.A,
    D = size.bridge / 1000;
  const W = 512,
    Hh = 224,
    span = 2 * A + D + 0.02,
    k = W / span;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = Hh;
  const g = c.getContext('2d');
  const pts = BM.outline(a.shape, A, B, 48);
  // Draw the rims far off-canvas and keep only their blurred shadow (shadowBlur works in every browser).
  g.shadowColor = 'rgba(0,0,0,1)';
  g.shadowBlur = 14;
  g.shadowOffsetX = W * 2;
  g.strokeStyle = '#000';
  g.lineWidth = a.style === 'acetate' ? 10 : 5;
  for (const side of [1, -1]) {
    g.beginPath();
    pts.forEach((pt, i) => {
      const x = W / 2 + side * (D / 2 + A / 2 + pt.x * side) * k - W * 2;
      const y = Hh / 2 - pt.y * k;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    });
    g.closePath();
    g.stroke();
  }
  g.beginPath();
  g.moveTo(W / 2 - (D / 2) * k - W * 2, Hh / 2 - B * 0.12 * k);
  g.lineTo(W / 2 + (D / 2) * k - W * 2, Hh / 2 - B * 0.12 * k);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  return { texture: t, width: span, height: span * (Hh / W) };
}

/* ---------- Engine ---------- */
/**
 * Creates (or re-arms) the engine. The landmarker and renderer are created once and reused.
 * @returns {Promise<object>} the engine API
 */
export async function createEngine(opts = {}) {
  const listeners = {};
  const emit = (ev, data) => {
    if (ev === 'progress' && opts.onProgress) opts.onProgress(data);
    (listeners[ev] || []).forEach((fn) => fn(data));
  };
  if (!shared) shared = makeShared();
  const S = shared;
  if (!S.lm) {
    try {
      const r = await loadLandmarker(emit);
      S.lm = r.lm;
      S.delegate = r.delegate;
      S.mode = 'VIDEO';
    } catch (e) {
      throw new Error('Try-on could not load its face tracker: ' + (e && e.message));
    }
  }

  const st = {
    source: null,
    live: false,
    w: 0,
    h: 0,
    running: false,
    raf: 0,
    lastVideoTime: -1,
    lastSeen: 0,
    faceVisible: false,
    fade: 0,
    fadeTarget: 0,
    calib: new FaceWidthCalibrator(),
    lastGood: 0,
    nudge: 0,
    frame: null, // { p, ci, sizeId, meshes, materials, geo, width, shadow }
    pose: null,
    fT: new OneEuroVector(3, ENGINE.smoothing),
    fQ: new OneEuroQuaternion(ENGINE.smoothing),
    fS: new OneEuroFilter(ENGINE.scaleSmoothing),
    light: { hemi: 0.8, env: 0.7, keyX: 0, color: new THREE.Color(0xffffff) },
    lightTarget: { hemi: 0.8, env: 0.7, keyX: 0, color: new THREE.Color(0xffffff) },
    lastLight: 0,
    lastFitEmit: { w: 0, cal: false },
    stats: { frames: 0, t0: 0, fps: 0, inferMs: 0 },
    texture: null,
    lostAt: 0,
  };

  /* ----- Size and crop ----- */
  function resize() {
    const el = S.canvas.parentElement;
    if (!el || !st.w) return;
    const r = el.getBoundingClientRect();
    const cw = Math.max(1, r.width),
      ch = Math.max(1, r.height);
    S.renderer.setSize(cw, ch, false);
    // Live video fills the screen (cover); a photo is shown whole (contain).
    const k = st.live ? Math.max(cw / st.w, ch / st.h) : Math.min(cw / st.w, ch / st.h);
    const vw = cw / k,
      vh = ch / k;
    setCamera((st.w - vw) / 2, (st.h - vh) / 2, vw, vh);
  }
  function setCamera(x, y, w, h) {
    const c = S.camera;
    c.left = x;
    c.right = x + w;
    c.bottom = y;
    c.top = y + h;
    c.updateProjectionMatrix();
  }

  /* ----- Background ----- */
  function setBackground(source) {
    if (st.texture) st.texture.dispose();
    st.texture = source instanceof HTMLVideoElement ? new THREE.VideoTexture(source) : new THREE.Texture(source);
    st.texture.colorSpace = THREE.SRGBColorSpace;
    st.texture.needsUpdate = true;
    S.bgMat.map = st.texture;
    S.bgMat.needsUpdate = true;
    S.bg.scale.set(st.w, st.h, 1);
    S.bg.position.set(st.w / 2, st.h / 2, -15000);
  }

  /* ----- Frame model ----- */
  function disposeFrame() {
    const f = st.frame;
    if (!f) return;
    S.holder.clear();
    for (const m of f.materials) m.dispose();
    if (f.shadow) {
      f.shadow.texture.dispose();
      f.shadow.mesh.geometry.dispose();
      f.shadow.mesh.material.dispose();
    }
    if (f.gltf) f.gltf.traverse((o) => o.geometry && o.geometry.dispose());
    st.frame = null;
  }

  async function buildFrame(p, ci, sizeId) {
    const col = BM.colorOf(p, ci);
    const size = sizeOf(p, sizeId);
    const G = frameGeometry(p, size.id);
    const materials = [];
    const group = new THREE.Group();
    let gltf = null;
    if (col.model) {
      try {
        gltf = (await new GLTFLoader().loadAsync(col.model)).scene;
      } catch (e) {
        console.warn('Artist model failed to load, using the generated frame:', e && e.message);
        gltf = null;
      }
    }
    if (gltf) {
      // Artist model: 1 unit = 1 m, front +Z, bridge at the origin. Scale it to this size's real width.
      const box = new THREE.Box3().setFromObject(gltf.getObjectByName('front') || gltf);
      const k = G.outerWidth / Math.max(1e-6, box.max.x - box.min.x);
      gltf.scale.setScalar(k);
      gltf.traverse((o) => {
        if (!o.isMesh) return;
        o.material = o.material.clone();
        if (/lens/i.test(o.name) && p.sun) {
          o.material.color = new THREE.Color(col.l);
          o.material.transparent = true;
          o.material.opacity = col.lk === 'mirror' ? 0.92 : 0.82;
          o.material.metalness = col.lk === 'mirror' ? 0.9 : 0.1;
        }
        o.material.transparent = true;
        materials.push(o.material);
        o.renderOrder = /lens/i.test(o.name) ? 2 : 1;
      });
      group.add(gltf);
    } else {
      for (const pt of partsFor(p, col, G)) {
        let mat;
        if (pt.part === 'lens' && !p.sun) {
          // Clear lens: faint reflection with an anti-reflective coating sheen at grazing angles.
          mat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.14,
            roughness: 0.03,
            metalness: 0,
            iridescence: 0.7,
            iridescenceIOR: 1.6,
            iridescenceThicknessRange: [260, 420],
            envMapIntensity: 1.6,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
        } else {
          mat = S.mats[pt.kind].clone();
          mat.color.copy(pt.color);
        }
        mat.transparent = true;
        mat.userData.baseOpacity = mat.opacity;
        materials.push(mat);
        const parts = pt.part === 'lens' ? [G.lens] : [G.front[pt.part], G.temples[pt.part]].filter(Boolean);
        for (const geo of parts) {
          const m = new THREE.Mesh(geo, mat);
          m.name = pt.part === 'lens' ? 'lenses' : geo === G.front[pt.part] ? 'front' : 'temples';
          m.renderOrder = pt.part === 'lens' ? 2 : 1;
          group.add(m);
        }
      }
    }
    for (const m of materials) if (m.userData.baseOpacity == null) m.userData.baseOpacity = m.opacity;
    // Contact shadow just behind and below the rims.
    const sh = shadowTexture(p, size);
    const shMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      alphaMap: sh.texture,
      transparent: true,
      opacity: ENGINE.shadowOpacity,
      depthWrite: false,
      toneMapped: false,
    });
    shMat.userData.baseOpacity = ENGINE.shadowOpacity;
    const shMesh = new THREE.Mesh(new THREE.PlaneGeometry(sh.width, sh.height), shMat);
    shMesh.position.set(0, -0.0025, -0.007);
    shMesh.renderOrder = 0.5;
    group.add(shMesh);
    return { group, materials: materials.concat(shMat), G, size, gltf, shadow: { texture: sh.texture, mesh: shMesh } };
  }

  /** Places the frame and the occluder for the current face scale. */
  function placeFrame() {
    const f = st.frame;
    if (!f) return;
    const fw = st.calib.estimate;
    const fs = faceScale(fw);
    const pl = framePlacement({ faceScale: fs, bridgeYmm: f.G.bridgeY * 1000, nudgeMm: st.nudge });
    S.holder.position.fromArray(pl.position);
    S.holder.rotation.set((pl.tiltDeg * Math.PI) / 180, 0, 0);
    S.holder.scale.setScalar(1000 * fs); // model metres → mm → canonical units
    const hinge = f.G.hinges[0];
    const e = occluderEllipsoid({
      faceScale: fs,
      faceWidthMm: fw,
      templeXmm: Math.abs(hinge.x) * 1000 + 3,
      hingeBackMm: Math.max(0, -hinge.z * 1000),
      frontZ: pl.position[2],
      centreY: pl.position[1] - 10 * fs,
    });
    S.occluder.position.fromArray(e.centre);
    S.occluder.scale.fromArray(e.radii);
  }

  function setFade(a) {
    st.fade = a;
    S.holder.visible = a > 0.01;
    if (st.frame) for (const m of st.frame.materials) m.opacity = m.userData.baseOpacity * a;
  }

  /* ----- Tracking ----- */
  function onLandmarks(lms, tSec, single) {
    const Q = toWorld(lms, st.w, st.h);
    const pose = procrustes(
      RIGID_CANONICAL,
      RIGID.map((i) => Q[i]),
    );
    if (single) {
      st.calib.reset();
      const mm = faceWidthMmFrom(Q);
      for (let i = 0; i < st.calib.count; i++) st.calib.add(mm, 0);
    } else if (goodForCalibration(Q, pose.R)) {
      st.calib.add(faceWidthMmFrom(Q), st.lastGood ? tSec - st.lastGood : 0);
      st.lastGood = tSec;
    }
    // Snap the nose bridge exactly onto its tracked landmark in screen space.
    const nb = mulMV(pose.R, canonical(LM.noseBridge));
    const t = pose.t.slice();
    t[0] += Q[LM.noseBridge][0] - (pose.s * nb[0] + t[0]);
    t[1] += Q[LM.noseBridge][1] - (pose.s * nb[1] + t[1]);
    const T = single ? t : st.fT.filter(t, tSec);
    const q = single ? pose.q : st.fQ.filter(pose.q, tSec);
    const s = single ? pose.s : st.fS.filter(pose.s, tSec);
    S.head.matrix.compose(new THREE.Vector3(...T), new THREE.Quaternion(...q), new THREE.Vector3(s, s, s));
    S.head.matrixWorldNeedsUpdate = true;
    st.pose = { Q, s };
    if (DEBUG) st.dbg = Object.assign(yawPitch(pose.R), { open: eyeOpenness(Q), good: goodForCalibration(Q, pose.R) });
    placeFrame();
    if (DEBUG) {
      const attr = S.debugPts.geometry.attributes.position;
      Q.forEach((p, i) => i < 478 && attr.setXYZ(i, p[0], p[1], 0));
      attr.needsUpdate = true;
    }
    const w = Math.round(st.calib.estimate);
    if (w !== st.lastFitEmit.w || st.calib.calibrated !== st.lastFitEmit.cal) {
      st.lastFitEmit = { w, cal: st.calib.calibrated };
      emit('fit', { faceWidthMm: st.calib.estimate, calibrated: st.calib.calibrated });
    }
  }

  function faceFound(now) {
    st.lastSeen = now;
    if (!st.faceVisible) {
      st.faceVisible = true;
      st.fadeTarget = 1;
      emit('face', { visible: true });
    }
  }
  function checkLost(now) {
    if (st.faceVisible && now - st.lastSeen > ENGINE.faceLostMs) {
      st.faceVisible = false;
      st.fadeTarget = 0;
      // Start fresh when the face returns, so the frame fades in where the face is instead of sliding there.
      st.fT.reset();
      st.fQ.reset();
      st.fS.reset();
      emit('face', { visible: false });
    }
  }

  /* ----- Light estimation from forehead and cheek patches ----- */
  function estimateLight(now) {
    if (!st.pose || now - st.lastLight < ENGINE.lightEveryMs) return;
    st.lastLight = now;
    const c = S.sample,
      W = 64,
      H = Math.max(1, Math.round((64 * st.h) / st.w));
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }
    const g = c.getContext('2d', { willReadFrequently: true });
    try {
      g.drawImage(st.source, 0, 0, W, H);
    } catch (e) {
      return;
    }
    const patch = (i) => {
      const p = st.pose.Q[i];
      const x = Math.round((p[0] / st.w) * W),
        y = Math.round((1 - p[1] / st.h) * H);
      const d = g.getImageData(Math.max(0, x - 1), Math.max(0, y - 1), 3, 3).data;
      let r = 0,
        gg = 0,
        b = 0;
      for (let k = 0; k < d.length; k += 4) {
        r += d[k];
        gg += d[k + 1];
        b += d[k + 2];
      }
      const n = d.length / 4;
      return [r / n / 255, gg / n / 255, b / n / 255];
    };
    const lum = (c3) => 0.2126 * c3[0] + 0.7152 * c3[1] + 0.0722 * c3[2];
    const fh = patch(LM.forehead),
      cr = patch(LM.cheekR),
      cl = patch(LM.cheekL);
    const avg = [0, 1, 2].map((k) => (fh[k] + cr[k] + cl[k]) / 3);
    const L = lum(avg);
    const T = st.lightTarget;
    T.hemi = 0.35 + 1.1 * L;
    T.env = 0.3 + 0.9 * L;
    // Brighter left cheek (image right, +x) means light from that side.
    T.keyX = Math.max(-1, Math.min(1, (lum(cl) - lum(cr)) * 6));
    const m = Math.max(avg[0], avg[1], avg[2], 1e-3);
    T.color.setRGB(0.6 + 0.4 * (avg[0] / m), 0.6 + 0.4 * (avg[1] / m), 0.6 + 0.4 * (avg[2] / m));
  }
  function applyLight(dt) {
    const a = 1 - Math.exp(-dt / 0.6); // about 0.6 s to settle
    const L = st.light,
      T = st.lightTarget;
    L.hemi += (T.hemi - L.hemi) * a;
    L.env += (T.env - L.env) * a;
    L.keyX += (T.keyX - L.keyX) * a;
    L.color.lerp(T.color, a);
    S.hemi.intensity = L.hemi;
    S.hemi.color.copy(L.color);
    S.scene.environmentIntensity = L.env;
    S.key.intensity = 0.4 + 0.6 * L.hemi;
    S.key.position.set(L.keyX * 800 + st.w / 2, st.h / 2 + 500, 1000);
    S.key.target.position.set(st.w / 2, st.h / 2, 0);
  }

  /* ----- Loop ----- */
  let lastT = 0;
  function loop(now) {
    if (!st.running) return;
    st.raf = requestAnimationFrame(loop);
    const dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0.016;
    lastT = now;
    if (st.live) {
      const v = st.source;
      // Detect only on a new video frame; detection is synchronous, so it never queues up.
      if (v.readyState >= 2 && v.currentTime !== st.lastVideoTime) {
        st.lastVideoTime = v.currentTime;
        const t0 = performance.now();
        let res = null;
        try {
          res = S.lm.detectForVideo(v, now);
        } catch (e) {
          emit('error', { message: 'Face tracking stopped: ' + (e && e.message) });
        }
        st.stats.inferMs = performance.now() - t0;
        const lms = res && res.faceLandmarks && res.faceLandmarks[0];
        if (lms && lms.length >= 478) {
          faceFound(now);
          onLandmarks(lms, now / 1000, false);
        }
      }
      checkLost(now);
      estimateLight(now);
    }
    // Fade the frame in and out over 150 ms.
    if (st.fade !== st.fadeTarget) {
      const step = dt / (ENGINE.fadeMs / 1000);
      setFade(st.fadeTarget > st.fade ? Math.min(1, st.fade + step) : Math.max(0, st.fade - step));
    }
    applyLight(dt);
    S.renderer.render(S.scene, S.camera);
    if (DEBUG) {
      st.stats.frames++;
      if (now - st.stats.t0 > 1000) {
        st.stats.fps = (st.stats.frames * 1000) / (now - st.stats.t0);
        st.stats.frames = 0;
        st.stats.t0 = now;
        emit('stats', {
          fps: st.stats.fps,
          inferMs: st.stats.inferMs,
          faceWidthMm: st.calib.estimate,
          delegate: S.delegate,
          calibrated: st.calib.calibrated,
          samples: st.calib.samples.length,
          pose: st.dbg || null,
        });
      }
    }
  }

  const onResize = () => resize();

  const api = {
    canvas: S.canvas,
    delegate: S.delegate,
    get faceWidthMm() {
      return st.calib.estimate;
    },
    get calibrated() {
      return st.calib.calibrated;
    },
    on(ev, fn) {
      (listeners[ev] = listeners[ev] || []).push(fn);
      return api;
    },
    /**
     * Starts on a live <video> (camera) or a still image (photo).
     * @param {HTMLVideoElement|HTMLImageElement|HTMLCanvasElement|ImageBitmap} source
     * @returns {Promise<{faces: number}|void>}
     */
    async start(source) {
      api.stopLoop();
      st.source = source;
      st.live = source instanceof HTMLVideoElement;
      st.w = st.live ? source.videoWidth : source.naturalWidth || source.width;
      st.h = st.live ? source.videoHeight : source.naturalHeight || source.height;
      st.calib.reset();
      st.lastGood = 0;
      st.fT.reset();
      st.fQ.reset();
      st.fS.reset();
      st.faceVisible = false;
      st.fadeTarget = 0;
      setFade(0);
      st.pose = null;
      S.canvas.style.transform = st.live ? 'scaleX(-1)' : '';
      setBackground(source);
      resize();
      window.addEventListener('resize', onResize);
      let faces;
      // Changing options rebuilds MediaPipe's graph, so only switch when the mode changes.
      const mode = st.live ? 'VIDEO' : 'IMAGE';
      if (S.mode !== mode) {
        // Photos look for up to two faces, so we can say when there is more than one.
        await S.lm.setOptions({ runningMode: mode, numFaces: st.live ? 1 : 2 });
        S.mode = mode;
      }
      if (!st.live) {
        const res = S.lm.detect(source);
        faces = (res.faceLandmarks || []).length;
        emit('faces', { count: faces });
        if (faces === 1 && res.faceLandmarks[0].length >= 478) {
          onLandmarks(res.faceLandmarks[0], 0, true);
          st.faceVisible = true;
          st.fadeTarget = 1;
          estimateLightFromStill();
        }
      }
      st.running = true;
      lastT = 0;
      st.raf = requestAnimationFrame(loop);
      return st.live ? undefined : { faces };
    },
    /**
     * Shows a frame at its real size. Resolves with the front's outer width in mm for every size.
     * @param {string} productId
     * @param {number} colourIndex
     * @param {string} sizeId
     */
    async setFrame(productId, colourIndex, sizeId) {
      const p = BM.byId[productId];
      if (!p || p.type !== 'frame') throw new Error('Not a frame: ' + productId);
      const f = await buildFrame(p, colourIndex, sizeId);
      disposeFrame();
      st.frame = Object.assign(f, { p, ci: colourIndex, sizeId: f.size.id });
      S.holder.add(f.group);
      placeFrame();
      setFade(st.fade);
      return {
        widthMm: f.G.outerWidth * 1000,
        widths: p.sizes.map((s) => ({ id: s.id, widthMm: frameGeometry(p, s.id).outerWidth * 1000 })),
      };
    },
    /** Moves the frame up (+) or down (−) on the nose, in mm, limited to ±3 mm. Never changes its size. */
    setNudge(mm) {
      st.nudge = Math.max(-3, Math.min(3, mm));
      placeFrame();
      return st.nudge;
    },
    /**
     * Photo of the current view at the camera's full resolution (mirrored like the screen for the camera).
     * @returns {Promise<Blob>}
     */
    async snapshot() {
      const R = S.renderer;
      const prev = { w: R.domElement.width, h: R.domElement.height, pr: R.getPixelRatio() };
      R.setPixelRatio(1);
      R.setSize(st.w, st.h, false);
      setCamera(0, 0, st.w, st.h);
      R.render(S.scene, S.camera);
      const out = document.createElement('canvas');
      out.width = st.w;
      out.height = st.h;
      const g = out.getContext('2d');
      if (st.live) {
        g.translate(st.w, 0);
        g.scale(-1, 1);
      }
      g.drawImage(R.domElement, 0, 0);
      R.setPixelRatio(prev.pr);
      resize();
      R.render(S.scene, S.camera);
      return new Promise((res, rej) =>
        out.toBlob((b) => (b ? res(b) : rej(new Error('Photo failed'))), 'image/jpeg', 0.92),
      );
    },
    resize,
    stopLoop() {
      st.running = false;
      cancelAnimationFrame(st.raf);
    },
    /** Stops tracking and frees the frame and video textures. The renderer and tracker stay for next time. */
    stop() {
      api.stopLoop();
      window.removeEventListener('resize', onResize);
      disposeFrame();
      if (st.texture) st.texture.dispose();
      st.texture = null;
      S.bgMat.map = null;
      st.source = null;
      st.pose = null;
      st.calib.reset();
      if (S.canvas.parentElement) S.canvas.parentElement.removeChild(S.canvas);
      for (const k of Object.keys(listeners)) delete listeners[k];
    },
  };

  function estimateLightFromStill() {
    st.lastLight = -1e9;
    estimateLight(performance.now());
    Object.assign(st.light, {
      hemi: st.lightTarget.hemi,
      env: st.lightTarget.env,
      keyX: st.lightTarget.keyX,
    });
    st.light.color.copy(st.lightTarget.color);
  }

  return api;
}
