// Records which files the showroom's first screen loads, and their gzipped size, for scripts/check-bundle.mjs.
// The report goes to node_modules/.cache, never into dist/.
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../node_modules/.cache/brijman-bundle.json', import.meta.url));

/** @returns {import('vite').Plugin} */
export function bundleReport() {
  return {
    name: 'brijman-bundle-report',
    apply: 'build',
    generateBundle(_, bundle) {
      const chunks = Object.values(bundle).filter((c) => c.type === 'chunk');
      const seen = new Set();
      const add = (file) => {
        if (seen.has(file)) return;
        seen.add(file);
        const c = bundle[file];
        if (!c || c.type !== 'chunk') return;
        c.imports.forEach(add);
        for (const css of (c.viteMetadata && c.viteMetadata.importedCss) || []) seen.add(css);
      };
      const entry = chunks.find((c) => c.isEntry);
      if (entry) add(entry.fileName);
      // The interface chunk loads right after the store data, as part of the first screen.
      const app = chunks.find((c) => (c.facadeModuleId || '').replace(/\\/g, '/').endsWith('/src/ui/app.js'));
      if (app) add(app.fileName);
      const files = [...seen].map((f) => {
        const a = bundle[f];
        const src = a.type === 'chunk' ? a.code : a.source;
        return { file: f, gzip: gzipSync(Buffer.from(src), { level: 9 }).length };
      });
      mkdirSync(fileURLToPath(new URL('../node_modules/.cache/', import.meta.url)), { recursive: true });
      writeFileSync(OUT, JSON.stringify({ files, total: files.reduce((a, f) => a + f.gzip, 0) }, null, 2));
    },
  };
}
