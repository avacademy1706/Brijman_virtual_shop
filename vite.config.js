import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

import { apiPlugin } from './server/vite-api-plugin.js';
import { bundleReport } from './server/bundle-report-plugin.js';
import { SHOP_BUILDS } from './shared/marketplace.js';

// The site is the marketplace (index.html) with the eyewear shop at /eyewear/ (eyewear/index.html). The other shops
// are built from shops/<folder>/ into public/<path>/ by scripts/build-shops.mjs and served from there.
//
// `npm run preview` serves the production build with the same security headers as Vercel, so a Content-Security-Policy
// problem shows up locally before you deploy. vercel.json has one rule for the shops' paths and one for the rest.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));
const SHOP_RE = new RegExp('^/(' + SHOP_BUILDS.map((s) => s.path).join('|') + ')(/|$)');
const headersOf = (pick) => {
  const rule = (vercel.headers || []).find(
    (r) => r.headers.some((h) => h.key === 'Content-Security-Policy') && pick(r.source),
  );
  const out = Object.fromEntries((rule ? rule.headers : []).map((h) => [h.key, h.value]));
  delete out['Strict-Transport-Security']; // preview runs on plain http
  // Safari and WebKit apply upgrade-insecure-requests even to http://localhost, so the local preview would fail to load
  // its own files. Production (https on Vercel) keeps the directive.
  if (out['Content-Security-Policy'])
    out['Content-Security-Policy'] = out['Content-Security-Policy'].replace(/;\s*upgrade-insecure-requests/, '');
  return out;
};
const isShopRule = (src) => src.startsWith('/(' + SHOP_BUILDS.map((s) => s.path).join('|') + ')');
const siteHeaders = headersOf((src) => !isShopRule(src));
const shopHeaders = headersOf(isShopRule);

/**
 * Serves the shops' folders like Vercel does: /clothing → /clothing/, /clothing/ → /clothing/index.html; and, in
 * preview, sends each path the headers vercel.json gives it.
 * @returns {import('vite').Plugin}
 */
function shopsPlugin() {
  const route = (withHeaders) => (req, res, next) => {
    const [path, query = ''] = req.url.split('?');
    const q = query ? '?' + query : '';
    const m = path.match(/^\/([a-z]+)$/);
    if (m && (m[1] === 'eyewear' || SHOP_RE.test(path))) {
      res.statusCode = 308;
      res.setHeader('Location', path + '/' + q);
      return res.end();
    }
    if (withHeaders && !path.startsWith('/api/')) {
      for (const [k, v] of Object.entries(SHOP_RE.test(path) ? shopHeaders : siteHeaders)) res.setHeader(k, v);
    }
    if (SHOP_RE.test(path) && path.endsWith('/')) req.url = path + 'index.html' + q;
    next();
  };
  return {
    name: 'plexus-shops',
    configureServer(server) {
      server.middlewares.use(route(false));
    },
    configurePreviewServer(server) {
      server.middlewares.use(route(true));
    },
  };
}

export default defineConfig({
  plugins: [shopsPlugin(), apiPlugin(), bundleReport()],
  build: {
    target: 'es2020',
    sourcemap: false,
    // Emit every asset as a file. Inlined data: URLs would be blocked by the font-src 'self' policy in vercel.json.
    assetsInlineLimit: 0,
    // three.js is about 600 kB minified (about 150 kB over the network). It loads as its own chunk after the UI.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        market: 'index.html',
        eyewear: 'eyewear/index.html',
      },
    },
  },
  // The API is same-origin only, so the dev and preview servers send no CORS headers either.
  server: { port: 5173, cors: false },
  preview: { port: 4173, cors: false },
});
