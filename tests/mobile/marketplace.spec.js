// The marketplace front page on every device profile, and (on one phone and one desktop) a walk into each shop and
// back. Runs with the mobile audit: npm run test:mobile.
import { test, expect } from '@playwright/test';

const SHOPS = [
  { name: 'Brijman Eyewear', path: '/eyewear/' },
  { name: 'Brijman Opticals Salon', path: '/opticals/' },
  { name: 'Taana Studio', path: '/clothing/' },
  { name: 'Kanak Fine Jewellery', path: '/jewellery/' },
];
const READY = /Showroom ready|Salon ready|boutique is open|floor plan stands in/;

test('marketplace', async ({ page, browserName }, info) => {
  const project = info.project.name;
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/GPU stall|WebGL: |GroupMarkerNotSet|INFO: /.test(m.text()))
      errors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 200)));
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      window.__csp.push(e.violatedDirective + ' ' + e.blockedURI),
    );
  });

  await page.goto('/');
  await page.waitForSelector('.mk-card');
  const m = await page.evaluate(() => {
    const doors = [...document.querySelectorAll('.mk-door')].map((d) => d.getBoundingClientRect().bottom);
    return {
      cards: document.querySelectorAll('.mk-card').length,
      overflow: document.documentElement.scrollWidth - innerWidth,
      artGap: document.querySelector('#shops-title').getBoundingClientRect().top - Math.max(...doors),
      small: [...document.querySelectorAll('a, button')]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          // the card's link is stretched over the whole card; the skip link is off screen until focused
          if (!r.width || e.matches('.skip, .mk-card-link')) return false;
          return r.height < 44 || r.width < 44;
        })
        .map((e) => (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24)),
    };
  });
  expect.soft(m.cards, 'one card per shop').toBe(SHOPS.length);
  expect.soft(m.overflow, 'no horizontal scrolling').toBeLessThanOrEqual(0);
  expect.soft(m.artGap, 'hero art clear of the shops heading').toBeGreaterThanOrEqual(8);
  expect.soft(m.small, 'tap targets 44 px or more').toEqual([]);

  // Category filter, as a radio group
  await page.click('.mk-chip:has-text("Jewellery")');
  await expect(page.locator('.mk-card')).toHaveCount(1);
  await expect(page.locator('.mk-chip[aria-checked="true"]')).toHaveText('Jewellery');
  await page.click('.mk-chip:has-text("All shops")');
  await expect(page.locator('.mk-card')).toHaveCount(SHOPS.length);

  // Bag counts come from each shop's saved bag.
  await page.evaluate(() => {
    localStorage.setItem(
      'taana-bag-v1',
      JSON.stringify([
        { pid: 'a', qty: 2 },
        { pid: 'b', qty: 1 },
      ]),
    );
    localStorage.setItem('bm-bag-v2', JSON.stringify([{ pid: 'm01', qty: 1 }]));
    localStorage.removeItem('kanak-bag-v1');
  });
  await page.reload();
  await page.waitForSelector('.mk-card');
  const badges = await page.$$eval('.mk-card', (cs) =>
    cs.map((c) => c.querySelector('.mk-bag-badge')?.textContent || '-'),
  );
  expect.soft(badges).toEqual(['1 item', '-', '3 items', '-']);

  // Into each shop and back: one Android phone and one desktop (the 3D stores are slow on software graphics).
  if (browserName === 'chromium' && (project === 'Pixel 7' || project === 'Desktop 1366')) {
    for (const shop of SHOPS) {
      await page.goto('/');
      await page.click('.mk-card-link:has-text("' + shop.name + '")');
      await page.waitForURL('**' + shop.path);
      await page.waitForFunction(
        (re) => new RegExp(re).test(document.querySelector('#status-text')?.textContent || ''),
        READY.source,
        { timeout: 120000 },
      );
      expect.soft(await page.evaluate(() => window.__csp), shop.name + ': no CSP violations').toEqual([]);
      // Leaving a shop that is drawing in software graphics can take a while in the test browser.
      await page.click('#welcome .market-back', { noWaitAfter: true });
      await page.waitForURL((u) => u.pathname === '/', { timeout: 120000 });
      await expect(page.locator('#resume b')).toHaveText(shop.name);
    }
  }
  expect.soft(await page.evaluate(() => window.__csp), 'no CSP violations').toEqual([]);
  expect.soft(errors, 'no console errors').toEqual([]);
});
