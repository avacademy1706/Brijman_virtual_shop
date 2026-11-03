// Camera try-on with Chrome's fake camera (a moving test pattern, nothing real is captured): it opens, the camera
// starts, the face tracking model loads (or, if it was not installed, the shopper is told so and offered the 3D
// viewer) and the panel fits the screen. Placement on a real face and hand is covered by the unit tests
// (tests/unit/anchors.test.js), the simulator (tools/tryon-sim.html) and by hand (docs/TESTING.md).
import { test, expect } from '@playwright/test';
import { openStore, expectInsideSafeArea, expectNoSideScroll, shot, realProblems } from './helpers.js';

test.describe('camera try-on', () => {
  test.beforeEach(async ({}, info) => {
    test.skip(!['laptop', 'phone'].includes(info.project.name), 'runs on one laptop and one phone');
  });

  test('opens with a bridal set, starts the camera and loads tracking', async ({ page }, testInfo) => {
    const problems = await openStore(page, testInfo);
    await page.evaluate(() => window.NY.openTryOn({ set: 'rajwada' }));
    await expect(page.locator('#to-start')).toBeVisible();
    await expectInsideSafeArea(page, testInfo, ['#to-start', '.to-intro', '.to-top']);
    // the whole set is worn: four slots marked
    await expect(page.locator('.to-slots .to-dot')).toHaveCount(4);
    await shot(page, testInfo, 'tryon-intro');
    await page.locator('#to-start').click();
    // the face model compiles in software on test machines, which can take a minute or two
    const status = page.locator('.to-status');
    await expect(status).toHaveText(/Looking for you|Tracking/, { timeout: 180_000 });
    await expect(status).not.toHaveText(/Loading|Starting/, { timeout: 180_000 });
    const missing = (await status.textContent()).includes('unavailable');
    await expectNoSideScroll(page);
    await shot(page, testInfo, 'tryon-running');
    if (missing) {
      // models not installed (npm run setup:tryon could not download them): the camera stops, a clear message
      // explains it, and the 3D viewer is offered instead
      await expect(page.locator('.to-error')).toContainText('not installed');
      await expectInsideSafeArea(page, testInfo, ['.to-intro', '#to-viewer']);
      await page.locator('#to-viewer').click();
      await expect(page.locator('#tryon')).toBeHidden();
      await expect(page.locator('#sheet.open')).toBeVisible();
    } else {
      await expectInsideSafeArea(page, testInfo, ['.to-panel', '.to-top']);
      // adding a ring asks for the hand
      await page.locator('#to-slot-finger').click();
      await page.locator('.to-carousel .to-item').first().click();
      await expect(page.locator('.to-slots .to-dot')).toHaveCount(5);
      await page.locator('.to-top .to-icon').first().click();
      await expect(page.locator('#tryon')).toBeHidden();
    }
    // with the models missing, the browser may log the failed model request
    expect(realProblems(problems).filter((p) => !(missing && /not installed|Failed to load resource/.test(p)))).toEqual(
      [],
    );
  });
});
