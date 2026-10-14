# Brijman Virtual Showroom: mobile-first layout and interaction on every device

This file has two parts:

- **Part 1 is for you.** It covers how to report the issues you saw, how to run the task, and how to test on real phones.
- **Part 2 is the brief Claude Code follows.** In the Claude Code panel in VS Code, send: `Follow @docs/prompts/03-mobile-responsive.md`

It builds on `01-api-layer.md`, which must be done. If `02-virtual-try-on.md` is also done, the try-on is included in this work. If it isn't, the try-on items are skipped.

---

# Part 1: Steps for you

## 1.1 What you will end up with

- **A layout for every screen shape:**
  - small phones (iPhone SE size);
  - large phones;
  - phones turned sideways;
  - foldables and tablets (iPad, Android tabs);
  - laptops and desktops.
  Nothing overlaps, nothing is cut off, and the bars stay clear of the notch and home indicator.
- **Touch that behaves like an app:**
  - swipe the bottom panel down to close it;
  - the phone's **Back** button closes panels instead of leaving the site;
  - every button is at least 44 px;
  - the page never zooms by accident when you tap a text field;
  - the keyboard never hides the field you are typing in.
- **Smooth 3D on mid-range and low-end Android phones,** with automatic quality levels and recovery if the phone drops the graphics.
- **Better walking and looking on touch:**
  - tap to walk, with a clear target ring;
  - drag to look, with comfortable speed;
  - pinch to zoom;
  - section labels that never pile on top of each other.
- **Works inside WhatsApp, Instagram and Facebook links,** with an "Open in browser" tip where those in-app browsers block the camera.
- **A visual test report** (`reports/mobile-audit/index.html`) with screenshots of every screen on every test device, before and after.

## 1.2 Tell Claude Code what you saw (recommended)

Before running the task, fill in the **Reported issues** table at the start of Part 2 (section 2.0) with what went wrong on your phone. One line per issue is enough, for example:

| Device and browser | Screen | What happened |
| --- | --- | --- |
| Redmi Note 12, Chrome | Product sheet | Can't scroll the sheet when my finger starts on the 3D frame |
| iPhone 13, Safari | Checkout | Page zooms in when I tap the mobile field, and the button hides behind the keyboard |

Claude Code fixes these first, then runs the full audit. If you leave the table empty, it still runs the full audit.

## 1.3 Run the task

1. Save this file as `docs/prompts/03-mobile-responsive.md`, with your issues filled in.
2. Make sure earlier work is committed:

   ```bash
   git status
   ```

3. In Claude Code send `Follow @docs/prompts/03-mobile-responsive.md`. To review the approach first, use `/plan …`.
4. It works through 7 phases on the branch `feature/mobile-responsive`, committing after each one. At the end, open `reports/mobile-audit/index.html` in your browser to see the before-and-after screenshots.

## 1.4 Test on real phones

The emulator in the browser is not enough. Always finish on real devices.

- **Easiest:** push the branch and open the **Vercel preview** link on each phone (you need to be logged in to Vercel there). The camera and try-on need this, because they require `https://`.
- **Same Wi-Fi, quick look:** run `npm run dev:phone` and open the `Network:` address. Everything except the camera works.
- **See errors from an Android phone:**
  1. Turn on USB debugging.
  2. Connect the phone by cable.
  3. Open `chrome://inspect` in Chrome on the computer.
  4. Click **inspect** under the page.
- **See errors from an iPhone:** this needs a Mac. On the iPhone, go to Settings → Safari → Advanced → Web Inspector. Then use Safari on the Mac: Develop menu → your iPhone.
- **Many devices at once (optional, paid):** BrowserStack or LambdaTest real-device clouds.

Run the checklist Claude Code writes in `docs/mobile-testing.md` on at least:
- one budget Android phone;
- one mid-range Android phone;
- one iPhone;
- one tablet;
- one in-app browser (open the link from WhatsApp).

## 1.5 If something still looks wrong

Add a line to the **Reported issues** table, then ask Claude Code: `Fix the new issues in @docs/prompts/03-mobile-responsive.md section 2.0`.

