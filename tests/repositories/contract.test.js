// Every repository must honour the same contract. HttpRepository runs only when its env vars are set.
import { describe, it, expect } from 'vitest';

import { REPOSITORY_METHODS } from '../../server/repositories/contract.js';
import { createStaticRepository } from '../../server/repositories/static-repository.js';
import { createHttpRepository } from '../../server/repositories/http-repository.js';

const httpConfigured = !!(process.env.BACKEND_API_URL && process.env.BACKEND_API_KEY);

const suites = [
  ['StaticRepository', () => createStaticRepository(), true],
  ['HttpRepository', () => createHttpRepository(), httpConfigured],
];

for (const [name, make, enabled] of suites) {
  describe.skipIf(!enabled)(name + ' contract', () => {
    const repo = enabled ? make() : null;
    it('has every method', () => {
      for (const m of REPOSITORY_METHODS) expect(typeof repo[m]).toBe('function');
    });
    it('returns store details, zones and tour', async () => {
      const s = await repo.getStore();
      expect(typeof s.store.name).toBe('string');
      expect(s.zones.length).toBeGreaterThan(0);
      for (const id of s.tour) expect(s.zones.some((z) => z.id === id)).toBe(true);
    });
    it('returns a catalogue whose merchandising only uses known products', async () => {
      const { products } = await repo.getCatalogue();
      const ids = new Set(products.map((p) => p.id));
      const merch = await repo.getMerchandising();
      const used = JSON.stringify(merch)
        .match(/"[a-z]\d{2}"/g)
        .map((s) => s.slice(1, -1));
      for (const id of used) expect(ids.has(id)).toBe(true);
    });
    it('returns lens options and an eye-test configuration', async () => {
      const lens = await repo.getLenses();
      for (const k of ['types', 'index', 'coats', 'sun', 'rx']) expect(Array.isArray(lens[k])).toBe(true);
      const et = await repo.getEyeTestConfig();
      expect(et.timezone).toBe('Asia/Kolkata');
      expect(et.slotTimes.every((t) => /^\d{2}:\d{2}$/.test(t))).toBe(true);
    });
  });
}

describe('HttpRepository configuration', () => {
  it('fails clearly when not configured', () => {
    expect(() => createHttpRepository({ url: '', key: '' })).toThrow(/not configured/);
  });
  it('refuses plain http except for localhost', () => {
    expect(() => createHttpRepository({ url: 'http://api.example.com', key: 'k' })).toThrow(/https/);
    expect(() => createHttpRepository({ url: 'http://localhost:4000', key: 'k' })).not.toThrow();
  });
  it('sends the key in a header, never in the URL', async () => {
    const calls = [];
    const orig = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      calls.push({ url, init });
      return new Response('{"store":{}}', { status: 200 });
    };
    try {
      await createHttpRepository({ url: 'https://backend.example', key: 'secret-key' }).getStore();
    } finally {
      globalThis.fetch = orig;
    }
    expect(calls[0].url).toBe('https://backend.example/store');
    expect(calls[0].url).not.toMatch(/secret-key/);
    expect(calls[0].init.headers['X-Api-Key']).toBe('secret-key');
  });
});
