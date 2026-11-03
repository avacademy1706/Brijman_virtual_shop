// Catalogue, merchandising, frame sizes and pricing.
import { describe, expect, it } from 'vitest';
import { NY } from '../../src/core/ny.js';
import '../../src/data/store-layout.js';
import '../../src/data/catalogue.js';

const frames = NY.PRODUCTS.filter((p) => p.type === 'frame');

describe('products', () => {
  it('have unique ids and complete data', () => {
    const ids = NY.PRODUCTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(frames.length).toBe(41);
    for (const p of frames) {
      expect(NY.ARCH[p.arch], p.id).toBeTruthy();
      expect(p.size).toHaveLength(3);
      expect(p.price).toBeGreaterThan(0);
      expect(p.colors.length, p.id).toBeGreaterThan(0);
      for (const c of p.colors) expect(c.sw, p.id).toMatch(/^#[0-9a-f]{6}$/i);
      if (p.sun) for (const c of p.colors) expect(c.l, p.id + ' lens').toBeTruthy();
    }
  });
});

describe('merchandising', () => {
  const placed = new Set();
  for (const k of ['women', 'men', 'sunA', 'sunB', 'atelier', 'plinths', 'kids'])
    for (const [pid, ci] of NY.MERCH[k]) placed.add(pid + '|' + ci);
  it('every frame in every colour is on display somewhere', () => {
    const missing = [];
    for (const p of frames)
      for (let ci = 0; ci < p.colors.length; ci++)
        if (!placed.has(p.id + '|' + ci)) missing.push(p.id + ' colour ' + ci);
    expect(missing).toEqual([]);
  });
  it('fills each fixture exactly', () => {
    const L = NY.L;
    expect(NY.MERCH.women).toHaveLength(4 * L.nicheShelves.length);
    expect(NY.MERCH.men).toHaveLength(4 * L.nicheShelves.length);
    expect(NY.MERCH.atelier).toHaveLength(L.hutch.shelves.length * L.hutch.slots);
    expect(NY.MERCH.kids).toHaveLength(L.kids.shelves.length * L.kids.slots);
    expect(NY.MERCH.plinths).toHaveLength(6);
  });
  it('puts each style in its own section', () => {
    const where = { women: 'women', men: 'men', kids: 'kids' };
    for (const [k, zone] of Object.entries(where))
      for (const [pid] of NY.MERCH[k]) expect(NY.byId[pid].zone, pid).toBe(zone);
    for (const [pid] of NY.MERCH.sunA) expect(NY.byId[pid].sun, pid).toBe(true);
    for (const [pid] of NY.MERCH.atelier) expect(NY.byId[pid].zone, pid).toBe('atelier');
  });
  it('shows every contact lens and care product on the counter', () => {
    const shown = NY.MERCH.contacts.flat();
    for (const p of NY.PRODUCTS.filter((p) => p.type !== 'frame')) expect(shown, p.id).toContain(p.id);
  });
});

describe('frame sizes', () => {
  it.each(frames.map((p) => [p.id, p]))('%s: S < M < L, and M is the catalogue size', (id, p) => {
    const [s, m, l] = ['S', 'M', 'L'].map((k) => NY.sizeOf(p, k));
    expect(m).toEqual(p.size);
    expect(s[0]).toBeLessThan(m[0]);
    expect(l[0]).toBeGreaterThan(m[0]);
    expect(NY.frameWidth(p, 'S')).toBeLessThan(NY.frameWidth(p, 'M'));
    expect(NY.frameWidth(p, 'M')).toBeLessThan(NY.frameWidth(p, 'L'));
    // adult frames span the usual range of face widths
    if (p.zone !== 'kids') {
      expect(NY.frameWidth(p, 'M')).toBeGreaterThan(120);
      expect(NY.frameWidth(p, 'M')).toBeLessThan(150);
    }
  });
  it('suggests the size whose width is closest to the face', () => {
    const p = NY.byId.w01;
    for (const k of ['S', 'M', 'L']) expect(NY.bestSize(p, NY.frameWidth(p, k))).toBe(k);
    expect(NY.bestSize(p, 90)).toBe('S');
    expect(NY.bestSize(p, 190)).toBe('L');
    expect(NY.fitFor(p, 'M', NY.frameWidth(p, 'M')).fit).toBe('good');
    expect(NY.fitFor(p, 'M', NY.frameWidth(p, 'M') - 12).fit).toBe('wide');
    expect(NY.fitFor(p, 'M', NY.frameWidth(p, 'M') + 12).fit).toBe('narrow');
  });
  it('kids sizes are named XS, S and M', () => {
    const k = NY.byId.k01;
    expect(['S', 'M', 'L'].map((s) => NY.sizeName(k, s))).toEqual(['XS', 'S', 'M']);
    expect(NY.sizeName(NY.byId.m01, 'L')).toBe('L');
  });
  it('the size does not change the price, and shows in the order summary', () => {
    const p = NY.byId.m01;
    const cfg = NY.defaultCfg(p);
    expect(cfg.fs).toBe('M');
    expect(NY.priceOf(p, Object.assign({}, cfg, { fs: 'L' }))).toBe(NY.priceOf(p, cfg));
    expect(NY.cfgSummary(p, Object.assign({}, cfg, { fs: 'L' }))).toContain('Size L · 55□19-150');
  });
});

describe('lenses and prices', () => {
  it('adds lens options to the frame price', () => {
    const p = NY.byId.m01;
    const cfg = Object.assign(NY.defaultCfg(p), { type: 'pg', index: '167', coats: ['bc'] });
    expect(NY.priceOf(p, cfg)).toBe(p.price + 4900 + 2200 + 900);
    expect(NY.needsRx(p, cfg)).toBe(true);
    expect(NY.needsAdd(p, cfg)).toBe(true);
  });
  it('sunglasses can take prescription sun lenses', () => {
    const p = NY.byId.s01;
    expect(NY.priceOf(p, Object.assign(NY.defaultCfg(p), { sunlens: 'rxsun' }))).toBe(p.price + 2900);
  });
});
