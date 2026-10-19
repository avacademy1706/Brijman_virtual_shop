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

## 2026-10-14: Frame geometry lives in `src/three/frame-model.js`; shelves keep the archetype build

`buildArch`, the frame materials, `partsFor` and the tortoiseshell texture moved out of the showroom unchanged. The shelves still build one geometry per archetype and scale it, which keeps instancing (56 meshes) and the render pixel-identical: screenshots of six sections before and after differ by 0.000, with 188 products, 56 meshes and 472,504 triangles in both. The product viewer and the try-on use `frameGeometry(p, sizeId)`, which builds the true geometry from `{lens, bridge, temple}` in mm (real bridge, real temple length), with the front, temples and lenses split and both hinge points. `ENDPIECE_MM` in `shared/frame-archetypes.js` gives the outer width without three.js (2 × lens + bridge + endpieces), checked against the geometry to ±0.5 mm.

## 2026-10-14: Frame sizes (S, M, L) added to the catalogue

Every frame now has `sizes` and `defaultSize: "M"`, generated by `generateSizes` in `shared/fit.js` from its listed `size` (which becomes M). Adult optical frames get S, M and L; sunglasses and Atelier get M and L; kids get S and M. Kids' sunglasses (`k05`) follow the kids rule. `size` stays as the M marking, so the shelves and everything that read it are unchanged.

This is an intentional catalogue change. The snapshot test compares products with `sizes` and `defaultSize` removed (everything else must still match the pre-migration snapshot), and `tests/unit/fit-and-filter.test.js` checks every frame's sizes follow the rules.

Cart lines carry `sizeId`: required for frames, refused for contacts and care, validated by the quote service. An optional whole-rupee `priceDelta` per size is added by `priceOf`. Quote and order lines return `sizeId` and `sizeLabel` ("M · 52□18-145").

The bag moved to localStorage key `bm-bag-v2` (id, colour, size, configuration, quantity). Version 1 lines are migrated once to the default size and the old key is deleted. A saved line whose size no longer exists is dropped with a notice rather than silently changed to another size.

## 2026-10-14: Try-on security and delivery

- `vercel.json`: `script-src` gains `'wasm-unsafe-eval'` (WebAssembly needs it) and `Permissions-Policy` changes `camera=()` to `camera=(self)`. Nothing else changed: the browser tests show no CSP violations with these two alone, and MediaPipe runs on the main thread, so no `worker-src` is needed.
- `/vendor/mediapipe/(.*)` is cached for a year as immutable. Every file there has a version in its path (`1.0.1/wasm/…`, `models/float16-1/…`); the face model moved into `models/float16-1/` for that reason.
- All try-on code, MediaPipe, three.js and the model load only when a shopper taps Try on. `scripts/check-bundle.mjs` (part of `npm run check`) fails if the first load grows more than 10 KB gzipped over the pre-try-on release (32,552 bytes): it is now +1.8 KB.
- The camera is requested only after the shopper taps Allow camera (or Use the camera), is stopped on close, on `pagehide` and when the page is hidden, and restarts only on the shopper's action. A newer camera request cancels an older one, so a double tap cannot leave a second camera running.
- MediaPipe's wasm prints an informational line ("INFO: Created TensorFlow Lite XNNPACK delegate for CPU.") through `console.error`. The engine filters exactly the lines that start with "INFO: ", so real errors still show.
- `track(event, props)` in `src/tryon/analytics.js` is a no-op with an allow-list: six events and `productId`, `sizeId`, `colourIndex`, `source` and `result` (good, narrow or wide). No measurements can pass.

## 2026-10-14: Try-on details that differ from the brief or fill gaps

- **Photos look for two faces.** The brief sets `numFaces: 1`. Live video keeps 1; uploaded photos use 2 so the try-on can say "More than one face is in this photo". The mode switch happens only when the input changes, because every `setOptions` rebuilds MediaPipe's graph.
- **Consent is remembered when the shopper turns the camera on.** Tapping Allow camera, or Use the camera inside the mirror, stores `tryonConsent` in `bm-settings` (not personal data). Choosing a photo does not, so the notice shows again next time.
- **Artist models are scaled to the chosen size.** A colour's `.glb` (1 unit = 1 m, front +Z, bridge at the origin) is scaled so its `front` node matches the size's real outer width, because one file serves every size of that colour. If it fails to load, the generated frame is used.
- **Kids' sunglasses follow the kids size rule** (S, M), since kids comes first in the brief's table.
- **Fit uses the front's outer width from the real geometry** (`frameGeometry(...).outerWidth`) in the try-on, and `frontWidthMm` (2 × lens + bridge + endpieces) in the product sheet; both agree to ±0.5 mm.
- **Browser test material.** The real-face browser checks used MediaPipe's public test portrait and a short clip made from it, kept outside the repository. The repository's tests use synthetic faces only.

## 2026-10-14: Mobile layout modes, defined once

Four modes, in `src/styles/main.css` and mirrored for JavaScript in `src/ui/layout.js`: phone portrait (≤ 600 px wide: compact top bar, bottom bar, bottom sheet), phone landscape (≤ 500 px tall: no bottom bar, a top-bar menu, a side-panel sheet at half the width), tablet (601–1024 px: the desktop arrangement with a 380–420 px sheet and touch-sized targets) and desktop. The old single 760 px breakpoint is gone. Landscape rules come last in the stylesheet so they win for short, wide phones.

The store now fills the whole screen, under the notch; the bars, sheet footer and panels are padded with the safe-area insets instead of padding the whole page. Heights use `100dvh` and measured variables: `--bb-h` (bottom bar), `--mm-h` (floor plan), `--vvh` and `--kb` (visible height and keyboard overlap from `visualViewport`).

