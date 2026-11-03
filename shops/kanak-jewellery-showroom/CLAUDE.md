# CLAUDE.md · Kanak virtual jewellery boutique

> **In the Plexus marketplace repository** this shop is served at `/jewellery/`. The repository root builds it with `../../scripts/build-shops.mjs` (`npm run build -- --base=/jewellery/` into `../../public/jewellery/`), and the root `vercel.json` sets its headers; this folder's own `vercel.json` is used only if the shop is deployed on its own. Keep reading every file under `import.meta.env.BASE_URL`, and keep the `.market-back` and `.market-link` links to the marketplace (`/`).

Static Vite site: a walkable three.js jewellery boutique with a procedural jewellery engine (gold, diamonds, polki, pearls), a live price breakdown and a camera try-on (MediaPipe Face and Hand Landmarker, on-device). Plain JavaScript ES modules, no framework, no TypeScript, no backend. Deployed on Vercel. README.md is the client-facing setup guide; this file is for working on the code.

> This project is one of three in the `plexus-virtual-showrooms` master folder. The master `CLAUDE.md` one level up lists the others and the shared rules; work inside this folder for anything specific to this project.

## Security rules (highest priority)

- Secrets, credentials, tokens and API keys must never leak. Never read, stage, print, echo or commit `.env` files or credential values. Never paste a token into chat or into code. Keep secrets in `.env` (gitignored) and refer to them only by variable name.
- The site needs no secrets today. When a backend is added (live gold rates, payments, appointments), secrets live in Vercel environment variables and server code (`/api`) only. Never give a secret a `VITE_` prefix: Vite inlines those into the public bundle.
- Flag any secret you find in code, logs, git history or the built bundle (`dist/`).
- Keep the CSP in `vercel.json` strict. No inline `<script>`, no third-party CDN, no `eval`. `'wasm-unsafe-eval'` is there only for MediaPipe. `connect-src 'self'` is deliberate: it keeps the try-on on-device and blocks MediaPipe's usage telemetry (one console error, expected). A rates API must be same-origin (`/api/rates`) for the CSP to allow it.
- Camera frames never leave the device. Do not add uploads, analytics or recording of video or photos. The try-on photo is a local blob URL, saved only when the shopper taps Save.
- `npm run preview` serves `dist/` with the headers from `vercel.json`. Test CSP and Permissions-Policy changes there before deploying.

## Commands

```bash
npm ci               # first time (exact versions from package-lock.json)
npm run dev          # predev: try-on setup, then Vite on :5173
npm run dev:phone    # same, exposed on the LAN (camera needs HTTPS on phones)
npm run build        # prebuild (try-on setup) + vite build -> dist/
npm run preview      # dist/ on :4173 with production headers
npm run setup:tryon  # copy MediaPipe wasm, download face and hand models if missing, pin SHA-256
npm run models       # import 3D jewellery models from models/jewellery/ (docs/JEWELLERY-MODELS.md)
npm run check        # fonts, wasm and models are in place
npm run format       # prettier (printWidth 120, single quotes, trailing commas)
npm test             # unit tests (Vitest, Node): catalogue and prices, layout, jewellery engine, try-on maths, thumbnails, security
npm run test:e2e     # browser tests (Playwright) on 12 screens + no-WebGL; first run: npx playwright install chromium
npm run test:devices # only the responsive layout test, every screen
node tools/piece-report.mjs   # price, weight, triangles and size of every piece at store and viewer detail
```

Development pages (with `npm run dev`, not part of the build): `/tools/gallery.html` (every piece in the studio; `?id=p01&metal=w18&q=0.9`) and `/tools/tryon-sim.html` (the real try-on driven by a painted mannequin and synthetic landmarks; `?set=rajwada`, `?pid=s02&hand=1`, `?yaw=25`, `?move=1`).

