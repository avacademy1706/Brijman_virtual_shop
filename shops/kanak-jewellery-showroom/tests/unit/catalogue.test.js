// The catalogue and the price breakdown: every product is complete, every option is valid, and the price adds up
// the way a jeweller's bill does (metal weight x rate + making + stones + 3% GST).
import { describe, expect, it } from 'vitest';
import { NY } from '../../src/core/ny.js';
import '../../src/data/store-layout.js';
import '../../src/data/catalogue.js';
import { PEARLS } from '../../src/jewel/materials.js';

const P = NY.PRODUCTS;
const TYPES = ['ring', 'earrings', 'necklace', 'pendant', 'bangle', 'bracelet', 'tikka', 'nath'];
const SLOTS = ['ear', 'neck', 'forehead', 'nose', 'finger', 'wrist'];
const SLOT_OF = {
  ring: 'finger',
  earrings: 'ear',
  necklace: 'neck',
  pendant: 'neck',
  bangle: 'wrist',
  bracelet: 'wrist',
  tikka: 'forehead',
  nath: 'nose',
};

describe('products', () => {
  it('has a full catalogue with unique ids', () => {
    expect(P.length).toBeGreaterThanOrEqual(40);
    expect(new Set(P.map((p) => p.id)).size).toBe(P.length);
    for (const p of P) expect(NY.byId[p.id]).toBe(p);
  });

  it.each(P.map((p) => [p.id, p]))('%s is complete', (id, p) => {
    expect(p.name).toBeTruthy();
    expect(TYPES).toContain(p.type);
    expect(p.desc.length).toBeGreaterThan(20);
    expect(NY.zoneById(p.zone), 'zone ' + p.zone).toBeTruthy();
    expect(p.metals.length).toBeGreaterThan(0);
    expect(p.metals).toContain(p.metal);
    for (const m of p.metals) expect(NY.METAL[m], 'metal ' + m).toBeTruthy();
    expect(p.wt).toBeGreaterThan(0);
    expect(p.making).toBeGreaterThan(0);
    expect(p.making).toBeLessThan(0.4);
    expect(p.build && p.build.type).toBeTruthy();
    // the camera try-on slot matches the type
    expect(SLOTS).toContain(p.tryon);
    expect(p.tryon).toBe(SLOT_OF[p.type]);
  });

  it('every stone and stone option is a known stone or pearl colour', () => {
    for (const p of P) {
      for (const s of p.stones) {
        expect(NY.STONE[s.kind], p.id + ' stone ' + s.kind).toBeTruthy();
        expect(s.n).toBeGreaterThan(0);
      }
      for (const role in p.stoneOptions || {})
        for (const k of p.stoneOptions[role]) expect(NY.STONE[k] || PEARLS[k], p.id + ' option ' + k).toBeTruthy();
    }
  });

  it('default sizes exist in the size charts', () => {
    for (const p of P) {
      if (!p.sizes) continue;
      const ids = NY.sizesOf(p).map((o) => o.id);
      expect(ids, p.id).toContain(NY.defaultSize(p));
    }
  });
});

