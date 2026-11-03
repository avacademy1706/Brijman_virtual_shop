# CLAUDE.md · Taana Studio virtual clothing showroom

> **In the Plexus marketplace repository** this shop is served at `/clothing/`. The repository root builds it with `../../scripts/build-shops.mjs` (`npm run build -- --base=/clothing/` into `../../public/clothing/`), and the root `vercel.json` sets its headers; this folder's own `vercel.json` is used only if the shop is deployed on its own. Keep reading every file under `import.meta.env.BASE_URL`, and keep the `.market-back` and `.market-link` links to the marketplace (`/`).

Static Vite site: a walkable three.js clothing store with a custom cloth simulator and a camera try-on (MediaPipe Pose, on-device). Plain JavaScript ES modules, no framework, no TypeScript, no backend. Deployed on Vercel. README.md is the client-facing setup guide; this file is for working on the code.

> This project is one of three in the `plexus-virtual-showrooms` master folder. The master `CLAUDE.md` one level up lists the others and the shared rules; work inside this folder for anything specific to this project.

## Security rules (highest priority)

- Secrets, credentials, tokens and API keys must never leak. Never read, stage, print, echo or commit `.env` files or credential values. Never paste a token into chat or into code. Keep secrets in `.env` (gitignored) and refer to them only by variable name.
- The site needs no secrets today. When a backend is added, secrets live in Vercel environment variables and server code (`/api`) only. Never give a secret a `VITE_` prefix: Vite inlines those into the public bundle.
- Flag any secret you find in code, logs, git history or the built bundle (`dist/`).
- Keep the CSP in `vercel.json` strict. No inline `<script>`, no third-party CDN, no `eval`. `'wasm-unsafe-eval'` is there only for MediaPipe. `connect-src 'self'` is deliberate: it keeps the try-on on-device and blocks MediaPipe's usage telemetry (one console error, expected).
- Camera frames never leave the device. Do not add uploads, analytics or recording of video, photos or body measurements. Measurements stay in `localStorage` (`taana-body`).
- `npm run preview` serves `dist/` with the headers from `vercel.json`. Test CSP and Permissions-Policy changes there before deploying.

## Commands

```bash
npm ci               # first time (exact versions from package-lock.json)
npm run dev          # predev: bake drapes + set up try-on, then Vite on :5173
npm run dev:phone    # same, exposed on the LAN (camera needs HTTPS on phones)
npm run build        # prebuild (same steps) + vite build -> dist/
npm run preview      # dist/ on :4173 with production headers
npm run bake         # force a re-bake of all drapes
npm run setup:tryon  # copy MediaPipe wasm, download pose models if missing
npm run check        # drapes, wasm and models are in place
npm run format       # prettier (printWidth 120, single quotes, trailing commas)
npm test             # unit tests (Vitest, Node): data, layout, cloth engine, drapes, security
npm run test:e2e     # browser tests (Playwright) on 12 screens + no-WebGL; first run: npx playwright install chromium
npm run test:devices # only the responsive layout test, every screen
```

Node 22.12 up to 24 (Vercel builds with 24; `engines` in package.json). Versions are pinned exactly (three 0.180.0, @mediapipe/tasks-vision 1.0.1, vite 8.3.4, vitest 5.0.3, @playwright/test 1.63.0). Run `npm audit` after any dependency change; it must report 0 vulnerabilities. Keep the MediaPipe version in `package.json`, the wasm path and `MP_VERSION` in `src/tryon/tracker.js` in step.

## Layout

