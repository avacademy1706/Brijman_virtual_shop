// The saved bag: version 1 to 2 migration and what may be stored.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { readBag, writeBag, BAG_KEY, OLD_BAG_KEY } from '../../src/lib/bag-storage.js';

const read = (f) => JSON.parse(readFileSync(new URL('../../data/' + f, import.meta.url), 'utf8'));
const byId = Object.fromEntries(read('catalogue.json').products.map((p) => [p.id, p]));
const lens = read('lenses.json');
const memory = (init = {}) => {
  const m = { ...init };
  return {
    m,
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => (m[k] = String(v)),
    removeItem: (k) => delete m[k],
  };
};
const zero = { type: 'zero', index: '156', coats: [] };

describe('bag storage', () => {
  it('migrates version 1 lines to the default size once, then deletes the old key', () => {
    const v1 = [
      { key: 'a', pid: 'm01', ci: 1, cfg: zero, qty: 1, unit: 1 },
      { key: 'b', pid: 'c01', ci: 0, cfg: { pack: 1 }, qty: 3 },
    ];
    const s = memory({ [OLD_BAG_KEY]: JSON.stringify(v1) });
    const { lines, dropped } = readBag(s, byId, lens);
    expect(dropped).toBe(0);
    expect(lines.map((l) => [l.pid, l.size, l.qty])).toEqual([
      ['m01', 'M', 1],
      ['c01', null, 3],
    ]);
    expect(s.m[OLD_BAG_KEY]).toBeUndefined();
    expect(JSON.parse(s.m[BAG_KEY])).toHaveLength(2);
    expect(s.m[BAG_KEY]).not.toMatch(/unit/);
  });
  it('keeps a valid size, and drops a line whose size no longer exists rather than changing it', () => {
    const s = memory({
      [BAG_KEY]: JSON.stringify([
        { key: 'a', pid: 'm01', ci: 0, size: 'L', cfg: zero, qty: 1 },
        { key: 'b', pid: 'k01', ci: 0, size: 'L', cfg: zero, qty: 1 },
      ]),
    });
    const out = readBag(s, byId, lens);
    expect(out.lines.map((l) => l.size)).toEqual(['L']);
    expect(out.dropped).toBe(1);
  });
  it('drops lines that no longer match the catalogue', () => {
    const s = memory({
      [BAG_KEY]: JSON.stringify([
        { pid: 'zz9', ci: 0, cfg: zero, qty: 1 },
        { pid: 'm01', ci: 9, size: 'M', cfg: zero, qty: 1 },
        { pid: 'k01', ci: 0, size: 'M', cfg: { type: 'pg', index: '156', coats: [] }, qty: 1 },
      ]),
    });
    expect(readBag(s, byId, lens)).toMatchObject({ lines: [], dropped: 3 });
  });
  it('writes only id, colour, size, configuration and quantity', () => {
    const s = memory();
    writeBag(s, [{ key: 'a', pid: 'm01', ci: 0, size: 'M', cfg: zero, qty: 1, unit: 2490, name: 'x', rx: { pd: 63 } }]);
    expect(Object.keys(JSON.parse(s.m[BAG_KEY])[0]).sort()).toEqual(['cfg', 'ci', 'key', 'pid', 'qty', 'size']);
  });
});
