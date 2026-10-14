// Builds synthetic MediaPipe landmark sets from the canonical face model, at a known real size and pose.
// No real faces are used anywhere in the tests.
import { canonical, CANONICAL_FACE } from '../../shared/canonical-face.js';
import { CANONICAL_FACE_WIDTH, IRIS_DIAMETER_MM, LM, quatToMat, mulMV } from '../../src/tryon/face-math.js';

const rad = (d) => (d * Math.PI) / 180;

/** Quaternion [x, y, z, w] from yaw (about Y), pitch (about X) and roll (about Z), in degrees, applied Z·X·Y. */
export function eulerQuat(yawDeg = 0, pitchDeg = 0, rollDeg = 0) {
  const qy = [0, Math.sin(rad(yawDeg) / 2), 0, Math.cos(rad(yawDeg) / 2)];
  const qx = [Math.sin(rad(pitchDeg) / 2), 0, 0, Math.cos(rad(pitchDeg) / 2)];
  const qz = [0, 0, Math.sin(rad(rollDeg) / 2), Math.cos(rad(rollDeg) / 2)];
  return qmul(qz, qmul(qx, qy));
}
function qmul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

/**
 * @param {{widthMm?: number, pxPerMm?: number, yaw?: number, pitch?: number, roll?: number, W?: number, H?: number,
 *   cx?: number, cy?: number, noise?: number, seed?: number}} o
 * @returns {{landmarks: Array<{x: number, y: number, z: number}>, q: number[], pxPerMm: number, W: number, H: number}}
 */
export function syntheticFace(o = {}) {
  const widthMm = o.widthMm ?? 140,
    pxPerMm = o.pxPerMm ?? 3,
    W = o.W ?? 1280,
    H = o.H ?? 720;
  const cx = o.cx ?? W / 2,
    cy = o.cy ?? H / 2;
  const q = eulerQuat(o.yaw, o.pitch, o.roll);
  const R = quatToMat(q);
  const mmPerCm = widthMm / CANONICAL_FACE_WIDTH; // real mm per canonical cm for this face
  let seed = o.seed ?? 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
  const toPx = (cmPoint) => {
    const mm = cmPoint.map((v) => v * mmPerCm);
    const r = mulMV(R, mm);
    const n = o.noise ? () => rnd() * o.noise : () => 0;
    // World: X right, Y up, Z towards the camera. Pixels = mm × pxPerMm.
    return [cx + r[0] * pxPerMm + n(), H - cy + r[1] * pxPerMm + n(), r[2] * pxPerMm + n()];
  };
  const world = [];
  for (let i = 0; i < CANONICAL_FACE.length / 3; i++) world.push(toPx(canonical(i)));
  // Irises: a ring of the average iris size around each eye centre (centre, +x, +y, −x, −y in face space).
  const rIris = IRIS_DIAMETER_MM / 2 / mmPerCm; // canonical cm
  for (const [outer, inner] of [
    [LM.eyeOuterR, LM.eyeInnerR],
    [LM.eyeInnerL, LM.eyeOuterL],
  ]) {
    const a = canonical(outer),
      b = canonical(inner);
    const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 + 0.4];
    world.push(toPx(c));
    world.push(toPx([c[0] + rIris, c[1], c[2]]));
    world.push(toPx([c[0], c[1] + rIris, c[2]]));
    world.push(toPx([c[0] - rIris, c[1], c[2]]));
    world.push(toPx([c[0], c[1] - rIris, c[2]]));
  }
  const landmarks = world.map(([X, Y, Z]) => ({ x: X / W, y: 1 - Y / H, z: -Z / W }));
  return { landmarks, q, pxPerMm, W, H };
}
