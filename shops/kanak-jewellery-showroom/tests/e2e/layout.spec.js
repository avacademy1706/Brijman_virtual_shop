// Responsive layout on every screen in playwright.config.js: nothing off screen, nothing under a notch or home
// bar, floating controls never cover each other, panels fit, and buttons are big enough for fingers.
import { test, expect } from '@playwright/test';
import {
  openStore,
  explore,
  expectInsideSafeArea,
  expectNoOverlap,
  expectNoSideScroll,
  expectTapTargets,
  settled,
  shot,
  realProblems,
} from './helpers.js';

// floating controls over the 3D view
const CHROME = ['.topbar', '#minimap', '#zonecard', '#tourcard', '#here', '.bottombar'];

test.describe('layout', () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name === 'no-webgl', 'covered by fallback.spec.js');
  });

  test('fits the screen on arrival, while exploring and with panels open', async ({ page }, testInfo) => {
    const problems = await openStore(page, testInfo);
    const touch = testInfo.project.use.hasTouch;

    await test.step('welcome card', async () => {
      await expectNoSideScroll(page);
      await expectInsideSafeArea(page, testInfo, ['#welcome', '.topbar', '.bottombar', '#w-explore', '#w-tour']);
      if (touch) await expectTapTargets(page, '#welcome .btn');
      await shot(page, testInfo, '1-welcome');
    });

    await test.step('exploring: floating controls', async () => {
      await explore(page);
      await page.evaluate(() => window.NY.api.goZone('polki'));
      await expect(page.locator('#zonecard')).toBeVisible();
      await page.waitForTimeout(800);
      await expectNoSideScroll(page);
      await expectInsideSafeArea(page, testInfo, [...CHROME, '#hint', '#toast']);
      await expectNoOverlap(page, CHROME);
      if (touch) await expectTapTargets(page, '.topbar button, .bottombar button, #zonecard .btn, #here button');
      await shot(page, testInfo, '2-exploring');
    });

    await test.step('section card closed: corner button', async () => {
      // the card closes itself after a few seconds; close it by hand if it is still open
      if (await page.locator('#zonecard').isVisible()) await page.locator('#zc-close').click();
      await expect(page.locator('#here')).toBeVisible();
      await expectInsideSafeArea(page, testInfo, CHROME);
      await expectNoOverlap(page, CHROME);
    });

    // The panel checks below do not need the 3D view. Pausing it keeps software-rendered test browsers fast on
    // large screens (the jewellery viewer inside the sheet keeps running).
    await page.evaluate(() => window.NY.api.setPaused(true));

    await test.step('product sheet with the 3D viewer and price breakdown', async () => {
      await page.evaluate(() => window.NY.onProductTap('p03'));
      await expect(page.locator('#sheet.open')).toBeVisible();
      await settled(page.locator('#sheet'));
      await expect(page.locator('#sheet .price-table')).toBeVisible();
      await expectNoSideScroll(page);
      await expectInsideSafeArea(page, testInfo, ['#sheet', '#sheet-close', '#add-to-bag']);
      if (touch) await expectTapTargets(page, '#sheet-close, #add-to-bag, #sheet .chip, #sheet .swatch, #sheet .btn');
      // the sheet must not hide the top bar on large screens
      if (!touch || testInfo.project.use.viewport.width > 760) await expectNoOverlap(page, ['.topbar', '#sheet']);
      await shot(page, testInfo, '3-product');
      await page.locator('#add-to-bag').click();
      await expect(page.locator('#bag-count')).toHaveText('1');
      await page.locator('#sheet-close').click();
      await expect(page.locator('#sheet')).not.toHaveClass(/open/);
    });

    await test.step('bag', async () => {
      await page.locator('#btn-bag').click();
      await expect(page.locator('#sheet.open')).toBeVisible();
      await settled(page.locator('#sheet'));
      await expectInsideSafeArea(page, testInfo, ['#sheet', '#sheet-foot', '#sheet-close']);
      await shot(page, testInfo, '4-bag');
      await page.locator('#sheet-close').click();
      await expect(page.locator('#sheet')).not.toHaveClass(/open/);
    });

    await test.step("today's rates", async () => {
      if (await page.locator('#bb-rates').isVisible()) await page.locator('#bb-rates').click();
      else await page.evaluate(() => window.NY.onFeatureTap('rates'));
      await expect(page.locator('#sheet.open')).toBeVisible();
      await settled(page.locator('#sheet'));
      await expectInsideSafeArea(page, testInfo, ['#sheet', '#sheet-close']);
      await expectNoSideScroll(page);
      await shot(page, testInfo, '5-rates');
      await page.locator('#sheet-close').click();
      await expect(page.locator('#sheet')).not.toHaveClass(/open/);
    });

    await test.step('store details and settings', async () => {
      // Store details: the Info button in the phone bottom bar, otherwise the logo button
      const info = (await page.locator('#bb-info').isVisible()) ? '#bb-info' : '#brand-btn';
      await page.locator(info).click();
      await expect(page.locator('#sheet.open')).toBeVisible();
      await settled(page.locator('#sheet'));
      await expectInsideSafeArea(page, testInfo, ['#sheet', '#sheet-close']);
      await expectNoSideScroll(page);
      await shot(page, testInfo, '6-settings');
    });

    expect(realProblems(problems)).toEqual([]);
  });
});
