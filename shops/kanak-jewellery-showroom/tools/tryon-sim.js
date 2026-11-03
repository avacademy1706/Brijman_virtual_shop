// Try-on simulator (development only, not part of the build). Runs the real try-on module against a painted
// mannequin "camera" and synthetic landmarks, so jewellery placement, scale, occlusion and the earring swing can
// be checked without a camera or the MediaPipe models.
//   npm run dev, then open http://localhost:5173/tools/tryon-sim.html
//   ?set=rajwada | ?pid=<product id>   what to wear      ?yaw=20&pitch=0&roll=0   head pose in degrees
//   ?hand=1   raise a hand (rings and bangles)            ?move=1                  sway the head (earring swing)
//   ?handY=500  height of the hand in the picture (pixels from the top of a 720 x 960 frame)
import '../src/styles/fonts.css';
import '../src/styles/main.css';
import { NY } from '../src/core/ny.js';
import '../src/data/catalogue.js';
import '../src/lib/drawings.js';
import { openTryOn, tryOnState } from '../src/tryon/tryon.js';
import { faceAnchors, handAnchors } from '../src/tryon/anchors.js';
import { createMannequin } from './sim-mannequin.js';

const qs = new URLSearchParams(location.search);
const sim = createMannequin(720, 960, {
  yaw: +(qs.get('yaw') || 0),
  pitch: +(qs.get('pitch') || 0),
  roll: +(qs.get('roll') || 0),
  hand: qs.has('hand'),
  move: qs.has('move'),
  hy: +(qs.get('handY') || 540),
});
window.__pose = sim.pose;

// fake camera: the painted mannequin as a video stream
const stream = sim.canvas.captureStream(30);
navigator.mediaDevices.getUserMedia = async () => stream;
navigator.mediaDevices.enumerateDevices = async () => [{ kind: 'videoinput', deviceId: 'sim', label: 'Simulator' }];
const t0 = performance.now();
const tick = (now) => {
  sim.paint((now - t0) / 1000);
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);

// fake tracker: the mannequin's own landmarks, through the real anchor maths
const fake = {
  ensure: async () => {},
  reset() {},
  update(video, now, needs) {
    const L = sim.landmarks((now - t0) / 1000);
    return {
      face: needs.face ? faceAnchors(L.face) : null,
      hand: needs.hand && L.hand ? handAnchors(L.hand, L.handedness) : null,
      raw: {},
    };
  },
};

const o = { addToBag: (pid) => console.log('bag', pid), openProduct: (pid) => console.log('open', pid), onClose() {} };
if (qs.get('pid')) o.pid = qs.get('pid');
if (qs.get('set')) o.set = qs.get('set');
openTryOn(o);
tryOnState().tracker = fake;
document.getElementById('to-start').click();
window.__ready = new Promise((res) => setTimeout(res, 1500));
window.NY = NY;
