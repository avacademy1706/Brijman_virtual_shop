// Builds the marketplace's other shops (each a separate Vite project in shops/<folder>/, with its own package.json and
// lockfile) into public/<path>/, so the main Vite server and build serve them at /<path>/ next to the eyewear shop.
//
//   node scripts/build-shops.mjs          build the shops whose files changed since their last build
//   node scripts/build-shops.mjs --force  build every shop
//
// On Vercel (VERCEL=1) or with --force every shop is built from scratch. A shop's own build downloads its try-on model
// on the first run (see shops/<folder>/scripts/setup-tryon.mjs); on Vercel that build stops if the model cannot be
// downloaded, rather than publishing a try-on that cannot start.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SHOP_BUILDS } from '../shared/marketplace.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const STAMPS = join(ROOT, 'node_modules', '.cache', 'shops');
const force = process.argv.includes('--force') || !!process.env.VERCEL || !!process.env.CI;
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// Files that change a shop's build. Generated folders (public/vendor, public/models) are left out.
const SKIP = new Set([
  'node_modules',
  'dist',
  'test-results',
  'playwright-report',
  'vendor',
  'tests',
  'docs',
  '.claude',
]);
function hashShop(dir) {
  const h = createHash('sha256');
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      if (SKIP.has(name) || name.endsWith('.task') || name.endsWith('.part')) continue;
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else h.update(relative(dir, p) + '\0' + st.size + '\0').update(readFileSync(p));
    }
  };
  walk(dir);
  return h.digest('hex');
}

function run(args, cwd) {
  const r = spawnSync(npm, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error('[build-shops] "npm ' + args.join(' ') + '" failed in ' + relative(ROOT, cwd));
    process.exit(r.status || 1);
  }
}

mkdirSync(STAMPS, { recursive: true });
for (const shop of SHOP_BUILDS) {
  const dir = join(ROOT, 'shops', shop.folder);
  const out = join(ROOT, 'public', shop.path);
  const stampFile = join(STAMPS, shop.path + '.txt');
  if (!existsSync(join(dir, 'package.json'))) {
    console.error('[build-shops] Missing shop folder: shops/' + shop.folder);
    process.exit(1);
  }
  // Install the shop's exact dependencies the first time, and again when its lockfile changes.
  const lock = readFileSync(join(dir, 'package-lock.json'));
  const lockHash = createHash('sha256').update(lock).digest('hex');
  const lockStamp = join(dir, 'node_modules', '.marketplace-lock');
  if (!existsSync(lockStamp) || readFileSync(lockStamp, 'utf8') !== lockHash) {
    console.log('[build-shops] Installing ' + shop.folder + ' …');
    run(['ci', '--no-audit', '--no-fund'], dir);
    writeFileSync(lockStamp, lockHash);
  }
  const hash = hashShop(dir);
  if (
    !force &&
    existsSync(join(out, 'index.html')) &&
    existsSync(stampFile) &&
    readFileSync(stampFile, 'utf8') === hash
  ) {
    console.log('[build-shops] ' + shop.folder + ' is up to date at /' + shop.path + '/');
    continue;
  }
  console.log('[build-shops] Building ' + shop.folder + ' for /' + shop.path + '/ …');
  run(['run', 'build', '--', '--base=/' + shop.path + '/', '--outDir=' + out, '--emptyOutDir'], dir);
  // Fingerprint again: the first build pins the try-on models' checksums in models/models.lock.json.
  writeFileSync(stampFile, hashShop(dir));
}
console.log('[build-shops] Shops ready: ' + SHOP_BUILDS.map((s) => '/' + s.path + '/').join(', '));
