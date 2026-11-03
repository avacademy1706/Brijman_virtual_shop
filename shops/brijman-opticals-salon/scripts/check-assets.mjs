// Checks the files the salon and the camera try-on load at runtime (the salon itself is procedural and needs
// none besides its fonts). Run with: npm run check   (the build runs the try-on setup first)
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const problems = [];
const ok = (msg) => console.log('  ok   ' + msg);

// 1. Fonts (self-hosted, so no Google Fonts request at runtime)
for (const f of [
  'bodoni-moda-latin-500-normal.woff2',
  'bodoni-moda-latin-500-italic.woff2',
  'jost-latin-400-normal.woff2',
]) {
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

// 3. The face model and its pinned checksum
const lockPath = join(root, 'models/models.lock.json');
const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : {};
{
  const file = 'face_landmarker.task';
  const p = join(root, 'public/models', file);
  if (!existsSync(p)) problems.push(file + ' missing: the camera try-on will not start. Run: npm run setup:tryon');
  else {
    const h = createHash('sha256').update(readFileSync(p)).digest('hex');
    if (lock.face && lock.face.sha256 !== h) problems.push(file + ' does not match models/models.lock.json');
    else ok('face model' + (lock.face ? ' (checksum pinned)' : ''));
  }
}

if (problems.length) {
  console.error('\n' + problems.map((p) => '  fail ' + p).join('\n'));
  process.exit(1);
}
console.log('\nAll runtime assets are in place.');
