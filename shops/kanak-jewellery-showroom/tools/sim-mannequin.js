// A painted mannequin "camera" with matching synthetic landmarks, for trying the try-on without a camera or the
// MediaPipe models (development only, not part of the build). Used by tools/tryon-sim.html.
// Face and hand are defined in millimetres and drawn and "tracked" from the same numbers, so what the try-on
// places is exactly where the mannequin is painted.
import { FACE, HAND } from '../src/tryon/anchors.js';

// A canonical face: origin between the cheek landmarks, x to the face's left, y up, z out of the face.
export const FACE_PTS = {
  [FACE.rightCheek]: [-70, 5, 0],
  [FACE.leftCheek]: [70, 5, 0],
  [FACE.foreheadTop]: [0, 95, 68],
  [FACE.forehead]: [0, 75, 80],
  [FACE.browsMid]: [0, 45, 86],
  [FACE.chin]: [0, -95, 70],
  [FACE.noseTip]: [0, -5, 100],
  [FACE.rightJaw]: [-66, -25, 2],
  [FACE.leftJaw]: [66, -25, 2],
  [FACE.rightAla]: [-17, -18, 82],
  [FACE.leftAla]: [17, -18, 82],
};
// A right hand held up, back of the hand to the camera, as the camera sees it (unmirrored).
export const HAND_PTS = {
  [HAND.wrist]: [0, -88, 0],
  [HAND.indexMcp]: [-36, 0, 0],
  [HAND.middleMcp]: [-12, 4, 0],
  [HAND.ringMcp]: [12, 2, 0],
  [HAND.ringPip]: [15, 46, 0],
  [HAND.pinkyMcp]: [36, -8, 0],
};

const rad = (d) => (d * Math.PI) / 180;
function rot(p, yaw, pitch, roll) {
  let [a, b, c] = p;
  [a, c] = [a * Math.cos(rad(yaw)) + c * Math.sin(rad(yaw)), -a * Math.sin(rad(yaw)) + c * Math.cos(rad(yaw))];
  [b, c] = [b * Math.cos(rad(pitch)) + c * Math.sin(rad(pitch)), -b * Math.sin(rad(pitch)) + c * Math.cos(rad(pitch))];
  [a, b] = [a * Math.cos(rad(roll)) - b * Math.sin(rad(roll)), a * Math.sin(rad(roll)) + b * Math.cos(rad(roll))];
  return [a, b, c];
}

/**
 * pose: { yaw, pitch, roll (degrees), hand (bool), move (sway the head), sway (its amplitude, degrees), s (px per mm),
 *         cx, cy (face centre px),
 *         hx, hy, hs (hand position and scale) }
 */
