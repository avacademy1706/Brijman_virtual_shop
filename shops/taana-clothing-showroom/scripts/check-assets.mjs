// Checks the files the showroom and the camera try-on load at runtime.
// Run with: npm run check   (the build runs the bake and the try-on setup first, so this is a quick sanity pass)
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const problems = [];
const ok = (msg) => console.log('  ok   ' + msg);

// 1. Baked drapes
const idxPath = join(root, 'src/generated/drapes.json'),
  binPath = join(root, 'public/drapes/drapes.bin');
if (!existsSync(idxPath) || !existsSync(binPath)) problems.push('Baked drapes missing. Run: npm run bake');
else {
  const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
  const size = statSync(binPath).size;
  let need = 0;
  for (const it of Object.values(idx.items)) for (const p of it.pieces || [it]) need = Math.max(need, p.o + p.n * 6);
  if (need > size) problems.push('drapes.bin is shorter than its index. Run: npm run bake');
  else ok(Object.keys(idx.items).length + ' baked drapes (' + (size / 1024).toFixed(0) + ' KB, ' + idx.hash + ')');
}

// 2. MediaPipe runtime
const pkg = JSON.parse(readFileSync(join(root, 'node_modules/@mediapipe/tasks-vision/package.json'), 'utf8'));
for (const f of [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]) {
  const p = join(root, 'public/vendor/mediapipe', pkg.version, 'wasm', f);
  if (!existsSync(p)) problems.push('Missing ' + f + '. Run: npm run setup:tryon');
}
if (!problems.some((p) => p.includes('wasm'))) ok('MediaPipe ' + pkg.version + ' runtime');

// 3. Pose models and their pinned checksums
const lockPath = join(root, 'models/models.lock.json');
const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : {};
for (const name of ['lite', 'full']) {
  const p = join(root, 'public/models/pose_landmarker_' + name + '.task');
  if (!existsSync(p)) {
    if (name === 'lite')
      problems.push('Pose model (lite) missing: the camera try-on will not start. Run: npm run setup:tryon');
    else console.log('  note full model not present (optional; desktop uses lite instead)');
    continue;
  }
  const h = createHash('sha256').update(readFileSync(p)).digest('hex');
  if (lock[name] && lock[name].sha256 !== h) problems.push(name + ' model does not match models/models.lock.json');
  else ok(name + ' pose model' + (lock[name] ? ' (checksum pinned)' : ''));
}

if (problems.length) {
  console.error('\n' + problems.map((p) => '  fail ' + p).join('\n'));
  process.exit(1);
}
console.log('\nAll runtime assets are in place.');
