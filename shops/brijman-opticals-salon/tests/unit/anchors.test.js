// Glasses placement and face measurement on synthetic faces (the same face the simulator paints), at different
// distances, head turns and face sizes.
import { describe, expect, it } from 'vitest';
import {
  faceAnchors,
  faceFrame,
  glassesPose,
  canMeasure,
  Calibrator,
  FACE,
  FACE_MM,
  OneEuro,
  v,
} from '../../src/tryon/anchors.js';
import { facePoints, rot } from '../../tools/sim-face.js';

/** Landmarks in pixel space for a face of a given size, pose and distance (s = px per mm). */
function landmarks({ temples = 138, pd = 63, yaw = 0, pitch = 0, roll = 0, s = 2.4, cx = 30, cy = -40 } = {}) {
  const pts = facePoints({ temples, pd });
  const P = [];
  for (const k in pts) {
    const q = rot(pts[k], yaw, pitch, roll);
    P[k] = [cx + q[0] * s, cy + q[1] * s, q[2] * s];
  }
  return P;
}
const measure = (o, frames = 40) => {
  const cal = new Calibrator();
  let s = 0;
  for (let i = 0; i < frames; i++) {
    const a = faceAnchors(landmarks(o));
    s = cal.update(a.F, a.px);
  }
  return { cal, s };
};

describe('face frame', () => {
  it('axes point to the face’s left, up and out of the face', () => {
    const F = faceFrame(landmarks());
    expect(F.X[0]).toBeGreaterThan(0.99);
    expect(F.Y[1]).toBeGreaterThan(0.99);
    expect(F.Z[2]).toBeGreaterThan(0.99);
    expect(Math.abs(v.dot(F.X, F.Y))).toBeLessThan(1e-9);
  });
  it('follows a turned head', () => {
    const F = faceFrame(landmarks({ yaw: 30 }));
    expect(F.yaw).toBeCloseTo((30 * Math.PI) / 180, 2);
  });
});

describe('measuring the face', () => {
  it.each([
    [138, 63, 2.4],
    [128, 58, 1.6],
    [146, 68, 3.2],
  ])('face %i mm, PD %i mm at %f px/mm', (temples, pd, s) => {
    const r = measure({ temples, pd, s });
    expect(r.cal.ready).toBe(true);
    expect(r.cal.face).toBeCloseTo(temples, 0);
    expect(r.cal.pd).toBeCloseTo(pd, 0);
    expect(r.s).toBeCloseTo(s, 2);
  });
  it('only measures while the shopper faces the camera', () => {
    const a = faceAnchors(landmarks({ yaw: 35 }));
    expect(canMeasure(a.F, a.px)).toBe(false);
    const b = faceAnchors(landmarks({ pitch: 25 }));
    expect(canMeasure(b.F, b.px)).toBe(false);
    const c = faceAnchors(landmarks());
    expect(canMeasure(c.F, c.px)).toBe(true);
  });
  it('keeps the calibrated scale when the head turns', () => {
    const cal = new Calibrator();
    for (let i = 0; i < 30; i++) {
      const a = faceAnchors(landmarks({ s: 2 }));
      cal.update(a.F, a.px);
    }
    const t = faceAnchors(landmarks({ s: 2, yaw: 40 }));
    // the cheek width shrinks on screen when the head turns; the 3D landmarks keep it, so the scale holds
    expect(cal.update(t.F, t.px)).toBeCloseTo(2, 1);
  });
});

describe('where the glasses sit', () => {
  it.each([0, 25, -30])('in front of the eyes, between the pupils, at yaw %i°', (yaw) => {
    const P = landmarks({ yaw, s: 2.4 });
    const F = faceFrame(P);
    const g = glassesPose(P, F, 2.4);
    const mid = v.lerp(P[FACE.rightPupil], P[FACE.leftPupil], 0.5);
    const d = v.sub(g.o, mid);
    // depth: the vertex distance in front of the eyes
    expect(v.dot(d, F.Z) / 2.4).toBeCloseTo(FACE_MM.vertex, 0);
    // height: a little above the pupils; sideways: centred
    expect(v.dot(d, F.Y) / 2.4).toBeCloseTo(FACE_MM.lift, 1);
    expect(Math.abs(v.dot(d, F.X))).toBeLessThan(1e-6);
    // the lenses never sit inside the bridge of the nose
    expect(v.dot(v.sub(g.o, P[FACE.bridge]), F.Z)).toBeGreaterThan(-1e-6);
  });
});

describe('smoothing', () => {
  it('a One Euro filter settles on a steady value', () => {
    const f = new OneEuro(1.2, 0.03);
    let x = 0;
    for (let i = 0; i < 120; i++) x = f.filter(10 + (i % 2 ? 0.2 : -0.2), 1 / 30);
    expect(x).toBeCloseTo(10, 0);
  });
});