export function createMannequin(W = 720, H = 960, pose = {}) {
  pose = Object.assign(
    {
      yaw: 0,
      pitch: 0,
      roll: 0,
      hand: false,
      move: false,
      sway: 22,
      s: 2.0,
      cx: W / 2,
      cy: 330,
      hx: 570,
      hy: 540,
      hs: 2.2,
    },
    pose,
  );
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');

  const headPose = (t) => ({
    yaw: pose.yaw + (pose.move ? pose.sway * Math.sin(t * 2.4) : 0),
    pitch: pose.pitch,
    roll: pose.roll + (pose.move ? (pose.sway / 7) * Math.sin(t * 1.3) : 0),
  });
  /** Face point (mm) -> anchor pixel space (origin at the image centre, y up, z towards the camera). */
  const faceP = (mm, t) => {
    const hp = headPose(t);
    const q = rot(mm, hp.yaw, hp.pitch, hp.roll);
    return [pose.cx + q[0] * pose.s - W / 2, H / 2 - (pose.cy - q[1] * pose.s), q[2] * pose.s];
  };
  const toImg = (p) => [p[0] + W / 2, H / 2 - p[1]];
  const handP = (mm) => [pose.hx + mm[0] * pose.hs - W / 2, H / 2 - (pose.hy - mm[1] * pose.hs), mm[2] * pose.hs];

  function paint(t) {
    const S = pose.s;
    const X = (mm) => pose.cx + mm * S,
      Y = (mm) => pose.cy - mm * S;
    // backdrop: warm studio wall with a soft light behind the head
    const bg = g.createRadialGradient(W * 0.5, H * 0.3, 40, W * 0.5, H * 0.45, H * 0.85);
    bg.addColorStop(0, '#6b5646');
    bg.addColorStop(0.55, '#3b2e27');
    bg.addColorStop(1, '#1d1714');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    const skin = (x0, y0, r, light) => {
      const k = g.createRadialGradient(x0 - r * 0.25, y0 - r * 0.3, r * 0.1, x0, y0, r);
      k.addColorStop(0, light ? '#e2b597' : '#d1a283');
      k.addColorStop(0.7, light ? '#c9967a' : '#b8876b');
      k.addColorStop(1, '#9c6f56');
      return k;
    };
    // shoulders and chest, then a deep-neck black velvet blouse
    g.fillStyle = skin(X(0), Y(-260), 260 * S, true);
    g.beginPath();
    g.moveTo(X(-58), Y(-150));
    g.bezierCurveTo(X(-120), Y(-178), X(-200), Y(-188), X(-226), Y(-300));
    g.lineTo(X(-232), Y(-340));
    g.lineTo(X(232), Y(-340));
    g.lineTo(X(226), Y(-300));
    g.bezierCurveTo(X(200), Y(-188), X(120), Y(-178), X(58), Y(-150));
    g.closePath();
    g.fill();
    g.fillStyle = '#120d0c';
    g.beginPath();
    g.moveTo(X(-232), Y(-250));
    g.bezierCurveTo(X(-150), Y(-232), X(-120), Y(-262), X(-70), Y(-330));
    g.lineTo(X(70), Y(-330));
    g.bezierCurveTo(X(120), Y(-262), X(150), Y(-232), X(232), Y(-250));
    g.lineTo(X(232), Y(-340));
    g.lineTo(X(-232), Y(-340));
    g.closePath();
    g.fill();
    // neck with a soft shadow under the jaw
    const hp = headPose(t);
    const shift = Math.sin(rad(hp.yaw)) * 28;
    const neck = g.createLinearGradient(X(-52), 0, X(52), 0);
    neck.addColorStop(0, '#a7785e');
    neck.addColorStop(0.5, '#c4917a');
    neck.addColorStop(1, '#a7785e');
    g.fillStyle = neck;
    g.beginPath();
    g.moveTo(X(-50), Y(-40));
    g.lineTo(X(-56), Y(-160));
    g.quadraticCurveTo(X(0), Y(-176), X(56), Y(-160));
    g.lineTo(X(50), Y(-40));
    g.closePath();
    g.fill();
    // hair, behind the head
    g.save();
    g.translate(X(shift * 0.2), Y(16));
    g.rotate(rad(-hp.roll));
    const hair = g.createLinearGradient(0, -120 * S, 0, 120 * S);
    hair.addColorStop(0, '#2c1d16');
    hair.addColorStop(1, '#130c09');
    g.fillStyle = hair;
    g.beginPath();
    g.ellipse(0, 0, 86 * S, 120 * S, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // ears
    for (const sgn of [-1, 1]) {
      const e = toImg(faceP([sgn * 74, -6, -12], t));
      g.fillStyle = '#b98469';
      g.beginPath();
      g.ellipse(e[0], e[1], 9 * S, 26 * S, 0, 0, Math.PI * 2);
      g.fill();
    }
    // face
    g.save();
    g.translate(X(shift * 0.35), Y(-4));
    g.rotate(rad(-hp.roll));
    g.fillStyle = skin(0, -10 * S, 110 * S, true);
    g.beginPath();
    g.ellipse(0, 0, 74 * S, 104 * S, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // hair parting and the hairline
    const hpt = toImg(faceP([0, 100, 60], t));
    g.strokeStyle = 'rgba(120, 82, 62, .8)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(hpt[0], hpt[1] + 4);
    g.lineTo(hpt[0], hpt[1] - 46);
    g.stroke();
    // features
    const pt = (mm) => toImg(faceP(mm, t));
    for (const sgn of [-1, 1]) {
      const e = pt([sgn * 32, 28, 78]);
      g.fillStyle = '#f3ece6';
      g.beginPath();
      g.ellipse(e[0], e[1], 12 * S, 4.6 * S, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2b1a14';
      g.beginPath();
      g.arc(e[0], e[1], 4.2 * S, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#2b1a14';
      g.lineWidth = 1.6 * S;
      g.beginPath();
      g.ellipse(e[0], e[1] - 0.5 * S, 12.5 * S, 5 * S, 0, Math.PI * 1.05, Math.PI * 1.95);
      g.stroke();
      const b = pt([sgn * 32, 44, 82]);
      g.lineWidth = 3 * S;
      g.beginPath();
      g.moveTo(b[0] - 15 * S, b[1] + 2 * S);
      g.quadraticCurveTo(b[0], b[1] - 4 * S, b[0] + 15 * S, b[1] + 1 * S);
      g.stroke();
    }
    const n = pt([0, -10, 98]);
    g.strokeStyle = 'rgba(140, 92, 70, .7)';
    g.lineWidth = 1.6 * S;
    g.beginPath();
    g.moveTo(n[0] - 9 * S, n[1] + 2 * S);
    g.quadraticCurveTo(n[0], n[1] + 7 * S, n[0] + 9 * S, n[1] + 2 * S);
    g.stroke();
    const l = pt([0, -48, 84]);
    const lip = g.createLinearGradient(0, l[1] - 6 * S, 0, l[1] + 7 * S);
    lip.addColorStop(0, '#8c3a3e');
    lip.addColorStop(1, '#a8464a');
    g.fillStyle = lip;
    g.beginPath();
    g.moveTo(l[0] - 21 * S, l[1]);
    g.quadraticCurveTo(l[0] - 8 * S, l[1] - 8 * S, l[0], l[1] - 4 * S);
    g.quadraticCurveTo(l[0] + 8 * S, l[1] - 8 * S, l[0] + 21 * S, l[1]);
    g.quadraticCurveTo(l[0], l[1] + 10 * S, l[0] - 21 * S, l[1]);
    g.fill();
    // a bindi
    const bi = pt([0, 40, 87]);
    g.fillStyle = '#8e1b24';
    g.beginPath();
    g.arc(bi[0], bi[1], 2.6 * S, 0, Math.PI * 2);
    g.fill();
    if (pose.hand) paintHand();
  }
  function paintHand() {
    const s = pose.hs;
    const X = (mm) => pose.hx + mm * s,
      Y = (mm) => pose.hy - mm * s;
    g.fillStyle = '#b8876b';
    g.beginPath();
    g.roundRect(X(-30), Y(-80), 60 * s, H, 14 * s); // forearm
    g.fill();
    g.fillStyle = skin2(X(0), Y(40), 90 * s);
    g.beginPath();
    g.roundRect(X(-46), Y(14), 92 * s, 100 * s, 18 * s); // back of the hand
    g.fill();
    for (const [x, y, len] of [
      [-36, 0, 64],
      [-12, 4, 76],
      [13, 2, 70],
      [36, -8, 54],
    ]) {
      g.beginPath();
      g.roundRect(X(x - 10), Y(y + len), 20 * s, len * s, 10 * s);
      g.fill();
    }
    g.beginPath();
    g.roundRect(X(-80), Y(-10), 22 * s, 58 * s, 11 * s); // thumb
    g.fill();
  }
  function skin2(x, y, r) {
    const k = g.createRadialGradient(x - r * 0.2, y - r * 0.3, r * 0.1, x, y, r);
    k.addColorStop(0, '#dcae90');
    k.addColorStop(1, '#b8876b');
    return k;
  }
  /** Synthetic tracking result, shaped like the pixel-space landmark arrays the anchors expect. */
  function landmarks(t) {
    const face = [];
    for (const k in FACE_PTS) face[k] = faceP(FACE_PTS[k], t);
    let hand = null;
    if (pose.hand) {
      hand = [];
      for (const k in HAND_PTS) hand[k] = handP(HAND_PTS[k]);
    }
    return { face, hand, handedness: 'Left' };
  }
  return { canvas, pose, paint, landmarks, W, H };
}
