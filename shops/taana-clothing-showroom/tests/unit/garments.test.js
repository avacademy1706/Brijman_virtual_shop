// Garment patterns: every product builds a valid cloth mesh, the shoulders are closed, and a settled garment
// never ends up inside the mannequin.
import { describe, expect, it } from 'vitest';
import { NY } from '../../src/core/ny.js';
import '../../src/data/catalogue.js';
import { buildGarment, computeTargets, templateFor } from '../../src/cloth/garments.js';
import { frames, restPose, colliders, SEG, vec } from '../../src/cloth/body.js';
import { resolvePoint } from '../../src/cloth/sim.js';
import { bodyFor, chestGirth, settleOnBody } from '../../src/cloth/display.js';

const { add, sub, cross, dot } = vec;
const garments = NY.PRODUCTS.filter((p) => p.type !== 'dupatta');
const RES = [0.55, 0.85]; // phone and desktop resolutions

function build(p, si, res, ci = 0) {
  const m = bodyFor(p.kind);
  const spec = NY.specFor(p, si ?? NY.recommendSize(p, chestGirth(m)), ci);
  return { spec, m, g: buildGarment(spec, m, { res, armAngle: 0.22 }) };
}

/** Does the ray o + t*d (t > 0) hit any render triangle? */
function rayHits(g, pos, o, d) {
  const { index, map } = g.render;
  const P = (v) => [pos[map[v] * 3], pos[map[v] * 3 + 1], pos[map[v] * 3 + 2]];
  for (let i = 0; i < index.length; i += 3) {
    const a = P(index[i]),
      b = P(index[i + 1]),
      c = P(index[i + 2]);
    const e1 = sub(b, a),
      e2 = sub(c, a),
      p = cross(d, e2),
      det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(o, a),
      u = dot(s, p) / det;
    if (u < 0 || u > 1) continue;
    const q = cross(s, e1),
      v = dot(d, q) / det;
    if (v < 0 || u + v > 1) continue;
    if (dot(e2, q) / det > 0) return true;
  }
  return false;
}

describe('cloth meshes', () => {
  const cases = [];
  for (const p of NY.PRODUCTS)
    for (const res of RES) for (const si of [0, NY.sizesOf(p).length - 1]) cases.push([p.id, res, si, p]);

  it.each(cases)('%s at resolution %s, size %s builds a valid mesh', (id, res, si, p) => {
    const { g } = build(p, si, res);
    const n = g.rest.length / 3;
    expect(n).toBeGreaterThan(100);
    for (const v of g.rest) expect(Number.isFinite(v)).toBe(true);
    // constraints join two different particles at a positive rest length
    for (let c = 0; c < g.consRest.length; c++) {
      const a = g.cons[c * 2],
        b = g.cons[c * 2 + 1];
      expect(a).toBeLessThan(n);
      expect(b).toBeLessThan(n);
      expect(a).not.toBe(b);
      expect(g.consRest[c]).toBeGreaterThan(1e-4);
    }
    // render mesh points at real particles
    const rv = g.render.map.length;
    for (const v of g.render.index) expect(v).toBeLessThan(rv);
    for (const i of g.render.map) expect(i).toBeLessThan(n);
    expect(g.render.uv.length).toBe(rv * 2);
    // something holds the garment up
    expect(g.pinned.reduce((a, b) => a + b, 0)).toBeGreaterThan(3);
  });
});

describe('shoulder seams', () => {
  // A ray straight down onto the top of each shoulder, between the neckline and the shoulder point, must hit
  // fabric. An open seam here shows the mannequin through the garment ("torn at the shoulders").
  it.each(garments.map((p) => [p.id, p]))('%s covers the top of both shoulders', (id, p) => {
    for (const res of RES) {
      const { g, m, spec } = build(p, null, res);
      const J = restPose(m, 0.22),
        F = frames(J),
        T = F[SEG.TORSO];
      const pos = new Float32Array(g.rest.length);
      computeTargets(g, F, pos);
      const xn = templateFor(spec, m).neck.half + 0.02,
        sx = m.shoulderW / 2 - 0.01;
      for (const side of [1, -1])
        for (let k = 0; k <= 4; k++) {
          const x = side * (xn + ((sx - xn) * k) / 4);
          const o = add(T.o, add([T.x[0] * x, T.x[1] * x, T.x[2] * x], [T.y[0] * 0.4, T.y[1] * 0.4, T.y[2] * 0.4]));
          const down = [-T.y[0], -T.y[1], -T.y[2]];
          expect(rayHits(g, pos, o, down), `res ${res}, x ${x.toFixed(3)}`).toBe(true);
        }
    }
  });
});

describe('settled garments stay outside the body', () => {
  // one of each template, women, men and kids
  const pick = ['kurta', 'anarkali', 'dress', 'tee', 'shirt', 'vest'].map((t) =>
    garments.find((p) => p.template === t),
  );
  const kids = garments.find((p) => p.kind === 'kids');
  it.each([...pick, kids].filter(Boolean).map((p) => [p.id, p]))('%s', (id, p) => {
    const m = bodyFor(p.kind);
    const spec = NY.specFor(p, NY.recommendSize(p, chestGirth(m)), 0);
    const g = buildGarment(spec, m, { res: 0.85, armAngle: 0.22 });
    const { positions, J } = settleOnBody([{ g, fabric: p.fabric, layer: 0 }], m, { mode: 'still', seconds: 1.5 });
    const C = colliders(J, m, frames(J));
    const pos = positions[0];
    let worst = 0;
    for (let i = 0; i < g.cmask.length; i++) {
      const q = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
      const r = resolvePoint(q, C, 0, g.cmask[i], 1);
      worst = Math.max(worst, Math.hypot(r[0] - q[0], r[1] - q[1], r[2] - q[2]));
    }
    // deepest point inside a body part it should collide with, in metres
    expect(worst).toBeLessThan(0.004);
  });
});
