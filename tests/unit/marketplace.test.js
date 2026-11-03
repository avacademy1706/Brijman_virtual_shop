// The marketplace's shop list, bag counts and the deployment settings every shop needs.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

import { SHOPS, SHOP_BUILDS, shopUrl, bagCount } from '../../shared/marketplace.js';

const root = (p) => new URL('../../' + p, import.meta.url);
const read = (p) => readFileSync(root(p), 'utf8');
const vercel = JSON.parse(read('vercel.json'));
const memory = (data) => ({ getItem: (k) => (k in data ? data[k] : null) });

describe('shop list', () => {
  it('has unique ids, paths and bag keys', () => {
    for (const key of ['id', 'path', 'bagKey']) expect(new Set(SHOPS.map((s) => s[key])).size).toBe(SHOPS.length);
  });
  it('lists the eyewear shop and every built shop', () => {
    expect(SHOPS.map((s) => s.path).sort()).toEqual(['eyewear', ...SHOP_BUILDS.map((s) => s.path)].sort());
    expect(shopUrl(SHOPS[0])).toBe('/eyewear/');
  });
  it('gives every shop the text and colours its card needs', () => {
    for (const s of SHOPS) {
      for (const key of ['name', 'category', 'tagline', 'blurb', 'tryOn', 'tryOnIcon']) expect(s[key]).toBeTruthy();
      expect(s.stats.length).toBeGreaterThan(0);
      for (const c of Object.values(s.theme)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('bag counts', () => {
  const shop = { bagKey: 'k' };
  it('counts lines and their quantities', () => {
    expect(bagCount(memory({ k: JSON.stringify([{ qty: 2 }, { qty: 1 }, {}]) }), shop)).toBe(4);
  });
  it('is 0 for a missing, empty, broken or unexpected bag', () => {
    expect(bagCount(memory({}), shop)).toBe(0);
    expect(bagCount(memory({ k: '[]' }), shop)).toBe(0);
    expect(bagCount(memory({ k: '{not json' }), shop)).toBe(0);
    expect(bagCount(memory({ k: '{"a":1}' }), shop)).toBe(0);
    expect(bagCount(memory({ k: '[null, 3, "x"]' }), shop)).toBe(0);
  });
  it('caps silly quantities', () => {
    expect(bagCount(memory({ k: JSON.stringify([{ qty: 1e9 }, { qty: -5 }]) }), shop)).toBe(100);
  });
  it('survives storage that throws', () => {
    const broken = {
      getItem() {
        throw new Error('blocked');
      },
    };
    expect(bagCount(broken, shop)).toBe(0);
  });
  it('reads the keys the shops really save their bags under', () => {
    expect(read('src/lib/bag-storage.js')).toContain("'" + SHOPS.find((s) => s.id === 'eyewear').bagKey + "'");
    for (const b of SHOP_BUILDS) {
      const key = SHOPS.find((s) => s.path === b.path).bagKey;
      expect(read('shops/' + b.folder + '/src/ui/app.js')).toContain("'" + key + "'");
    }
  });
});

describe('each built shop', () => {
  for (const b of SHOP_BUILDS) {
    describe(b.folder, () => {
      it('has its own project with an exact lockfile', () => {
        expect(existsSync(root('shops/' + b.folder + '/package.json'))).toBe(true);
        expect(existsSync(root('shops/' + b.folder + '/package-lock.json'))).toBe(true);
      });
      it('links back to the marketplace from its welcome card and store details', () => {
        expect(read('shops/' + b.folder + '/index.html')).toMatch(/class="market-back" href="\/"/);
        expect(read('shops/' + b.folder + '/src/ui/app.js')).toContain("class: 'btn market-link', href: '/'");
      });
      it('has security headers, caching and a trailing-slash redirect on Vercel', () => {
        const rule = vercel.headers.find(
          (r) =>
            (r.source.startsWith('/(') && r.source.includes(b.path + '|')) || r.source.includes('|' + b.path + ')'),
        );
        expect(rule, 'header rule for /' + b.path + '/').toBeTruthy();
        const keys = rule.headers.map((h) => h.key);
        for (const k of [
          'Content-Security-Policy',
          'Permissions-Policy',
          'X-Content-Type-Options',
          'Strict-Transport-Security',
        ])
          expect(keys).toContain(k);
        expect(vercel.redirects).toContainEqual({
          source: '/' + b.path,
          destination: '/' + b.path + '/',
          permanent: true,
        });
      });
      it('keeps the strict policy of its own project (camera for itself only, no third-party sources)', () => {
        const own = JSON.parse(read('shops/' + b.folder + '/vercel.json')).headers[0].headers;
        const ours = vercel.headers.find((r) => r.source === '/(clothing|jewellery)/(.*)').headers;
        const csp = (hs) => hs.find((h) => h.key === 'Content-Security-Policy').value;
        expect(csp(ours)).toBe(csp(own));
        expect(csp(ours)).not.toMatch(/https?:|\*/);
      });
    });
  }
  it('are left out of the marketplace site rule, so each path gets exactly one policy', () => {
    const site = vercel.headers.find((r) => r.source.startsWith('/((?!'));
    for (const b of SHOP_BUILDS) expect(site.source).toContain(b.path);
  });
});

describe('marketplace page', () => {
  it('links to every shop without JavaScript too', () => {
    const html = read('index.html');
    for (const s of SHOPS) expect(html).toContain('href="' + shopUrl(s) + '"');
  });
  it('the eyewear shop links back to the marketplace', () => {
    expect(read('eyewear/index.html')).toMatch(/class="market-back" href="\/"/);
  });
});
