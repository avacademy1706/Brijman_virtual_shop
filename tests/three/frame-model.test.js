// The shared frame model: true size from millimetres, named parts and hinges.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { frameGeometry, archForSize, buildArch } from '../../src/three/frame-model.js';
import { frontWidthMm } from '../../shared/frame-archetypes.js';
import { BM } from '../../src/core/bm.js';

const frames = JSON.parse(readFileSync(new URL('../../data/catalogue.json', import.meta.url), 'utf8')).products.filter(
  (p) => p.type === 'frame',
);

describe('frame model at real sizes', () => {
  it('outer width is 2 × lens + bridge + endpieces within ±0.5 mm, for every frame and size', () => {
    for (const p of frames)
      for (const s of p.sizes) {
        const mm = frameGeometry(p, s.id).outerWidth * 1000;
        expect(Math.abs(mm - frontWidthMm(p, s)), p.id + ' ' + s.id).toBeLessThanOrEqual(0.5);
      }
  });
  it('grows by 2 mm per lens millimetre and 1 mm per bridge millimetre', () => {
    const p = frames.find((x) => x.id === 'm01');
    const w = (id) => frameGeometry(p, id).outerWidth * 1000;
    const S = p.sizes[0],
      L = p.sizes[2];
    expect(w('L') - w('S')).toBeCloseTo(2 * (L.lens - S.lens) + (L.bridge - S.bridge), 0);
  });
  it('uses the real temple length', () => {
    const p = frames.find((x) => x.id === 'm01');
    const reach = (id) => {
      const g = frameGeometry(p, id).temples.acetate || frameGeometry(p, id).temples.metal;
      return -g.boundingBox.min.z;
    };
    expect(reach('L') / reach('S')).toBeCloseTo(150 / 140, 1);
  });
  it('splits the front, temples and lenses, and reports both hinges', () => {
    const G = frameGeometry(frames.find((x) => x.id === 'm03'));
    expect(G.front.metal).toBeTruthy();
    expect(G.temples.metal).toBeTruthy();
    expect(G.lens).toBeTruthy();
    expect(G.hinges).toHaveLength(2);
    expect(G.hinges[0].x).toBeCloseTo(-G.hinges[1].x, 6);
  });
  it('resizes lens height with lens width and keeps the bridge real', () => {
    const a = archForSize('rectA', { lens: 55, bridge: 20, temple: 145 });
    expect(a.A).toBeCloseTo(0.055, 6);
    expect(a.B / a.A).toBeCloseTo(BM.ARCH.rectA.B / BM.ARCH.rectA.A, 6);
    expect(a.dbl).toBeCloseTo(0.02, 6);
  });
  it('builds the shelf geometry exactly as before when no temple length is given', () => {
    const G = buildArch(BM.ARCH.rectA);
    expect(G.front).toBeUndefined();
    expect(G.acetate.attributes.position.count).toBeGreaterThan(1000);
  });
});

describe('low-detail shelf geometry', () => {
  it('uses about 40 % of the triangles of the full build, for every archetype', () => {
    const tris = (G) =>
      ['acetate', 'metal', 'lens'].reduce((n, k) => n + (G[k] ? G[k].attributes.position.count / 3 : 0), 0);
    for (const id of Object.keys(BM.ARCH)) {
      const ratio = tris(buildArch(BM.ARCH[id], { detail: 'low' })) / tris(buildArch(BM.ARCH[id]));
      expect(ratio, id).toBeGreaterThan(0.25);
      expect(ratio, id).toBeLessThan(0.55);
    }
  });
});