```
index.html               shell, top bar, panels, bottom bar (UI markup)
src/main.js              entry: styles, UI, then lazy-loads the 3D scene
src/core/ny.js           NY shared namespace (window.NY in the browser; also imported by Node scripts)
src/data/store-layout.js NY.STORE, NY.L (floor plan in metres), NY.ZONES, NY.TOUR, NY.TOUR_TEXT, obstacles
src/data/catalogue.js    36 products, size charts, NY.MERCH (what hangs where), specFor(), recommendSize()
src/cloth/sim.js         ClothSim (Verlet + distance constraints), colliders, CGROUP masks, FABRICS presets, resolvePoint
src/cloth/body.js        joints, segment frames, measurements, torso profile, shoulderLine, colliders()
src/cloth/garments.js    TEMPLATES, SLEEVES, DRAPES, buildGarment(), buildCurtain(), computeTargets()
src/cloth/poses.js       animatedPose(m, t, { mode: still | idle | turn | walk | showcase })
src/cloth/render.js      fabric textures and materials, ClothMesh (wrinkles, trims), Mannequin
src/cloth/outfit.js      Outfit: layered garments on one body (live looks, product viewer, try-on)
src/cloth/display.js     hanger and form set-ups, settle helpers used by the bake
src/cloth/measure.js     body from the shopper's height, chest, waist, hip
src/scene/showroom.js    three.js store: fixtures, baked garment batches, live looks, picking, camera, viewer, NY.api
src/scene/drapes.js      loads public/drapes/drapes.bin (quantised Int16, decoded on demand)
src/ui/app.js            all panels: product sheet, browse, search, bag, checkout demo, size guide, measurements, settings
src/tryon/tracker.js     createLandmarker(), PoseTracker (One Euro filters, scale calibration, mask widths)
src/tryon/tryon.js       try-on overlay: camera, loop, cloth on the tracked body, occluders, photo; lazy-loaded
src/lib/dom.js           h() element helper and SVG icons
src/lib/drawings.js      floor plan and garment SVG thumbnails
scripts/bake-drapes.mjs  simulates hanger/form garments in Node and writes the drape files
scripts/setup-tryon.mjs  copies wasm to public/vendor/, downloads models to public/models/, pins SHA-256
scripts/check-assets.mjs asset check used by `npm run check`
tests/unit/              Vitest unit tests (Node)
tests/e2e/               Playwright browser and device tests (helpers.js: safe-area, overlap, tap-target checks)
docs/                    SETUP-VSCODE, TESTING, RESPONSIVE, DEPLOY-VERCEL (client-facing guides)
.github/workflows/ci.yml format, unit tests, build on every push; browser tests on manual dispatch
```

Generated, do not edit by hand: `src/generated/drapes.json`, `public/drapes/drapes.bin` (committed, rebuilt by the bake), `public/vendor/` and `public/models/*.task` (gitignored, created by setup).

## Conventions

- Units are metres and seconds everywhere in `src/cloth/` and the scene. Sizes in the catalogue are centimetres and are converted in `specFor()`.
- Body frame: x is the viewer's right, y up, z toward the viewer. The person's left side is +x. The try-on camera frame uses the same axes.
- Data modules attach to `NY` and must run in Node (no `window`, `document` or canvas at import time). The bake imports them.
- The UI talks to the scene only through `NY.api` (set in `app.js`, implemented in `showroom.js`). Keep that boundary.
- Every collider has a `group` from `CGROUP`; every particle has a `cmask`. A new collider without a group collides with nothing.
- Garment shape changes go in `TEMPLATES` or a product's `over` overrides, not in special cases inside the builder.
- Prettier formats everything; run `npm run format` before finishing.
- Client-facing text (UI copy, README) is formal English. No marketing superlatives.

## How the pieces fit

