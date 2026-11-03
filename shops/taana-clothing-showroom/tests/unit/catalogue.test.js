// Catalogue, size charts and merchandising: the data every part of the store reads.
import { describe, expect, it } from 'vitest';
import { NY } from '../../src/core/ny.js';
import '../../src/data/catalogue.js';
import '../../src/data/store-layout.js';
import { TEMPLATES } from '../../src/cloth/garments.js';
import { FABRICS } from '../../src/cloth/sim.js';

const garments = NY.PRODUCTS.filter((p) => p.type !== 'dupatta');
const dupattas = NY.PRODUCTS.filter((p) => p.type === 'dupatta');
const HEX = /^#[0-9a-f]{6}$/i;

describe('products', () => {
  it('has a non-empty catalogue with unique ids', () => {
    expect(NY.PRODUCTS.length).toBeGreaterThan(20);
    const ids = NY.PRODUCTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(NY.byId[id]).toBeDefined();
  });

  it.each(NY.PRODUCTS.map((p) => [p.id, p]))('%s has a name, a price, colours and a fabric', (id, p) => {
    expect(p.name.trim().length).toBeGreaterThan(2);
    expect(Number.isInteger(p.price)).toBe(true);
    expect(p.price).toBeGreaterThan(0);
    expect(p.colors.length).toBeGreaterThan(0);
    for (const c of p.colors) {
      expect(c.n.trim().length).toBeGreaterThan(0);
      expect(c.base).toMatch(HEX);
      if (c.accent) expect(c.accent).toMatch(HEX);
    }
    expect(FABRICS[p.fabric], 'physics preset for ' + p.fabric).toBeDefined();
    expect(NY.FABRIC_INFO[p.fabric], 'care text for ' + p.fabric).toBeDefined();
  });

  it.each(garments.map((p) => [p.id, p]))('%s uses a known template, size chart and section', (id, p) => {
    expect(TEMPLATES[p.template]).toBeDefined();
    expect(NY.SIZES[p.kind]).toBeDefined();
    expect(NY.EASE[p.fit]).toBeDefined();
    expect(NY.zoneById(p.zone), 'section ' + p.zone).not.toBeNull();
    expect(p.len).toBeGreaterThan(0.3);
    expect(p.len).toBeLessThan(1.6);
  });

  it('has dupattas with a drape and dimensions', () => {
    expect(dupattas.length).toBeGreaterThan(0);
    for (const p of dupattas) {
      const spec = NY.specFor(p, 0, 0);
      expect(spec.template).toBe('dupatta');
      expect(['stole', 'shoulder']).toContain(spec.drape);
      expect(spec.dims).toBeDefined();
    }
  });
});

describe('size charts and size advice', () => {
  it.each(Object.entries(NY.SIZES))('%s sizes grow in chest girth', (kind, sizes) => {
    for (let i = 1; i < sizes.length; i++) expect(sizes[i][1]).toBeGreaterThan(sizes[i - 1][1]);
  });

  it.each(garments.map((p) => [p.id, p]))('%s: specFor gives metres that grow with the size', (id, p) => {
    const sizes = NY.sizesOf(p);
    let prev = null;
    for (let si = 0; si < sizes.length; si++) {
      const s = NY.specFor(p, si, 0);
      expect(s.dims.chest).toBeGreaterThan(0.4);
      expect(s.dims.chest).toBeLessThan(1.6);
      expect(s.dims.length).toBeGreaterThan(0.3);
      // the garment is always roomier than the body it is sized for
      expect(s.dims.chest).toBeGreaterThan(sizes[si][1]);
      if (prev) expect(s.dims.chest).toBeGreaterThan(prev.dims.chest);
      prev = s;
    }
  });

  it.each(garments.map((p) => [p.id, p]))('%s: recommended size never shrinks for a bigger chest', (id, p) => {
    let last = 0;
    for (let chest = 0.5; chest <= 1.3; chest += 0.01) {
      const si = NY.recommendSize(p, chest);
      expect(si).toBeGreaterThanOrEqual(last);
      expect(si).toBeLessThan(NY.sizesOf(p).length);
      last = si;
    }
  });

  it('describes fit from ease in plain words', () => {
    expect(NY.fitWord(0)).toBe('Too tight');
    expect(NY.fitWord(0.03)).toBe('Snug');
    expect(NY.fitWord(0.08)).toBe('Regular');
    expect(NY.fitWord(0.15)).toBe('Relaxed');
    expect(NY.fitWord(0.3)).toBe('Oversized');
  });
});

describe('merchandising', () => {
  // every [pid, colourIndex] pair anywhere in NY.MERCH
  const pairs = [];
  const walk = (v) => {
    if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && typeof v[1] === 'number') pairs.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(NY.MERCH);

  it('references real products and colours', () => {
    expect(pairs.length).toBeGreaterThan(20);
    for (const [pid, ci] of pairs) {
      expect(NY.byId[pid], pid).toBeDefined();
      expect(ci).toBeLessThan(NY.byId[pid].colors.length);
    }
  });

  it('lists shelf stacks by known product ids', () => {
    for (const bay of [...NY.MERCH.ethnic, ...NY.MERCH.mens])
      for (const pid of bay.shelf || []) expect(NY.byId[pid], pid).toBeDefined();
  });

  it('shows every garment somewhere in the store', () => {
    const shown = new Set(pairs.map(([pid]) => pid));
    for (const bay of [...NY.MERCH.ethnic, ...NY.MERCH.mens]) for (const pid of bay.shelf || []) shown.add(pid);
    const missing = NY.PRODUCTS.filter((p) => !shown.has(p.id)).map((p) => p.id);
    expect(missing).toEqual([]);
  });
});
