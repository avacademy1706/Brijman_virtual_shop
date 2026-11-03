// Checks the files the camera try-on loads at runtime (the boutique itself is fully procedural and needs none).
// Run with: npm run check   (the build runs the try-on setup first, so this is a quick sanity pass)
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const problems = [];
const ok = (msg) => console.log('  ok   ' + msg);

// 1. Fonts (self-hosted, so no Google Fonts request at runtime)
for (const f of ['cormorant-garamond-latin-500-normal.woff2', 'jost-latin-400-normal.woff2']) {
  if (!existsSync(join(root, 'src/assets/fonts', f))) problems.push('Missing font ' + f);
}
if (!problems.length) ok('self-hosted fonts');

// 2. MediaPipe runtime
const pkg = JSON.parse(readFileSync(join(root, 'node_modules/@mediapipe/tasks-vision/package.json'), 'utf8'));
let wasmOk = true;
for (const f of [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]) {
  const p = join(root, 'public/vendor/mediapipe', pkg.version, 'wasm', f);
  if (!existsSync(p)) {
    problems.push('Missing ' + f + '. Run: npm run setup:tryon');
    wasmOk = false;
  }
}
if (wasmOk) ok('MediaPipe ' + pkg.version + ' runtime');

// 3. Face and hand models and their pinned checksums
const lockPath = join(root, 'models/models.lock.json');
const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : {};
for (const [name, file, use] of [
  ['face', 'face_landmarker.task', 'earrings, necklaces, tikka, nath'],
  ['hand', 'hand_landmarker.task', 'rings, bangles'],
]) {
  const p = join(root, 'public/models', file);
  if (!existsSync(p)) {
    problems.push(file + ' missing: the camera try-on for ' + use + ' will not start. Run: npm run setup:tryon');
    continue;
  }
  const h = createHash('sha256').update(readFileSync(p)).digest('hex');
  if (lock[name] && lock[name].sha256 !== h) problems.push(file + ' does not match models/models.lock.json');
  else ok(name + ' model' + (lock[name] ? ' (checksum pinned)' : ''));
}

// 4. Imported jewellery models (optional): every file listed in src/data/jewellery-models.json is present
const modelsPath = join(root, 'src/data/jewellery-models.json');
const models = existsSync(modelsPath) ? JSON.parse(readFileSync(modelsPath, 'utf8')) : {};
let modelProblems = 0;
for (const [id, m] of Object.entries(models))
  for (const f of [m.file, m.store])
    if (!existsSync(join(root, 'public', f))) {
      problems.push(id + ': ' + f + ' is missing. Run: npm run models');
      modelProblems++;
    }
const n = Object.keys(models).length;
if (!modelProblems)
  ok(
    n ? n + ' imported jewellery model' + (n > 1 ? 's' : '') : 'no imported jewellery models (all pieces are built in)',
  );

if (problems.length) {
  console.error('\n' + problems.map((p) => '  fail ' + p).join('\n'));
  process.exit(1);
}
console.log('\nAll runtime assets are in place.');