describe('prices', () => {
  it.each(P.map((p) => [p.id, p]))('%s: the breakdown adds up', (id, p) => {
    const cfg = NY.defaultCfg(p);
    const b = NY.priceOf(p, cfg);
    for (const k of ['weight', 'rate', 'metal', 'making', 'stoneValue', 'subtotal', 'gst', 'total'])
      expect(Number.isFinite(b[k]), k).toBe(true);
    expect(b.metal).toBeCloseTo(b.weight * b.rate, 6);
    expect(b.making).toBeCloseTo(b.metal * p.making, 6);
    expect(b.subtotal).toBeCloseTo(b.metal + b.making + b.stoneValue, 6);
    expect(b.gst).toBeCloseTo(b.subtotal * 0.03, 6);
    expect(b.total).toBe(Math.round(b.subtotal + b.gst));
    expect(b.total).toBeGreaterThan(1000);
    expect(p.price).toBe(b.total);
  });

  it('gold rates follow purity; platinum and silver have their own rate', () => {
    expect(NY.metalRate('y22')).toBeCloseTo(NY.RATES.gold24 * 0.916, 6);
    expect(NY.metalRate('y18')).toBeCloseTo(NY.RATES.gold24 * 0.75, 6);
    expect(NY.metalRate('pt')).toBe(NY.RATES.platinum);
    expect(NY.metalRate('ag')).toBe(NY.RATES.silver);
    expect(NY.metalRate('y22')).toBeGreaterThan(NY.metalRate('y18'));
  });

  it('heavier metals weigh more for the same piece', () => {
    const p = NY.byId.s01;
    const w = (m) => NY.weightOf(p, Object.assign(NY.defaultCfg(p), { metal: m }));
    expect(w('pt')).toBeGreaterThan(w('w18'));
  });

  it('a bigger ring or longer chain weighs more', () => {
    const ring = NY.byId.s01;
    const cfg = NY.defaultCfg(ring);
    expect(NY.weightOf(ring, { ...cfg, size: 20 })).toBeGreaterThan(NY.weightOf(ring, { ...cfg, size: 8 }));
    const chain = P.find((p) => p.sizes === 'chain');
    const c2 = NY.defaultCfg(chain);
    expect(NY.weightOf(chain, { ...c2, size: 24 })).toBeGreaterThan(NY.weightOf(chain, { ...c2, size: 16 }));
  });

  it('a bigger solitaire and a better diamond quality cost more', () => {
    const p = P.find((x) => x.caratOptions);
    const cfg = NY.defaultCfg(p);
    const at = (c) => NY.priceOf(p, c).total;
    const opts = p.caratOptions;
    expect(at({ ...cfg, carat: opts[opts.length - 1] })).toBeGreaterThan(at({ ...cfg, carat: opts[0] }));
    expect(at({ ...cfg, quality: 'efvvs' })).toBeGreaterThan(at({ ...cfg, quality: 'ijsi' }));
  });

  it('changing a stone option changes the stone value', () => {
    const p = P.find(
      (x) => x.stoneOptions && Object.values(x.stoneOptions).some((o) => o.length > 1 && o.every((k) => NY.STONE[k])),
    );
    const role = Object.keys(p.stoneOptions).find((r) => p.stoneOptions[r].length > 1);
    const [a, b] = p.stoneOptions[role];
    const cfg = NY.defaultCfg(p);
    const va = NY.priceOf(p, { ...cfg, stones: { ...cfg.stones, [role]: a } }).stoneValue;
    const vb = NY.priceOf(p, { ...cfg, stones: { ...cfg.stones, [role]: b } }).stoneValue;
    if (NY.STONE[a].perCt !== NY.STONE[b].perCt) expect(va).not.toBe(vb);
  });

  it('summaries name the metal and size', () => {
    const p = NY.byId.s01;
    const s = NY.cfgSummary(p, NY.defaultCfg(p));
    expect(s).toContain(NY.METAL[p.metal].short);
    expect(s).toMatch(/Size \d+/);
  });
});

describe('sets and merchandising', () => {
  it('bridal sets use real pieces, one per try-on slot', () => {
    expect(NY.SETS.length).toBeGreaterThanOrEqual(3);
    for (const s of NY.SETS) {
      const slots = s.pieces.map((id) => {
        expect(NY.byId[id], s.id + ' ' + id).toBeTruthy();
        return NY.byId[id].tryon;
      });
      expect(new Set(slots).size, s.id + ' has two pieces for one slot').toBe(slots.length);
    }
  });

  const entries = [];
  const M = NY.MERCH;
  for (const e of M.hero.map((x) => [x])) entries.push(['hero', e]);
  for (const e of M.pillars) entries.push(['pillar', e]);
  for (const e of M.columns) entries.push(['column', e]);
  for (const [salon, s] of Object.entries(M.salons))
    for (const where of ['niches', 'left', 'right', 'counter'])
      for (const e of s[where]) entries.push([salon + '.' + where, e]);
  for (const e of M.lounge.table) entries.push(['lounge.table', e]);

  it('every displayed piece exists, in a metal and stones it is offered in', () => {
    for (const [where, [id, metal, stones]] of entries) {
      const p = NY.byId[id];
      expect(p, where + ' ' + id).toBeTruthy();
      if (metal) expect(p.metals, where + ' ' + id + ' metal').toContain(metal);
      for (const r in stones || {}) {
        const ok =
          (p.stoneOptions && p.stoneOptions[r] && p.stoneOptions[r].includes(stones[r])) ||
          NY.STONE[stones[r]] ||
          PEARLS[stones[r]];
        expect(ok, where + ' ' + id + ' ' + r).toBeTruthy();
      }
    }
  });

  it('wall niches hold necklaces and pendants; counters hold none (a bust would not fit under the glass)', () => {
    for (const [salon, s] of Object.entries(M.salons)) {
      for (const [id] of s.niches) expect(['necklace', 'pendant'], salon + ' niche ' + id).toContain(NY.byId[id].type);
      for (const [id] of s.counter)
        expect(['necklace', 'pendant'], salon + ' counter ' + id).not.toContain(NY.byId[id].type);
    }
  });

  it('lounge cases show real sets', () => {
    for (const id of M.lounge.cases)
      expect(
        NY.SETS.some((s) => s.id === id),
        id,
      ).toBe(true);
  });
});
