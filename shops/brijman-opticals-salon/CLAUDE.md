# CLAUDE.md · Brijman Opticals virtual eyewear salon

> **In the Plexus marketplace repository** this shop is served at `/opticals/`. The repository root builds it with `../../scripts/build-shops.mjs` (`npm run build -- --base=/opticals/` into `../../public/opticals/`), and the root `vercel.json` sets its headers; this folder's own `vercel.json` is used only if the shop is deployed on its own. Keep reading every file under `import.meta.env.BASE_URL`, and keep the `.market-back` and `.market-link` links to the marketplace (`/`).

Static Vite site: a walkable three.js eyewear salon (marble islands, arched niches, Atelier wall, lounge), procedural frames at their real millimetre size, a lens configurator with S/M/L frame sizes, and a camera try-on with face measurement (MediaPipe Face Landmarker, on-device). Plain JavaScript ES modules, no framework, no TypeScript, no backend. Deployed on Vercel. README.md is the client-facing guide; this file is for working on the code.

> This project is one of three in the `plexus-virtual-showrooms` master folder. The master `CLAUDE.md` one level up lists the others and the shared rules; work inside this folder for anything specific to this project.

## Security rules (highest priority)

- Secrets, credentials, tokens and API keys must never leak. Never read, stage, print, echo or commit `.env` files or credential values. Never paste a token into chat or into code. Keep secrets in `.env` (gitignored) and refer to them only by variable name.
- The site needs no secrets today. When a backend is added (payments, orders, bookings), secrets live in Vercel environment variables and server code (`/api`) only. Never give a secret a `VITE_` prefix: Vite inlines those into the public bundle.
- Flag any secret you find in code, logs, git history or the built bundle (`dist/`).
- Keep the CSP in `vercel.json` strict: no inline `<script>`, no third-party CDN, no `eval`. `'wasm-unsafe-eval'` is there only for MediaPipe. `connect-src 'self'` is deliberate: it keeps the try-on on-device and blocks MediaPipe's usage telemetry (one console error, expected).
- Camera frames never leave the device. Do not add uploads, analytics or recording of video, photos or face measurements. Measurements live in memory (`S.fit` in `app.js`) for the visit only; never write them to localStorage.
- `npm run preview` serves `dist/` with the headers from `vercel.json`. Test CSP and Permissions-Policy changes there before deploying.

## Commands

```bash
npm ci               # first time (exact versions)
npm run dev          # predev: try-on setup, then Vite on :5173
npm run dev:phone    # same, exposed on the LAN (the camera needs HTTPS on phones)
npm run build        # prebuild (try-on setup) + vite build -> dist/
npm run preview      # dist/ on :4173 with production headers
npm run setup:tryon  # copy the MediaPipe wasm, download the face model if missing, pin its SHA-256
npm run check        # fonts, wasm and model are in place
npm run format       # prettier (printWidth 120, single quotes, trailing commas)
npm test             # unit tests (Vitest, Node): layout, catalogue and sizes, frame geometry, salon build, try-on maths, security
npm run test:e2e     # browser tests (Playwright) on 12 screens + no-WebGL; first run: npx playwright install chromium
npm run test:devices # only the responsive layout test, every screen
```

