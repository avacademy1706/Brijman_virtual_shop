// Try-on simulator (development only, not part of the build). Runs the real try-on module against a painted face
// "camera" and synthetic landmarks, so frame placement, scale, the head occluder and the size suggestion can be
// checked without a camera or the MediaPipe model.
//   npm run dev, then open http://localhost:5173/tools/tryon-sim.html
//   ?pid=<product id>&ci=<colour>&size=S|M|L   what to wear       ?yaw=20&pitch=0&roll=0   head pose in degrees
//   ?move=1   turn the head slowly          ?temples=132&pd=60   the face's size in mm (default 138 and 63)
import '../src/styles/fonts.css';
import '../src/styles/main.css';
import { NY } from '../src/core/ny.js';
import '../src/data/catalogue.js';
import '../src/lib/drawings.js';
import { openTryOn, tryOnState } from '../src/tryon/tryon.js';
import { faceAnchors } from '../src/tryon/anchors.js';
import { createFace } from './sim-face.js';

const qs = new URLSearchParams(location.search);
const num = (k, d) => (qs.has(k) ? +qs.get(k) : d);
const sim = createFace(720, 960, {
  yaw: num('yaw', 0),
  pitch: num('pitch', 0),
  roll: num('roll', 0),
  move: qs.has('move'),
  pd: num('pd', 63),
  temples: num('temples', 138),
});
window.__pose = sim.pose;

// fake camera: the painted face as a video stream
const stream = sim.canvas.captureStream(30);
navigator.mediaDevices.getUserMedia = async () => stream;
navigator.mediaDevices.enumerateDevices = async () => [{ kind: 'videoinput', deviceId: 'sim', label: 'Simulator' }];
const t0 = performance.now();
const tick = (now) => {
  sim.paint((now - t0) / 1000);
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);

// fake tracker: the face's own landmarks, through the real anchor maths
const fake = {
  ensure: async () => {},
  reset() {},
  update() {
    return { face: faceAnchors(sim.landmarks((performance.now() - t0) / 1000)), raw: null };
  },
};
const measured = [];
const o = {
  addToBag: (pid, ci, cfg) => console.log('bag', pid, ci, JSON.stringify(cfg)),
  openProduct: (pid) => console.log('open', pid),
  onMeasure: (m) => measured.push(m),
  toast: (t) => console.log('toast', t),
  onClose() {},
};
if (qs.get('pid')) o.pid = qs.get('pid');
if (qs.get('ci')) o.ci = +qs.get('ci');
if (qs.get('size')) o.size = qs.get('size');
openTryOn(o);
tryOnState().tracker = fake;
document.getElementById('to-start').click();
window.__measured = measured;
window.__ready = new Promise((res) => setTimeout(res, 1500));
window.NY = NY;
