# Prompt for Claude Code: check and fix the layout on every screen

Use in Claude Code from the project folder: `Follow @docs/prompts/02-responsive-audit.md`

---

Read `CLAUDE.md` and `docs/RESPONSIVE.md` first. Change only layout and styles unless a fix needs a small change in `src/ui/app.js` or `index.html`; never change store data, the frame builder or the security headers.

1. Build and run the device tests: `npm run build`, then `npm run test:devices`. The screens are listed in `playwright.config.js` (phones portrait and landscape with emulated notches, tablets, laptops, large desktops).
2. Look at every screenshot in `test-results/screens/`, failed or not. Note anything that is cut off, hidden behind the notch or home bar, overlapping, too small to tap, or badly spaced.
3. Fix the problems in `src/styles/main.css` following the rules in `docs/RESPONSIVE.md`:
   - everything inside the safe area, including sheets and bottom buttons;
   - no sideways scrolling;
   - floating controls never overlap;
   - touch targets at least 44 px on touch screens (`pointer: coarse`), never under 40 px;
   - text fields 16 px on touch screens.
4. If you add a floating control or panel, add its selector to the lists in `tests/e2e/layout.spec.js`.
5. Check the camera try-on panel too: open `/tools/tryon-sim.html?pid=w01` with `npm run dev` at phone, tablet and desktop sizes (Chrome device toolbar). The panel must stay inside the safe area and leave the eyes and the frame visible (on phones it folds down once the shopper is found).
6. Re-run `npm run test:devices` until it passes, then `npm test` and `npm run format`.
7. Update `docs/RESPONSIVE.md` if a layout changed. Report the problems found, the fixes and before/after screenshots paths. Do not commit or deploy.
