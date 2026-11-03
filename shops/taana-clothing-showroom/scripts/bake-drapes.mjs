// Bakes the resting drape of every garment shown in the store, using the same cloth engine as the browser.
// Output: public/drapes/drapes.bin (quantised positions) and src/generated/drapes.json (index).
// Runs before every build (npm run build). It is skipped when nothing that affects the drapes has changed.
//   node scripts/bake-drapes.mjs          bake if needed
//   node scripts/bake-drapes.mjs --force  always bake
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { NY } from '../src/core/ny.js';
import '../src/data/catalogue.js';
import {
  displayGarment,
  settleOnHanger,
  settleOnBody,
  settleCurtain,
  bodyFor,
  lookGarments,
  staticLooks,
  hangerProducts,
  RES,
} from '../src/cloth/display.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_BIN = join(root, 'public/drapes/drapes.bin');
const OUT_JSON = join(root, 'src/generated/drapes.json');
const force = process.argv.includes('--force');

const SOURCES = ['sim.js', 'body.js', 'garments.js', 'poses.js', 'display.js'].map((f) => join(root, 'src/cloth', f));
const hash = createHash('sha256');
for (const f of SOURCES) hash.update(readFileSync(f));
hash.update(JSON.stringify({ p: NY.PRODUCTS, m: NY.MERCH, s: NY.SIZES, e: NY.EASE, r: RES }));
const digest = hash.digest('hex').slice(0, 16);

if (!force && existsSync(OUT_BIN) && existsSync(OUT_JSON)) {
  try {
    const prev = JSON.parse(readFileSync(OUT_JSON, 'utf8'));
    if (prev.hash === digest) {
      console.log('[bake] drapes are up to date (' + digest + ')');
      process.exit(0);
    }
  } catch {
    /* re-bake */
  }
}

const chunks = [];
let offset = 0;
const index = { version: 1, hash: digest, res: RES, items: {} };
function put(key, pos, extra) {
  let mn = [Infinity, Infinity, Infinity],
    mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3)
    for (let k = 0; k < 3; k++) {
      mn[k] = Math.min(mn[k], pos[i + k]);
      mx[k] = Math.max(mx[k], pos[i + k]);
    }
  const q = new Int16Array(pos.length);
  for (let i = 0; i < pos.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const span = mx[k] - mn[k] || 1;
      q[i + k] = Math.round(((pos[i + k] - mn[k]) / span) * 65535) - 32768;
    }
  chunks.push(Buffer.from(q.buffer));
  const item = Object.assign(
    { o: offset, n: pos.length / 3, bb: [...mn, ...mx].map((v) => +v.toFixed(5)) },
    extra || {},
  );
  offset += q.byteLength;
  return item;
}

const t0 = Date.now();
for (const p of hangerProducts(NY)) {
  const { g } = displayGarment(NY, p, 0, RES.hanger);
  const pos = settleOnHanger(g, p.fabric, bodyFor(p.kind));
  index.items['hanger:' + p.id] = put('hanger:' + p.id, pos);
}
for (const look of staticLooks(NY)) {
  const pieces = lookGarments(NY, look, RES.look);
  const { positions } = settleOnBody(pieces, bodyFor(look.kind), { mode: 'still', seconds: 2.4 });
  index.items['look:' + look.key] = { pieces: positions.map((pos, i) => put('look:' + look.key + ':' + i, pos)) };
}
index.items.curtain = put('curtain', settleCurtain().pos);
mkdirSync(dirname(OUT_BIN), { recursive: true });
mkdirSync(dirname(OUT_JSON), { recursive: true });
writeFileSync(OUT_BIN, Buffer.concat(chunks));
writeFileSync(OUT_JSON, JSON.stringify(index));
console.log(
  '[bake] ' +
    Object.keys(index.items).length +
    ' drapes, ' +
    (offset / 1024).toFixed(0) +
    ' KB, ' +
    ((Date.now() - t0) / 1000).toFixed(1) +
    ' s',
);
