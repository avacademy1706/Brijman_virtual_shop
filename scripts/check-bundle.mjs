// Fails if the showroom's first load grew by more than 10 KB gzipped compared with the release before the try-on.
// Run after `npm run build` (npm run check does this).
import { readFileSync, existsSync } from 'node:fs';

const REPORT = new URL('../node_modules/.cache/brijman-bundle.json', import.meta.url);
// First load (entry script, stylesheet and interface chunk) of the live release before the try-on, gzipped.
const BASELINE = 32552;
const BUDGET = BASELINE + 10 * 1024;

if (!existsSync(REPORT)) {
  console.error('No bundle report found. Run npm run build first.');
  process.exit(1);
}
const { files, total } = JSON.parse(readFileSync(REPORT, 'utf8'));
for (const f of files) console.log('  ' + f.file.padEnd(40) + (f.gzip / 1024).toFixed(1).padStart(7) + ' KB');
const diff = total - BASELINE;
console.log(
  'First load: ' +
    (total / 1024).toFixed(1) +
    ' KB gzipped (' +
    (diff >= 0 ? '+' : '') +
    (diff / 1024).toFixed(1) +
    ' KB against ' +
    (BASELINE / 1024).toFixed(1) +
    ' KB; budget +10 KB).',
);
const lazy = files.filter((f) => /engine|tryon|mediapipe|frame-model|showroom/.test(f.file));
if (lazy.length) {
  console.error('The first load includes lazy code: ' + lazy.map((f) => f.file).join(', '));
  process.exit(1);
}
if (total > BUDGET) {
  console.error('The first load is over budget by ' + ((total - BUDGET) / 1024).toFixed(1) + ' KB.');
  process.exit(1);
}
