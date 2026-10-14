// True size on the face, pose recovery, calibration and the head occluder, proved with synthetic faces.
import { describe, it, expect } from 'vitest';

import {
  toWorld,
  faceWidthMmFrom,
  irisDiameterPx,
  faceScale,
  procrustes,
  quatToMat,
  mulMV,
  yawPitch,
  goodForCalibration,
  FaceWidthCalibrator,
  CANONICAL_FACE_WIDTH,
  RIGID,
  LM,
  framePlacement,
  noseSurfaceZ,
  occluderEllipsoid,
  occludedBy,
  FIT,
} from '../../src/tryon/face-math.js';
import { canonical } from '../../shared/canonical-face.js';
import { syntheticFace } from '../helpers/synthetic-face.js';

const fit = (o) => {
  const f = syntheticFace(o);
  const Q = toWorld(f.landmarks, f.W, f.H);
  const pose = procrustes(
    RIGID.map(canonical),
    RIGID.map((i) => Q[i]),
  );
  return { f, Q, pose };
};
const angle = (q1, q2) => 2 * Math.acos(Math.min(1, Math.abs(q1.reduce((a, v, i) => a + v * q2[i], 0))));

describe('canonical face', () => {
  it('is in centimetres: about 15 cm between the temple landmarks', () => {
    expect(CANONICAL_FACE_WIDTH).toBeCloseTo(15.33, 1);
    expect(canonical(LM.noseTip)[2]).toBeGreaterThan(canonical(LM.noseBridge)[2]);
  });
});

describe('face width from the iris', () => {
  it.each([118, 128, 140, 152])('measures a %i mm face within 0.5 %', (w) => {
    const { Q } = fit({ widthMm: w });
    expect(Math.abs(faceWidthMmFrom(Q) - w) / w).toBeLessThan(0.005);
  });
  it('is independent of distance (pixels per mm) and head turn', () => {
    for (const pxPerMm of [1.5, 3, 6])
      for (const yaw of [-30, 0, 25]) {
        const { Q } = fit({ widthMm: 136, pxPerMm, yaw, pitch: 8 });
        expect(faceWidthMmFrom(Q)).toBeCloseTo(136, 0);
      }
  });
  it('reads the iris diameter in pixels', () => {
    const { Q } = fit({ widthMm: 140, pxPerMm: 4 });
    expect(irisDiameterPx(Q)).toBeCloseTo(11.7 * 4, 1);
  });
});

describe('true size', () => {
  it('a 128 mm frame on a 140 mm face has a frame-to-face ratio of 0.914 ± 0.01', () => {
    const { Q, pose } = fit({ widthMm: 140, pxPerMm: 3.2, yaw: 12 });
    const fs = faceScale(faceWidthMmFrom(Q)); // canonical units per real mm
    const frameCanonical = 128 * fs;
    // On screen both are scaled by the same pose scale s, so the ratio is frame / face in canonical units.
    const framePx = frameCanonical * pose.s;
    const facePx = CANONICAL_FACE_WIDTH * pose.s;
    expect(framePx / facePx).toBeGreaterThan(0.904);
    expect(framePx / facePx).toBeLessThan(0.924);
  });
  it('renders the frame at its real size in pixels, within 1 %', () => {
    for (const w of [120, 140, 160]) {
      const { f, Q, pose } = fit({ widthMm: w, pxPerMm: 2.7, yaw: -20, roll: 6 });
      const framePx = 130 * faceScale(faceWidthMmFrom(Q)) * pose.s;
      expect(Math.abs(framePx - 130 * f.pxPerMm) / (130 * f.pxPerMm)).toBeLessThan(0.01);
    }
  });
});

describe('pose fit', () => {
  it('recovers yaw, pitch and roll within 0.5°', () => {
    for (const [yaw, pitch, roll] of [
      [0, 0, 0],
      [35, 0, 0],
      [-35, 10, 0],
      [20, -12, 15],
    ]) {
      const { f, pose } = fit({ yaw, pitch, roll });
      expect((angle(pose.q, f.q) * 180) / Math.PI).toBeLessThan(0.5);
    }
  });
  it('places the nose bridge on the tracked landmark', () => {
    const { Q, pose } = fit({ yaw: 25, pitch: 5, cx: 500, cy: 300 });
    const p = mulMV(pose.R, canonical(LM.noseBridge)).map((v, i) => pose.s * v + pose.t[i]);
    expect(Math.hypot(p[0] - Q[LM.noseBridge][0], p[1] - Q[LM.noseBridge][1])).toBeLessThan(0.5);
  });
  it('stays accurate with landmark noise', () => {
    const { f, pose } = fit({ yaw: 15, noise: 1.5, seed: 3 });
    expect((angle(pose.q, f.q) * 180) / Math.PI).toBeLessThan(2);
  });
  it('reports yaw and pitch, and accepts only frontal, open-eyed frames for calibration', () => {
    const a = fit({ yaw: 30 });
    expect(yawPitch(quatToMat(a.pose.q)).yaw).toBeCloseTo(30, 0);
    expect(goodForCalibration(a.Q, a.pose.R)).toBe(false);
    const b = fit({ yaw: 5, pitch: -5 });
    expect(goodForCalibration(b.Q, b.pose.R)).toBe(true);
  });
});

