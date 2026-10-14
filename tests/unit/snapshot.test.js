// Proves the move from JavaScript to data/*.json changed nothing: BM rebuilt from the JSON equals the old snapshot.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { BM } from '../../src/core/bm.js';
import { installData } from '../../src/data/catalogue.js';
import { buildBootstrap } from '../../shared/bootstrap.js';

const read = (f) => JSON.parse(readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
const snapshot = read('tests/fixtures/pre-migration-snapshot.json');

describe('data migration', () => {
  installData(
    buildBootstrap({
      store: read('data/store.json'),
      catalogue: read('data/catalogue.json'),
      merchandising: read('data/merchandising.json'),
      lenses: read('data/lenses.json'),
    }),
  );
  const now = JSON.parse(
    JSON.stringify({
      PRODUCTS: BM.PRODUCTS,
      MERCH: BM.MERCH,
      LENS: BM.LENS,
      STORE: BM.STORE,
      ZONES: BM.ZONES,
      TOUR: BM.TOUR,
      TOUR_TEXT: BM.TOUR_TEXT,
    }),
  );

  for (const key of Object.keys(snapshot)) {
    it(key + ' is unchanged', () => {
      expect(now[key]).toEqual(snapshot[key]);
    });
  }

  it('indexes every product by id', () => {
    expect(Object.keys(BM.byId)).toHaveLength(48);
    expect(BM.byId.m01.name).toBe('Arlo');
  });
});
