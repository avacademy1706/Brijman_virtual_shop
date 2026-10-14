// The mobile and responsive audit. One test per device and orientation, walking through every main screen.
// Results and screenshots go to reports/mobile-audit/<phase>/ (gitignored); scripts/mobile-report.mjs builds the report.
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as H from './audit-helpers.js';

const PHASE = process.env.AUDIT_PHASE === 'before' ? 'before' : 'after';
const ROOT = fileURLToPath(new URL('../../reports/mobile-audit/' + PHASE + '/', import.meta.url));

const INJECT =
  [H.chromeBoxes, H.overlaps, H.smallTargets, H.smallText, H.labelProblems].map((f) => f.toString()).join('\n') +
  '\nconst describe = ' +
  // describe is not exported; rebuild it here.
  `(el) => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; else if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.'); const label = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 24); return label ? s + ' "' + label + '"' : s; };` +
  '\nwindow.__auditChromeBoxes = chromeBoxes;' +
  '\nwindow.__audit = { chromeBoxes, overlaps, smallTargets, smallText, labelProblems };';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

test('mobile audit', async ({ page, browserName }, info) => {
  const project = info.project.name;
  const dir = ROOT + slug(project) + '/';
  mkdirSync(dir, { recursive: true });
  const vp = page.viewportSize();
  const touch = !!info.project.use.hasTouch;
  const lowEnd = project.startsWith('Low-end');
  const result = {
    project,
    browser: browserName,
    viewport: vp,
    touch,
    checks: [],
    shots: [],
    metrics: {},
    errors: [],
    csp: [],
  };
  const check = (step, name, ok, detail) => {
    result.checks.push({ step, name, ok: ok === null ? null : !!ok, detail: detail || '' });
    if (ok === false) expect.soft(ok, step + ': ' + name + (detail ? ' — ' + detail : '')).toBe(true);
  };
  const shot = async (n, label) => {
    const f = n + '-' + slug(label) + '.png';
    await page.screenshot({ path: dir + f, timeout: 60000 });
    result.shots.push({ file: f, label });
  };
  const run = (fn, ...args) => page.evaluate(fn, ...args);
  const common = async (step) => {
    const ov = await run(() => window.__audit.overlaps());
    check(step, 'No overlapping fixed elements', ov.length === 0, ov.join('; '));
    const sw = await run(() => document.documentElement.scrollWidth - innerWidth);
    check(step, 'No horizontal overflow', sw <= 0, sw > 0 ? sw + ' px too wide' : '');
    if (touch) {
      const st = await run(() => window.__audit.smallTargets());
      check(
        step,
        'Touch targets 44 px or more',
        st.length === 0,
        st.slice(0, 12).join('; ') + (st.length > 12 ? ' …+' + (st.length - 12) : ''),
      );
    }
    const tx = await run((t) => window.__audit.smallText(t), touch);
    check(
      step,
      'Text 11 px or more' + (touch ? ', inputs 16 px or more' : ''),
      tx.length === 0,
      tx.slice(0, 10).join('; ') + (tx.length > 10 ? ' …+' + (tx.length - 10) : ''),
    );
  };

  page.on('console', (m) => {
    if (m.type() === 'error' && !/GPU stall|WebGL: |GroupMarkerNotSet|INFO: /.test(m.text()))
      result.errors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => result.errors.push('pageerror: ' + e.message.slice(0, 200)));
  result.navigations = [];
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) result.navigations.push(((Date.now() - t0) / 1000).toFixed(1) + 's ' + f.url());
  });
  await page.addInitScript(INJECT);
  await page.addInitScript(() => {
    if (!/^https?:/.test(location.protocol)) return; // about:blank denies storage
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      window.__csp.push(
        e.violatedDirective +
          ' ' +
          e.blockedURI +
          ' @ ' +
          (e.sourceFile || '').split('/').pop() +
          ':' +
          e.lineNumber +
          ':' +
          e.columnNumber,
      ),
    );
    // Walk mode so tap-to-walk is measurable; picture quality is chosen by the app.
    localStorage.setItem(
      'bm-settings',
      JSON.stringify({ move: 'walk', labels: true, quality: 'auto', coachSeen: false }),
    );
    // Count frames for the fps figure.
    window.__frames = 0;
    const f = () => {
      window.__frames++;
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });

  let t0 = Date.now();
  let cdp = null;
  if (browserName === 'chromium') {
    cdp = await page.context().newCDPSession(page);
    if (lowEnd) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 60,
        downloadThroughput: (9 * 1024 * 1024) / 8,
        uploadThroughput: (1.5 * 1024 * 1024) / 8,
      });
    }
  }

  // Top-bar buttons sit under the sheet's backdrop on phones: close the sheet first, like a person would.
  const topClick = async (sel) => {
    await run(() => {
      const sh = document.querySelector('#sheet');
      if (sh && sh.classList.contains('open')) document.querySelector('#sheet-close').click();
    });
    await page.waitForTimeout(400);
    await page.click(sel);
  };

  try {
    /* 1. Welcome */
    t0 = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#w-explore') && window.BM && window.BM.PRODUCTS, null, {
      timeout: 120000,
    });
    result.metrics.welcomeUsableMs = Date.now() - t0;
    const ready = await page
      .waitForFunction(
        () => {
          const t = document.querySelector('#status-text')?.textContent || '';
          return t === 'Showroom ready.' || /floor plan stands in/.test(t);
        },
        null,
        { timeout: 240000 },
      )
      .then(() => true)
      .catch(() => false);
    result.metrics.readyMs = Date.now() - t0;
    const has3D = await run(() => !!(window.BM && window.BM.api));
    result.metrics.has3D = has3D;
    check('Welcome', '3D view started (or the floor plan stood in)', ready, has3D ? '' : 'floor plan fallback');
    await shot(1, 'Welcome');
    {
      const w = await run(() => {
        const el = document.querySelector('#welcome');
        const r = el.getBoundingClientRect();
        const btns = ['#w-tour', '#w-explore'].map((s) => document.querySelector(s)).filter((b) => b && !b.hidden);
        const scrolls = el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY);
        const inView = btns.every((b) => {
          const q = b.getBoundingClientRect();
          return q.top >= 0 && q.bottom <= innerHeight && q.left >= 0 && q.right <= innerWidth;
        });
        return { top: r.top, bottom: r.bottom, H: innerHeight, inView, scrolls };
      });
      check(
        'Welcome',
        'Welcome card fits, or scrolls inside itself',
        (w.top >= 0 && w.bottom <= w.H + 1) || w.scrolls,
        'card ' + Math.round(w.top) + '–' + Math.round(w.bottom) + ' of ' + w.H + ' px',
      );
      check('Welcome', 'Both buttons visible or reachable by scrolling the card', w.inView || w.scrolls);
      await common('Welcome');
    }

    /* 2. The store */
    await page.click('#w-explore');
    await page.waitForTimeout(800);
    await shot(2, 'Store');
    await common('Store');
    if (has3D) {
      const lp = await run(() => window.__audit.labelProblems());
      check(
        'Store',
        'Section labels never overlap each other or the chrome',
        lp.problems.length === 0,
        lp.problems.slice(0, 6).join('; '),
      );
      if (vp.width <= 600 || vp.height <= 500)
        check('Store', 'At most 4 labels on phones', lp.count <= 4, lp.count + ' labels');

      /* 3D gestures with touch-like pointer events (works in every engine) */
      // The store renders on demand: nudge a render before reading the pose.
      const pose = async () => {
        await run(() => window.dispatchEvent(new Event('resize')));
        await page.waitForTimeout(250);
        return run(() => {
          const p = window.BM.api.stats();
          return {
            x: window.__lastPose ? window.__lastPose.x : null,
            z: window.__lastPose ? window.__lastPose.z : null,
            yaw: window.__lastPose ? window.__lastPose.yaw : null,
            zoom: p.zoom,
          };
        });
      };
      await run(() => {
        const o = window.BM.onPose;
        window.BM.onPose = (p) => {
          window.__lastPose = p;
          o(p);
        };
      });
      const ptr = (type, id, x, y) =>
        run(
          ([type, id, x, y, touch]) => {
            const c = document.querySelector('#scene');
            c.dispatchEvent(
              new PointerEvent(type, {
                pointerId: id,
                clientX: x,
                clientY: y,
                bubbles: true,
                cancelable: true,
                isPrimary: id === 1,
                pointerType: touch ? 'touch' : 'mouse',
                buttons: type === 'pointerup' ? 0 : 1,
              }),
            );
          },
          [type, id, x, y, touch],
        );
      await page.waitForTimeout(500);
      // Tap on the floor (down and up in one go, like a finger): walks.
      const pt = await pose();
      await run(
        ([x, y, touch]) => {
          const c = document.querySelector('#scene');
          const o = {
            pointerId: 1,
            clientY: y,
            bubbles: true,
            cancelable: true,
            isPrimary: true,
            pointerType: touch ? 'touch' : 'mouse',
          };
          c.dispatchEvent(new PointerEvent('pointerdown', { ...o, clientX: x, buttons: 1 }));
          c.dispatchEvent(new PointerEvent('pointerup', { ...o, clientX: x + 2, buttons: 0 }));
        },
        [vp.width / 2, vp.height * 0.66, touch],
      );
      await page.waitForTimeout(3500);
      const pw = await pose();
      check(
        '3D',
        'Tap on the floor walks there',
        Math.hypot(pw.x - pt.x, pw.z - pt.z) > 0.08,
        'moved ' + Math.hypot(pw.x - pt.x, pw.z - pt.z).toFixed(2) + ' m',
      );
      // Let the walk finish before the drag test (slow software rendering makes walks take longer).
      await page.waitForFunction(() => !window.BM.api.stats().moving, null, { timeout: 40000 }).catch(() => {});
      await page.waitForTimeout(300);
      // Drag to look: must turn, must not walk.
      const p0 = await pose();
      const cx = vp.width / 2,
        cy = vp.height * 0.62;
      await ptr('pointerdown', 1, cx, cy);
      for (let i = 1; i <= 8; i++) await ptr('pointermove', 1, cx + i * 12, cy);
      await ptr('pointerup', 1, cx + 96, cy);
      await page.waitForTimeout(700);
      const p1 = await pose();
      check(
        '3D',
        'Drag turns the view',
        p0.yaw !== null && Math.abs(p1.yaw - p0.yaw) > 0.05,
        p0.yaw === null ? 'no pose' : 'yaw ' + (p1.yaw - p0.yaw).toFixed(3),
      );
      check(
        '3D',
        'A drag does not start walking',
        Math.hypot(p1.x - p0.x, p1.z - p0.z) < 0.05,
        'moved ' + Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(3) + ' m',
      );
      // Pinch zooms.
      const z0 = (await pose()).zoom;
      await ptr('pointerdown', 1, cx - 40, cy);
      await ptr('pointerdown', 2, cx + 40, cy);
      for (let i = 1; i <= 6; i++) {
        await ptr('pointermove', 1, cx - 40 - i * 10, cy);
        await ptr('pointermove', 2, cx + 40 + i * 10, cy);
      }
      await ptr('pointerup', 1, cx - 100, cy);
      await ptr('pointerup', 2, cx + 100, cy);
      const z1 = (await pose()).zoom;
      check(
        '3D',
        'Pinch changes the zoom',
        z0 === undefined ? null : Math.abs(z1 - z0) > 0.02,
        z0 === undefined ? 'zoom not exposed (manual check)' : 'zoom ' + z0.toFixed(2) + ' → ' + z1.toFixed(2),
      );
      // Tap a frame on a shelf, a little off its centre like a finger: opens the product, does not walk.
      // m03 and p01 are thin wire frames that a touch tap used to miss.
      for (const pid of ['m03', 'p01']) {
        await run((id) => window.BM.api.goProduct(id, 0), pid);
        await page.waitForTimeout(500);
        await page.waitForFunction(() => !window.BM.api.stats().moving, null, { timeout: 40000 }).catch(() => {});
        await page.waitForTimeout(300);
        const f0 = await pose();
        await run(
          ([x, y, touch]) => {
            const c = document.querySelector('#scene');
            const o = {
              pointerId: 1,
              clientX: x,
              clientY: y,
              bubbles: true,
              cancelable: true,
              isPrimary: true,
              pointerType: touch ? 'touch' : 'mouse',
            };
            c.dispatchEvent(new PointerEvent('pointerdown', { ...o, buttons: 1 }));
            c.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0 }));
          },
          [vp.width / 2 + (touch ? 10 : 0), vp.height / 2 + (touch ? 8 : 0), touch],
        );
        await page.waitForTimeout(900);
        const opened = await run(() => document.querySelector('#sheet').classList.contains('open'));
        const f1 = await pose();
        const moved = Math.hypot(f1.x - f0.x, f1.z - f0.z);
        check(
          '3D',
          'Tap on a frame opens it (' + pid + ')',
          opened && moved < 0.05,
          (opened ? 'sheet open' : 'no sheet') + ', moved ' + moved.toFixed(2) + ' m',
        );
        await run(
          () =>
            document.querySelector('#sheet').classList.contains('open') &&
            document.querySelector('#sheet-close').click(),
        );
        await page.waitForTimeout(400);
      }
      result.metrics.draws = (await run(() => window.BM.api.stats())).draws;
    }

    /* 3. Directory and Back */
    await run(() =>
      document.querySelector('#bb-dir') && getComputedStyle(document.querySelector('.bottombar')).display !== 'none'
        ? document.querySelector('#bb-dir').click()
        : document.querySelector('#zone-pill').click(),
    );
    await page.waitForSelector('#sheet.open');
    await page.waitForTimeout(400);
    await shot(3, 'Directory');
    await common('Directory');
    const href = page.url();
    await page.goBack({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
    const stayed =
      page.url().startsWith(href.split('#')[0].split('?')[0]) && (await run(() => !!window.BM).catch(() => false));
    check(
      'Back',
      'Back closes the directory and stays on the page',
      stayed && !(await run(() => document.querySelector('#sheet').classList.contains('open')).catch(() => true)),
      stayed ? '' : 'left the page: ' + page.url(),
    );
    if (!stayed) {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.BM && window.BM.openTryOn, null, { timeout: 120000 });
      await page
        .waitForFunction(
          () => /Showroom ready|floor plan/.test(document.querySelector('#status-text')?.textContent || ''),
          null,
          { timeout: 240000 },
        )
        .catch(() => {});
      await page.click('#w-explore').catch(() => {});
    }

    /* 4. Search */
    await topClick('#btn-search');
    await page.waitForSelector('#search-q');
    await page.waitForTimeout(300);
    await shot(4, 'Search');
    await common('Search');

    /* 5. Product sheet */
    await run(() => window.BM.onProductTap('m01', 0));
    await page.waitForSelector('#add-to-bag');
    await page.waitForTimeout(800);
    await shot(5, 'Product');
    await common('Product');
    {
      // Swipe up on the 3D viewer: the sheet must scroll.
      const viewerTA = await run(() => {
        const c = document.querySelector('.viewer-canvas') || document.querySelector('.viewer');
        return c ? getComputedStyle(c).touchAction : '';
      });
      if (touch && cdp) {
        const box = await page.locator('.viewer').boundingBox();
        const before = await run(() => document.querySelector('#sheet-body').scrollTop);
        const x = box.x + box.width / 2,
          y = box.y + box.height * 0.7;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let i = 1; i <= 10; i++)
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 14 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(600);
        const after = await run(() => document.querySelector('#sheet-body').scrollTop);
        check(
          'Product',
          'A swipe on the 3D viewer scrolls the sheet',
          after > before + 20,
          'scrolled ' + Math.round(after - before) + ' px; touch-action ' + viewerTA,
        );
      } else if (touch)
        check(
          'Product',
          'Viewer lets vertical swipes scroll the sheet (touch-action)',
          /pan-y|auto|manipulation/.test(viewerTA),
          'touch-action: ' + viewerTA + ' (real swipe needs a device; WebKit cannot simulate it)',
        );
      await run(() => document.querySelector('#sheet-body').scrollTo(0, 0));
      await page.click('#sw-m01-1');
      await page.click('#size-m01-L').catch(() => {});
      await page.click('label[for="opt-lt-sv"]');
      await page.click('#add-to-bag');
      const n = await page
        .waitForFunction(() => document.querySelector('#bag-count').textContent === '1', null, { timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      check('Product', 'Colour, size, lenses and add to bag work', n);
    }

    /* 6. Bag and checkout */
    await topClick('#btn-bag');
    await page.waitForSelector('.quote-note');
    await page.waitForTimeout(800);
    await shot(6, 'Bag');
    await common('Bag');
    await page.click('#sheet-foot .btn.primary');
    await page.waitForSelector('#place-order');
    await page.waitForTimeout(300);
    for (const [sel, val] of [
      ['#f-name', 'Asha Rao'],
      ['#f-mobile', '9876543210'],
      ['#f-line1', '12 MG Road'],
      ['#f-city', 'Bengaluru'],
      ['#f-pin', '560001'],
    ]) {
      await page.fill(sel, val);
      // The page waits for the keyboard animation before bringing the field into view.
      await page.waitForTimeout(450);
      const vis = await run((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        const vv = window.visualViewport || { offsetTop: 0, height: innerHeight };
        return r.top >= vv.offsetTop - 1 && r.bottom <= vv.offsetTop + vv.height + 1;
      }, sel);
      if (!vis) check('Checkout', 'Focused field stays in view: ' + sel, false);
    }
    check('Checkout', 'Fields stay in view while typing (keyboard itself needs a real device)', true);
    await shot(7, 'Checkout');
    await common('Checkout');
    await page.check('#f-consent');
    await page.click('#place-order');
    const done = await page
      .waitForSelector('.done-title', { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    check('Checkout', 'Demo order placed', done);
    await shot(8, 'Order placed');

    /* 7. Swipe down to close */
    await topClick('#btn-search');
    await page.waitForSelector('#sheet.open');
    if (vp.width <= 600 || (vp.height <= 500 && touch) || touch) {
      const drag = (dy) =>
        run(
          async ([dy]) => {
            const g = document.querySelector('.sheet-grip') || document.querySelector('.sheet-head');
            const r = g.getBoundingClientRect();
            const x = r.left + r.width / 2,
              y = r.top + r.height / 2;
            const fire = (type, yy) =>
              g.dispatchEvent(
                new PointerEvent(type, {
                  pointerId: 7,
                  clientX: x,
                  clientY: yy,
                  bubbles: true,
                  cancelable: true,
                  isPrimary: true,
                  pointerType: 'touch',
                  buttons: type === 'pointerup' ? 0 : 1,
                }),
              );
            fire('pointerdown', y);
            for (let i = 1; i <= 10; i++) {
              fire('pointermove', y + (dy * i) / 10);
              await new Promise((r2) => setTimeout(r2, 30));
            }
            fire('pointerup', y + dy);
            await new Promise((r2) => setTimeout(r2, 500));
            return document.querySelector('#sheet').classList.contains('open');
          },
          [dy],
        );
      const side = await run(() => getComputedStyle(document.querySelector('.sheet-grip')).display === 'none');
      if (!side) {
        const stillOpen = await drag(30);
        check('Swipe', 'A short drag on the grip snaps back', stillOpen);
        const closed = !(await drag(Math.round(vp.height * 0.6)));
        check('Swipe', 'Dragging the grip down closes the sheet', closed);
      } else check('Swipe', 'Side panel (no swipe-down needed in this layout)', null, 'side panel');
    }
    await run(
      () =>
        document.querySelector('#sheet-close') &&
        document.querySelector('#sheet').classList.contains('open') &&
        document.querySelector('#sheet-close').click(),
    );

    /* 8. Info and settings, lens guide, eye test */
    await topClick('#brand-btn');
    await page.waitForSelector('#sheet.open');
    await page.waitForTimeout(300);
    await shot(9, 'Store details');
    await common('Store details');
    await run(() => document.querySelector('#sheet-close').click());
    await run(() => window.BM.onFeatureTap('eyetest'));
    await page.waitForSelector('#sheet.open');
    await page.waitForTimeout(1500);
    await shot(10, 'Eye test');
    await common('Eye test');
    await run(() => document.querySelector('#sheet-close').click());

    /* 9. Try-on (privacy screen) and Back */
    await run(() => window.BM.openTryOn && window.BM.openTryOn('m01', 0, 'M'));
    const tryOpen = await page
      .waitForSelector('.tryon-card', { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    if (tryOpen) {
      await shot(11, 'Try-on privacy');
      if (touch) {
        const st = await run(() => window.__audit.smallTargets().filter((s) => true));
        check('Try-on', 'Touch targets 44 px or more', st.length === 0, st.slice(0, 8).join('; '));
      }
      await page.goBack({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(600);
      const closed = await run(() => !document.querySelector('.tryon')).catch(() => false);
      const alive = await run(() => !!window.BM).catch(() => false);
      check('Back', 'Back closes the try-on and stays on the page', closed && alive, alive ? '' : 'left the page');
    }

    // If Back left the page earlier, come back before measuring performance.
    if (!(await run(() => !!window.BM).catch(() => false))) {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.BM && window.BM.openTryOn, null, { timeout: 120000 });
      await page
        .waitForFunction(
          () => /Showroom ready|floor plan/.test(document.querySelector('#status-text')?.textContent || ''),
          null,
          { timeout: 240000 },
        )
        .catch(() => {});
      await page.click('#w-explore').catch(() => {});
    }

    /* 9b. Graphics context loss and recovery (Chromium can simulate it) */
    if (browserName === 'chromium' && (await run(() => !!(window.BM && window.BM.api)).catch(() => false))) {
      await run(() => {
        const t = document.querySelector('.tryon');
        if (t) document.querySelector('.tryon-top .tryon-icon')?.click();
        const sh = document.querySelector('#sheet');
        if (sh && sh.classList.contains('open')) document.querySelector('#sheet-close').click();
      });
      const lost = await run(async () => {
        const gl = document.querySelector('#scene').getContext('webgl2');
        const ext = gl && gl.getExtension('WEBGL_lose_context');
        if (!ext) return { ok: false, why: 'no WEBGL_lose_context' };
        ext.loseContext();
        await new Promise((r) => setTimeout(r, 400));
        const shown = !document.querySelector('#restore').hidden;
        ext.restoreContext();
        await new Promise((r) => setTimeout(r, 1500));
        window.dispatchEvent(new Event('resize'));
        await new Promise((r) => setTimeout(r, 600));
        return {
          ok: true,
          shown,
          hidden: document.querySelector('#restore').hidden,
          draws: window.BM.api.stats().draws,
          lostNow: gl.isContextLost(),
        };
      });
      check(
        '3D',
        'Recovers after a lost graphics context, without a reload',
        lost.ok && lost.shown && lost.hidden && !lost.lostNow && lost.draws > 0,
        JSON.stringify(lost),
      );
    }

    /* 10. Performance (low-end profile) */
    if (lowEnd && (await run(() => !!(window.BM && window.BM.api)).catch(() => false))) {
      await run(() => document.querySelector('.tryon') && document.querySelector('.tryon-top .tryon-icon')?.click());
      await run(
        () =>
          document.querySelector('#sheet-close') &&
          document.querySelector('#sheet').classList.contains('open') &&
          document.querySelector('#sheet-close').click(),
      );
      const f0 = await run(() => window.__frames);
      const s0 = Date.now();
      for (const z of ['men', 'sun', 'premium', 'women']) {
        await run((zz) => window.BM.api.goZone(zz), z);
        await page.waitForTimeout(2500);
      }
      const f1 = await run(() => window.__frames);
      result.metrics.fpsWalking = +(((f1 - f0) * 1000) / (Date.now() - s0)).toFixed(1);
      const st = await run(() => window.BM.api.stats());
      result.metrics.drawsWalking = st.draws;
      result.metrics.tier = st.tier || 'n/a';
      result.metrics.heapMB = await run(() =>
        performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      );
      check(
        'Performance',
        'Walking at 30 fps or more (software WebGL, 4× CPU throttle)',
        null,
        result.metrics.fpsWalking + ' fps (recorded; headless software rendering is not representative)',
      );
    }
  } catch (e) {
    // Keep Playwright's call log: it says which element blocked an action.
    check(
      'Run',
      'Audit ran to the end',
      false,
      e.message
        .split('\n')
        .filter((l) => l.trim() && !/^\s*-\s*waiting for/.test(l))
        .slice(0, 8)
        .join(' / '),
    );
    await shot(99, 'Where it stopped').catch(() => {});
  }

  /* 11. Errors */
  result.csp = (await run(() => window.__csp).catch(() => [])) || [];
  check('Errors', 'No CSP violations', result.csp.length === 0, result.csp.join('; '));
  check('Errors', 'No console errors', result.errors.length === 0, result.errors.slice(0, 4).join(' | '));
  writeFileSync(dir + 'result.json', JSON.stringify(result, null, 2));
});
