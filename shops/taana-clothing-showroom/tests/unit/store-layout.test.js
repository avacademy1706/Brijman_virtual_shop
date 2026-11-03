// Floor plan, sections, guided tour, fixtures and keep-out areas.
import { describe, expect, it } from 'vitest';
import { NY } from '../../src/core/ny.js';
import '../../src/data/catalogue.js';
import '../../src/data/store-layout.js';

const L = NY.L;
const BODY_R = 0.32; // the walk planner keeps the visitor this far from fixtures (showroom.js)
const inStore = (x, z) => x >= L.x0 && x <= L.x1 && z >= L.z0 && z <= L.z1;
const blockedByFixture = (x, z, r = BODY_R) =>
  NY.OBS.some((o) =>
    o.t === 'r'
      ? x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r
      : (x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + r) ** 2,
  );
const inNoGo = (x, z) => NY.NO_GO.some((o) => x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1);

describe('sections', () => {
  it('have unique ids and names', () => {
    const ids = NY.ZONES.map((z) => z.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const z of NY.ZONES) expect(z.name.length).toBeGreaterThan(2);
  });

  it.each(NY.ZONES.map((z) => [z.id, z]))('%s lies inside the store', (id, z) => {
    const [x0, z0, x1, z1] = z.rect;
    expect(x0).toBeLessThan(x1);
    expect(z0).toBeLessThan(z1);
    expect(inStore(x0, z0) && inStore(x1, z1)).toBe(true);
    expect(inStore(z.view.p[0], z.view.p[1])).toBe(true);
    expect(inStore(z.anchor[0], z.anchor[2])).toBe(true);
  });

  it.each(NY.ZONES.map((z) => [z.id, z]))('%s: the visitor can stand at its viewpoint', (id, z) => {
    const [x, zz] = z.view.p;
    expect(blockedByFixture(x, zz), 'viewpoint is inside a fixture').toBe(false);
    expect(inNoGo(x, zz), 'viewpoint is inside a keep-out area').toBe(false);
  });

  it('do not overlap each other', () => {
    for (const a of NY.ZONES)
      for (const b of NY.ZONES) {
        if (a === b) continue;
        const ix = Math.min(a.rect[2], b.rect[2]) - Math.max(a.rect[0], b.rect[0]);
        const iz = Math.min(a.rect[3], b.rect[3]) - Math.max(a.rect[1], b.rect[1]);
        expect(ix > 0.01 && iz > 0.01, a.id + ' overlaps ' + b.id).toBe(false);
      }
  });

  it('each viewpoint lies in its own section (so the section card and corner button match)', () => {
    for (const z of NY.ZONES) expect((NY.zoneAt(z.view.p[0], z.view.p[1]) || {}).id, z.id).toBe(z.id);
    expect(NY.zoneAt(100, 100)).toBeNull();
  });
});

describe('guided tour', () => {
  it('visits every section exactly once and has text for each stop', () => {
    expect([...NY.TOUR].sort()).toEqual(NY.ZONES.map((z) => z.id).sort());
    for (const id of NY.TOUR) expect((NY.TOUR_TEXT[id] || '').length).toBeGreaterThan(20);
  });
});

describe('fixtures and keep-out areas', () => {
  it('fixtures are inside the store and well formed', () => {
    expect(NY.OBS.length).toBeGreaterThan(20);
    for (const o of NY.OBS) {
      if (o.t === 'r') {
        expect(o.x0).toBeLessThanOrEqual(o.x1);
        expect(o.z0).toBeLessThanOrEqual(o.z1);
        expect(inStore(o.x0, o.z0) && inStore(o.x1, o.z1)).toBe(true);
      } else {
        expect(o.r).toBeGreaterThan(0);
        expect(inStore(o.x, o.z)).toBe(true);
      }
    }
  });

  it('keep-out areas are inside the store and say why they exist', () => {
    expect(NY.NO_GO.length).toBeGreaterThan(5);
    for (const o of NY.NO_GO) {
      expect(o.x0).toBeLessThan(o.x1);
      expect(o.z0).toBeLessThan(o.z1);
      expect(inStore(o.x0, o.z0) && inStore(o.x1, o.z1)).toBe(true);
      expect(o.why.length).toBeGreaterThan(3);
    }
  });

  it('close the spaces behind the counter, the desk and the dress forms', () => {
    const C = L.counter,
      D = L.desk;
    expect(inNoGo(C.x, C.z + C.d / 2 + 0.3)).toBe(true);
    expect(inNoGo(D.x, D.z + D.d / 2 + 0.3)).toBe(true);
    for (const fx of L.chikan.forms) expect(inNoGo(fx, L.chikan.formZ - 0.6)).toBe(true);
  });

  it('leave the front of the counter, the desk and the mirror open', () => {
    const C = L.counter,
      D = L.desk;
    expect(inNoGo(C.x, C.z - C.d / 2 - 0.6)).toBe(false);
    expect(inNoGo(D.x, D.z - D.d / 2 - 0.6)).toBe(false);
    expect(inNoGo(L.mirror.x - 1.2, L.mirror.z)).toBe(false);
  });

  it('keeps the entrance clear', () => {
    expect(blockedByFixture(0, L.z1 - 0.75)).toBe(false);
    expect(inNoGo(0, L.z1 - 0.75)).toBe(false);
  });
});