Development page (with `npm run dev`, not part of the build): `/tools/tryon-sim.html`, the real try-on driven by a painted face and synthetic landmarks: `?pid=w01&ci=1&size=S`, `?yaw=25`, `?move=1`, `?temples=128&pd=60` (the face's size in mm), `&tryondebug=1` (landmark dots).

In the browser console: `NY.api.where()`, `NY.api.stats()` (draw calls, triangles), `NY.api.navGrid()`, `NY.api.debugPose(x, z, yaw, pitch, eye)` (place the camera), `NY.api.pick(x, y)` (what a tap at a screen point would hit), `NY.byId.w01`, `NY.frameWidth(NY.byId.w01, 'M')`.

Node 22.12 up to 24 (Vercel builds with 24; `engines` in package.json). Versions are pinned exactly (three 0.180.0, @mediapipe/tasks-vision 1.0.1, vite 8.3.4, vitest 5.0.3, @playwright/test 1.63.0, prettier 3.9.9). Run `npm audit` after any dependency change; it must report 0 vulnerabilities. Keep the MediaPipe version in `package.json` and `MP_VERSION` in `src/tryon/tracker.js` in step.

## Layout

```
index.html               shell, top bar (Tour, Directory, Try on, Search, Bag), cards, bottom bar on phones, sheet
src/main.js              entry: fonts and styles, UI, then lazy-loads the 3D scene
src/core/ny.js           NY shared namespace (window.NY in the browser; also imported by Node tests)
src/data/store-layout.js NY.STORE, NY.L (floor plan in metres: niches, islands, counter, hutch, kids niche, lounge,
                         mirrors, posters, totem, vases), NY.ZONES, NY.TOUR, NY.obstacles()/NY.OBS, NY.START
src/data/frames.js       NY.ARCH (13 frame archetypes), NY.SHAPES, NY.outline(), NY.hingeOffset, NY.archWidth
src/data/catalogue.js    colours, 41 frames + 7 contact/care products, NY.MERCH (fill() per fixture), NY.SIZES,
                         NY.sizeOf / frameWidth / fitFor / bestSize, NY.LENS, NY.priceOf, NY.cfgSummary
src/frames/geometry.js   buildArch() (acetate, metal, combo fronts, temples, end pieces), frameMaterials(), partsFor(),
                         frameGroup() for the viewer and try-on, frameScale()
src/scene/textures.js    canvas textures: herringbone oak, marble, stone, travertine, linen, plaster, boucle, pampas,
                         posters (original artwork), wordmark, directory screen
src/scene/batch.js       Batcher: merge geometry by material, transform stack, hitboxes, solids for picking
src/scene/salon.js       salonMaterials(), SALON_BATCH, buildSalon(): shell, floor, arched niche wall, kids niche,
                         islands, counter, hutch, lounge chairs, mirrors, totem, posters, lamps, vases -> display slots
src/scene/showroom.js    renderer, frames instanced on the slots, contacts on the counter, lights, mirror capture,
                         walk grid and A*, input, labels, hover, product viewer, quality, NY.api
src/ui/app.js            all panels: product sheet (colours, sizes, lenses, prescription), browse, search, directory,
                         bag, checkout demo, eye-test demo, lens guide, info; try-on hand-off (S.fit)
src/tryon/anchors.js     pure maths: landmark table, faceFrame, facePx, canMeasure, glassesPose, Calibrator, OneEuro
src/tryon/tracker.js     Face Landmarker (GPU, CPU fallback), Tracker (filters landmarks, returns anchors)
src/tryon/tryon.js       try-on overlay: camera, panel (collections, frames, colour, size, fit readout), placement,
                         head occluder, measurement and size suggestion, photo; lazy-loaded
src/styles/              fonts.css, main.css (layout, theme), tryon.css
src/lib/dom.js           h() element helper, icons, money(), store (localStorage)
src/lib/drawings.js      frame SVG thumbnails, size diagram, floor plan drawing
scripts/setup-tryon.mjs  copies wasm to public/vendor/, downloads the face model to public/models/, pins SHA-256
scripts/check-assets.mjs asset check used by `npm run check`
tools/                   try-on simulator (sim-face.js paints a face and gives its landmarks)
tests/unit/              Vitest unit tests (Node)
tests/e2e/               Playwright browser and device tests (helpers.js: safe-area, overlap, tap-target checks)
docs/                    SETUP-VSCODE, DEPLOY-VERCEL, TRYON, TESTING, RESPONSIVE, prompts/
```

Generated, do not edit by hand: `public/vendor/` and `public/models/*.task` (gitignored, created by the setup). `models/models.lock.json` is written by the setup and committed.

## Conventions

- Units: metres in the scene, millimetres for frames and faces in data and the try-on, rupees for prices. x runs left to right, z from the back wall (-6) to the glass front (+6), y up. Frames face +z in their own space; temples run back along -z.
- A frame's 3D width comes from `NY.archWidth()` and the lens width; `NY.frameWidth()` uses the same maths, so the fit guide and the drawn frame always agree (a unit test checks it to 1.5 mm).
- `NY.MERCH` lists are filled slot by slot; a fixture's slot count must equal its list length (tested). Every colour of every frame must be on display somewhere (tested).
- Static geometry is batched by material key (`SALON_BATCH` sets solid, cast and receive). Unique textured pieces (posters, wordmark, directory) are separate meshes. Keep draw calls around 100 and triangles under about 550k.
- Fixture footprints in `NY.obstacles()` drive the walk planner and the floor plan; update them with any fixture you move.
- Tapping a wall, poster or fixture walks to a spot square in front of it (`focusFor()`, `standIn()` in `showroom.js`); posters, niches, the kids' niche, the Atelier wall and the back mirror are framed whole (`FOCUS`, built from `NY.L`). Floor taps stop `CLEAR` (0.95 m) short of a wall ahead (`keepClear()`). Distances: `NEAR`, `FAR`, `BAND` at the top of that block. Zones must cover the floor without overlapping, and each zone's viewpoint must be free, in its own zone and reachable (tested).
- **Try-on models on Vercel.** `scripts/setup-tryon.mjs` runs before every build. On Vercel (`VERCEL=1`) or with `TRYON_STRICT=1` it retries each download three times and then fails the build if a required model is still missing, so a deployment never goes live without a working try-on. `TRYON_OPTIONAL=1` deploys without it on purpose. Locally a missing model is only a warning.
- UI text is formal English. All UI stays inside the safe area (see docs/RESPONSIVE.md).
- Do not reproduce real brands or logos (posters, signage, products). The posters are original artwork drawn in `textures.js`.
- Run `npm run format`, `npm test` and `npm run build` before handing over a change.