Node 22.12 up to 24 (Vercel builds with 24; `engines` in package.json). Versions are pinned exactly (three 0.180.0, @mediapipe/tasks-vision 1.0.1, vite 8.3.4, vitest 5.0.3, @playwright/test 1.63.0, prettier 3.9.9). Run `npm audit` after any dependency change; it must report 0 vulnerabilities. Keep the MediaPipe version in `package.json` and `MP_VERSION` in `src/tryon/tracker.js` in step.

## Layout

```
index.html               shell, top bar, cards, bottom bar (Directory, Tour, Try on, Rates, Info), sheet
src/main.js              entry: fonts and styles, UI, then lazy-loads the 3D scene
src/core/ny.js           NY shared namespace (window.NY in the browser; also imported by Node tests and tools)
src/data/store-layout.js NY.STORE, NY.L (rotunda + 8 rooms, metres), NY.SIDES, NY.sideFrame, NY.ROOMS, NY.ZONES,
                         NY.TOUR, NY.SALON_FIX (fixture footprints), NY.OBS (fixtures), NY.NO_GO (keep-out polygons)
src/data/catalogue.js    NY.RATES, NY.METAL, NY.STONE, size charts, 44 products, NY.priceOf, NY.SETS, NY.MERCH
src/jewel/gems.js        faceted stone geometry (brilliants, step cuts, cabochons, polki, briolette) with facet ids
src/jewel/materials.js   studio and gem environments, METALS, GEMS (gem shader), PEARLS, ENAMELS, velvet
src/jewel/shapes.js      sweeps, profiles, wires, beads, domed plates, outlines, BUST, necklacePath()
src/jewel/build.js       FRAMES, settings (prongs, bezel, pave), motifs, buildRing/Earrings/Necklace/Bangle/Bracelet/Tikka/Nath, buildPiece()
src/jewel/kit.js         Kit (metal by slot, gems by role), appendKit with resolvers, realize() -> meshes + instanced stones + glints
src/jewel/sparkle.js     instanced glints (perspective and orthographic cameras)
src/jewel/stage.js       JewelStage: product viewer studio (velvet, bust/dais, bloom)
src/jewel/models.js      imported 3D models (GLB) -> Kit: metal slots, stone groups with per-stone frames, pearls, sizes
src/jewel/source.js      pieceKit(): the imported model if there is one, otherwise buildPiece(); falls back on any error
src/data/jewellery-models.json  manifest written by scripts/import-models.mjs (do not edit by hand)
src/scene/textures.js    marble, rotunda floor inlay, carpets, rate board, soft light textures
src/scene/batch.js       Batcher (merge by material, solids for the walk grid), arch helpers
src/scene/boutique.js    the architecture and fixtures: rotunda, dome, chandelier, salons, foyer, lounge
src/scene/displays.js    stands per piece type: bust, T-stand, ring block, bangle cradle, flat (counter)
src/scene/showroom.js    renderer, materials, placement of every piece, lights, reflection, bloom, walk grid, input, viewer, NY.api
src/ui/app.js            all panels: product sheet (configurator + price table), browse, sets, search, bag/wishlist, checkout demo,
                         appointment demo, rates, size guide, store details; try-on hand-off
src/tryon/anchors.js     pure maths: landmark tables, faceAnchors, handAnchors, OneEuro, Swing (unit-tested)
src/tryon/tracker.js     Face/Hand Landmarker creation (GPU, CPU fallback), Tracker (filters, anchors)
src/tryon/tryon.js       try-on overlay: camera, slots, panel, placement, occluders, swing, photo; lazy-loaded
src/lib/dom.js           h() element helper, icons, money(), store (localStorage)
src/lib/drawings.js      piece SVG thumbnails, floor plan drawing
scripts/setup-tryon.mjs  copies wasm to public/vendor/, downloads models to public/models/, pins SHA-256
scripts/check-assets.mjs asset check used by `npm run check`
scripts/import-models.mjs imports models/jewellery/<id>.glb|gltf|obj -> public/jewellery/<id>.<hash>(.store).glb
tools/                   gallery, try-on simulator, piece report (development only)
tests/unit/              Vitest unit tests (Node)
tests/e2e/               Playwright browser and device tests (helpers.js: safe-area, overlap, tap-target checks)
docs/                    SETUP-VSCODE, TESTING, RESPONSIVE, DEPLOY-VERCEL, TRYON (client-facing guides)
.github/workflows/ci.yml format, unit tests, build on every push; browser tests on manual dispatch
```

