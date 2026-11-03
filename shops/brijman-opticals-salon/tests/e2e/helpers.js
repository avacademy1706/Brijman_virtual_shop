// Shared steps for the browser tests.
import { expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/** Notch and home-bar areas of real phones, emulated in Chromium so the layout must keep clear of them. */
const SAFE_AREAS = {
  phone: { top: 47, bottom: 34, left: 0, right: 0 },
  'phone-large': { top: 59, bottom: 34, left: 0, right: 0 },
  'phone-landscape': { top: 0, bottom: 21, left: 47, right: 47 },
};
export const safeAreaOf = (project) => SAFE_AREAS[project] || { top: 0, bottom: 0, left: 0, right: 0 };

/**
 * Open the store and wait until it is ready (3D attached, or the floor-plan fallback when WebGL is missing).
 * Returns a list that collects page errors and console errors.
 */
export async function openStore(page, testInfo, settings = {}) {
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push('console: ' + m.text());
  });
  // fast and deterministic: battery-saver graphics and instant jumps
  await page.addInitScript(
    (s) => {
      try {
        localStorage.setItem('brijman-settings', JSON.stringify(s));
      } catch {
        /* storage blocked */
      }
    },
    Object.assign({ quality: 'low', move: 'jump', labels: true }, settings),
  );
  const inset = safeAreaOf(testInfo.project.name);
  if (inset.top || inset.bottom || inset.left || inset.right) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: inset });
  }
  await page.goto('/');
  await expect(page.locator('#welcome')).toBeVisible();
  await page.waitForFunction(
    () => (window.NY && window.NY.api) || document.getElementById('status').classList.contains('warn'),
    null,
    { timeout: 180_000 },
  );
  return problems;
}

/** Leave the welcome card and start exploring. */
export async function explore(page) {
  await page.locator('#w-explore').click();
  await expect(page.locator('#welcome')).toBeHidden();
}

/** The area the interface may use: the viewport minus the emulated notch and home bar. */
export async function safeRect(page, testInfo) {
  const s = safeAreaOf(testInfo.project.name);
  const { w, h } = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  return { x0: s.left, y0: s.top, x1: w - s.right, y1: h - s.bottom };
}

// The layout checks below are soft: a test keeps going after a problem, so one run lists every problem on
// every screen.

/** Every listed element that is visible must lie inside the safe area (1 px tolerance). */
export async function expectInsideSafeArea(page, testInfo, selectors) {
  const r = await safeRect(page, testInfo);
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if (!(await loc.isVisible())) continue;
    const b = await loc.boundingBox();
    const where = `${sel} at ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}`;
    expect.soft(b.x, where + ' left edge').toBeGreaterThanOrEqual(r.x0 - 1);
    expect.soft(b.y, where + ' top edge').toBeGreaterThanOrEqual(r.y0 - 1);
    expect.soft(b.x + b.width, where + ' right edge').toBeLessThanOrEqual(r.x1 + 1);
    expect.soft(b.y + b.height, where + ' bottom edge').toBeLessThanOrEqual(r.y1 + 1);
  }
}

/** Visible elements in the list must not cover each other. */
export async function expectNoOverlap(page, selectors) {
  const boxes = [];
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible()) boxes.push([sel, await loc.boundingBox()]);
  }
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const [na, a] = boxes[i],
        [nb, b] = boxes[j];
      const ix = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const iy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      expect.soft(ix > 1 && iy > 1, `${na} overlaps ${nb}`).toBe(false);
    }
}

/** The page never scrolls sideways. */
export async function expectNoSideScroll(page) {
  const { sw, w } = await page.evaluate(() => ({
    sw: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    w: window.innerWidth,
  }));
  expect.soft(sw, 'page is wider than the screen').toBeLessThanOrEqual(w + 1);
}

/** Buttons a finger has to hit are at least `min` px in both directions. */
export async function expectTapTargets(page, selector, min = 40) {
  const small = await page.$$eval(
    selector,
    (els, m) =>
      els
        .filter((e) => e.offsetParent !== null)
        .map((e) => [e.id || e.className || e.textContent.trim().slice(0, 20), e.getBoundingClientRect()])
        .filter(([, r]) => r.width > 0 && (r.width < m || r.height < m))
        .map(([n, r]) => `${n} ${Math.round(r.width)}x${Math.round(r.height)}`),
    min,
  );
  expect.soft(small, 'tap targets smaller than ' + min + ' px').toEqual([]);
}

/** Save a screenshot under test-results/screens and attach it to the HTML report. */
export async function shot(page, testInfo, name) {
  const dir = 'test-results/screens';
  mkdirSync(dir, { recursive: true });
  const path = `${dir}/${testInfo.project.name}-${name}.png`;
  await page.screenshot({ path });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

/** Wait until an element's slide-in transition has finished and it stops moving. */
export async function settled(locator) {
  await locator.evaluate(
    (el) =>
      new Promise((done) => {
        const check = () => (el.getAnimations().length ? requestAnimationFrame(check) : done());
        requestAnimationFrame(() => requestAnimationFrame(check));
      }),
  );
  return locator.boundingBox();
}

/** Errors that are expected and harmless. */
export const KNOWN_NOISE = [
  /odml\.pa\.googleapis\.com/, // MediaPipe usage statistics, blocked on purpose by connect-src 'self'
  /Content Security Policy.*connect-src/,
  /INFO: Created TensorFlow Lite XNNPACK delegate/, // MediaPipe logs this information line as a console error
];
export const realProblems = (list) => list.filter((p) => !KNOWN_NOISE.some((re) => re.test(p)));
