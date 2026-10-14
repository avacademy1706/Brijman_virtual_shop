// Copies the MediaPipe wasm runtime from node_modules into public/vendor/mediapipe/<version>/wasm/ and checks the
// face model's SHA-256. Runs before dev, build and preview, so MediaPipe is always self-hosted (never a CDN).
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = join(root, 'node_modules', '@mediapipe', 'tasks-vision');
const MODEL = join(root, 'public', 'vendor', 'mediapipe', 'models', 'float16-1', 'face_landmarker.task');
const MODEL_SHA256 = '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff';
// The loader picks the SIMD build when the browser supports it, otherwise the no-SIMD build.
const FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

function fail(msg) {
  console.error('\n[copy-mediapipe] ' + msg + '\n');
  process.exit(1);
}

if (!existsSync(pkgDir)) fail('@mediapipe/tasks-vision is not installed. Run npm ci first.');
const { version } = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
const vendor = join(root, 'public', 'vendor', 'mediapipe');
const dest = join(vendor, version, 'wasm');

if (!existsSync(MODEL))
  fail('The face model is missing: public/vendor/mediapipe/models/float16-1/face_landmarker.task');
const hash = createHash('sha256').update(readFileSync(MODEL)).digest('hex');
if (hash !== MODEL_SHA256)
  fail(
    'face_landmarker.task does not match the expected SHA-256.\n  expected ' +
      MODEL_SHA256 +
      '\n  found    ' +
      hash +
      '\nDownload it again from the official URL in docs/try-on.md.',
  );

// Remove runtimes of other versions so stale files are never served.
for (const d of readdirSync(vendor))
  if (d !== 'models' && d !== version && statSync(join(vendor, d)).isDirectory())
    rmSync(join(vendor, d), { recursive: true, force: true });

mkdirSync(dest, { recursive: true });
let copied = 0;
for (const f of FILES) {
  const from = join(pkgDir, 'wasm', f),
    to = join(dest, f);
  if (!existsSync(from)) fail('Missing ' + f + ' in @mediapipe/tasks-vision ' + version + '.');
  if (!existsSync(to) || statSync(to).size !== statSync(from).size) {
    copyFileSync(from, to);
    copied++;
  }
}
console.log('[copy-mediapipe] MediaPipe ' + version + ' ready (' + copied + ' file(s) copied, model hash OK).');