---

# Part 2: Brief for Claude Code

You are working in the Brijman Virtual Showroom project.

**Read first:**
- `CLAUDE.md`, `README.md`, `docs/decisions.md` and `docs/setup-and-deploy.md`.
- The current versions of:
  - `index.html`;
  - `src/styles/main.css`;
  - `src/ui/app.js`, plus any modules it was split into;
  - `src/scene/showroom.js`;
  - `src/three/frame-model.js` and `src/tryon/*`, if they exist;
  - `src/services/*`;
  - `vercel.json`, `vite.config.js`, `package.json`.

Follow the code as it is. File names may differ from earlier briefs.

## 2.0 Reported issues (from the developer's real devices; fix these first)

| Device and browser | Screen | What happened |
| --- | --- | --- |
| _(add rows)_ | | |

If this table is empty, continue with the full audit. Every reported row must end up in `docs/mobile-testing.md`, marked fixed with the commit that fixed it, or explained.

## 2.1 Project rules (summary; `CLAUDE.md` wins if they differ)

- Plain JavaScript ES modules, Vite 8 and three.js 0.180.0. Pin exact versions released at least two weeks ago. Scripts must be cross-platform, because the developer is on Windows.
- **Secrets.** Never read, print, stage or commit `.env` files or credentials.
- **Personal data.** Never log personal data, and never put it in URLs or localStorage. Keep the CSP and Permissions-Policy as strict as they are now. This task needs no new origins.
- **Look and feel.** Keep the existing visual identity: colour tokens, fonts and tone of copy. This task is about layout, interaction and performance, not a redesign.
- **Working style.** Work in large batches without stopping for routine confirmations. Record decisions in `docs/decisions.md`. Commit after each phase on `feature/mobile-responsive`. Never push or deploy without asking.

## 2.2 Goal

The showroom must feel native and work perfectly on every common device: from a ₹10,000 Android phone to a large desktop, in portrait and landscape, in Chrome, Safari, Samsung Internet and Firefox, and inside the WhatsApp, Instagram and Facebook in-app browsers. Every screen and flow must work with touch, mouse and keyboard:

- welcome;
- walking in the 3D store;
- tour;
- floor plan and directory;
- search;
- product sheet with the 3D viewer and lens configurator;
- size selector;
- bag;
- checkout;
- eye test booking;
- lens guide;
- store details and settings;
- try-on.

## 2.3 Known problems found by code review (verify and fix each one)

These come from reading the current code. Some may already be fixed; confirm each against the code.

1. **iOS zooms on input focus.** The search box and the prescription, checkout and booking inputs are 15 px. iOS zooms the page for any input under 16 px. Every `input`, `select` and `textarea` must be at least 16 px on touch devices.
2. **The sheet cannot scroll from the 3D viewer.** The product viewer canvas uses OrbitControls, which sets `touch-action: none`. A vertical swipe that starts on the viewer cannot scroll the sheet. On touch:
   - set the viewer canvas to `touch-action: pan-y`;
   - rotate on horizontal drags only;
   - allow pinch zoom only inside the viewer.
   On desktop, keep full orbit.
3. **The bottom bar height is guessed.** `--bb-h` is never set (the CSS falls back to 66 px). Measure the real bottom bar with a `ResizeObserver` and set `--bb-h`. The dock, welcome card, toast and hint must use it.
4. **No Back button support.** The Android and iOS Back gestures leave the site instead of closing what is open.
   - Push a history entry when opening a sheet, the directory, the tour, the try-on or the photo compare view; close it on `popstate`.
   - Nested sheets (Back inside the sheet) should map to history too.
   - Never trap the user: Back from the bare store behaves normally.
5. **The keyboard hides fields.** The bottom sheet is sized against the layout viewport. On phones the keyboard covers the field and the sheet's footer button. Use the `visualViewport` API:
   - set `--vvh`, the visible height, and size the sheet from it;
   - keep the focused field scrolled into view inside the sheet body only, never by scrolling `#app`;
   - keep the primary action reachable.
   Also add `interactive-widget=resizes-content` to the viewport meta, test it on Chrome Android, and record the result in `docs/decisions.md`.
