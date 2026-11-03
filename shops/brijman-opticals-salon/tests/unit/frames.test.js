// Frames are built from their real millimetre sizes: lens width, overall width and the try-on anchor points.
import { describe, expect, it } from 'vitest';
import { NY } from '../../src/core/ny.js';
import '../../src/data/catalogue.js';
import '../../src/lib/drawings.js';
import { archGeo, buildArch, frameScale } from '../../src/frames/geometry.js';

const frames = NY.PRODUCTS.filter((p) => p.type === 'frame');

describe('frame geometry', () => {
  it.each(Object.keys(NY.ARCH).map((k) => [k]))('%s builds lenses, a front and temples', (id) => {
    const G = buildArch(NY.ARCH[id]);
    expect(G.lens).toBeTruthy();
    expect(G.acetate || G.metal).toBeTruthy();
    for (const k of ['acetate', 'metal', 'lens'])
      if (G[k]) for (const v of G[k].attributes.position.array) expect(Number.isFinite(v)).toBe(true);
    // temples run back about 14 cm from the front
    const bb = (G.acetate || G.metal).boundingBox;
    expect(bb.min.z).toBeLessThan(-0.13);
    expect(G.hinges).toHaveLength(2);
  });

  it.each(frames.map((p) => [p.id, p]))('%s is drawn at its real lens width and overall width', (id, p) => {
    const G = archGeo(p.arch);
    const k = frameScale(p) * 1000; // metres -> mm at the product's size
    const a = NY.ARCH[p.arch];
    // one lens, measured on the lens geometry
    G.lens.computeBoundingBox();
    const lensSpan = (G.lens.boundingBox.max.x - G.lens.boundingBox.min.x) * k; // both lenses and the bridge
    expect(Math.abs(lensSpan - (2 * p.size[0] + a.dbl * k))).toBeLessThan(3);
    // the drawn hinge-to-hinge width is the width the fit guide uses
    expect(Math.abs(G.width * k - NY.frameWidth(p, 'M'))).toBeLessThan(1.5);
    // sizes scale the whole frame
    expect(frameScale(p, 'L')).toBeGreaterThan(frameScale(p, 'M'));
  });
});

describe('drawings', () => {
  it.each(frames.map((p) => [p.id, p]))('%s draws a valid thumbnail in every colour and a size diagram', (id, p) => {
    for (let ci = 0; ci < p.colors.length; ci++) {
      const svg = NY.frameSVG(p, ci, 96, 40);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).not.toMatch(/NaN|undefined|<script|on[a-z]+=/i);
    }
    const s = NY.sizeSVG(p);
    expect(s).toContain(p.size[0] + ' mm');
    expect(s).not.toMatch(/NaN|undefined/);
  });
  it('draws contact lens and care products', () => {
    for (const p of NY.PRODUCTS.filter((p) => p.type !== 'frame')) expect(NY.frameSVG(p, 0)).toMatch(/^<svg/);
  });
});