Generated, do not edit by hand: `public/vendor/` and `public/models/*.task` (gitignored, created by setup). `models/models.lock.json` is written by the setup and committed.

## Conventions

- The jewellery engine works in **millimetres**; the boutique in **metres**. `displays.js` returns piece matrices that include the 0.001 scale.
- Piece frames (`FRAMES` in `build.js`): ring axis along z with the head at +y; one earring hangs along -y from the piercing at the origin, front +z; necklaces in the bust frame (neck base at y = 0, front +z); bangle axis along z; tikka hook at the origin hanging along -y; nath piercing at the origin, ring in the x-y plane.
- Metal slots: `'m'` the chosen metal, `'w'` claws (white gold on yellow or rose diamond pieces when `whiteClaws`), `'ox'` oxidised recesses. Stone roles: `'@main'`, `'@accent'`, `'@drop'`, `'@side'`, `'@band'`, `'@pearl'`. A change of metal or stone only swaps materials; the store merges a whole room by resolving slots and roles in `appendKit`.
- Detail `q` (0..1): store 0.35 (0.25 on touch devices), viewer 0.9 (0.7), try-on 0.8 (0.6). Triangle budget per piece: 60k at 0.35, 110k at 0.9 (`jewel.test.js`).
- Side frames: `NY.sideFrame(k)` has `u` sideways and `v` outward from the rotunda wall; `yaw: a` (local +z points into the room). Rooms, fixtures and keep-out areas are all written in `(k, u, v)` and converted with `rect()`.
- Data modules attach to `NY` and must run in Node (no `window`, `document` or canvas at import time).
- The UI talks to the scene only through `NY.api` (set in `app.js`, implemented in `showroom.js`). Keep that boundary.
- Prettier formats everything; run `npm run format` before finishing.
- Client-facing text (UI copy, README) is formal English. No marketing superlatives. Prices in rupees with Indian grouping (`money()`).

## How the pieces fit

