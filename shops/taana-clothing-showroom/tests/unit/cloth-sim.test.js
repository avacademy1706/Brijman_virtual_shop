// The cloth solver: stable, steady at rest whatever the frame rate, and collisions that push fabric out.
import { describe, expect, it } from 'vitest';
import { NY } from '../../src/core/ny.js';
import '../../src/data/catalogue.js';
import { ClothSim, FABRICS, COLL, CGROUP, TUNE, resolvePoint } from '../../src/cloth/sim.js';
import { buildGarment, computeTargets } from '../../src/cloth/garments.js';
import { frames, colliders } from '../../src/cloth/body.js';
import { animatedPose } from '../../src/cloth/poses.js';
import { bodyFor, chestGirth } from '../../src/cloth/display.js';

function garmentOnBody(pid, res = 0.75) {
  const p = NY.byId[pid];
  const m = bodyFor(p.kind);
  const spec = NY.specFor(p, NY.recommendSize(p, chestGirth(m)), 0);
  const g = buildGarment(spec, m, { res, armAngle: 0.22 });
  return { p, m, g };
}

/** Simulate `seconds` of a pose function with the given frame times; returns the sim. */
function run(g, m, fabric, dts, poseAt) {
  const sim = new ClothSim(g, FABRICS[fabric] || FABRICS.cotton);
  sim.maxSpeed = 12;
  const tg = new Float32Array(g.rest.length);
  let t = 0;
  let J = poseAt(0);
  let F = frames(J);
  computeTargets(g, F, tg);
  sim.pos.set(tg);
  sim.prev.set(tg);
  sim.target.set(tg);
  sim.targetPrev.set(tg);
  for (const dt of dts) {
    t += dt;
    J = poseAt(t);
    F = frames(J);
    computeTargets(g, F, tg);
    sim.setTargets(tg);
    sim.colliders = colliders(J, m, F);
    sim.step(dt, 3);
  }
  return sim;
}

describe('ClothSim', () => {
  it('keeps every fabric preset finite and stable during a fast spin', () => {
    const { m, g } = garmentOnBody('k03', 0.6);
    for (const fabric of Object.keys(FABRICS)) {
      const spin = (t) =>
        animatedPose(m, t, { mode: 'still', yaw: t > 0.3 ? Math.min(8, (t - 0.3) * 16) * (t - 0.3) : 0 });
      const sim = run(g, m, fabric, new Array(90).fill(1 / 60), spin);
      expect(sim.broken(), fabric).toBe(false);
      // structural edges stay close to their rest length (no runaway stretching)
      let worst = 0;
      for (let c = 0; c < g.consRest.length; c++) {
        if (g.consType[c] !== 0) continue;
        const a = g.cons[c * 2] * 3,
          b = g.cons[c * 2 + 1] * 3;
        const d = Math.hypot(sim.pos[a] - sim.pos[b], sim.pos[a + 1] - sim.pos[b + 1], sim.pos[a + 2] - sim.pos[b + 2]);
        worst = Math.max(worst, d / g.consRest[c]);
      }
      expect(worst, fabric).toBeLessThan(1.35);
    }
  });

  it('rests in the same shape whatever the frame rate (no shaking on 120 Hz screens)', () => {
    const { p, m, g } = garmentOnBody('k01');
    const still = (t) => animatedPose(m, t, { mode: 'still' });
    const even = run(g, m, p.fabric, new Array(360).fill(1 / 60), still);
    // the same 6 seconds, cut into uneven frames between 1/144 s and 1/30 s
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // the first step fixes the internal step length (ClothSim.fixedH), as the store's settle step does
    const uneven = [1 / 60];
    let total = 1 / 60;
    while (total < 6) {
      const dt = 1 / 144 + rnd() * (1 / 30 - 1 / 144);
      uneven.push(dt);
      total += dt;
    }
    const jittery = run(g, m, p.fabric, uneven, still);
    let diff = 0;
    for (let i = 0; i < even.pos.length; i++) diff = Math.max(diff, Math.abs(even.pos[i] - jittery.pos[i]));
    expect(diff).toBeLessThan(0.003);
    // and once at rest it stays put from frame to frame
    const before = Float32Array.from(jittery.pos);
    const tg = new Float32Array(g.rest.length);
    computeTargets(g, frames(still(6)), tg);
    for (const dt of [1 / 144, 1 / 120, 1 / 60, 1 / 33]) {
      jittery.setTargets(tg);
      jittery.step(dt, 3);
    }
    let move = 0;
    for (let i = 0; i < before.length; i++) move = Math.max(move, Math.abs(before[i] - jittery.pos[i]));
    expect(move).toBeLessThan(0.001);
  });

  it('uses the anti-jelly settings the docs describe', () => {
    expect(TUNE.strainLimit).toBeGreaterThan(0);
    expect(TUNE.strainLimit).toBeLessThan(0.1);
    expect(TUNE.relFriction).toBe(true);
  });
});

describe('collisions', () => {
  const sphere = { type: COLL.SPHERE, group: CGROUP.TORSO, c: [0, 0, 0], r: 0.1 };
  const capsule = { type: COLL.CAPSULE, group: CGROUP.UARM, a: [0, 0, 0], b: [0, -0.3, 0], ra: 0.05, rb: 0.04 };

  it('pushes a point out of a sphere to radius plus margin', () => {
    const p = resolvePoint([0.03, 0.02, 0], [sphere], 0.006);
    expect(Math.hypot(...p)).toBeCloseTo(0.106, 5);
  });

  it('pushes a point out of a tapered capsule', () => {
    const p = resolvePoint([0.01, -0.15, 0], [capsule], 0);
    expect(Math.hypot(p[0], p[2])).toBeCloseTo(0.045, 4);
  });

  it('ignores colliders whose group is not in the mask', () => {
    const p = resolvePoint([0.01, 0.01, 0], [sphere], 0.006, CGROUP.UARM);
    expect(Math.hypot(p[0] - 0.01, p[1] - 0.01, p[2])).toBeLessThan(1e-6);
  });
});
