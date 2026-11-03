// Without WebGL the store shows a clickable floor plan instead of the 3D view; browsing and the bag still work.
import { test, expect } from '@playwright/test';
import { openStore, shot, expectNoSideScroll, realProblems } from './helpers.js';

test.describe('no WebGL', () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== 'no-webgl', 'needs a browser without WebGL');
  });

  test('falls back to the floor plan and keeps the shop working', async ({ page }, testInfo) => {
    const problems = await openStore(page, testInfo);
    await expect(page.locator('#status')).toHaveClass(/warn/);
    await expect(page.locator('#plan-fallback')).toBeVisible();
    await expect(page.locator('#scene')).toBeHidden();
    await page.locator('#w-explore').click();
    await expectNoSideScroll(page);
    await shot(page, testInfo, 'fallback-plan');
    // open a product from search and add it to the bag
    await page.locator('#btn-search').click();
    await expect(page.locator('#sheet.open')).toBeVisible();
    await page.locator('#search-q').fill('aviator');
    await page.locator('#sheet-body .row-hit').first().click();
    await expect(page.locator('#add-to-bag')).toBeVisible();
    await page.locator('#add-to-bag').click();
    await expect(page.locator('#bag-count')).toHaveText('1');
    // the only expected warning is the 3D view itself not starting
    expect(realProblems(problems).filter((p) => !/WebGL|3D view/i.test(p))).toEqual([]);
  });
});
