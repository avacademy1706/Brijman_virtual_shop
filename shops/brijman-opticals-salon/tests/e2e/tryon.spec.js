// Camera try-on with Chrome's fake camera (a moving test pattern, nothing real is captured): it opens with the
// chosen frame, the camera starts, the face tracking model loads (or, if it was not installed, the shopper is told
// so and offered the 3D viewer) and the panel fits the screen. Placement and measurement on a face are covered by
// the unit tests (tests/unit/anchors.test.js) and the simulator (tools/tryon-sim.html).
import { test, expect } from '@playwright/test';
import { openStore, expectInsideSafeArea, expectNoSideScroll, shot, realProblems } from './helpers.js';

test.describe('camera try-on', () => {
  test.beforeEach(async ({}, info) => {
    test.skip(!['laptop', 'phone'].includes(info.project.name), 'runs on one laptop and one phone');
  });

  test('opens with a frame, starts the camera and loads tracking', async ({ page }, testInfo) => {
    const problems = await openStore(page, testInfo);
    await page.evaluate(() => window.NY.openTryOn({ pid: 'w01', ci: 1, size: 'L' }));
    await expect(page.locator('#to-start')).toBeVisible();
    await expectInsideSafeArea(page, testInfo, ['#to-start', '.to-intro', '.to-top']);
    await shot(page, testInfo, 'tryon-intro');
    await page.locator('#to-start').click();
    const status = page.locator('.to-status');
    await expect(status).toHaveText(/Looking for you|Tracking|unavailable/, { timeout: 180_000 });
    await expect(status).not.toHaveText(/Loading|Starting/, { timeout: 180_000 });
    const missing = (await status.textContent()).includes('unavailable');
    await expectNoSideScroll(page);
    await shot(page, testInfo, 'tryon-running');
    if (missing) {
      await expect(page.locator('.to-error')).toContainText('not installed');
      await expectInsideSafeArea(page, testInfo, ['.to-intro', '#to-viewer']);
      await page.locator('#to-viewer').click();
      await expect(page.locator('#tryon')).toBeHidden();
      await expect(page.locator('#sheet.open')).toBeVisible();
      await expect(page.locator('#size-L')).toHaveAttribute('aria-checked', 'true');
    } else {
      await expectInsideSafeArea(page, testInfo, ['.to-panel', '.to-top']);
      await expect(page.locator('#to-size-L')).toHaveAttribute('aria-checked', 'true');
      await page.locator('#to-size-S').click();
      await page.locator('#to-bag').click();
      await expect(page.locator('#bag-count')).toHaveText('1');
      await page.locator('.to-top .to-icon').first().click();
      await expect(page.locator('#tryon')).toBeHidden();
    }
    expect(realProblems(problems).filter((p) => !(missing && /not installed|Failed to load resource/.test(p)))).toEqual(
      [],
    );
  });
});
