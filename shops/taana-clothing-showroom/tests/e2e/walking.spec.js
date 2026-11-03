// Walking: every section can be reached, keep-out areas stay closed, a stray click never moves the visitor, and a
// tap on a wall or fixture stops square in front of it.
import { test, expect } from '@playwright/test';
import { openStore, explore } from './helpers.js';

test.describe('walking', () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== 'laptop', 'runs once, on the laptop screen');
  });

  test('every section is reachable and keep-out areas are closed', async ({ page }, testInfo) => {
    await openStore(page, testInfo);
    const r = await page.evaluate(() => {
      const g = window.NY.api.navGrid();
      const cellOf = (x, z) => [Math.floor((x - g.x0) / g.cell), Math.floor((z - g.z0) / g.cell)];
      const free = (c, r) => c >= 0 && r >= 0 && c < g.cols && r < g.rows && !g.blocked[r * g.cols + c];
      // flood fill from the entrance
      const [c0, r0] = cellOf(0, window.NY.L.z1 - 0.75);
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
      // the nearest free cell to each section's viewpoint must be reachable
      const unreachable = [];
      for (const z of window.NY.ZONES) {
        const [c, r] = cellOf(z.view.p[0], z.view.p[1]);
        let ok = false;
        for (let d = 0; d <= 4 && !ok; d++)
          for (let dr = -d; dr <= d && !ok; dr++)
            for (let dc = -d; dc <= d && !ok; dc++) ok = free(c + dc, r + dr) && !!seen[(r + dr) * g.cols + c + dc];
        if (!ok) unreachable.push(z.id);
      }
      // the centre of every keep-out area is blocked
      const open = window.NY.NO_GO.filter((o) => {
        const [c, r] = cellOf((o.x0 + o.x1) / 2, (o.z0 + o.z1) / 2);
        return free(c, r);
      }).map((o) => o.why);
      return { unreachable, open };
    });
    expect(r.unreachable).toEqual([]);
    expect(r.open).toEqual([]);
  });

  test('a single click on the floor only marks the spot; a second click walks there', async ({ page }, testInfo) => {
    await openStore(page, testInfo);
    await explore(page);
    const where = () => page.evaluate(() => window.NY.api.where());
    const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    // keep the floating cards out of the way so the clicks land on the floor
    await page.addStyleTag({ content: '#dock, #minimap, #here, .labels { visibility: hidden !important; }' });
    const canvas = page.locator('#scene');
    const box = await canvas.boundingBox();
    const spot = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.82 };
    const start = await where();
    await page.mouse.click(spot.x, spot.y);
    await expect(page.locator('#toast')).toHaveText(/again to walk here/, { timeout: 2000 });
    await page.waitForTimeout(1200);
    expect(dist(start, await where()), 'moved after one click').toBeLessThan(0.01);
    await page.mouse.click(spot.x, spot.y);
    await expect.poll(async () => dist(start, await where()), { timeout: 15_000 }).toBeGreaterThan(0.3);
  });

  test('a click while walking stops the walk', async ({ page }, testInfo) => {
    await openStore(page, testInfo, { move: 'walk' });
    await explore(page);
    const where = () => page.evaluate(() => window.NY.api.where());
    const start = await where();
    await page.evaluate(() => window.NY.api.goZone('chikan'));
    // wait until the walk is under way (slow test machines draw few frames per second)
    await expect
      .poll(async () => Math.hypot((await where()).x - start.x, (await where()).z - start.z), { timeout: 120_000 })
      .toBeGreaterThan(0.1);
    const box = await page.locator('#scene').boundingBox();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.35);
    const stopped = await where();
    await page.waitForTimeout(2500);
    const later = await where();
    expect(Math.hypot(later.x - stopped.x, later.z - stopped.z)).toBeLessThan(0.05);
  });

  test('a tap on a wall or fixture stops square in front of it, a little way back', async ({ page }, testInfo) => {
    await openStore(page, testInfo, { walkClick: 'single' });
    await explore(page);
    await page.addStyleTag({
      content: '#dock, #minimap, #here, #zonecard, .labels { visibility: hidden !important; }',
    });
    const where = () => page.evaluate(() => window.NY.api.where());
    const box = await page.locator('#scene').boundingBox();
    const zones = await page.evaluate(() => window.NY.ZONES.map((z) => ({ id: z.id, p: z.view.p, t: z.view.t })));
    let checked = 0;
    for (const z of zones) {
      if (checked >= 2) break;
      // stand at the section's viewpoint, looking at its target
      const dx = z.t[0] - z.p[0],
        dz = z.t[2] - z.p[1],
        dy = z.t[1] - 1.62;
      await page.evaluate(
        ([x, zz, yaw, pitch]) => window.NY.api.debugPose(x, zz, yaw, pitch),
        [z.p[0], z.p[1], Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))],
      );
      // the tap is aimed with the last frame drawn: wait until the new pose has been drawn
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))),
      );
      await page.waitForTimeout(300);
      // find a wall or fixture in view
      let target = null;
      for (const fy of [0.35, 0.5])
        for (const fx of [0.2, 0.5, 0.8]) {
          if (target) break;
          const cx = box.x + box.width * fx,
            cy = box.y + box.height * fy;
          const h = await page.evaluate(([x, y]) => window.NY.api.pick(x, y), [cx, cy]);
          if (h && h.kind === 'surface' && h.dist > 1.6 && Math.hypot(h.nx, h.nz) > 0.6) target = { ...h, cx, cy };
        }
      if (!target) continue;
      await page.mouse.click(target.cx, target.cy);
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
      await page.waitForTimeout(1500); // let the turn finish
      const w = await where();
      const n = Math.hypot(target.nx, target.nz),
        nx = target.nx / n,
        nz = target.nz / n;
      const ahead = (w.x - target.x) * nx + (w.z - target.z) * nz; // distance out from the surface
      const fx = -Math.sin(w.yaw),
        fz = -Math.cos(w.yaw),
        tx = target.x - w.x,
        tz = target.z - w.z;
      const off = (Math.acos(Math.max(-1, Math.min(1, (fx * tx + fz * tz) / Math.hypot(tx, tz)))) * 180) / Math.PI;
      expect(ahead, 'distance from the tapped surface in ' + z.id).toBeGreaterThan(0.9);
      expect(off, 'facing the tapped spot in ' + z.id).toBeLessThan(12);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});