- **Colour-true lighting.** Every renderer that shows jewellery (store, viewer, try-on) uses `THREE.NeutralToneMapping`; ACES turned 22K gold orange and rubies coral. Metals reflect `studioScene()`: a neutral grey tent with the `STUDIO` three-point set-up (key front-left, fill front-right, rim behind, overhead box, white bounce card in front, two black flags) in neutral white. `addStudioLights()` adds the same key, fill and rim as directional lights. Keep every light neutral: a warm light or a dark, brown environment is what makes gold look copper. Metal base colours in `METALS` are physically based reflectance (sRGB); change them only together with a look at `/tools/gallery.html` in every metal.
- **Display scale.** `showScale()` in `showroom.js` shows pieces in cases and counters at 1.45× and the wall-niche busts at 1.3×, so colour and stones read from where the visitor stands. Busts in pillar cases, columns and lounge cases stay at 1× (they would not fit the glass).
- **Imported models.** Everything that shows a piece (store, viewer, try-on, gallery) gets its kit from `pieceKit()` in `src/jewel/source.js` (async). The importer detects units from the expected size per type (`RANGES`), turns rings and bangles onto z and centres the hole found by rasterising the shape along z, rests necklaces on `BUST`, places hanging pieces at the piercing, sorts parts by material or object name (`classify`), splits stones into connected pieces with their own frame (largest flat facet = table) and pearls into spheres, simplifies with meshopt to `FULL_TRIS` / `STORE_TRIS`, and writes meshopt-compressed GLBs named by content hash. Stones from models are drawn with `gemMaterial(kind, cube, true)` (`STONE_FRAME`: per-vertex `sUp`, `sX`, `facet`). Positions in the GLB are quantised; `models.js` unpacks them to floats before applying node transforms. Keep `src/data/jewellery-models.json` out of Prettier (it is in `.prettierignore`).
- **Gem shader** (`GEM_VERT`/`GEM_FRAG` in `materials.js`): flat facet id (`flat varying float vFacet`), refraction through the table, two pavilion bounces into a cube map of `gemScene()`, per-channel dispersion, an upward bias on exit rays so face-up stones do not go dark, a luminance limit for coloured stones (else rubies wash out pink) and gold foil for polki and kundan. The cube map is rendered once per renderer (`makeJewelEnv`).
- **Plates** are domed (`plate(..., { bulge })`, default 0.35). Stones set on a plate are lifted to clear the dome; the chandbali crescent uses `bulge: 0` plus a rim wire.
- **Sparkle** is additive with a little alpha (so it shows over the transparent try-on canvas). With an orthographic camera (`ortho` uniform) the view direction is constant and sizes do not divide by depth.
- **Store placement.** `showroom.js` builds each displayed piece once per configuration (kit cache), appends it to its room's kit with `appendKit` (merging), and creates an invisible pick proxy at least 7 cm across. Glints from every displayed stone go into one store sparkle layer. The hero necklace turns in its own group with its own sparkle.
- **Quality** (`applyQuality`): High = bloom, floor reflection, all point lights; Auto = bloom everywhere, reflection and extra lights only on non-touch devices, adaptive resolution; Battery saver = none. The loop drops to about 20 fps when nothing moves.
- **Walking and boundaries.** The walk grid (`NAV` in `showroom.js`, 10 cm cells over `NY.BOUNDS`) is the room polygons, minus fixture footprints in `NY.OBS`, minus every solid triangle between ankle and head height, minus the keep-out polygons in `NY.NO_GO` (behind every counter and its ends, behind the concierge desk, behind the lounge sofa), then a distance transform for `BODY_R` (0.32 m) and a flood fill from `NY.START`. Click-to-walk, keys, the tour and the floor plan all use it. `NY.api.navGrid()` returns it for tests.
- **Tapping walls and fixtures.** A tap (or the second tap, with double-tap walking) on a wall, poster or fixture walks to a spot square in front of it, `NEAR` (1.45 m) back, and turns to face it (`focusFor()`, `standIn()` in `showroom.js`; the look point sits a little above the middle of the screen, `BAND_MID`, so the section card does not cover it). A floor tap stops `CLEAR` (0.95 m) short of a wall or fixture straight ahead (`keepClear()`); so does `NY.api.goPoint()`. `NY.api.pick(x, y)` reports what a tap at a screen point would hit, and `NY.api.debugPose()` places the camera, for tests.
- **Try-on models on Vercel.** `scripts/setup-tryon.mjs` runs before every build. On Vercel (`VERCEL=1`) or with `TRYON_STRICT=1` it retries each download three times and then fails the build if a required model is still missing, so a deployment never goes live without a working try-on. `TRYON_OPTIONAL=1` deploys without it on purpose. Locally a missing model is only a warning.
- **Merchandising rules.** Wall niches hold necklaces and pendants on busts. Counters are low glass cases: no necklaces or pendants there (a bust would poke through the glass; `catalogue.test.js` enforces it, and `displays.js` lays one flat at half size if it ever happens).
- **Section card, corner button, panels tied to a spot, controls**: same mechanics as the other showrooms in this family: card closes after `ZC_SECONDS` (6); `#here` shows the section's main action; panels opened from the store close when the visitor walks `LEAVE_BY` (1 m) away; double-click to walk by default (`PEND_MS` 2.6 s), `DRAG_PX` 8/14, look speed slow/normal/fast.
- **Try-on pipeline.** `Tracker.update` → landmarks to pixel space (`toPx`) → One Euro filters → `faceAnchors` / `handAnchors` → `place()` in `tryon.js` sets each worn group's matrix in an orthographic pixel-space camera (1 unit = 1 video pixel; pieces scale by px per mm) → depth-only occluders (head ellipsoid, neck cylinder, finger and forearm cylinders) → render over the video. Earrings use `kit.single` twice, hang along screen-down with a `Swing` pendulum driven by the lobe's acceleration, turn with 85% of the head's yaw and fade out on the far side (`hideL`/`hideR`). The necklace frame hangs below the cheek-landmark midpoint (close to the head's turning axis) and turns only part of the way with the head. The tikka follows the forehead slope from landmark 10. Rings are scaled so the inner diameter matches the measured finger width.
- **Model loading.** `create()` in `tracker.js` HEAD-checks each model URL and rejects an HTML response (Vite and Vercel return `index.html` for a missing file). A missing model raises `ModelMissing`, and the try-on shows a clear message and offers the 3D viewer.
- **Responsive layout** (`docs/RESPONSIVE.md`). Phone layout up to 760 px wide (five-button bottom bar, bottom sheet), desktop above (right-hand panel), tablet tier 761–1080, short-screen tier (max-height 500), sideways-phone tier, touch sizing under `pointer: coarse`. The root element is padded with all four `env(safe-area-inset-*)`; position new chrome inside `.app` with `position: absolute`, never `fixed`. The try-on overlay (`.to`) is full screen and pads its own controls with the safe-area insets; on wide screens its panel is a right-hand column and the camera view fills the rest.

