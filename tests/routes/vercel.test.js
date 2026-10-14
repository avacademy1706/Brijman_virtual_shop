// The Vercel Function entry and vercel.json: the rewritten request keeps its original path and reaches the router.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import handler from '../../api/index.js';

const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
const vercelignore = readFileSync(new URL('../../.vercelignore', import.meta.url), 'utf8');

describe('Vercel entry', () => {
  it('exports a fetch handler that routes the original /api path', async () => {
    expect(typeof handler.fetch).toBe('function');
    const res = await handler.fetch(new Request('https://brijman.example/api/v1/products/m01'));
    expect(res.status).toBe(200);
    expect((await res.json()).data.id).toBe('m01');
  });
});

describe('vercel.json', () => {
  it('rewrites /api/* to the single function, in Mumbai, with a 10 s limit and the data files', () => {
    expect(vercel.rewrites).toEqual([{ source: '/api/(.*)', destination: '/api' }]);
    expect(vercel.regions).toEqual(['bom1']);
    expect(vercel.functions['api/index.js']).toMatchObject({ maxDuration: 10, includeFiles: 'data/**' });
  });
  it('keeps the security headers and sets no API cache rule', () => {
    const site = vercel.headers.find((h) => h.source === '/(.*)').headers.map((h) => h.key);
    for (const k of [
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'Strict-Transport-Security',
      'Permissions-Policy',
    ])
      expect(site).toContain(k);
    expect(vercel.headers.some((h) => h.source.startsWith('/api'))).toBe(false);
    const csp = vercel.headers
      .find((h) => h.source === '/(.*)')
      .headers.find((h) => h.key === 'Content-Security-Policy');
    expect(csp.value).toMatch(/connect-src 'self'/);
  });
  it("allows only what the try-on needs: 'wasm-unsafe-eval' and camera=(self)", () => {
    const site = vercel.headers.find((h) => h.source === '/(.*)').headers;
    const csp = site.find((h) => h.key === 'Content-Security-Policy').value;
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval';");
    expect(csp).not.toMatch(/unsafe-eval'(?<!wasm-unsafe-eval')|https?:/);
    expect(csp).not.toContain('worker-src');
    const pp = site.find((h) => h.key === 'Permissions-Policy').value;
    expect(pp).toBe('camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
  });
  it('caches the versioned MediaPipe files for a year', () => {
    const rule = vercel.headers.find((h) => h.source === '/vendor/mediapipe/(.*)');
    expect(rule.headers).toEqual([{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]);
  });
  it('.vercelignore excludes only assets-3d/', () => {
    expect(vercelignore.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'))).toEqual(['assets-3d/']);
  });
});
