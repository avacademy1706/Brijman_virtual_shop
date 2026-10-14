# Decisions

Newest last. Each entry: date, decision, reason.

## 2026-10-14: Rename the brand from Nayan to Brijman everywhere

The client asked for "Brijman" in place of "Nayan". The abbreviation derived from the old name changed too:

- the shared namespace `NY` became `BM` (`src/core/bm.js`, `window.BM`);
- product codes and references `NY-…` became `BM-…` (`BM-M01-53`, `BM-DEMO-…`, `BM-ET-DEMO-…`);
- localStorage keys `ny-bag-v1` and `ny-settings` became `bm-bag-v1` and `bm-settings`.

In `assets-3d/` the file names, the node names inside the GLB files, `catalogue.csv`/`catalogue.json` and the README were renamed. The two textures with the name painted in (the storefront sign and the directory screen) were re-rendered with the site's own drawing code and fonts, then swapped into `Storefront.glb`, `Directory_Totem.glb` and `Brijman_Showroom.glb`. The files were checked by loading them with three.js `GLTFLoader`.

## 2026-10-14: Built on the Vite project, not the single-file HTML

The single-file `Virtual Eyewear Showroom.html` and the Vite project have the same features, data and 3D scene; the Vite version is the production port (self-hosted fonts, no CDN, CSP headers). The one missing line, `scroll-padding-top` for notched phones, was added to `main.css`.

## 2026-10-14: Frames are one pair per bag line

The brief makes the API reject frame lines with a quantity other than 1. The old bag let you raise a frame's quantity and merged identical frames into one line. Now each frame added is its own line with a unique key, the bag shows "1 pair" instead of a stepper, and contact lenses and care products still merge and go up to 12. Reason: each pair can carry its own prescription, and the client and server agree on the rule.

## 2026-10-14: Prescriptions travel with the order, never stored

A prescription typed in the product sheet is attached to its bag line in memory (`S.rx`, keyed by line key) and sent with the order. It is never written to localStorage. After a reload, a line that needs one shows "Add your prescription" with three choices: enter it now (a small sheet), add it later, or book an eye test. Checkout is blocked until each such line is resolved, and the server rejects a missing or invalid prescription again.

## 2026-10-14: Only id, colour, configuration and quantity are saved in the bag

The old bag also stored the unit price. Prices are now recomputed on load with `shared/pricing.js` and confirmed by `POST /cart/quote`, so a stale price in localStorage can never be shown or sent. Saved lines that no longer match the catalogue (unknown product, colour or configuration) are dropped on load.

## 2026-10-14: Pricing reads the sun-lens surcharge from the lens table

`priceOf` used a hard-coded ₹2,900 for prescription sun lenses. It now reads `lenses.json` (`sun[].rxsun.p`, which is 2900), so editing the JSON changes the price everywhere. All other behaviour is unchanged and covered by tests.

## 2026-10-14: Frame archetypes moved to `shared/frame-archetypes.js`

The API needs each frame's shape for the `shape` filter, and `src/data/frames.js` touches `window`. The `ARCH` table (pure data) moved to `shared/`; `frames.js` still owns the shape maths (`SHAPES`, `outline`) and sets `BM.ARCH` from the shared table.

## 2026-10-14: Routes grouped in two files

The brief listed one file per route group. They live in `server/routes/catalogue.js` (health, bootstrap, store, products, lenses) and `server/routes/commerce.js` (cart, orders, eye test). Each is small, and the grouping matches the cache policy: catalogue responses are cacheable, commerce responses are `no-store`.

## 2026-10-14: Data files are read with `readFileSync` and listed in `includeFiles`

`StaticRepository` reads `data/*.json` with `readFileSync(new URL(..., import.meta.url))` and re-reads a file when its modification time changes, so edits show up in `npm run dev` without a restart. `vercel.json` adds `"includeFiles": "data/**"` to the function so the files are always bundled, whatever the file tracer decides.

