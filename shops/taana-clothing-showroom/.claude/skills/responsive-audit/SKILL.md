---
name: responsive-audit
description: 'Check the layout on every screen size and fix anything cut off, overlapping, outside the safe area or too small to tap.'
disable-model-invocation: true
---

Read `CLAUDE.md` and `docs/RESPONSIVE.md` first. Change only layout and styles unless a fix needs a small change in `src/ui/app.js` or `index.html`; never change store data, the cloth engine or the security headers.

1. Build and run the device tests: `npm run build`, then `npm run test:devices`. The screens are listed in `playwright.config.js` (phones portrait and landscape with emulated notches, tablets, laptops, large desktops).
2. Look at every screenshot in `test-results/screens/`, failed or not. Note anything that is cut off, hidden behind the notch or home bar, overlapping, too small to tap, or badly spaced.
3. Fix the problems in `src/styles/main.css` following the rules in `docs/RESPONSIVE.md`:
   - everything inside the safe area, including sheets and bottom buttons;
   - no sideways scrolling;
   - floating controls never overlap;
   - touch targets at least 44 px on touch screens (`pointer: coarse`), never under 40 px;
   - text fields 16 px on touch screens.
4. If you add a floating control or panel, add its selector to the lists in `tests/e2e/layout.spec.js`.
5. Re-run `npm run test:devices` until it passes, then `npm test` and `npm run format`.
6. Update `docs/RESPONSIVE.md` if a layout changed. Report the problems found, the fixes and before/after screenshots paths. Do not commit or deploy.
