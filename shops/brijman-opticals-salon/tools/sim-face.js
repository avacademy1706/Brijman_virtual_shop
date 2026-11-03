// A painted face "camera" with matching synthetic landmarks, for trying the glasses try-on without a camera or the
// MediaPipe model (development only, not part of the build). Used by tools/tryon-sim.html and the tests.
// The face is defined in millimetres and both painted and "tracked" from the same numbers, so the frame the
// try-on places can be checked against the painted eyes, nose and temples.
import { FACE, FACE_MM } from '../src/tryon/anchors.js';

/** An average adult face. Origin between the cheek landmarks; x to the face's left, y up, z out of the face. */
export function facePoints(o) {
  o = o || {};
  const pd = o.pd || 63,
    temples = o.temples || 138;
  const ir = FACE_MM.iris / 2;
  const P = {
    [FACE.rightCheek]: [-70, 0, 0],
    [FACE.leftCheek]: [70, 0, 0],
    [FACE.rightTemple]: [-temples / 2, 24, 10],
    [FACE.leftTemple]: [temples / 2, 24, 10],
    [FACE.foreheadTop]: [0, 98, 80],
    [FACE.chin]: [0, -112, 74],
    [FACE.bridge]: [0, 17, 99],
    [FACE.noseTip]: [0, -24, 124],
    [FACE.rightEyeOuter]: [-pd / 2 - 13, 17, 80],
    [FACE.rightEyeInner]: [-pd / 2 + 13, 17, 84],
    [FACE.leftEyeInner]: [pd / 2 - 13, 17, 84],
    [FACE.leftEyeOuter]: [pd / 2 + 13, 17, 80],
    [FACE.rightPupil]: [-pd / 2, 17, 87],
    [FACE.rightIrisA]: [-pd / 2 - ir, 17, 86],
    [FACE.rightIrisB]: [-pd / 2 + ir, 17, 86],
    [FACE.leftPupil]: [pd / 2, 17, 87],
    [FACE.leftIrisA]: [pd / 2 - ir, 17, 86],
    [FACE.leftIrisB]: [pd / 2 + ir, 17, 86],
  };
  return P;
}

const rad = (d) => (d * Math.PI) / 180;
export function rot(p, yaw, pitch, roll) {
  let [a, b, c] = p;
  [a, c] = [a * Math.cos(rad(yaw)) + c * Math.sin(rad(yaw)), -a * Math.sin(rad(yaw)) + c * Math.cos(rad(yaw))];
  [b, c] = [b * Math.cos(rad(pitch)) + c * Math.sin(rad(pitch)), -b * Math.sin(rad(pitch)) + c * Math.cos(rad(pitch))];
  [a, b] = [a * Math.cos(rad(roll)) - b * Math.sin(rad(roll)), a * Math.sin(rad(roll)) + b * Math.cos(rad(roll))];
  return [a, b, c];
}

/**
 * pose: { yaw, pitch, roll (degrees), move (turn the head slowly), sway (degrees), s (px per mm), cx, cy (px),
 *         pd, temples (mm) }
 */