- **Baked vs live.** Hanger, rail, folded and form garments are simulated once by `bake-drapes.mjs` and merged per material in the scene. The Festive podium looks, the fitting-room mannequin, the product viewer and the try-on run `Outfit` every frame. The bake is skipped when a hash of the cloth sources (`sim`, `body`, `garments`, `poses`, `display`), the products, merchandising, size charts, ease and `RES` is unchanged; `npm run bake` forces it. If a new file affects drapes, add it to `SOURCES` in the bake script.
- **Live budget.** Live looks run only when near and in view, at 30 Hz on coarse-pointer devices. A look that left the view is reset when it returns. Resolution tiers: live looks 0.75 / 0.55 (phone), viewer 0.9 / 0.72, try-on 0.85 / 0.66. Collision margin grows as resolution drops.
- **Cloth feel (`TUNE` in `sim.js`).** Four settings keep the fabric from wobbling like jelly: `skinDamp` (pulls toward the body drag the cloth instead of acting as springs), `deformDamp` (removes velocity that differs from the cloth's best-fit rigid motion, so jiggle dies but swings and twirls stay), `strainLimit` (structural edges stretch at most 3%), `relFriction` (friction is measured against the moving body). The fabric presets keep compression stiffness low so excess fabric folds instead of puffing. `jelly`-style regressions show up as repeated small twist reversals after a turn stops. Changing `sim.js` re-bakes the drapes.
- **Viewer spin.** Sideways drag in the product viewer turns the body (`VW.spin`), not the camera; OrbitControls keeps tilt and zoom with its azimuth locked. A released flick keeps spinning (`SPIN_MAX`, `SPIN_FRICTION`). `stepViewer` splits a large turn into up to 5 sub-steps so colliders and pinned seams follow the arc, and the viewer outfit uses `maxSpeed: 12` so the hem can flare. The try-on keeps the default 3 m/s limit because tracking can glitch.
- **Try-on pipeline.** detectForVideo → PoseTracker (filtered landmarks to metres, scale from world landmarks × height-prior correction) → completePose → Outfit.step on body colliders → orthographic overlay camera with metres-per-pixel matching the video → depth-only occluders for head, neck and forearms in front of the torso. Segmentation masks are on only for calibration (silhouette widths), then switched off with `setOptions`.
- **Section card timer.** The section card closes itself after `ZC_SECONDS` (5) in `app.js`; the countdown is a CSS animation on `#zc-bar` (`animationend` hides the card), so hovering the card or focusing a button in it pauses it. `S.cardZone` stays set, so the card does not pop up again in the same section.
- **Corner section button.** `#here` (built in `app.js`, `updateHere`) shows the current section's main action (`hereAction`) in the bottom-right corner whenever the visitor stands in a section and nothing covers it (section card, tour, panel, welcome, try-on). A MutationObserver on those elements keeps it in step. The info button reopens the section card.
- **Walking and boundaries.** The walk grid (`NAV` in `showroom.js`, 10 cm cells) blocks three things: fixture footprints in `NY.OBS`, every solid triangle and baked garment between ankle and head height (so a rail end or a garment that hangs past its shelf counts too), and the keep-out rectangles in `NY.NO_GO` (`store-layout.js`: behind the counter and desk, behind the dress forms and tables, the strips along the wall bays). The visitor keeps `BODY_R` (0.32 m) from fixtures and geometry. Click-to-walk, the keys, the tour and the floor plan all go through this grid. `NY.api.navGrid()` returns it for tests.
- **Tapping walls and fixtures.** A tap (or the second tap, with double-tap walking) on a wall, poster or fixture walks to a spot square in front of it, `NEAR` (1.45 m) back, and turns to face it (`focusFor()`, `standIn()` in `showroom.js`; the look point sits a little above the middle of the screen, `BAND_MID`, so the section card does not cover it). A floor tap stops `CLEAR` (0.95 m) short of a wall or fixture straight ahead (`keepClear()`); so does `NY.api.goPoint()`. `NY.api.pick(x, y)` reports what a tap at a screen point would hit, and `NY.api.debugPose()` places the camera, for tests.
- **Try-on models on Vercel.** `scripts/setup-tryon.mjs` runs before every build. On Vercel (`VERCEL=1`) or with `TRYON_STRICT=1` it retries each download three times and then fails the build if a required model is still missing, so a deployment never goes live without a working try-on. `TRYON_OPTIONAL=1` deploys without it on purpose. Locally a missing model is only a warning.
- **Controls.** With "Walking by click" on Double-click (the default, `S.settings.walkClick`), the first click on the floor marks the spot with a pulsing ring and a second click on it within `PEND_MS` walks there; garments and fixtures still open with one click. Any press while walking stops the walk. A press counts as a drag after `DRAG_PX` (8 px mouse, 14 px touch). "Look speed" (`S.settings.look`) scales drag and key turning (`LOOK_SPEED`: 0.45 / 0.7 / 1). Key walking is 1.8 m/s; click walks take `len / 1.9` s.
- **Panels tied to a spot.** A panel opened from something in the store (garment or counter tap, section card, tour, corner button) is opened with `openAtSpot` / `openAtZone` in `app.js` and remembers the item's position (or where the visitor stood). `checkLeftSpot` (called from `NY.onMove`, which the scene fires on every position change) closes it once the visitor is `LEAVE_BY` (1 m) further from that point than the closest they came, never less than `NEAR_MIN` + `LEAVE_BY`. Walking towards the item keeps it open. Panels opened from the top or bottom bar use plain `openSheet` and stay open. The section card hides as soon as the visitor is in another section. Tooltips hide while the view moves and are re-checked when it settles.
- **Responsive layout** (`docs/RESPONSIVE.md`). Phone layout up to 760 px wide (bottom bar, bottom sheet), desktop above (right-hand panel), a 761–1080 tablet tier, a short-screen tier (max-height 500: no floor-plan card, scrolling cards), a sideways-phone tier (no bottom bar; Tour and Directory move into the top bar) and touch sizing under `pointer: coarse` (44 px targets, 16 px inputs). The root element is padded with all four `env(safe-area-inset-*)`, so everything inside `.app` is in the safe area; position new chrome inside `.app` with `position: absolute`, never `fixed`.
- **Model loading.** `createLandmarker` HEAD-checks the model URL and rejects an HTML response (Vite and Vercel return `index.html` for a missing file, which MediaPipe reports as "Unable to open zip archive").

## Known pitfalls

- Cloth must step at a fixed length. Position-based cloth rests in a slightly different shape for each step length, so stepping with the raw frame time (uneven on 120/144 Hz screens or busy machines) makes resting cloth shake. `ClothSim.step` therefore runs whole internal steps of `fixedH` (set on the first call, or explicitly) and carries the remainder; the Orbit live loop and the store's product viewer also run fixed steps of their own.
- Shoulders and armholes (`buildBody`, `buildSleeve` in `garments.js`). The front and back top edges of the body tube are pinned about 2 cm apart over each shoulder; `B.bridge` closes that slit with render-only triangles. The rows over the shoulder are spaced evenly along the surface, not in equal steps of depth, because long flat triangles there cut into the shoulder ball. The sleeve's top edge follows a full armhole curve (exponent 2.4) and tucks slightly under the body panel. Loosening any of these makes the dark mannequin show through as "torn" seams; check with close-ups of the shoulders from the front, side, top and back.
- Do not call `computeVertexNormals()` on non-indexed mannequin geometry; it gives flat shading. Normals are built per segment.
- Pinned dupatta columns must have zero pleat depth, or the pinned edge spikes.
- Layered pieces (jacket over kurta, dupatta over anything) collide with padded colliders (`pad 0.014`, `armPad 0.03`). Without the padding the outer layer pokes through.
- Hand and forearm occluders are only enabled when the arm is in front of the torso; otherwise they punch holes in sleeves.
- Wrinkle strength is driven by compression and clamped (`min(0.7, …)`). Raising it makes fabric look furry.
- MediaPipe may lock on to a second person in frame. `numPoses` is 1 and the intro asks for only one person in view; do not raise it.
- Portrait camera video on a landscape screen uses `object-fit: contain` (`.to.fit-contain`) so the overlay maps 1:1 to the video.
- `assetsInlineLimit: 0` is required. Inlined `data:` fonts would be blocked by `font-src 'self'`.

## Testing

Details in `docs/TESTING.md`. Before finishing a change:

1. `npm run format:check`, `npm test`, `npm run build`, `npm run check`.
2. For any change to layout, CSS or the interface: `npm run test:devices` (and look at `test-results/screens/`). For changes to walking, the try-on or headers: `npm run test:e2e`.
3. `npm run preview`, open http://localhost:4173. The console should show no errors except the blocked MediaPipe telemetry request.
4. On a real phone through a Vercel preview URL (HTTPS): walk, product sheet, try-on.

Rules for tests:

- A new garment template, fabric or catalogue field gets a check in `tests/unit/`. A new collider gets a `group` (body.test.js fails otherwise).
- Every new floating control or panel goes into the selector lists in `tests/e2e/layout.spec.js` so the safe-area and overlap checks cover it.
- Never weaken `security.test.js` to make it pass; fix the cause. It never opens `.env` files.
- The e2e suite runs against the production build on port 4173 and reuses a running preview server; rebuild after changes.

Fake camera for repeatable try-on tests in Chromium:

```bash
chromium --use-fake-ui-for-media-stream --use-fake-device-for-media-stream \
  --use-file-for-fake-video-capture=/path/to/person.y4m http://localhost:4173
```

Useful console handles: `NY.api` (scene; `navGrid()`, `where()`, `stats()`, `pick(x, y)`, `debugPose(x, z, yaw, pitch)`), `NY.tryonState` (try-on state: tracker, outfit, calibration), `NY.byId` (products).
