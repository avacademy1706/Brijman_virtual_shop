// Prepares the files the camera try-on loads from this site (no third-party CDN at runtime):
//   1. copies the MediaPipe Tasks Vision WASM runtime from node_modules into public/vendor/mediapipe/<version>/wasm
//   2. downloads the Face Landmarker model (478 face points with irises) from Google's official MediaPipe model bucket
//      into public/models (only when missing), and pins their SHA-256 in models/models.lock.json on first download.
// Runs automatically before `npm run dev` and `npm run build`. Safe to run any time.
//   node scripts/setup-tryon.mjs            copy + download if missing
//   node scripts/setup-tryon.mjs --offline  copy only (the try-on then shows a "model not installed" message)
// No secrets or tokens are needed: the models are public files.
// On Vercel (VERCEL=1) or with TRYON_STRICT=1 a missing required model fails the build, so a site without a
// working try-on is never deployed by accident. Set TRYON_OPTIONAL=1 to deploy without it on purpose.
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  renameSync,
  unlinkSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'node_modules/@mediapipe/tasks-vision/package.json'), 'utf8'));
const VERSION = pkg.version;
const offline = process.argv.includes('--offline');

// 1. WASM runtime
const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const dst = join(root, 'public/vendor/mediapipe', VERSION, 'wasm');
mkdirSync(dst, { recursive: true });
let copied = 0;
// the SIMD runtime plus the no-SIMD fallback; the ES-module variant is not used
for (const f of readdirSync(src).filter((n) => !n.includes('_module_'))) {
  const a = join(src, f),
    b = join(dst, f);
  if (!existsSync(b) || statSync(b).size !== statSync(a).size) {
    copyFileSync(a, b);
    copied++;
  }
}
console.log(
  '[setup-tryon] MediaPipe ' + VERSION + ' runtime ' + (copied ? 'copied (' + copied + ' files)' : 'up to date'),
);

// 2. Models (Apache-2.0, published by Google for MediaPipe)
export const MODELS = {
  face: {
    file: 'face_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    use: 'glasses',
  },
};
const modelsDir = join(root, 'public/models');
const lockPath = join(root, 'models/models.lock.json');
mkdirSync(modelsDir, { recursive: true });
mkdirSync(dirname(lockPath), { recursive: true });
const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : {};
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const strict = (process.env.VERCEL === '1' || process.env.TRYON_STRICT === '1') && process.env.TRYON_OPTIONAL !== '1';
/** Downloads a model, trying up to three times (60 s each) with a short pause between tries. */
async function download(url) {
  let last = null;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1_000_000) throw new Error('unexpected size ' + buf.length);
      return buf;
    } catch (e) {
      last = e;
      if (i < 2) await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw last;
}
let failed = false;
for (const [name, m] of Object.entries(MODELS)) {
  const file = join(modelsDir, m.file);
  if (existsSync(file)) {
    const h = sha(readFileSync(file));
    if (lock[name] && lock[name].sha256 !== h) {
      console.error('[setup-tryon] ' + m.file + ' does not match models/models.lock.json. Delete it and run again.');
      process.exitCode = 1;
    } else if (!lock[name]) lock[name] = { url: m.url, sha256: h, bytes: statSync(file).size };
    continue;
  }
  if (offline) {
    console.warn('[setup-tryon] ' + m.file + ' missing (offline). Download it from ' + m.url);
    continue;
  }
  try {
    const buf = await download(m.url);
    const h = sha(buf);
    if (lock[name] && lock[name].sha256 !== h) throw new Error('checksum differs from models/models.lock.json');
    writeFileSync(file + '.part', buf);
    renameSync(file + '.part', file);
    lock[name] = { url: m.url, sha256: h, bytes: buf.length };
    console.log('[setup-tryon] downloaded ' + m.file + ' (' + (buf.length / 1e6).toFixed(1) + ' MB)');
  } catch (e) {
    if (existsSync(file + '.part')) unlinkSync(file + '.part');
    failed = true;
    console.warn('[setup-tryon] could not download ' + m.file + ': ' + e.message);
  }
}
writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
const missing = Object.entries(MODELS).filter(([, m]) => !existsSync(join(modelsDir, m.file)));
if (missing.length) {
  for (const [, m] of missing)
    console.warn(
      '[setup-tryon] ' +
        m.file +
        ' is missing: the camera try-on for ' +
        m.use +
        ' will not start. Everything else works.',
    );
  if (failed) console.warn('[setup-tryon] Check your connection and run: npm run setup:tryon');
  if (strict && !offline) {
    console.error(
      '[setup-tryon] Build stopped: the camera try-on would not work on this deployment. Redeploy to retry the ' +
        'download, or set TRYON_OPTIONAL=1 to deploy without the try-on.',
    );
    process.exit(1);
  }
} else console.log('[setup-tryon] model ready: face');
