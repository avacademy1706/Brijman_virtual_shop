// Read-only catalogue views: the bootstrap payload, store details, product search and lens options.
import { buildBootstrap } from '../../shared/bootstrap.js';
import { shapeOf } from '../../shared/frame-archetypes.js';
import { sha256 } from '../lib/hash.js';
import { notFound } from '../lib/errors.js';

// Payloads and ETags are recomputed only when a data file object changes (the static repository caches by mtime).
const memo = new WeakMap();
function withEtag(key, build) {
  const hit = memo.get(key);
  if (hit) return hit;
  const data = build();
  const value = { data, etag: '"' + sha256(JSON.stringify(data)).slice(0, 32) + '"' };
  memo.set(key, value);
  return value;
}

/**
 * Everything the first screen needs: store, zones, tour, catalogue, merchandising and lenses.
 * @param {import('../repositories/contract.js').Repository} repo
 * @returns {Promise<{data: object, etag: string}>}
 */
export async function getBootstrap(repo) {
  const [store, catalogue, merchandising, lenses] = await Promise.all([
    repo.getStore(),
    repo.getCatalogue(),
    repo.getMerchandising(),
    repo.getLenses(),
  ]);
  // Key on the catalogue object, and rebuild if any other file changed since.
  const files = { store, catalogue, merchandising, lenses };
  const prev = memo.get(catalogue);
  if (prev && prev.files.store === store && prev.files.merchandising === merchandising && prev.files.lenses === lenses)
    return prev;
  memo.delete(catalogue);
  const value = withEtag(catalogue, () => buildBootstrap(files));
  value.files = files;
  return value;
}

/**
 * Store details, zones and tour.
 * @param {import('../repositories/contract.js').Repository} repo
 */
export async function getStoreInfo(repo) {
  const s = await repo.getStore();
  return withEtag(s, () => ({ store: s.store, zones: s.zones, tour: s.tour, tourText: s.tourText }));
}

/**
 * Lens types, index, coatings, sun options and prescription options.
 * @param {import('../repositories/contract.js').Repository} repo
 */
export async function getLensOptions(repo) {
  const lenses = await repo.getLenses();
  return withEtag(lenses, () => lenses);
}

/**
 * Filters the catalogue. Every filter is optional; text search matches name, description, material, tags and colours.
 * @param {import('../repositories/contract.js').Repository} repo
 * @param {{zone?: string, q?: string, shape?: string, material?: string, polarised?: string, maxPrice?: number, type?: string}} f
 */
export async function listProducts(repo, f) {
  const { products } = await repo.getCatalogue();
  const words = (f.q || '').toLowerCase().split(/\s+/).filter(Boolean);
  const text = (p) =>
    [p.name, p.desc, p.mat || '', (p.tags || []).join(' '), (p.colors || []).map((c) => c.n).join(' ')]
      .join(' ')
      .toLowerCase();
  const price = (p) => (p.type === 'frame' ? p.price : Math.min(...p.packs.map((x) => x.p)));
  return products.filter(
    (p) =>
      (!f.zone || p.zone === f.zone) &&
      (!f.type || p.type === f.type) &&
      (!f.shape || shapeOf(p) === f.shape) &&
      (!f.material || (p.mat || '').toLowerCase().includes(f.material.toLowerCase())) &&
      (f.polarised === undefined || !!p.polar === (f.polarised === 'true')) &&
      (f.maxPrice === undefined || price(p) <= f.maxPrice) &&
      words.every((w) => text(p).includes(w)),
  );
}

/**
 * One product by id.
 * @param {import('../repositories/contract.js').Repository} repo
 * @param {string} id
 */
export async function getProduct(repo, id) {
  const { products } = await repo.getCatalogue();
  const p = products.find((x) => x.id === id);
  if (!p) throw notFound('No product with id "' + String(id).slice(0, 20) + '".');
  return p;
}
