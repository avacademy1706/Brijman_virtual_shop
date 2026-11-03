// The procedural jewellery engine: gem cuts, the necklace path on the bust, and every catalogue piece built at
// store detail (0.35) and try-on/viewer detail (0.9), in every metal it is offered in.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { NY } from '../../src/core/ny.js';
import '../../src/data/catalogue.js';
import { CUTS, gemGeometry, girdleSize, pavilionDepth, crownHeight } from '../../src/jewel/gems.js';
import { buildPiece, stoneMM, stoneCt } from '../../src/jewel/build.js';
import { necklacePath, BUST } from '../../src/jewel/shapes.js';
import { resolveMetal } from '../../src/jewel/kit.js';

const finite = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

describe('gem cuts', () => {
  it.each(CUTS.map((c) => [c]))('%s is a closed, finite, faceted stone', (cut) => {
    const g = gemGeometry(cut);
    const pos = g.attributes.position;
    expect(pos.count).toBeGreaterThan(12);
    expect(g.attributes.facet, 'facet ids for the gem shader').toBeTruthy();
    for (let i = 0; i < pos.count; i++) expect(Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i))).toBe(true);
    g.computeBoundingBox();
    const s = g.boundingBox.getSize(new THREE.Vector3());
    // unit girdle width, table up
    expect(Math.max(s.x, s.z)).toBeGreaterThan(0.5);
    expect(Math.max(s.x, s.z)).toBeLessThan(1.6);
    expect(g.boundingBox.max.y).toBeGreaterThan(0);
    expect(pavilionDepth(cut)).toBeGreaterThanOrEqual(0);
    expect(crownHeight(cut)).toBeGreaterThan(0);
    expect(girdleSize(cut)).toBeTruthy();
  });

  it('carat and millimetre conversions agree', () => {
    for (const cut of ['round', 'oval', 'pear', 'emerald', 'princess']) {
      const mm = stoneMM(cut, 1);
      expect(mm).toBeGreaterThan(4.5);
      expect(mm).toBeLessThan(8.5);
      expect(stoneCt(cut, mm)).toBeCloseTo(1, 1);
    }
    // a one-carat round brilliant is about 6.4 mm across
    expect(stoneMM('round', 1)).toBeCloseTo(6.45, 0);
  });
});

describe('necklace path on the bust', () => {
  it.each([14, 16, 18, 22, 28])('a %s inch chain hangs lower the longer it is, and closes on itself', (inch) => {
    const path = necklacePath(inch * 25.4);
    const len = path.curve.getLength();
    expect(len).toBeGreaterThan(inch * 25.4 * 0.9);
    expect(len).toBeLessThan(inch * 25.4 * 1.1);
    const front = path.frame(0); // 0 = the front centre
    expect(front.p.z).toBeGreaterThan(0);
    expect(front.p.y).toBeLessThan(5);
    expect(front.p.y).toBeGreaterThan(BUST.bottom);
    expect(front.down.y).toBeLessThan(0);
  });
  it('longer chains drop further', () => {
    expect(necklacePath(28 * 25.4).frame(0).p.y).toBeLessThan(necklacePath(16 * 25.4).frame(0).p.y - 50);
  });
});

describe('white claws on yellow or rose gold', () => {
  it('a diamond set in yellow gold gets white gold claws when the design asks for it', () => {
    expect(resolveMetal('w', { metal: 'y18', whiteClaws: true })).toBe('w18');
    expect(resolveMetal('w', { metal: 'pt', whiteClaws: true })).toBe('pt');
    expect(resolveMetal('m', { metal: 'y18', whiteClaws: true })).toBe('y18');
  });
});

const BUDGET = { 0.35: 60_000, 0.9: 110_000 }; // triangles per piece (the store holds about 100 pieces)
// overall size limits per type, millimetres
const SIZE = {
  ring: [14, 40],
  earrings: [6, 110],
  necklace: [100, 300],
  pendant: [100, 300],
  bangle: [50, 90],
  bracelet: [40, 90],
  tikka: [40, 120],
  nath: [15, 60],
};

describe('every catalogue piece builds', () => {
  for (const q of [0.35, 0.9])
    it.each(NY.PRODUCTS.map((p) => [p.id + ' at detail ' + q, p]))('%s', (name, p) => {
      for (const metal of p.metals) {
        const cfg = Object.assign(NY.defaultCfg(p), { metal });
        const kit = buildPiece(p.build, NY.buildCfg(p, cfg), q);
        const b = kit.bounds();
        expect(finite(b.min) && finite(b.max), 'finite bounds').toBe(true);
        const s = b.getSize(new THREE.Vector3());
        const big = Math.max(s.x, s.y, s.z);
        const [lo, hi] = SIZE[p.type];
        expect(big, 'size').toBeGreaterThan(lo);
        expect(big, 'size').toBeLessThan(hi);
        expect(kit.tris(), 'triangle budget').toBeLessThan(BUDGET[q]);
        expect(Object.keys(kit.metal).length, 'has metal').toBeGreaterThan(0);
        // pieces with stones show them (at full detail every stone is placed)
        if (q === 0.9 && p.stones.length) expect(kit.gems.length + kit.pearls.length, 'stones').toBeGreaterThan(0);
        for (const gm of kit.gems) expect(gm.size).toBeGreaterThan(0.3);
        if (p.type === 'earrings') expect(kit.single, 'one earring for the try-on').toBeTruthy();
        if (p.type === 'tikka') expect(kit.anchors.chain).toBeGreaterThan(10);
      }
    });

  it('a bigger ring size makes a bigger ring', () => {
    const p = NY.byId.s01;
    const size = (n) =>
      buildPiece(p.build, NY.buildCfg(p, { ...NY.defaultCfg(p), size: n }), 0.35)
        .bounds()
        .getSize(new THREE.Vector3()).x;
    expect(size(22)).toBeGreaterThan(size(6));
  });

  it('a bigger solitaire makes a bigger centre stone', () => {
    const p = NY.PRODUCTS.find((x) => x.caratOptions && x.type === 'ring');
    const top = (ct) =>
      Math.max(
        ...buildPiece(p.build, NY.buildCfg(p, { ...NY.defaultCfg(p), carat: ct }), 0.35).gems.map((g) => g.size),
      );
    expect(top(p.caratOptions[p.caratOptions.length - 1])).toBeGreaterThan(top(p.caratOptions[0]));
  });
});