describe('calibration', () => {
  it('takes the median of the first 30 good frames, ignoring outliers', () => {
    const c = new FaceWidthCalibrator();
    let good = 0;
    for (let i = 0; good < 29; i++) {
      if (i % 5 === 0)
        c.add(300, 1 / 30); // outlier: ignored
      else {
        c.add(138 + (good % 3), 1 / 30);
        good++;
      }
    }
    expect(c.calibrated).toBe(false);
    c.add(139, 1 / 30);
    expect(c.calibrated).toBe(true);
    expect(c.estimate).toBe(139);
  });
  it('then follows slowly (about 5 s time constant)', () => {
    const c = new FaceWidthCalibrator({ count: 1 });
    c.add(140, 0);
    for (let i = 0; i < 150; i++) c.add(130, 1 / 30); // 5 s of a new value
    expect(c.estimate).toBeGreaterThan(130 + 10 * 0.3);
    expect(c.estimate).toBeLessThan(130 + 10 * 0.42);
  });
});

describe('placement', () => {
  const fs = faceScale(140);
  const pl = framePlacement({ faceScale: fs, bridgeYmm: 5 });
  it('puts the lenses about 12 mm in front of the cornea, clear of the nose, tilted 9°', () => {
    const lidZ = canonical(LM.lidUpR)[2];
    expect(pl.position[2] - lidZ).toBeGreaterThanOrEqual((FIT.vertexDistanceMm + FIT.corneaAheadOfLidMm) * fs - 1e-9);
    expect(pl.position[2]).toBeGreaterThan(noseSurfaceZ(pl.position[1] + 5 * fs));
    expect(pl.tiltDeg).toBeGreaterThanOrEqual(8);
    expect(pl.tiltDeg).toBeLessThanOrEqual(10);
  });
  it('lines the lens centres up just below the pupils, and the nudge is limited to ±3 mm', () => {
    const pupilY = (canonical(LM.eyeOuterR)[1] + canonical(LM.eyeInnerR)[1]) / 2;
    expect((pupilY - pl.position[1]) / fs).toBeCloseTo(FIT.pupilAboveLensCentreMm, 1);
    const up = framePlacement({ faceScale: fs, bridgeYmm: 5, nudgeMm: 9 });
    expect((up.position[1] - pl.position[1]) / fs).toBeCloseTo(3, 5);
  });
});

describe('head occluder', () => {
  const fs = faceScale(140);
  const frontZ = 5.5;
  const e = occluderEllipsoid({
    faceScale: fs,
    faceWidthMm: 140,
    templeXmm: 70,
    hingeBackMm: 4,
    frontZ,
    centreY: 1.5,
  });
  const ray = (yawDeg) => [Math.sin((yawDeg * Math.PI) / 180), 0, Math.cos((yawDeg * Math.PI) / 180)];
  const mm = (x, y, z) => [x * fs, 1.5 + y * fs, frontZ + z * fs];
  it('is at least as wide as the face and about 1.25 times deeper than wide', () => {
    expect(e.radii[0]).toBeGreaterThanOrEqual(70 * fs - 1e-9);
    expect(e.radii[2] / e.radii[0]).toBeCloseTo(1.25, 5);
  });
  it('never hides the rims, lenses or bridge for head turns up to ±35°', () => {
    for (let yaw = -35; yaw <= 35; yaw += 5)
      for (let x = -66; x <= 66; x += 6)
        for (const y of [-18, 0, 18]) expect(occludedBy(e, mm(x, y, -2), ray(yaw))).toBe(false);
  });
  it('hides the temples from about 30 mm behind the hinges', () => {
    for (const side of [-1, 1]) {
      expect(occludedBy(e, mm(side * 70, 0, -4 - 15), ray(0))).toBe(false);
      expect(occludedBy(e, mm(side * 70, 0, -4 - 40), ray(0))).toBe(true);
      expect(occludedBy(e, mm(side * 71, -10, -4 - 90), ray(side * 30))).toBe(true);
    }
  });
});
