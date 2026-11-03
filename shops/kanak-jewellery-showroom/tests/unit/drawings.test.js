// Thumbnails drawn as SVG for lists, the bag and the try-on carousel.
import { describe, expect, it } from 'vitest';
import { NY } from '../../src/core/ny.js';
import '../../src/data/store-layout.js';
import '../../src/data/catalogue.js';
import '../../src/lib/drawings.js';

describe('piece thumbnails', () => {
  it.each(NY.PRODUCTS.map((p) => [p.id, p]))('%s draws a valid SVG in every metal', (id, p) => {
    for (const metal of p.metals) {
      const svg = NY.pieceSVG(p, Object.assign(NY.defaultCfg(p), { metal }), 48, 48);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('</svg>');
      expect(svg).not.toMatch(/NaN|undefined/);
      // nothing that could run script inside the markup
      expect(svg).not.toMatch(/<script|on[a-z]+=/i);
    }
  });
  it('gradient ids are unique, so several thumbnails can share a page', () => {
    const p = NY.PRODUCTS[0];
    const ids = [1, 2, 3].map(() => NY.pieceSVG(p, null, 40, 40).match(/id="([^"]+)"/)[1]);
    expect(new Set(ids).size).toBe(3);
  });
});