## 2026-10-14: Nothing floats over another fixed element

To meet the audit's no-overlap rule: the bottom sheet replaces the bottom bar while it is open (the bar is hidden, as in native apps); the sheet stops below the top bar; a message shown while the sheet is open appears as a banner inside the sheet instead of a floating toast; the coach mark steps aside while a panel is open; section labels hide behind any chrome (re-checked whenever cards, the coach mark, the hint or the floor plan change).

## 2026-10-14: Back button support with history layers, safe against go() races

`src/ui/history.js` pushes one history entry per open panel (each sheet view, the tour, the try-on, photo compare) and closes the top one on `popstate`. Closing a panel with its own button calls `history.go(-n)`. Because `go()` is asynchronous, a panel opened in the same moment could have its entry removed by the late `go()`, and Back would then leave the site (the audit caught this on iPad: the eye-test sheet closed and the try-on opened in the same tick). New entries now wait until a pending `go()` has finished. Unit tests cover the race with a fake history whose `go()` is asynchronous.

## 2026-10-14: interactive-widget only where it is understood

The brief asked for `interactive-widget=resizes-content` in the viewport meta. Safari and WebKit do not know the key and log "Viewport argument key … not recognized" as a console error, which the audit forbids. `src/ui/layout.js` therefore appends it at start-up only in Chromium browsers (detected by `navigator.userAgentData`). The keyboard behaviour itself (sheet above the keyboard, field kept in view) is driven by `visualViewport` in every browser. Its real effect on Chrome Android needs a real phone: see the checklist in `docs/mobile-testing.md`.

## 2026-10-14: Local preview drops upgrade-insecure-requests

Safari and WebKit apply `upgrade-insecure-requests` even to `http://localhost`, so `npm run preview` could not load its own scripts in those browsers (the WebKit audit failed with "SSL connect error"). `vite.config.js` removes that one directive from the preview headers only; production on Vercel (https) keeps it.

## 2026-10-14: zod runs without generated code

zod 4 probes whether `new Function` is allowed to pick a faster path; under our CSP (`script-src 'self'`) the probe is caught but still reports a policy violation. `shared/schemas.js` sets `z.config({ jitless: true })`, so zod never tries.

## 2026-10-14: 3D quality tiers, culling and level of detail

Tiers (low, medium, high) are chosen at start-up from `deviceMemory`, `hardwareConcurrency`, the GPU's `MAX_TEXTURE_SIZE`, the pointer type and the platform (iPhones and iPads start at medium; their GPUs are strong but they report few cores), then checked with a 1-second render benchmark. In Automatic mode the tier drops if fps stays under its target (30, 45, 50) for 3 s, after first lowering the pixel ratio. Info → Picture quality offers Automatic, High, Balanced and Battery saver.

Shelf frames are instanced per section, archetype, part and material, so frustum culling skips whole sections: desktop draw calls fell from about 77 to 46 and rendered triangles from 472,504 to about 147,000, with 188 products and pixel-identical screenshots. Simplified frames (about 40 % of the triangles, `buildArch(..., { detail: 'low' })`) are used on the low tier everywhere and on medium for sections more than 4 m away; the high tier keeps full detail so desktops look exactly as before. Textures are drawn at full size and uploaded at most 512 px (low) or 1024 px (medium).

On a lost graphics context the store pauses and shows "Restoring the 3D view…"; when the browser restores the context the environment map and shadows are rebuilt without a reload. If it is not restored within 8 s, or is lost a third time, the visitor gets Reload and Use the floor plan.

## 2026-10-14: Mobile work not done, by choice

- "Look around by moving your phone" (optional in the brief) was not added: it needs a permission button on iOS and extra Permissions-Policy entries, for little gain.
- Haptics (optional) were not added.
- The layout, touch and forms phases were committed together, because they change the same lines of `src/ui/app.js` and `src/styles/main.css`; the try-on and performance phases have their own commits.

## 2026-10-14: Tapping a frame picks the nearest frame

- On phones, a tap on a thin wire frame (Cove, Aurum) often hit the shelf or the floor behind it, so the visitor walked instead of seeing the product. A tap or click that misses now opens the nearest frame within 32 CSS px on touch or 16 px with a mouse, if that frame is within 8 m and not behind what the tap hit. Taps on the open floor still walk.
- The mobile audit taps two wire frames slightly off-centre on every profile to keep this fixed.
- In portrait the product sheet opened on pointerup and the click the browser sends right after the tap landed on the new backdrop, closing the sheet again (landscape has no backdrop, so it worked there). `src/ui/app.js` now swallows that one click (within 40 px and 700 ms of the end of a 3D tap). The audit taps with real touch and mouse input so the click is included.

## 2026-10-19: Details close when the visitor walks away; bigger try-on nudge

- A product, eye-test or lens-guide panel opened from the store now closes when the visitor walks somewhere else (floor tap, keys, a section label, the floor plan or a section jump), and the product's tag over the shelf goes with it. The bag, checkout and directory stay open, and so does a panel whose form the visitor has typed in. Small steps (under 30 cm) don't count.
- After walking to a product, a card for the previous section no longer stays up.
- In phone landscape the section card sits below the floor plan button and steps aside while the side panel is open.
- The try-on up and down buttons moved the frame 1 mm per tap, at most 3 mm: on a phone that is often under two screen pixels a tap, so they seemed not to work. They now move 2 mm per tap, up to 10 mm, show the offset (for example "+4 mm") and grey out at the end. Sizes S, M and L stay true to their millimetre measurements.
