// The baked drapes (scripts/bake-drapes.mjs) must match what the browser builds at runtime: the store pairs
// each baked position list with a freshly built garment, particle for particle.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NY } from '../../src/core/ny.js';
import '../../src/data/catalogue.js';
import { displayGarment, hangerProducts, lookGarments, staticLooks, RES } from '../../src/cloth/display.js';

const root = new URL('../../', import.meta.url);
const indexPath = new URL('src/generated/drapes.json', root);
const binPath = new URL('public/drapes/drapes.bin', root);

describe('baked drapes', () => {
  it('exist (npm test bakes them first)', () => {
    expect(existsSync(indexPath)).toBe(true);
    expect(existsSync(binPath)).toBe(true);
  });

  const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : { items: {} };
  const bin = existsSync(binPath) ? readFileSync(binPath) : Buffer.alloc(0);
  const decode = (it) => {
    const q = new Int16Array(bin.buffer, bin.byteOffset + it.o, it.n * 3);
    const out = new Float32Array(it.n * 3);
    for (let i = 0; i < out.length; i += 3)
      for (let k = 0; k < 3; k++) out[i + k] = it.bb[k] + ((q[i + k] + 32768) / 65535) * (it.bb[k + 3] - it.bb[k]);
    return out;
  };

  it('cover every garment shown on a hanger, with the same particle count the store builds', () => {
    for (const p of hangerProducts(NY)) {
      const it = index.items['hanger:' + p.id];
      expect(it, 'hanger:' + p.id).toBeDefined();
      const { g } = displayGarment(NY, p, 0, RES.hanger);
      expect(it.n, p.id).toBe(g.rest.length / 3);
    }
  });

  it('cover every mannequin look, piece by piece', () => {
    for (const look of staticLooks(NY)) {
      const it = index.items['look:' + look.key];
      expect(it, look.key).toBeDefined();
      const pieces = lookGarments(NY, look, RES.look);
      expect(it.pieces.length).toBe(pieces.length);
      pieces.forEach((pc, i) => expect(it.pieces[i].n).toBe(pc.g.rest.length / 3));
    }
    expect(index.items.curtain).toBeDefined();
  });

  it('decode to finite positions inside their bounding boxes', () => {
    let need = 0;
    for (const item of Object.values(index.items))
      for (const it of item.pieces || [item]) {
        need = Math.max(need, it.o + it.n * 6);
        const pos = decode(it);
        for (let i = 0; i < pos.length; i += 3)
          for (let k = 0; k < 3; k++) {
            expect(Number.isFinite(pos[i + k])).toBe(true);
            expect(pos[i + k]).toBeGreaterThanOrEqual(it.bb[k] - 1e-4);
            expect(pos[i + k]).toBeLessThanOrEqual(it.bb[k + 3] + 1e-4);
          }
      }
    expect(bin.length).toBeGreaterThanOrEqual(need);
  });
});