## Known pitfalls

- `necklacePath` frames: `frame(0)` is the front centre. Long chains are found by bisection on the drop; a chain shorter than the neck at the base keeps drop 0.
- Two circles that do not intersect break `crescentOutline` (`distanceToSquared of undefined`); keep `ri` 0.7 and `sh` 0.42 or check the intersection.
- The rotunda floor inlay's `oct()` must not start a new path when it adds a hole (`keep` parameter), or the even-odd fill covers everything.
- `sideFrame` yaw must be `a` (not `-a`), or every salon is mirrored.
- MediaPipe labels hands as if the image were mirrored: in the unmirrored frame a real right hand is "Left". `handAnchors` flips the palm normal for "Right".
- The try-on canvas is `alpha: true`; anything drawn with alpha 1 and no colour (for example the old additive sparkle) shows as black squares over the video.
- Portrait camera video on a landscape screen uses `object-fit: contain` (`.to.fit-contain`) so the overlay maps 1:1 to the video; the check uses the stage size, not the window.
- `assetsInlineLimit: 0` is required. Inlined `data:` fonts would be blocked by `font-src 'self'`.

## Testing

Details in `docs/TESTING.md`. Before finishing a change:

1. `npm run format:check`, `npm test`, `npm run build`, `npm run check`.
2. For any change to layout, CSS or the interface: `npm run test:devices` (and look at `test-results/screens/`). For changes to walking, the try-on or headers: `npm run test:e2e`.
3. For a change to a piece or the engine: `/tools/gallery.html?id=<id>` and `node tools/piece-report.mjs`. For the try-on: `/tools/tryon-sim.html` (several poses, phone and desktop sizes), then a real camera.
4. `npm run preview`, open http://localhost:4173. The console should show no errors except the blocked MediaPipe telemetry request.
5. On a real phone through a Vercel preview URL (HTTPS): walk, product sheet, try-on with a set.

Rules for tests:

- A new piece, builder style, stone or catalogue field must keep `catalogue.test.js` and `jewel.test.js` green (they build every piece in every metal). A new try-on anchor gets a case in `anchors.test.js`.
- Every new floating control or panel goes into the selector lists in `tests/e2e/layout.spec.js` so the safe-area and overlap checks cover it.
- Never weaken `security.test.js` to make it pass; fix the cause. It never opens `.env` files.
- The e2e suite runs against the production build on port 4173 and reuses a running preview server; rebuild after changes.

Useful console handles: `NY.api` (scene; `navGrid()`, `where()`, `stats()`, `pick(x, y)`, `debugPose(x, z, yaw, pitch)`), `NY.byId` (products), `NY.priceOf(NY.byId.s01, NY.defaultCfg(NY.byId.s01))`.
