// Reads data/*.json. Saves nothing: in static mode orders and bookings are demos and personal data is never stored.
import { readFileSync, statSync } from 'node:fs';

const cache = new Map();

/** Reads and parses a data file, re-reading it only when it changes on disk (so edits show up in `npm run dev`). */
function load(name) {
  const url = new URL('../../data/' + name, import.meta.url);
  const mtime = statSync(url).mtimeMs;
  const hit = cache.get(name);
  if (hit && hit.mtime === mtime) return hit.value;
  const value = JSON.parse(readFileSync(url, 'utf8'));
  cache.set(name, { mtime, value });
  return value;
}

/** @returns {import('./contract.js').Repository} */
export function createStaticRepository() {
  return {
    name: 'static',
    getStore: async () => load('store.json'),
    getCatalogue: async () => load('catalogue.json'),
    getMerchandising: async () => load('merchandising.json'),
    getLenses: async () => load('lenses.json'),
    getEyeTestConfig: async () => load('eye-test.json'),
    saveOrder: async () => ({ persisted: false }),
    saveBooking: async () => ({ persisted: false }),
  };
}
