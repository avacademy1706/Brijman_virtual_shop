// Floor plan: an octagonal rotunda with eight arched rooms (foyer, six salons, bridal lounge), the sections,
// the guided tour, the fixtures and the keep-out areas.
import { describe, expect, it } from 'vitest';
import { NY } from '../../src/core/ny.js';
import '../../src/data/store-layout.js';
import '../../src/data/catalogue.js';

const BODY_R = 0.32; // the walk planner keeps the visitor this far from fixtures (showroom.js)
const distToSeg = (x, z, [ax, az], [bx, bz]) => {
  const dx = bx - ax,
    dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - (ax + t * dx), z - (az + t * dz));
};
const nearPoly = (x, z, pts, r) =>
  NY.inPoly(x, z, pts) || pts.some((p, i) => distToSeg(x, z, p, pts[(i + 1) % pts.length]) < r);
const blockedByFixture = (x, z, r = BODY_R) =>
  NY.OBS.some((o) => (o.t === 'c' ? Math.hypot(x - o.x, z - o.z) < o.r + r : nearPoly(x, z, o.pts, r)));
const inNoGo = (x, z) => NY.NO_GO.some((o) => NY.inPoly(x, z, o.pts));
const inB = (x, z) => x >= NY.BOUNDS.x0 && x <= NY.BOUNDS.x1 && z >= NY.BOUNDS.z0 && z <= NY.BOUNDS.z1;

describe('rooms', () => {
  it('a rotunda and eight rooms, each joined to the rotunda by an arch', () => {
    expect(NY.SIDES).toHaveLength(8);
    expect(NY.ROOMS.filter((r) => r.arch)).toHaveLength(8);
    expect(NY.ROOMS.find((r) => r.id === 'rotunda')).toBeTruthy();
    for (const id of NY.SIDES)
      expect(
        NY.ROOMS.find((r) => r.id === id),
        id,
      ).toBeTruthy();
  });

  it('every room lies inside the bounds', () => {
    for (const r of NY.ROOMS) for (const [x, z] of r.poly) expect(inB(x, z), r.id).toBe(true);
  });

  it('the side frames turn evenly around the rotunda', () => {
    for (let k = 0; k < 8; k++) {
      const f = NY.sideFrame(k);
      const [x, z] = f.toWorld(0, 2);
      expect(Math.hypot(x, z)).toBeGreaterThan(NY.L.A);
      const angle = Math.atan2(x, z);
      const want = (k * Math.PI) / 4;
      const d = Math.atan2(Math.sin(angle - want), Math.cos(angle - want));
      expect(Math.abs(d)).toBeLessThan(1e-6);
    }
  });

  it('the visitor starts inside the foyer, clear of fixtures', () => {
    expect(NY.inside(NY.START.x, NY.START.z)).toBe(true);
    expect(NY.zoneAt(NY.START.x, NY.START.z).id).toBe('foyer');
    expect(blockedByFixture(NY.START.x, NY.START.z)).toBe(false);
  });
});

describe('sections', () => {
  it('have unique ids and names, and every salon has its colours', () => {
    const ids = NY.ZONES.map((z) => z.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const z of NY.ZONES) expect(z.name.length).toBeGreaterThan(2);
    for (const z of NY.ZONES.filter((z) => z.colors))
      for (const k of ['velvet', 'wall', 'accent']) expect(z.colors[k]).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it.each(NY.ZONES.map((z) => [z.id, z]))('%s: the visitor can stand at its viewpoint', (id, z) => {
    const [x, zz] = z.view.p;
    expect(NY.inside(x, zz), 'viewpoint outside the boutique').toBe(true);
    expect(blockedByFixture(x, zz), 'viewpoint is inside a fixture').toBe(false);
    expect(inNoGo(x, zz), 'viewpoint is inside a keep-out area').toBe(false);
  });

  it('each viewpoint lies in its own section (so the section card and the zone button match)', () => {
    for (const z of NY.ZONES) expect((NY.zoneAt(z.view.p[0], z.view.p[1]) || {}).id, z.id).toBe(z.id);
    expect(NY.zoneAt(100, 100)).toBeNull();
  });

  it('every salon holds products, and every product is in a salon', () => {
    for (const id of ['everyday', 'temple', 'polki', 'solitaire', 'diamond', 'gems'])
      expect(
        NY.PRODUCTS.some((p) => p.zone === id),
        id,
      ).toBe(true);
  });
});

describe('guided tour', () => {
  it('visits every section exactly once and has text for each stop', () => {
    expect([...NY.TOUR].sort()).toEqual(NY.ZONES.map((z) => z.id).sort());
    for (const id of NY.TOUR) expect((NY.TOUR_TEXT[id] || '').length).toBeGreaterThan(20);
  });
});

describe('fixtures and keep-out areas', () => {
  it('fixtures are inside the boutique', () => {
    for (const o of NY.OBS) {
      const pts = o.t === 'c' ? [[o.x, o.z]] : o.pts;
      for (const [x, z] of pts) expect(inB(x, z), o.k).toBe(true);
    }
  });

  it('every salon has a counter, two side cases and stools; the walk planner knows them', () => {
    const kinds = NY.OBS.map((o) => o.k);
    expect(kinds.filter((k) => k === 'counter')).toHaveLength(6);
    expect(kinds.filter((k) => k === 'case').length).toBeGreaterThanOrEqual(12);
    expect(kinds).toContain('plinth');
    expect(kinds.filter((k) => k === 'pillar')).toHaveLength(4);
  });

  it('keeps visitors out from behind every counter', () => {
    for (const id of ['everyday', 'temple', 'polki', 'solitaire', 'diamond', 'gems']) {
      const k = NY.sideOf(id);
      const [x, z] = NY.sideFrame(k).toWorld(0, NY.L.WT + NY.L.salon.D - 0.1);
      expect(inNoGo(x, z), 'behind the ' + id + ' counter').toBe(true);
    }
  });

  it('there is a clear walkway from the foyer into every room', () => {
    for (let k = 0; k < 8; k++) {
      const f = NY.sideFrame(k);
      // the arch centre line, from the rotunda to the middle of the room
      for (let v = -0.6; v <= 1.4; v += 0.2) {
        const [x, z] = f.toWorld(0, v);
        expect(NY.inside(x, z), NY.SIDES[k] + ' v=' + v.toFixed(1)).toBe(true);
      }
    }
  });
});
