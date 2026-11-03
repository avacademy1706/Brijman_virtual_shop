// Body model, shopper measurements and the collision shapes built from them.
import { describe, expect, it } from 'vitest';
import {
  defaultMeasurements,
  measurementsFromPose,
  restPose,
  frames,
  colliders,
  shoulderTop,
  SEG,
} from '../../src/cloth/body.js';
import { bodyFromMeasurements, heightOf } from '../../src/cloth/measure.js';
import { CGROUP } from '../../src/cloth/sim.js';

const KINDS = ['female', 'male', 'child'];

describe('body model', () => {
  it.each(KINDS)('%s: default proportions are plausible', (kind) => {
    const m = defaultMeasurements(kind);
    const h = heightOf(m);
    expect(h).toBeGreaterThan(kind === 'child' ? 1.0 : 1.5);
    expect(h).toBeLessThan(kind === 'child' ? 1.5 : 1.95);
    for (const k of ['chestA', 'chestB', 'waistA', 'hipA', 'neckR', 'upperArmR']) expect(m[k]).toBeGreaterThan(0);
  });

  it.each(KINDS)('%s: shoulder line is symmetric and slopes down to the shoulder point', (kind) => {
    const m = defaultMeasurements(kind);
    const sx = m.shoulderW / 2;
    let prev = Infinity;
    for (let i = 0; i <= 10; i++) {
      const x = (sx * i) / 10;
      expect(shoulderTop(m, x)).toBeCloseTo(shoulderTop(m, -x), 10);
      expect(shoulderTop(m, x)).toBeLessThanOrEqual(prev + 1e-12);
      prev = shoulderTop(m, x);
    }
  });

  it.each(KINDS)('%s: every collision shape has a group (a shape without one collides with nothing)', (kind) => {
    const m = defaultMeasurements(kind);
    const J = restPose(m, 0.22);
    const C = colliders(J, m, frames(J));
    expect(C.length).toBeGreaterThan(8);
    const all = Object.values(CGROUP).filter((g) => g !== CGROUP.ALL);
    for (const c of C) expect(all).toContain(c.group);
  });

  it('builds a full set of body frames from the joints', () => {
    const m = defaultMeasurements('female');
    const F = frames(restPose(m, 0.22));
    for (const seg of Object.values(SEG)) {
      if (!F[seg]) continue;
      const { x, y, z } = F[seg];
      // orthonormal
      expect(Math.hypot(...x)).toBeCloseTo(1, 5);
      expect(Math.hypot(...y)).toBeCloseTo(1, 5);
      expect(x[0] * y[0] + x[1] * y[1] + x[2] * y[2]).toBeCloseTo(0, 5);
      expect(Math.hypot(...z)).toBeCloseTo(1, 5);
    }
  });

  it('clamps measurements read from a camera pose to human ranges', () => {
    const J = restPose(defaultMeasurements('female'), 0.22);
    const wild = Object.fromEntries(Object.entries(J).map(([k, v]) => [k, v.map((c) => c * 5)]));
    const m = measurementsFromPose(wild, 'female');
    expect(m.shoulderW).toBeLessThanOrEqual(0.5);
    expect(m.torsoLen).toBeLessThanOrEqual(0.65);
    expect(m.upperArm).toBeLessThanOrEqual(0.36);
  });
});

describe('shopper measurements', () => {
  it('returns null when nothing usable is given', () => {
    expect(bodyFromMeasurements('women', null)).toBeNull();
    expect(bodyFromMeasurements('women', {})).toBeNull();
  });

  it('scales the body to the given height', () => {
    for (const cm of [150, 165, 180]) {
      const m = bodyFromMeasurements('women', { height: cm });
      // within 1.5 cm (the 7 cm ankle-to-floor allowance does not scale)
      expect(Math.abs(heightOf(m) - cm / 100)).toBeLessThan(0.015);
    }
  });

  it('uses the given chest, waist and hip girths', () => {
    const girth = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    const m = bodyFromMeasurements('men', { height: 178, chest: 100, waist: 86, hip: 98 });
    expect(girth(m.chestA, m.chestB)).toBeCloseTo(1.0, 2);
    expect(girth(m.waistA, m.waistB)).toBeCloseTo(0.86, 2);
    expect(girth(m.hipA, m.hipB)).toBeCloseTo(0.98, 2);
    expect(m.custom).toBe(true);
  });

  it('ignores impossible values instead of building a broken body', () => {
    const m = bodyFromMeasurements('women', { height: 999, chest: 5 });
    expect(m).not.toBeNull();
    expect(heightOf(m)).toBeGreaterThan(1.4);
    expect(heightOf(m)).toBeLessThan(1.9);
  });
});