6. **The welcome card can overflow** on short screens (iPhone SE, landscape). Give it a max height that follows the visible area, between the top bar and the bottom bar, with its own scrolling.
7. **Sticky hover on touch.** `:hover` rules stay applied after a tap. Wrap hover styles in `@media (hover: hover) and (pointer: fine)`.
8. **Touch targets are too small:**
   - chips 34 px, quantity buttons 34 px, locate 36 px, card close 34 px;
   - small text links;
   - floating zone labels about 26 px;
   - swatches 36 px.
   Make every interactive element on `(pointer: coarse)` at least 44×44 px. Where the visual size should stay small, enlarge only the hit area with padding or a pseudo-element.
9. **Text too small to read on phones:**
   - eyebrows 9–10.5 px;
   - viewer hint and tags 10 px;
   - prescription headers 10 px.
   The minimum is 11 px for uppercase micro-labels and 12 px for anything else. Body text stays at 15–16 px.
10. **Floating section labels overlap.** On small screens they also collide with the minimap and the cards. Add screen-space collision avoidance:
    - priority goes to the nearest label, and to the current tour target;
    - hide labels behind the top bar, minimap, dock and bottom bar, and any that overlap a higher-priority label;
    - show at most 4 labels on phones.
11. **The minimap overlaps the 3D labels and the hint** on phones (top left, 118×86). Make it collapsible to a small floor-plan button, collapsed by default on phones shorter than 700 px, with its state remembered in `bm-settings`.
12. **Tap and drag thresholds are too strict for touch.** A tap allows 6 px of movement and 650 ms. Use about 10 px and 500 ms for touch, keep 6 px for the mouse, and scale by device pixel ratio. A drag that ends must not count as a tap.
13. **Long-press and text-selection side effects:**
    - long-pressing the canvas, labels or controls can open the iOS callout or magnifier, or select text;
    - double-tapping a button can zoom on iOS.
    Fix with `-webkit-touch-callout: none` and `user-select: none` on the 3D canvas and chrome (never on inputs or readable text), `touch-action: manipulation` on buttons, and `-webkit-text-size-adjust: 100%` on `html`.
14. **Pull-to-refresh and overscroll.** Dragging down on the top bar or cards can trigger Android pull-to-refresh. Set `overscroll-behavior: none` on `html` and `body`, and keep `contain` on scrolling panels.
15. **No swipe-down to close the sheet.** The grip is only decoration. Add drag-to-dismiss on the grip and header:
    - follow the finger;
    - snap back if pulled less than 30 % of the sheet height or slower than the velocity threshold;
    - close otherwise;
    - respect reduced motion;
    - never start the gesture while the sheet body is scrolled away from the top.
16. **3D performance on low-end phones:**
    - all instances of an archetype share one `InstancedMesh` spanning the whole store, so frustum culling never helps;
    - shelf frames use full-detail geometry;
    - textures are full size on phones.
    See section 2.6.
17. **WebGL context loss.** It only shows a toast today. On iOS especially, the scene can stay black after the app returns from the background. Restore fully (see section 2.6).
18. **Viewport height.** Check every full-height surface on iOS Safari and Chrome Android as the toolbar collapses and expands:
    - the app;
    - the sheet;
    - the try-on;
    - the welcome card.
    Use `100dvh`, `svh` and `lvh` deliberately, keep `viewport-fit=cover` with safe-area padding on the top bar, bottom bar and sheet footer, and never use bare `100vh`.

## 2.4 Layout system

Define the layout modes in one place (`src/styles/main.css`, plus `src/ui/layout.js` for JavaScript checks) and use them everywhere:

