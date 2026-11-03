// Camera try-on with Chrome's fake camera (a moving test pattern, nothing real is captured): it opens, the
// pose model loads, the camera starts and the panel fits the screen. Tracking a real person is tested by hand
// (docs/TESTING.md), since the test pattern has no body in it.
import { test, expect } from '@playwright/test';
import { openStore, expectInsideSafeArea, expectNoSideScroll, shot, realProblems } from './helpers.js';

test.describe('camera try-on', () => {
  test.beforeEach(async ({}, info) => {
    test.skip(!['laptop', 'phone'].includes(info.project.name), 'runs on one laptop and one phone');
  });

  test('opens, loads the pose model and starts the camera', async ({ page }, testInfo) => {
    const problems = await openStore(page, testInfo);
    await page.evaluate(() => window.NY.openTryOn({ pid: 'k01', ci: 0 }));
    await expect(page.locator('#to-start')).toBeVisible();
    await expectInsideSafeArea(page, testInfo, ['#to-start']);
    await shot(page, testInfo, 'tryon-intro');
    await page.locator('#to-start').click();
    // the pose model compiles in software on test machines, which can take a minute or two
    await expect
      .poll(() => page.evaluate(() => !!(window.NY.tryonState && window.NY.tryonState.running)), { timeout: 180_000 })
      .toBe(true);
    await expect(page.locator('.to-status')).not.toBeEmpty();
    await expectNoSideScroll(page);
    await shot(page, testInfo, 'tryon-running');
    expect(realProblems(problems)).toEqual([]);
  });
});
