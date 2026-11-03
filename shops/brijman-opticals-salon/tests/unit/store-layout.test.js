// Floor plan: a rectangular salon with false walls on both sides (arched niches on the right, the kids' niche on
// the left), the islands and counter in the middle, the lounge at the front left. Sections, tour and fixtures.
import { describe, expect, it } from 'vitest';
import { NY } from '../../src/core/ny.js';
import '../../src/data/store-layout.js';
import '../../src/data/catalogue.js';

const L = NY.L;
const BODY_R = 0.3; // the walk planner keeps the visitor this far from fixtures (showroom.js)
const IN = { x0: L.x0 + L.wall, x1: L.x1 - L.wall, z0: L.z0, z1: L.z1 }; // the walkable room inside the false walls
const blocked = (x, z, r = BODY_R) =>
  x < L.x0 + r ||
  x > L.x1 - r ||
  z < L.z0 + r ||
  z > L.z1 - r ||
  NY.OBS.some((o) =>
    o.t === 'r' ? x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r : Math.hypot(x - o.x, z - o.z) < o.r + r,
  );

/** The walk planner's grid and a flood fill from the entrance (same cell size and body radius as showroom.js). */
function reach() {
  const cell = 0.2,
    cols = Math.round((L.x1 - L.x0) / cell),
    rows = Math.round((L.z1 - L.z0) / cell);
  const free = (c, r) =>
    c >= 0 && r >= 0 && c < cols && r < rows && !blocked(L.x0 + (c + 0.5) * cell, L.z0 + (r + 0.5) * cell);
  const cellOf = (x, z) => [Math.floor((x - L.x0) / cell), Math.floor((z - L.z0) / cell)];
  const seen = new Set();
  const [c0, r0] = cellOf(NY.START.x, NY.START.z);
  const q = [[c0, r0]];
  seen.add(c0 + ',' + r0);
  while (q.length) {
    const [c, r] = q.pop();
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = c + dc + ',' + (r + dr);
      if (!seen.has(k) && free(c + dc, r + dr)) {
        seen.add(k);
        q.push([c + dc, r + dr]);
      }
    }
  }
  return (x, z) => {
    const [c, r] = cellOf(x, z);
    return seen.has(c + ',' + r);
  };
}

describe('the room', () => {
  it('the visitor starts at the entrance, clear of fixtures', () => {
    expect(NY.zoneAt(NY.START.x, NY.START.z).id).toBe('welcome');
    expect(blocked(NY.START.x, NY.START.z)).toBe(false);
  });
  it('every fixture lies inside the room', () => {
    for (const o of NY.OBS) {
      const pts =
        o.t === 'c'
          ? [[o.x, o.z]]
          : [
              [o.x0, o.z0],
              [o.x1, o.z1],
            ];
      for (const [x, z] of pts) {
        expect(x, o.k).toBeGreaterThanOrEqual(L.x0);
        expect(x, o.k).toBeLessThanOrEqual(L.x1);
        expect(z, o.k).toBeGreaterThanOrEqual(L.z0);
        expect(z, o.k).toBeLessThanOrEqual(L.z1);
      }
    }
  });
  it('the arched niches fit the right wall without touching, and every shelf is in the straight part', () => {
    const N = L.niches;
    const zs = [...N.zs].sort((a, b) => a - b);
    expect(zs).toHaveLength(8);
    for (let i = 1; i < zs.length; i++) expect(zs[i] - zs[i - 1]).toBeGreaterThan(N.w + 0.3);
    expect(zs[0] - N.w / 2).toBeGreaterThan(L.z0 + 0.5);
    expect(zs[7] + N.w / 2).toBeLessThan(L.z1 - 0.5);
    for (const y of L.nicheShelves) {
      expect(y).toBeGreaterThan(N.y0 + N.w / 2);
      expect(y + 0.06).toBeLessThan(N.y1 - N.w / 2);
    }
    expect(N.depth).toBeLessThanOrEqual(L.wall);
  });
  it('the kids niche sits at a child’s eye level, inside the left false wall', () => {
    const K = L.kids;
    expect(K.y1).toBeLessThan(1.8);
    expect(K.shelves[0]).toBeGreaterThan(K.y0);
    expect(K.shelves[K.shelves.length - 1]).toBeLessThan(K.y1 - 0.1);
    expect(K.z - K.w / 2).toBeGreaterThan(L.z0);
  });
  it('the islands leave walkways of at least 1.4 m', () => {
    const A = L.islandA,
      B = L.islandB;
    expect(A.z - A.d / 2 - (B.z + B.d / 2)).toBeGreaterThanOrEqual(1.4); // between the islands
    expect(B.z - B.d / 2 - (L.z0 + L.hutch.d)).toBeGreaterThanOrEqual(1.4); // behind the raised island
    expect(IN.x1 - (L.counter.x + L.counter.w / 2)).toBeGreaterThanOrEqual(1.4); // in front of the niches
  });
});

describe('sections', () => {
  it('have unique ids, names and descriptions', () => {
    const ids = NY.ZONES.map((z) => z.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const z of NY.ZONES) {
      expect(z.name.length).toBeGreaterThan(3);
      expect(z.blurb.length).toBeGreaterThan(30);
    }
  });
  it('cover the whole floor without overlapping', () => {
    for (let x = IN.x0 + 0.07; x < IN.x1; x += 0.25)
      for (let z = IN.z0 + 0.07; z < IN.z1; z += 0.25) {
        const n = NY.ZONES.filter(
          (zn) => x >= zn.rect[0] && x <= zn.rect[2] && z >= zn.rect[1] && z <= zn.rect[3],
        ).length;
        expect(n, `point ${x.toFixed(2)},${z.toFixed(2)}`).toBe(1);
      }
    expect(NY.zoneAt(100, 100)).toBeNull();
  });
  it.each(NY.ZONES.map((z) => [z.id, z]))('%s: the viewpoint is free, in its own section and reachable', (id, z) => {
    const [x, zz] = z.view.p;
    expect(blocked(x, zz), 'viewpoint is inside a fixture').toBe(false);
    expect(NY.zoneAt(x, zz).id).toBe(id);
    expect(reach()(x, zz), 'cannot walk there from the entrance').toBe(true);
  });
  it('every product section holds products', () => {
    for (const id of ['sun', 'women', 'men', 'atelier', 'kids', 'counter'])
      expect(
        NY.PRODUCTS.some((p) => p.zone === id),
        id,
      ).toBe(true);
    for (const p of NY.PRODUCTS) expect(NY.zoneById(p.zone), p.id).toBeTruthy();
  });
});

describe('guided tour', () => {
  it('visits every section once and has text for each stop', () => {
    expect([...NY.TOUR].sort()).toEqual(NY.ZONES.map((z) => z.id).sort());
    for (const id of NY.TOUR) expect((NY.TOUR_TEXT[id] || '').length).toBeGreaterThan(20);
  });
});