| Mode | Rule | Layout |
| --- | --- | --- |
| Phone portrait | width ≤ 600 px, portrait | Compact top bar (brand mark, section pill, search, bag). Bottom bar with Directory, Tour, Eye test, Info. Dock cards above the bottom bar. Bottom sheet up to the visible height minus 56 px. Minimap collapsible. |
| Phone landscape | height ≤ 500 px, landscape | **No bottom bar:** its actions move into the top bar's menu. The top bar is about 44 px. The sheet becomes a **right side panel** at 50 % width (minimum 320 px). Dock cards are narrower and sit bottom-left. Minimap collapsed. Welcome card scrolls. |
| Tablet | 601–1024 px, touch | Desktop arrangement with a side sheet of 380–420 px, but touch-sized targets and no hover-only affordances. Bottom bar hidden. |
| Desktop | 1025 px and wider, or a fine pointer with enough room | Current desktop layout. |

**Rules:**
- **Gutter.** Use `clamp(12px, 3vw, 24px)`, plus safe-area insets on the sides in landscape (notch side).
- **Type scale.** Use `clamp()` so headings shrink on small phones without wrapping badly. Test with 200 % browser text zoom: nothing important may be clipped.
- **No overlaps.** No fixed element may cover another fixed element in any mode: top bar, minimap, dock, bottom bar, sheet, toast, hint, pin label, tooltips and try-on controls.
- **No sideways scroll.** No horizontal page scroll at any width from 320 px to 2560 px.
- **Foldables.** Use the `viewport-segments` media query if it is available. The minimum is that it must not break; do not build special layouts.
- **Right to left.** Not required. Do not add RTL work.

## 2.5 Interaction model

- **3D on touch:**
  - one-finger tap on the floor walks there;
  - one-finger drag looks around, at a speed of about 0.25° per CSS pixel, with light inertia that respects reduced motion;
  - pinch zooms;
  - tap on a frame opens its sheet;
  - tap on a label walks to that section.
  - Show the floor target ring on touch too: briefly at the tapped point, then at the destination while walking.
  - The first visit shows a 2-step coach mark (tap to walk, drag to look) that is dismissible and remembered.
- **Optional, off by default.** "Look around by moving your phone" uses `DeviceOrientationEvent`. On iOS it needs a permission button. If you add it, the Permissions-Policy must allow `gyroscope=(self)` and `accelerometer=(self)`; record that in `docs/decisions.md`. If it causes any problem, skip it.
- **Keyboard and mouse on desktop stay as they are:** WASD and arrows, drag, wheel, Esc.
- **Gestures in the sheet.** Swipe down to close (see item 15). Horizontal swipes in carousels never trigger 3D look.
- **Edge safety.** No custom gestures start within 16 px of the screen edges, so the iOS and Android Back-swipe still works.
- **Feedback.** Every tap gives visible feedback within 100 ms: a pressed state, or the ring on the floor. Optional haptics (`navigator.vibrate(8)`) only on supported Android devices, and only on add to bag and photo capture.
- **Forms:**
  - correct `type`, `inputmode`, `autocomplete` (`name`, `tel`, `email`, `address-line1`, `address-level2`, `postal-code`) and `enterkeyhint`;
  - the numeric keypad for prescription fields, including signed decimals (check iOS: you may need `inputmode="decimal"` plus explicit +/− toggles for the sign);
  - validation messages next to the field, announced through `aria-live`;
  - the primary button stays visible above the keyboard.
- **Try-on, if present:**
  - full screen with safe areas;
  - works in portrait and landscape;
  - controls stay reachable with the thumb (bottom third in portrait, right edge in landscape);
  - the camera stops when the app goes to the background;
  - in-app browsers that block `getUserMedia` show "Open in Chrome/Safari to use the camera, or use a photo instead", with a copy-link button.
- **Android Back** closes the try-on.

## 2.6 Performance and robustness on phones

**Quality tiers.** Choose a tier at start-up from `navigator.hardwareConcurrency`, `navigator.deviceMemory` (where available), screen size, the WebGL `MAX_TEXTURE_SIZE`, and a 1-second render benchmark. The tier can drop at run time if fps stays under target for 3 s. It can be overridden in Info → Picture quality.

| Tier | Typical device | Device pixel ratio | Shadows | Textures | Shelf frame detail | Target |
| --- | --- | --- | --- | --- | --- | --- |
| Low | Budget Android, 3–4 GB RAM | 1.0 | off | 512 px | simplified geometry: about 40 % of the triangles; fewer tube and outline segments | 30 fps or more |
| Medium | Mid-range phones, older iPhones | 1.25–1.5 | off | 1024 px | normal | 45 fps or more |
| High | Recent phones, tablets, laptops | up to 2 | on (desktop) | full | normal | 60 fps |

