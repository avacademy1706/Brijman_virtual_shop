import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// `npm run preview` serves the production build with the same security headers as Vercel,
// so a Content-Security-Policy problem shows up locally before you deploy.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));
const siteRule = (vercel.headers || []).find((rule) => rule.source === '/(.*)');
const previewHeaders = Object.fromEntries((siteRule ? siteRule.headers : []).map((h) => [h.key, h.value]));
delete previewHeaders['Strict-Transport-Security']; // preview runs on plain http

export default defineConfig({
  build: {
    target: 'es2020',
    sourcemap: false,
    // Emit every asset as a file. Inlined data: URLs would be blocked by the font-src 'self' policy in vercel.json.
    assetsInlineLimit: 0,
    // three.js is about 600 kB minified (about 150 kB over the network). It loads as its own chunk after the UI.
    chunkSizeWarningLimit: 900,
  },
  server: { port: 5173 },
  preview: { port: 4173, headers: previewHeaders },
});
