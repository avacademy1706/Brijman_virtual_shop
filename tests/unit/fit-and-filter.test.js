// Fit guide, size generation rules and the One Euro filter.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  fitResult,
  suggestSize,
  generateSizes,
  sizeOf,
  sizeLabel,
  FIT_NARROW_BELOW_MM,
  FIT_WIDE_ABOVE_MM,
} from '../../shared/fit.js';
import { OneEuroFilter, OneEuroQuaternion } from '../../src/tryon/one-euro.js';

const products = JSON.parse(readFileSync(new URL('../../data/catalogue.json', import.meta.url), 'utf8')).products;
const byId = Object.fromEntries(products.map((p) => [p.id, p]));

describe('fit guide', () => {
  it('uses the named thresholds: narrow below −8 mm, wide above +4 mm', () => {
    expect(FIT_NARROW_BELOW_MM).toBe(-8);
    expect(FIT_WIDE_ABOVE_MM).toBe(4);
    expect(fitResult(131, 140).result).toBe('narrow');
    expect(fitResult(132, 140).result).toBe('good');
    expect(fitResult(144, 140).result).toBe('good');
    expect(fitResult(144.5, 140)).toMatchObject({ result: 'wide', label: 'May feel wide' });
    expect(fitResult(138, 140).label).toBe('Good fit');
  });
  it('suggests the size that fits better, and nothing when the fit is already good', () => {
    const sizes = [
      { id: 'S', widthMm: 126 },
      { id: 'M', widthMm: 130 },
      { id: 'L', widthMm: 134 },
    ];
    expect(suggestSize(sizes, 'S', 142)).toBe('L');
    expect(suggestSize(sizes, 'L', 120)).toBe('S');
    expect(suggestSize(sizes, 'M', 131)).toBeNull();
  });
});

describe('size generation', () => {
  it('adult optical: S, M, L from the current size', () => {
    expect(generateSizes({ zone: 'men', size: [53, 18, 145] })).toEqual([
      { id: 'S', lens: 51, bridge: 17, temple: 140 },
      { id: 'M', lens: 53, bridge: 18, temple: 145 },
      { id: 'L', lens: 55, bridge: 19, temple: 150 },
    ]);
  });
  it('caps L temples at 150, gives sunglasses and Atelier M and L, and kids S and M with a 120 mm minimum', () => {
    expect(generateSizes({ zone: 'women', size: [52, 17, 148] })[2].temple).toBe(150);
    expect(generateSizes({ zone: 'sun', sun: true, size: [58, 14, 140] }).map((s) => s.id)).toEqual(['M', 'L']);
    expect(generateSizes({ zone: 'premium', size: [48, 22, 145] }).map((s) => s.id)).toEqual(['M', 'L']);
    expect(generateSizes({ zone: 'kids', size: [42, 16, 120] })[0]).toEqual({
      id: 'S',
      lens: 40,
      bridge: 15,
      temple: 120,
    });
  });
  it('every frame in the catalogue has sizes that follow the rules, with M equal to its listed size', () => {
    for (const p of products.filter((x) => x.type === 'frame')) {
      expect(p.sizes).toEqual(generateSizes(p));
      expect(p.defaultSize).toBe('M');
      expect(sizeOf(p, 'M')).toMatchObject({ lens: p.size[0], bridge: p.size[1], temple: p.size[2] });
    }
    expect(sizeLabel(sizeOf(byId.m01, 'L'))).toBe('L · 55□19-150');
    expect(byId.c01.sizes).toBeUndefined();
  });
});

describe('One Euro filter', () => {
  it('passes a constant through unchanged', () => {
    const f = new OneEuroFilter();
    for (let i = 0; i < 30; i++) expect(f.filter(5, i / 30)).toBeCloseTo(5, 10);
  });
  it('smooths jitter when still', () => {
    const f = new OneEuroFilter({ minCutoff: 1, beta: 0 });
    let maxDev = 0;
    for (let i = 0; i < 120; i++) {
      const v = f.filter(10 + (i % 2 ? 1 : -1), i / 30);
      if (i > 30) maxDev = Math.max(maxDev, Math.abs(v - 10));
    }
    expect(maxDev).toBeLessThan(0.3);
  });
  it('follows a fast move with less lag when beta is higher', () => {
    const lag = (beta) => {
      const f = new OneEuroFilter({ minCutoff: 1, beta });
      let v = 0;
      for (let i = 0; i < 15; i++) v = f.filter(i * 20, i / 30); // 600 units per second
      return 14 * 20 - v;
    };
    expect(lag(0.05)).toBeLessThan(lag(0));
    expect(lag(0.05)).toBeLessThan(40);
  });
  it('keeps quaternions normalised and never flips hemisphere', () => {
    const f = new OneEuroQuaternion();
    const a = f.filter([0, 0, 0, 1], 0);
    const b = f.filter([0, 0, 0, -1], 1 / 30); // same rotation, opposite sign
    expect(b[3]).toBeGreaterThan(0.99);
    expect(Math.hypot(...a)).toBeCloseTo(1, 10);
  });
});