**Draw calls and culling:**
- Split frame `InstancedMesh`es **per section** so frustum culling can skip whole sections behind the camera.
- Set accurate bounding spheres per section mesh.
- Keep the draw count shown by `BM.api.stats()` under about 120 on phones.

**Level of detail.** Shelf frames more than about 4 m away use the simplified geometry. The product viewer and the try-on always use full detail.

**Memory:**
- dispose of anything no longer used;
- no texture larger than 1024 px on Low or Medium;
- watch `renderer.info.memory` in debug mode;
- check the heap does not climb when the sheet, product viewer or try-on is opened and closed 20 times.

**Context loss.** On `webglcontextlost`, pause and show "Restoring the 3D view…". On `webglcontextrestored`, rebuild the GPU resources, textures and instanced meshes, without reloading the page. If restoring fails twice, offer **Reload** and keep the floor plan fallback usable.

**Page lifecycle:**
- pause rendering on `visibilitychange` (hidden) and on `pagehide`;
- resume on `pageshow`, including restores from the back-forward cache;
- the try-on camera always stops when the page is hidden.

**Loading:**
- On a 4G profile, the welcome card and the floor plan are usable within 2.5 s.
- The 3D view is ready within 6 s on Medium.
- Show progress for the three.js chunk and for scene building.
- Lazy-load anything not needed on the first screen.

**Accessibility:**
- reduced motion: no inertia, fades instead of slides, the tour jumps instead of walking;
- touch targets of 44 px or more;
- focus never lost when panels open or close;
- screen-reader labels unchanged or improved.

## 2.7 Automated audit (Playwright)

Add `@playwright/test`, pinned to an exact version at least two weeks old, as a dev dependency. Use only the browsers Playwright downloads (`npx playwright install chromium webkit firefox`, documented in the README). Add `npm run test:mobile`, which builds, starts the preview server and runs the audit.

**Device projects.** Use Playwright's built-in device descriptors, in both portrait and landscape:
- iPhone SE;
- iPhone 15 Pro (or the closest available);
- Pixel 7;
- Galaxy S9+ (small Android);
- a 360×800 low-end Android profile with Chromium CPU throttling at 4× through CDP;
- iPad Mini;
- Galaxy Tab S4;
- desktop at 1366×768 and 1920×1080.

Run Chromium for the Android and desktop profiles, and **WebKit** for the iPhone and iPad profiles. WebKit approximates Safari closely but is not identical; say so in the report.

**Checks on every device and orientation:**
1. **Welcome:** visible without clipping. Both buttons are in view or reachable by scrolling inside the card.
2. **No overlap:**
   - compute the bounding boxes of the top bar, minimap, dock cards, bottom bar, sheet and toast;
   - no two fixed elements may intersect, except the sheet over the dock when the sheet is open;
   - all of them sit inside the safe area.
3. **No horizontal overflow:** `document.documentElement.scrollWidth <= innerWidth`.
4. **Touch targets** on coarse-pointer profiles: every visible interactive element is at least 44×44 px, hit area included. Report offenders by selector.
5. **Minimum text size:** no visible text under 11 px, and inputs at 16 px or more on touch.
6. **Product sheet:** open it, scroll it by swiping on the 3D viewer area, change colour, change size, open the lens options, add to the bag.
7. **Checkout:** fill in every field. The focused field stays inside the visible viewport (simulate a smaller `visualViewport` where possible, and list it as a manual check otherwise). Then place a demo order.
8. **Back button:** open a sheet and go back in history; the sheet closes and the page stays. The same for the directory and the try-on (if present).
9. **Swipe down:** dragging the sheet grip closes the sheet. A short drag snaps back.
10. **3D:** a tap on the floor starts walking. A drag rotates the view and does not start walking. A pinch changes the zoom. Labels never overlap each other, and never sit under the top bar, minimap or dock.
11. **Performance** on the throttled low-end profile: record fps over 10 s of walking, the draw count and the JavaScript heap.
12. **No console errors and no CSP violations.**

