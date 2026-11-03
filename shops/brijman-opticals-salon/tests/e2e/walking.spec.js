// Walking: every section can be reached from the entrance, nothing outside the walls is walkable, a tap on the
// floor walks there, and a tap on a poster stops square in front of it at a comfortable distance.
import { test, expect } from '@playwright/test';
import { openStore, explore } from './helpers.js';

test.describe('walking', () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== 'laptop', 'runs once, on the laptop screen');
  });

  test('every section is reachable from the entrance', async ({ page }, testInfo) => {
    await openStore(page, testInfo);
    const r = await page.evaluate(() => {
      const NY = window.NY;
      const g = NY.api.navGrid();
      const cellOf = (x, z) => [Math.floor((x - g.x0) / g.cell), Math.floor((z - g.z0) / g.cell)];
      const free = (c, r) => c >= 0 && r >= 0 && c < g.cols && r < g.rows && !g.blocked[r * g.cols + c];
      const [c0, r0] = cellOf(NY.START.x, NY.START.z);
      const seen = new Uint8Array(g.cols * g.rows);
      const q = [[c0, r0]];
      seen[r0 * g.cols + c0] = 1;
      while (q.length) {
        const [c, r] = q.pop();
        for (const [dc, dr] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ])
          if (free(c + dc, r + dr) && !seen[(r + dr) * g.cols + c + dc]) {
            seen[(r + dr) * g.cols + c + dc] = 1;
            q.push([c + dc, r + dr]);
          }
      }
      const unreachable = NY.ZONES.filter((z) => {
        const [c, r] = cellOf(z.view.p[0], z.view.p[1]);
        return !seen[r * g.cols + c];
      }).map((z) => z.id);
      // nothing inside the false walls is walkable
      let inWalls = 0;
      for (let r = 0; r < g.rows; r++)
        for (let c = 0; c < g.cols; c++) {
          const x = g.x0 + (c + 0.5) * g.cell;
          if (free(c, r) && (x < NY.L.x0 + NY.L.wall || x > NY.L.x1 - NY.L.wall)) inWalls++;
        }
      return { unreachable, inWalls };
    });
    expect(r.unreachable).toEqual([]);
    expect(r.inWalls).toBe(0);
  });

  test('a tap on the floor walks there', async ({ page }, testInfo) => {
    await openStore(page, testInfo);
    await explore(page);
    await page.addStyleTag({ content: '#dock, #minimap, .labels { visibility: hidden !important; }' });
    const where = () => page.evaluate(() => window.NY.api.where());
    const start = await where();
    const box = await page.locator('#scene').boundingBox();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.86);
    await expect
      .poll(async () => Math.hypot((await where()).x - start.x, (await where()).z - start.z), { timeout: 30_000 })
      .toBeGreaterThan(0.3);
  });

  test('a tap on a poster stops square in front of it, not inside it', async ({ page }, testInfo) => {
    await openStore(page, testInfo);
    await explore(page);
    await page.addStyleTag({ content: '#dock, #minimap, .labels, #zonecard { visibility: hidden !important; }' });
    const poster = await page.evaluate(() => window.NY.L.posters.find((p) => p.id === 'clarity'));
    // stand off to the side and look straight at the poster's centre, then tap the middle of the screen
    const from = { x: 2.6, z: 3.4 };
    const dx = poster.x - from.x,
      dz = poster.z - from.z,
      dy = poster.y - 1.62;
    await page.evaluate(
      ([x, z, yaw, pitch]) => window.NY.api.debugPose(x, z, yaw, pitch),
      [from.x, from.z, Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))],
    );
    const where = () => page.evaluate(() => window.NY.api.where());
    // the tap is aimed with the last frame drawn, so wait until the new pose has been drawn (slow on CI)
    await expect
      .poll(async () => Math.hypot((await where()).x - from.x, (await where()).z - from.z), { timeout: 30_000 })
      .toBeLessThan(0.01);
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))),
    );
    await page.waitForTimeout(300);
    const box = await page.locator('#scene').boundingBox();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await expect
      .poll(async () => Math.hypot((await where()).x - from.x, (await where()).z - from.z), { timeout: 30_000 })
      .toBeGreaterThan(0.3);
    // settled: not moving, and the same spot twice in a row
    let last = null;
    await expect
      .poll(
        async () => {
          const w = await where();
          const same = last && !w.moving && Math.hypot(w.x - last.x, w.z - last.z) < 0.001;
          last = w;
          return same;
        },
        { timeout: 60_000, intervals: [500] },
      )
      .toBe(true);
    const w = await where();
    const nx = Math.sin(poster.ry),
      nz = Math.cos(poster.ry);
    const ahead = (w.x - poster.x) * nx + (w.z - poster.z) * nz; // distance out from the poster
    const aside = Math.abs(-(w.x - poster.x) * nz + (w.z - poster.z) * nx); // distance along the wall
    expect(ahead).toBeGreaterThan(1.3);
    expect(ahead).toBeLessThan(2.8);
    expect(aside).toBeLessThan(0.35);
  });
});