export function createFace(W = 720, H = 960, pose = {}) {
  pose = Object.assign({ yaw: 0, pitch: 0, roll: 0, move: false, sway: 24, s: 2.4, cx: W / 2, cy: H * 0.4 }, pose);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const PTS = facePoints(pose);
  const headPose = (t) => ({
    yaw: pose.yaw + (pose.move ? pose.sway * Math.sin(t * 1.6) : 0),
    pitch: pose.pitch + (pose.move ? 4 * Math.sin(t * 0.9) : 0),
    roll: pose.roll,
  });
  /** Face point (mm) -> anchor pixel space (origin at the image centre, y up, z towards the camera). */
  const faceP = (mm, t) => {
    const hp = headPose(t);
    const q = rot(mm, hp.yaw, hp.pitch, hp.roll);
    return [pose.cx + q[0] * pose.s - W / 2, H / 2 - (pose.cy - q[1] * pose.s), q[2] * pose.s];
  };
  const img = (p) => [p[0] + W / 2, H / 2 - p[1]];
  const pt = (mm, t) => img(faceP(mm, t));

  function paint(t) {
    const S = pose.s;
    const hp = headPose(t);
    // studio backdrop
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#d9d1c6');
    bg.addColorStop(1, '#a99f92');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    // shoulders and a navy top
    const c0 = pt([0, -150, 0], t);
    g.fillStyle = '#26324a';
    g.beginPath();
    g.moveTo(c0[0] - 70 * S, c0[1] - 10 * S);
    g.bezierCurveTo(c0[0] - 150 * S, c0[1] + 10 * S, c0[0] - 230 * S, c0[1] + 30 * S, c0[0] - 250 * S, H);
    g.lineTo(c0[0] + 250 * S, H);
    g.bezierCurveTo(c0[0] + 230 * S, c0[1] + 30 * S, c0[0] + 150 * S, c0[1] + 10 * S, c0[0] + 70 * S, c0[1] - 10 * S);
    g.closePath();
    g.fill();
    // neck
    const nk = pt([0, -120, 10], t);
    g.fillStyle = '#b98a6c';
    g.beginPath();
    g.roundRect(nk[0] - 46 * S, nk[1] - 20 * S, 92 * S, 90 * S, 30 * S);
    g.fill();
    // hair behind
    const hc = pt([0, 30, -10], t);
    g.fillStyle = '#2b2019';
    g.beginPath();
    g.ellipse(hc[0], hc[1], 92 * S, 122 * S, rad(-hp.roll), 0, Math.PI * 2);
    g.fill();
    // ears (drawn before the face so the face covers their inner edge)
    for (const sx of [-1, 1]) {
      const e = pt([sx * 74, 8, -6], t);
      g.fillStyle = '#b8876a';
      g.beginPath();
      g.ellipse(e[0], e[1], 10 * S * Math.max(0.35, Math.cos(rad(hp.yaw))), 27 * S, rad(-hp.roll), 0, Math.PI * 2);
      g.fill();
    }
    // face: an oval through the cheeks, the forehead and the chin
    const fc = pt([0, -6, 40], t);
    const k = g.createRadialGradient(fc[0] - 20 * S, fc[1] - 30 * S, 10 * S, fc[0], fc[1], 120 * S);
    k.addColorStop(0, '#e2b597');
    k.addColorStop(0.75, '#c9967a');
    k.addColorStop(1, '#a8775e');
    g.fillStyle = k;
    g.beginPath();
    g.ellipse(fc[0], fc[1], 72 * S, 110 * S, rad(-hp.roll), 0, Math.PI * 2);
    g.fill();
    // fringe of hair over the forehead
    const fh = pt([0, 92, 70], t);
    g.fillStyle = '#2b2019';
    g.beginPath();
    g.ellipse(fh[0], fh[1] - 6 * S, 76 * S, 26 * S, rad(-hp.roll), Math.PI, Math.PI * 2);
    g.fill();
    // eyes: white, iris (11.7 mm), pupil, lid line; brows above
    for (const [pi, outer, inner] of [
      [FACE.rightPupil, FACE.rightEyeOuter, FACE.rightEyeInner],
      [FACE.leftPupil, FACE.leftEyeOuter, FACE.leftEyeInner],
    ]) {
      const p = pt(PTS[pi], t),
        a = pt(PTS[outer], t),
        b = pt(PTS[inner], t);
      const cx = (a[0] + b[0]) / 2,
        cy = (a[1] + b[1]) / 2,
        rw = Math.hypot(a[0] - b[0], a[1] - b[1]) / 2;
      g.fillStyle = '#f4efea';
      g.beginPath();
      g.ellipse(cx, cy, rw, 5 * S, rad(-hp.roll), 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#5a3d2a';
      g.beginPath();
      g.arc(p[0], p[1], (FACE_MM.iris / 2) * S, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1a120d';
      g.beginPath();
      g.arc(p[0], p[1], 2.4 * S, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#3a2618';
      g.lineWidth = 1.4 * S;
      g.beginPath();
      g.ellipse(cx, cy - 0.5 * S, rw * 1.02, 5.4 * S, rad(-hp.roll), Math.PI * 1.05, Math.PI * 1.95);
      g.stroke();
      const sx = Math.sign(PTS[pi][0]);
      const br = pt([PTS[pi][0] + sx * 2, 33, 92], t);
      g.lineWidth = 3.2 * S;
      g.beginPath();
      g.moveTo(br[0] - 16 * S, br[1] + 2 * S);
      g.quadraticCurveTo(br[0], br[1] - 4 * S, br[0] + 16 * S, br[1] + 1 * S);
      g.stroke();
    }
    // nose: a soft ridge from the bridge to the tip, and nostrils
    const nb = pt(PTS[FACE.bridge], t),
      nt = pt(PTS[FACE.noseTip], t);
    g.strokeStyle = 'rgba(150, 100, 76, .55)';
    g.lineWidth = 2 * S;
    g.beginPath();
    g.moveTo(nb[0] + 4 * S, nb[1]);
    g.quadraticCurveTo(nt[0] + 6 * S, (nb[1] + nt[1]) / 2, nt[0] + 4 * S, nt[1]);
    g.stroke();
    g.beginPath();
    g.moveTo(nt[0] - 10 * S, nt[1] + 4 * S);
    g.quadraticCurveTo(nt[0], nt[1] + 9 * S, nt[0] + 10 * S, nt[1] + 4 * S);
    g.stroke();
    // mouth
    const m = pt([0, -58, 100], t);
    g.fillStyle = '#a5544f';
    g.beginPath();
    g.moveTo(m[0] - 22 * S, m[1]);
    g.quadraticCurveTo(m[0], m[1] - 7 * S, m[0] + 22 * S, m[1]);
    g.quadraticCurveTo(m[0], m[1] + 10 * S, m[0] - 22 * S, m[1]);
    g.fill();
  }
  /** Synthetic landmarks, shaped like the pixel-space arrays the anchors expect. */
  function landmarks(t) {
    const face = [];
    for (const k in PTS) face[k] = faceP(PTS[k], t);
    return face;
  }
  return { canvas, pose, paint, landmarks, faceP, W, H };
}