**Report.** Write `reports/mobile-audit/index.html`, a static page that works offline:
- screenshots of each step for each device and orientation, before and after;
- a pass or fail table;
- the fps, draw count and heap figures;
- a list of the manual checks still required.

Keep the screenshots out of git (`reports/` is gitignored), but commit the generator script.

## 2.8 Phases

Commit at the end of each phase on `feature/mobile-responsive`.

1. **Baseline audit.**
   - Add Playwright and the audit, and run it on the current code to produce the **before** report.
   - Reproduce every reported issue from section 2.0 and every item in section 2.3.
   - Write the findings into `docs/mobile-testing.md`.
2. **Layout system.** Modes, tokens, safe areas, viewport units, bottom-bar measuring, welcome card, minimap collapse, landscape layout, tablet layout.
3. **Touch and gestures.** Targets, hover gating, thresholds, callout and selection, overscroll, swipe to close, the Back button and history, the coach mark, the target ring, viewer touch rules, label collision.
4. **Forms and keyboard.** Input sizes, input attributes, `visualViewport` handling, the field kept in view, the reachable primary action.
5. **Performance and robustness.** Quality tiers, per-section instancing and culling, level of detail, texture sizes, context-loss recovery, page lifecycle, loading progress.
6. **Try-on on mobile (if present), and in-app browsers.** Orientation, safe areas, thumb-reach controls, camera lifecycle, in-app browser detection and copy-link fallback.
7. **Verification and docs.**
   - Run the audit again to produce the **after** report.
   - Fix anything still failing.
   - Write `docs/mobile-testing.md`: the manual device checklist with expected results, columns for device, browser, OS version, pass or fail and fps, and how to debug on real devices (`chrome://inspect`, Safari Web Inspector).
   - Update `README.md`, `docs/setup-and-deploy.md` (the `test:mobile` command, the Playwright browser install, the real-device testing steps) and `CLAUDE.md` (layout modes, interaction rules, performance tiers; under 200 lines).

## 2.9 Acceptance criteria

- [ ] `npm run check` and `npm run test:mobile` pass. `npm audit` reports 0 vulnerabilities. The smoke test still passes against `npm run preview`.
- [ ] Every row in section 2.0 is fixed, or explained in `docs/mobile-testing.md`.
- [ ] Every item in section 2.3 is fixed, or shown not to apply, with evidence in the report.
- [ ] Every device and orientation in section 2.7 meets all of these:
  - no horizontal overflow;
  - no overlapping fixed elements;
  - touch targets of 44 px or more;
  - text of 11 px or more and inputs of 16 px or more;
  - no console errors and no CSP violations.
- [ ] The Back button and swipe-down close panels on phones. A swipe on the product viewer scrolls the sheet. iOS never zooms on input focus.
- [ ] On the throttled low-end profile, the showroom holds 30 fps or more while walking (or the best achievable, measured and explained). On Medium it holds 45 fps or more.
- [ ] After a simulated context loss, the 3D view recovers without a page reload.
- [ ] Landscape phones are fully usable, with the side-panel sheet and the compact top bar.
- [ ] The look, colour tokens, fonts and copy tone are unchanged. Desktop behaviour is unchanged except for the fixes.
- [ ] `reports/mobile-audit/index.html` shows before and after for every device. `docs/mobile-testing.md` is ready for the team to run on real phones.

## 2.10 When you finish

Reply with:

1. the reported issues and the known problems: each one, fixed or not, with the commit;
2. what changed, by phase;
3. the before and after numbers: fps, draw calls, load times and failing checks;
4. the exact commands: `npm run test:mobile`, how to open the report, and how to test on real phones;
5. what only a real device can confirm, which the developer must check from `docs/mobile-testing.md`;
6. any deviation from this brief, and why.

If anything in this brief conflicts with how the code actually works, keep the existing behaviour, note the conflict in `docs/decisions.md`, and say so in your reply.
