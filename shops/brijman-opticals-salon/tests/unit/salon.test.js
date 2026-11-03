// The salon builds in Node (no browser needed): every fixture gives the number of display slots the
// merchandising fills, every slot is where its section says, and the interactive spots exist.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { NY } from '../../src/core/ny.js';
import '../../src/data/catalogue.js';
import { Batcher } from '../../src/scene/batch.js';
import { buildSalon, salonMaterials, SALON_BATCH } from '../../src/scene/salon.js';

// textures are drawn on canvases in the browser; here every texture is simply absent
const tex = new Proxy({}, { get: (t, k) => (k === 'posters' ? {} : null) });
const scene = new THREE.Scene();
const M = salonMaterials(tex);
const B = new Batcher(scene, M, SALON_BATCH);
const ctx = { B, M, tex, scene };
const built = buildSalon(ctx);
B.flush();
const S = built.slots;
const L = NY.L;

describe('display slots', () => {
  it('match the merchandising for every fixture', () => {
    expect(S.women.flat()).toHaveLength(NY.MERCH.women.length);
    expect(S.men.flat()).toHaveLength(NY.MERCH.men.length);
    expect(S.sunA).toHaveLength(NY.MERCH.sunA.length);
    expect(S.sunB).toHaveLength(NY.MERCH.sunB.length);
    expect(S.atelier.flat()).toHaveLength(NY.MERCH.atelier.length);
    expect(S.plinths).toHaveLength(NY.MERCH.plinths.length);
    expect(S.kids).toHaveLength(NY.MERCH.kids.length);
    expect(built.contacts.upper.length).toBeGreaterThanOrEqual(NY.MERCH.contacts[0].length);
    expect(built.contacts.lower.length).toBeGreaterThanOrEqual(NY.MERCH.contacts[1].length);
  });
  it('lie in the section they belong to', () => {
    // where a shopper stands to look at the slot: 0.4 m in front of it
    const check = (list, zone) => {
      for (const s of list) {
        const x = s.pos.x + Math.sin(s.ry) * 0.4,
          z = s.pos.z + Math.cos(s.ry) * 0.4;
        expect((NY.zoneAt(x, z) || {}).id, zone + ' at ' + x.toFixed(2) + ',' + z.toFixed(2)).toBe(zone);
      }
    };
    check(S.women.flat(), 'women');
    check(S.men.flat(), 'men');
    check(S.sunA, 'sun');
    check(S.sunB, 'sun');
    check(S.atelier.flat(), 'atelier');
    check(S.plinths, 'atelier');
    check(S.kids, 'kids');
  });
  it('frames on the niche shelves fit inside the niches (temples included)', () => {
    const back = L.x1 - L.wall + L.niches.depth;
    for (const s of S.women.flat().concat(S.men.flat())) {
      expect(s.pos.x + 0.15).toBeLessThan(back); // temples clear of the back of the niche
      expect(s.pos.x).toBeGreaterThan(L.x1 - L.wall); // the frame stands inside the recess
      expect(s.ry).toBeCloseTo(-Math.PI / 2);
    }
    for (const s of S.kids) {
      expect(s.pos.x - 0.15).toBeGreaterThan(L.x0);
      expect(s.pos.x).toBeLessThan(L.x0 + L.wall);
    }
  });
  it('blocks on the island stand clear of the lamp and of each other', () => {
    const pts = S.sunA.map((s) => s.pos);
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++)
        expect(Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z)).toBeGreaterThan(0.25);
    for (const p of pts) expect(p.y).toBeCloseTo(L.islandA.h + 0.045, 3);
  });
});

describe('the built scene', () => {
  it('draws in few batches, with the walls and fixtures solid for the walk ray', () => {
    const batches = scene.children.filter((o) => o.name && o.name.startsWith('batch-'));
    expect(batches.length).toBeGreaterThan(20);
    expect(batches.length).toBeLessThan(60);
    expect(B.solids.length).toBeGreaterThan(10);
    expect(ctx.floor).toBeTruthy();
  });
  it('has the try-on mirror, the directory, the lens samples and checkout as tap targets', () => {
    const acts = B.hitboxes.map((h) => h.userData.action).sort();
    expect(acts).toEqual(['bag', 'directory', 'lensguide', 'tryon']);
  });
  it('has round mirrors for the room reflection', () => {
    expect(built.mirrors.length).toBe(3);
  });
});
