// Try-on placement maths, tested with synthetic landmarks (a canonical face and hand, turned and scaled), so it
// runs without a camera or the MediaPipe models.
import { describe, expect, it } from 'vitest';
import {
  FACE,
  FACE_MM,
  HAND,
  HAND_MM,
  faceFrame,
  faceAnchors,
  handAnchors,
  toPx,
  v,
  OneEuro,
  Swing,
} from '../../src/tryon/anchors.js';

// A canonical face in millimetres: origin between the cheek landmarks, x to the face's left, y up, z out.
const FACE_PTS = {
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
// A right hand held up, back of the hand to the camera, as the camera sees it (unmirrored), in millimetres.
const HAND_PTS = {
  [HAND.wrist]: [0, -88, 0],
  [HAND.indexMcp]: [-36, 0, 0],
  [HAND.middleMcp]: [-12, 4, 0],
  [HAND.ringMcp]: [12, 2, 0],
  [HAND.ringPip]: [15, 46, 0],
  [HAND.pinkyMcp]: [36, -8, 0],
};
const deg = (d) => (d * Math.PI) / 180;
function pose(pts, { yaw = 0, pitch = 0, roll = 0, s = 2, at = [0, 0] } = {}) {
  const out = [];
  for (const k in pts) {
    let [a, b, c] = pts[k];
    [a, c] = [a * Math.cos(deg(yaw)) + c * Math.sin(deg(yaw)), -a * Math.sin(deg(yaw)) + c * Math.cos(deg(yaw))];
    [b, c] = [
      b * Math.cos(deg(pitch)) + c * Math.sin(deg(pitch)),
      -b * Math.sin(deg(pitch)) + c * Math.cos(deg(pitch)),
    ];
    [a, b] = [a * Math.cos(deg(roll)) - b * Math.sin(deg(roll)), a * Math.sin(deg(roll)) + b * Math.cos(deg(roll))];
    out[k] = [at[0] + a * s, at[1] + b * s, c * s];
  }
  return out;
}
const near = (a, b, tol) => expect(v.len(v.sub(a, b))).toBeLessThan(tol);

describe('landmarks to pixels', () => {
  it('puts the image centre at the origin, y up, nearer points at larger z', () => {
    expect(toPx({ x: 0.5, y: 0.5, z: 0 }, 640, 480)).toEqual([0, 0, -0]);
    expect(toPx({ x: 1, y: 0, z: -0.1 }, 640, 480)).toEqual([320, 240, 64]);
  });
});

describe('face frame', () => {
  it('a face looking straight at the camera', () => {
    const F = faceFrame(pose(FACE_PTS));
    near(F.X, [1, 0, 0], 1e-6);
    near(F.Y, [0, 1, 0], 0.02); // the chin sits a little in front of the hairline
    near(F.Z, [0, 0, 1], 0.02);
    expect(F.s).toBeCloseTo(2, 6); // 2 px per mm
    expect(F.yaw).toBeCloseTo(0, 3);
  });
  it.each([
    [25, 0, 0],
    [-30, 0, 0],
    [0, 15, 0],
    [0, 0, 20],
    [20, -10, 12],
  ])('recovers a turn of yaw %s, pitch %s, roll %s', (yaw, pitch, roll) => {
    const F = faceFrame(pose(FACE_PTS, { yaw, pitch, roll }));
    if (!pitch && !roll) expect((F.yaw * 180) / Math.PI).toBeCloseTo(yaw, 0);
    if (!yaw && !pitch) expect((F.roll * 180) / Math.PI).toBeCloseTo(roll, 0);
    // the axes stay orthonormal
    expect(v.dot(F.X, F.Y)).toBeCloseTo(0, 6);
    expect(v.len(F.Z)).toBeCloseTo(1, 6);
    expect(F.s).toBeGreaterThan(1.6); // scale stays close to the truth under turns
    expect(F.s).toBeLessThan(2.05);
  });
  it('scale follows the distance from the camera', () => {
    expect(faceFrame(pose(FACE_PTS, { s: 4 })).s).toBeCloseTo(4, 6);
  });
});

describe('face anchors', () => {
  const A = faceAnchors(pose(FACE_PTS, { at: [10, 40] }));
  it('earlobes sit below and behind the jaw landmarks, one on each side', () => {
    expect(A.lobeR[0]).toBeLessThan(A.lobeL[0]);
    expect(A.lobeR[1]).toBeLessThan(40 + -25 * 2); // below the jaw landmark
    expect(A.lobeR[2]).toBeLessThan(2 * 2); // behind it
    expect(Math.abs(A.lobeR[1] - A.lobeL[1])).toBeLessThan(1e-6);
  });
  it('both earrings show when facing the camera; the far one fades when the head turns', () => {
    expect(A.hideL).toBe(0);
    expect(A.hideR).toBe(0);
    const turned = faceAnchors(pose(FACE_PTS, { yaw: 50 }));
    // turning towards +x shows the right side of the face; the left lobe goes behind the head
    expect(turned.hideL).toBeGreaterThan(0.9);
    expect(turned.hideR).toBe(0);
  });
  it('the tikka hangs from the hairline along the forehead, the nath at the left nostril', () => {
    near(A.tikka.o, [10 + 0, 40 + 95 * 2, 68 * 2 + 1.5 * 2], 4);
    expect(A.tikka.Y[1]).toBeGreaterThan(0.9); // up the forehead
    expect(A.tikka.Y[2]).toBeLessThan(0); // the forehead slopes back
    expect(A.nath[0]).toBeGreaterThan(10); // the face's left side
    expect(A.nath[1]).toBeLessThan(40);
  });
  it('the necklace sits at the base of the neck, under the face, and barely moves when the head turns', () => {
    // a little below the chin (the chin is 95 mm under the cheek line on this face, scale 2 px per mm)
    const chinY = 40 - 95 * 2;
    expect(A.neck.o[1]).toBeLessThan(chinY - 20 * 2);
    expect(A.neck.o[1]).toBeGreaterThan(chinY - 90 * 2);
    expect(Math.abs(A.neck.o[0] - 10)).toBeLessThan(1);
    const turned = faceAnchors(pose(FACE_PTS, { yaw: 30, at: [10, 40] }));
    expect(Math.abs(turned.neck.o[0] - A.neck.o[0])).toBeLessThan(10 * 2); // less than 1 cm sideways
    // and the neck frame only turns part of the way
    expect(Math.abs(Math.atan2(turned.neck.Z[0], turned.neck.Z[2]))).toBeLessThan(deg(30) * 0.6);
  });
});

describe('hand anchors', () => {
  const at = [200, -100];
  const P = pose(HAND_PTS, { s: 2.5, at });
  const H = handAnchors(P, 'Left'); // MediaPipe calls a real right hand "Left" in an unmirrored image
  it('measures the hand from the knuckles', () => {
    expect(H.s).toBeCloseTo(2.5, 1);
  });
  it('the back of the hand faces the camera, so the ring head and the bangle face the camera too', () => {
    expect(H.palmFacing).toBe(false);
    expect(H.ring.up[2]).toBeGreaterThan(0.99);
    expect(H.bangle.up[2]).toBeGreaterThan(0.99);
  });
  it('the ring sits on the ring finger, between the knuckle and the middle joint', () => {
    const a = P[HAND.ringMcp],
      b = P[HAND.ringPip];
    const t = v.dot(v.sub(H.ring.o, a), v.sub(b, a)) / v.dot(v.sub(b, a), v.sub(b, a));
    expect(t).toBeCloseTo(HAND_MM.ringAt, 6);
    expect(H.ring.axis[1]).toBeGreaterThan(0.99); // along the finger
    expect(H.ring.fingerPx / H.s).toBeGreaterThan(15); // a finger is 16-22 mm wide
    expect(H.ring.fingerPx / H.s).toBeLessThan(24);
  });
  it('the bangle sits just above the wrist, along the forearm', () => {
    expect(H.bangle.o[1]).toBeLessThan(P[HAND.wrist][1]);
    expect(H.bangle.axis[1]).toBeLessThan(-0.99); // the forearm runs down from the wrist
  });
  it('a palm shown to the camera is detected', () => {
    // the same picture labelled as the other hand means the palm faces the camera
    expect(handAnchors(P, 'Right').palmFacing).toBe(true);
  });
});

describe('smoothing and swing', () => {
  it('the One Euro filter holds still values steady and follows a move', () => {
    const f = new OneEuro(1.2, 0.04);
    let x = 0;
    for (let i = 0; i < 30; i++) x = f.filter(10 + (i % 2 ? 0.3 : -0.3), 1 / 30);
    expect(Math.abs(x - 10)).toBeLessThan(0.3);
    for (let i = 0; i < 60; i++) x = f.filter(50, 1 / 30);
    expect(x).toBeCloseTo(50, 0);
  });
  it('an earring swings when the head moves, stays within limits and settles', () => {
    const s = new Swing(20);
    s.step(30000, 0, 1 / 30); // a quick sideways move
    expect(Math.abs(s.sway)).toBeGreaterThan(0.01);
    let peak = 0;
    for (let i = 0; i < 300; i++) {
      s.step(0, 0, 1 / 60);
      peak = Math.max(peak, Math.abs(s.sway));
    }
    expect(peak).toBeLessThanOrEqual(0.7);
    expect(Math.abs(s.sway)).toBeLessThan(0.01);
  });
  it('lobe and mesh constants are plausible for an adult face', () => {
    expect(FACE_MM.width).toBeGreaterThan(120);
    expect(FACE_MM.width).toBeLessThan(160);
    expect(HAND_MM.knuckles).toBeGreaterThan(55);
    expect(HAND_MM.knuckles).toBeLessThan(85);
  });
});
