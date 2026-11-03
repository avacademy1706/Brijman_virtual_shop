// The production build as Vercel serves it: security headers present, and nothing is requested from other sites.
import { test, expect } from '@playwright/test';
import { openStore, explore } from './helpers.js';

test.describe('security', () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== 'laptop', 'runs once, on the laptop screen');
  });

  test('sends the security headers', async ({ request }) => {
    const res = await request.get('/');
    expect(res.ok()).toBe(true);
    const h = res.headers();
    expect(h['content-security-policy']).toContain("default-src 'self'");
    expect(h['content-security-policy']).toContain("connect-src 'self'");
    // 'wasm-unsafe-eval' (MediaPipe's WebAssembly) is allowed; plain 'unsafe-eval' is not
    expect(h['content-security-policy']).not.toContain("'unsafe-eval'");
    expect(h['content-security-policy']).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(h['permissions-policy']).toContain('camera=(self)');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('SAMEORIGIN');
  });

  test('loads everything from this site only', async ({ page, baseURL }, testInfo) => {
    const outside = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.protocol.startsWith('http') && u.origin !== new URL(baseURL).origin) outside.push(r.url());
    });
    await openStore(page, testInfo);
    await explore(page);
    await page.evaluate(() => window.NY.onProductTap('s04', 0));
    await expect(page.locator('#sheet.open')).toBeVisible();
    await page.waitForTimeout(1500);
    expect(outside).toEqual([]);
  });

  test('does not serve environment or config files', async ({ request }) => {
    for (const path of ['/.env', '/.env.local', '/vercel.json', '/package.json'])
      expect((await request.get(path)).headers()['content-type'] || '', path).not.toMatch(/json|plain/);
  });
});
