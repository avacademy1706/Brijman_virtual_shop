// Business rules for lens prices and allowed configurations.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { priceOf, cfgSummary, cfgProblem, lensRules, needsRx, needsAdd, defaultCfg } from '../../shared/pricing.js';

const read = (f) => JSON.parse(readFileSync(new URL('../../data/' + f, import.meta.url), 'utf8'));
const lens = read('lenses.json');
const byId = Object.fromEntries(read('catalogue.json').products.map((p) => [p.id, p]));
const m01 = byId.m01; // Arlo, ₹2,490
const opt = (type, index, coats = []) => ({ type, index, coats, rx: 'later' });

describe('lens prices', () => {
  it('zero power adds nothing and always uses index 1.56', () => {
    expect(priceOf(m01, opt('zero', '156'), lens)).toBe(2490);
  });
  it.each([
    ['sv', 1200],
    ['bf', 2400],
    ['pg', 4900],
  ])('lens type %s adds ₹%i', (type, add) => {
    expect(priceOf(m01, opt(type, '156'), lens)).toBe(2490 + add);
  });
  it.each([
    ['156', 0],
    ['160', 900],
    ['167', 2200],
    ['174', 4500],
  ])('index %s adds ₹%i', (index, add) => {
    expect(priceOf(m01, opt('sv', index), lens)).toBe(2490 + 1200 + add);
  });
  it('anti-glare is included, blue-cut is ₹900 and photochromic ₹1,900', () => {
    expect(lens.coats.find((c) => c.id === 'ag')).toMatchObject({ p: 0, fixed: true });
    expect(priceOf(m01, opt('sv', '156', ['bc']), lens)).toBe(2490 + 1200 + 900);
    expect(priceOf(m01, opt('sv', '156', ['ph']), lens)).toBe(2490 + 1200 + 1900);
  });
  it('single vision, 1.60 and blue-cut on Arlo totals ₹5,490', () => {
    expect(priceOf(m01, opt('sv', '160', ['bc']), lens)).toBe(5490);
  });
  it('prescription sun lenses add ₹2,900', () => {
    expect(priceOf(byId.s01, { sunlens: 'plano' }, lens)).toBe(3990);
    expect(priceOf(byId.s01, { sunlens: 'rxsun' }, lens)).toBe(3990 + 2900);
  });
  it('contact lens and care prices come from the chosen pack', () => {
    expect(priceOf(byId.c01, { pack: 1 }, lens)).toBe(3950);
  });
});

describe('allowed configurations', () => {
  it("kids' frames allow only zero power and single vision at 1.56 or 1.60", () => {
    expect(lensRules(byId.k01)).toEqual({ mode: 'optical', types: ['zero', 'sv'], index: ['156', '160'] });
    expect(cfgProblem(byId.k01, opt('sv', '160'), lens)).toBeNull();
    expect(cfgProblem(byId.k01, opt('pg', '156'), lens)).toMatch(/not available/);
    expect(cfgProblem(byId.k01, opt('sv', '167'), lens)).toMatch(/not available/);
  });
  it('zero power must use index 1.56', () => {
    expect(cfgProblem(m01, opt('zero', '160'), lens)).toMatch(/1\.56/);
  });
  it('sunglasses take the sun lens options only', () => {
    expect(cfgProblem(byId.s01, { sunlens: 'rxsun', rx: 'now' }, lens)).toBeNull();
    expect(cfgProblem(byId.s01, opt('sv', '156'), lens)).toMatch(/sun lens/);
  });
  it('rejects unknown or repeated coatings, and the fixed anti-glare coat', () => {
    expect(cfgProblem(m01, opt('sv', '156', ['xx']), lens)).toMatch(/coating/);
    expect(cfgProblem(m01, opt('sv', '156', ['bc', 'bc']), lens)).toMatch(/coating/);
    expect(cfgProblem(m01, opt('sv', '156', ['ag']), lens)).toMatch(/coating/);
  });
  it('contacts need a valid pack', () => {
    expect(cfgProblem(byId.c03, { pack: 0 }, lens)).toBeNull();
    expect(cfgProblem(byId.c03, { pack: 1 }, lens)).toMatch(/pack/);
    expect(cfgProblem(byId.c03, opt('zero', '156'), lens)).toMatch(/pack/);
  });
  it('every default configuration is allowed', () => {
    for (const p of Object.values(byId)) {
      const cfg = defaultCfg(p);
      if (p.type === 'frame' && !needsRx(p, cfg)) delete cfg.rx;
      expect(cfgProblem(p, cfg, lens)).toBeNull();
    }
  });
  it('knows when a prescription and an ADD are needed', () => {
    expect(needsRx(m01, opt('zero', '156'))).toBe(false);
    expect(needsRx(m01, opt('sv', '156'))).toBe(true);
    expect(needsAdd(m01, opt('sv', '156'))).toBe(false);
    expect(needsAdd(m01, opt('pg', '156'))).toBe(true);
  });
  it('summarises a configuration', () => {
    expect(cfgSummary(m01, opt('sv', '160', ['bc']), lens)).toBe(
      'Single vision · 1.60 Thin · Blue-cut filter · Prescription to follow',
    );
  });
});