## 2026-10-14: Local API through `@hono/node-server`

The Vite plugin uses `getRequestListener` from `@hono/node-server` (dev dependency, 2.1.3) to pass Node requests to the Hono app. In dev it loads the app through `server.ssrLoadModule`, so server edits apply on the next request; in preview it imports the file directly. Vite's own CORS middleware is turned off (`server.cors: false`, `preview.cors: false`) so no CORS header is ever sent, matching production.

## 2026-10-14: zod loads only when a form is used

Importing the zod schemas into the UI added about 30 kB gzipped to the first-screen bundle. The bag, checkout and eye-test views now load `shared/schemas.js` on demand (prefetched when those views open). Prescription checks use the plain functions in `shared/rules.js`, which the zod schemas also use, so there is still one source of rules.

## 2026-10-14: Stable order references from the idempotency key

In static mode nothing is stored, so the server cannot look up an earlier order. The order reference is derived from a hash of the `Idempotency-Key`, so a retried request with the same key returns the same `BM-DEMO-…` reference. Without a key the reference is random.

## 2026-10-14: Eye-test slots start today and need 30 minutes' notice

Slots are generated in IST from `data/eye-test.json`, starting today. Slots that start within `leadTimeMinutes` (30) are left out, so nobody books a slot that starts in two minutes. The old screen offered the next six days from tomorrow; the new one shows the next seven days that still have a free slot.

## 2026-10-14: Static mode switches checkout and booking off

With `VITE_DATA_SOURCE=static` the browser never calls `/api`. The bag shows "Estimated prices", and checkout and eye-test booking say plainly that they are not available in this preview. In `api` mode with the API down, the catalogue falls back to the bundled JSON, and checkout and booking still try the API and show a clear error.

## 2026-10-14: Not verified with `vercel dev`

`vercel dev` needs a logged-in Vercel CLI, which this machine does not have. The rewrite is covered by a test that calls the function's `fetch` export with the original `/api/v1/...` URL, and by `npm run smoke` against `npm run preview`. After the first deployment, run `npm run smoke -- https://<your-project>.vercel.app`.

## 2026-10-14: Virtual try-on is built in-house on MediaPipe, behind an engine interface

The try-on uses `@mediapipe/tasks-vision` 1.0.1 (`FaceLandmarker`, on the device) with three.js. Everything sits behind `src/tryon/engine.js` (`start`, `setFrame`, `snapshot`, `stop`, `on`), and the interface talks only to that. A commercial SDK (Banuba, Fittingbox, GlamAR) could replace the engine later without touching the UI. Reasons: no per-use fee, no face data leaves the phone, and full control of true sizing.

The face model `public/vendor/mediapipe/models/face_landmarker.task` (Apache-2.0) is committed. SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`. The wasm runtime is copied from `node_modules` at build time and is never loaded from a CDN.

## 2026-10-14: Try-on pose comes from our own Procrustes fit, rendered in pixel space

The brief suggested using MediaPipe's facial transformation matrix with a perspective camera matched to its assumed field of view, plus a correction snap. Instead the engine fits MediaPipe's canonical face (`shared/canonical-face.js`, from the official `canonical_face_model.obj`) to the tracked landmarks with a similarity Procrustes fit (Horn's method). That is the same kind of fit MediaPipe uses to compute its matrix. The result is rendered with an orthographic camera in video-pixel space. Reasons:

- It needs no assumption about the camera's field of view, so there is no drift to correct; the nose bridge lands on its tracked landmark by construction (tested to within 0.5 px).
- Every step is unit-tested with synthetic faces: pose within 0.5°, true size within 1 %.
- It uses the rigid landmarks only (forehead, nose, eye corners, cheekbones, temples), so talking and blinking do not move the frame.

The weak-perspective camera ignores the slight perspective of the temples, which the head occluder hides from 30 mm behind the hinges anyway. `outputFacialTransformationMatrixes` is therefore off.
