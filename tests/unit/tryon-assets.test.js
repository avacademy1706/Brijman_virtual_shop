// MediaPipe self-hosting, the try-on's engine boundary and privacy-safe analytics.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { track } from '../../src/tryon/analytics.js';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

describe('MediaPipe self-hosting', () => {
  it('pins @mediapipe/tasks-vision to 1.0.1 and the engine uses the same version path', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.dependencies['@mediapipe/tasks-vision']).toBe('1.0.1');
    const installed = JSON.parse(read('node_modules/@mediapipe/tasks-vision/package.json')).version;
    expect(read('src/tryon/engine.js')).toContain("export const MEDIAPIPE_VERSION = '" + installed + "'");
  });
  it('commits the face model with the recorded SHA-256 and never loads MediaPipe from another origin', () => {
    const model = new URL('public/vendor/mediapipe/models/float16-1/face_landmarker.task', root);
    expect(existsSync(model)).toBe(true);
    const hash = createHash('sha256').update(readFileSync(model)).digest('hex');
    expect(hash).toBe('64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff');
    expect(read('scripts/copy-mediapipe.mjs')).toContain(hash);
    expect(read('docs/decisions.md')).toContain(hash);
    for (const f of ['src/tryon/engine.js', 'src/tryon/ui.js']) expect(read(f)).not.toMatch(/https?:\/\//);
  });
  it('copies the wasm before dev, build and preview, and keeps the copies out of git', () => {
    const s = JSON.parse(read('package.json')).scripts;
    for (const k of ['predev', 'prebuild', 'prepreview']) expect(s[k]).toBe('node scripts/copy-mediapipe.mjs');
    expect(read('.gitignore')).toContain('public/vendor/mediapipe/*/wasm/');
  });
  it('is lazy: the showroom entry and interface never import the try-on statically', () => {
    for (const f of ['src/main.js', 'src/ui/app.js']) {
      const src = read(f);
      expect(src).not.toMatch(/^import[^;]*tryon/m);
      expect(src).not.toMatch(/^import[^;]*@mediapipe/m);
    }
    expect(read('src/ui/app.js')).toContain("import('../tryon/ui.js')");
  });
  it('exposes the engine interface the UI depends on', () => {
    const src = read('src/tryon/engine.js');
    for (const m of ['start(source)', 'setFrame(productId, colourIndex, sizeId)', 'snapshot()', 'stop()', 'on(ev, fn)'])
      expect(src).toContain(m);
  });
});

describe('try-on analytics', () => {
  it('passes only the allowed events and properties', () => {
    expect(track('tryon_open', { productId: 'm01', faceWidthMm: 131, photo: 'x' })).toEqual({
      event: 'tryon_open',
      props: { productId: 'm01' },
    });
    expect(track('face_landmarks', { x: 1 })).toBeNull();
  });
  it('reports fit only as good, narrow or wide, never a measurement', () => {
    expect(track('fit_result', { result: 'good', diff: -3 })).toEqual({
      event: 'fit_result',
      props: { result: 'good' },
    });
    expect(track('fit_result', { result: '131.2' })).toBeNull();
  });
});
