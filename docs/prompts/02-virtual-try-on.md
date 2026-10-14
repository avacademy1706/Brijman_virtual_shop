# Brijman Virtual Showroom: realistic virtual try-on with frame sizes

This file has two parts:

- **Part 1 is for you.** It covers what you will get, how to run the task, and how to test the try-on on a laptop and a phone.
- **Part 2 is the brief Claude Code follows.** In the Claude Code panel in VS Code, send: `Follow @docs/prompts/02-virtual-try-on.md`

It builds on the API layer from `01-api-layer.md`, which must already be done and working.

---

# Part 1: Steps for you

## 1.1 What you will end up with

- **A "Try on" button** on every optical frame and pair of sunglasses, in the product sheet and in search results.
- **A full-screen live mirror.** The front camera shows your face and the selected frame sits on your nose at its **real size**:
  - it turns with your head;
  - the arms go behind your ears;
  - the lenses reflect light;
  - sunglass lenses are tinted.
- **Real size choice.** Every frame gets S, M and L sizes (for example 50□18-140, 52□18-145, 54□19-150). Switching size changes the frame on your face immediately.
- **A fit guide.** It reads "Good fit", "May feel narrow" or "May feel wide", based on your face width estimated from your eyes.
- **Colour switching and browsing.** Change colour, and swipe to the next frame in the same section without leaving the mirror.
- **Photos.** Take up to 4 photos, compare them side by side, and save one to your phone.
- **Add to bag from the mirror.** The colour and size you picked are carried into the bag.
- **No camera?** Upload a front-facing photo instead. It is processed on the device.
- **Privacy by design.** The camera image never leaves the phone. Nothing is uploaded, recorded or stored.

## 1.2 Realism: what to expect

- The try-on uses Google's MediaPipe face tracking, which runs inside the browser on the phone. There is no per-use fee and no face data leaves the device.
- On a mid-range phone in normal light, expect a stable fit and correct size, with smooth movement.
- The models are made in code. A 3D artist's model looks better close up, because it has real hinges, nose pads and acetate depth. The try-on uses an artist's `.glb` model automatically for any frame where one is provided (see section 1.6).
- The face-width measurement uses the average iris size, about 11.7 mm. That makes the fit guide a good **estimate**, not a measurement for prescriptions. The screen says so.

## 1.3 Run the task

1. Save this file as `docs/prompts/02-virtual-try-on.md` in the project.
2. Make sure everything from task 01 is committed:

   ```bash
   git status
   ```

3. In Claude Code send `Follow @docs/prompts/02-virtual-try-on.md`. To review the approach first, use `/plan Follow @docs/prompts/02-virtual-try-on.md`.
4. It works through 7 phases on the branch `feature/virtual-try-on` and commits after each one.

## 1.4 Test it on your computer

```bash
npm ci
npm run dev        # http://localhost:5173, where the camera works because localhost counts as secure
npm run check
npm run preview    # http://localhost:4173 with the live security headers
```

Open a frame, then click **Try on** and allow the camera.

## 1.5 Test it on a phone (needs HTTPS)

Browsers only allow the camera on `https://` addresses or `localhost`. `npm run dev:phone` uses `http://192.168…`, so the camera will be blocked there. Use one of these instead:

- **Vercel preview (easiest).** Push the branch, then open the preview link on the phone. You must be logged in to Vercel on the phone, because previews are protected.
- **Production.** After merging, open the live URL.

On the phone, test:

- in bright and dim light;
- with and without your own glasses;
- with your head turned left and right;
- closer and further from the camera.

## 1.6 Making frames look even more real (optional)

Give the 3D team the `.glb` files from `assets-3d/frames/` as a starting point. They should:

1. model each frame properly, at 1 unit = 1 m, front facing +Z, bridge centre at the origin;
2. save it as `public/models/frames/<SKU>_<colour>.glb`, for example `public/models/frames/BM-M01_Jet_black.glb`;
3. add its path to that product's colour in `data/catalogue.json`, in the `model` field.

The showroom viewer and the try-on then use the artist model for that frame, and the generated one for the rest.

## 1.7 If something goes wrong

| Problem                                | Fix                                                                                                                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Camera blocked" on a phone            | You are on `http://`. Use the Vercel preview or production URL.                                                                                                               |
| Camera works locally but not on Vercel | Check that `vercel.json` has `camera=(self)` in `Permissions-Policy`.                                                                                                         |
| "Try-on could not start"               | Check that the browser console has no CSP errors. Check that `vercel.json` has `'wasm-unsafe-eval'` in `script-src`, and that `/vendor/mediapipe/…` files exist in the build. |
| Frame jitters                          | Improve the light. Hold the phone at arm's length. Check that the frames-per-second counter (debug mode, `?tryon-debug`) shows 24 or more.                                    |
| Slow first start                       | The tracking files load once (about 15 MB) and are then cached. The loading message shows the size.                                                                           |

---

# Part 2: Brief for Claude Code

You are working in the Brijman Virtual Showroom project. The API layer from `docs/prompts/01-api-layer.md` is in place and working.

**Read first:**

- `CLAUDE.md`, `README.md`, `docs/decisions.md`, `docs/api.md` and `docs/setup-and-deploy.md`.
- The current versions of:
  - `data/catalogue.json`;
  - `shared/pricing.js` and `shared/schemas.js`;
  - the server routes and services for products, cart quote and orders;
  - `src/services/*`;
  - `src/ui/app.js` (product view, bag, size diagram `BM.sizeSVG`);
  - `src/scene/showroom.js`, especially `buildArch`, `partsFor`, the `FM` materials and the product viewer;
  - `vercel.json`, `vite.config.js`, `package.json`.

File names may differ slightly from what task 01 prescribed. **Follow the code as it is.**

## Project rules (summary; `CLAUDE.md` wins if they differ)

- Plain JavaScript ES modules, Vite 8 and three.js 0.180.0. Pin exact versions released at least two weeks ago. Scripts must be cross-platform, because the developer is on Windows.
- **Secrets.** Never read, print, stage or commit `.env` files or credentials. Server secrets are read only in server code. No `VITE_` secrets.
- **Personal data.** Never log personal data, and never put it in URLs or localStorage.
- **Look and feel.** Keep the existing design language, tokens and copy style. Everything works at 390 px and on desktop, in light and dark themes, with keyboard access and reduced motion respected.
- **Working style.** Work in large batches without stopping for routine confirmations. Record decisions in `docs/decisions.md`. Commit after each phase on `feature/virtual-try-on`. Never push or deploy without asking.

## Goal

Add a realistic, real-time virtual try-on for every frame (optical and sunglasses, adult, kids and Atelier).

When a shopper opens a frame, they can tap **Try on**. That opens a full-screen live mirror using the front camera, with the selected frame placed on their face at its **true physical size**. It must follow head movement smoothly, hide the arms behind the head, and look lit by the room.

In the mirror the shopper can:

- switch colour;
- switch **frame size (S, M or L, real size variants)**;
- see a fit guide;
- browse neighbouring frames;
- take and compare photos;
- add the exact colour and size to the bag.

When the camera is unavailable, the same try-on works on an uploaded photo.

**Everything runs on the device.** No camera frames, landmarks or photos are sent anywhere.

## Decisions already made (follow these)

| Area            | Decision                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Face tracking   | `@mediapipe/tasks-vision`, pinned to **1.0.1** or the newest version at least two weeks old. Use `FaceLandmarker` with `runningMode: 'VIDEO'` (`'IMAGE'` for uploaded photos), `numFaces: 1`, `outputFacialTransformationMatrixes: true`, `outputFaceBlendshapes: false`, and `delegate: 'GPU'`, falling back to `'CPU'` if GPU set-up fails. Verify every option and method name against `vision.d.ts` in the installed version. |
| Self-hosting    | Never load MediaPipe from a CDN or Google storage at run time. A Node script, `scripts/copy-mediapipe.mjs`, copies `node_modules/@mediapipe/tasks-vision/wasm/*` to `public/vendor/mediapipe/<version>/wasm/` before `dev`, `build` and `preview`. Gitignore the copied wasm.                                                                                                                                                     |
| Face model      | Download `face_landmarker.task` once from the official URL `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task` and commit it to `public/vendor/mediapipe/models/` (Apache-2.0; keep the licence note). Record its SHA-256 in `docs/decisions.md`. The copy script checks the hash and fails loudly on a mismatch.                                                    |
| 3D rendering    | three.js, the same version as the showroom. **Extract** the frame geometry and materials (`buildArch`, `partsFor`, `FM`, outline maths) from `src/scene/showroom.js` into `src/three/frame-model.js`. The showroom, the product viewer and the try-on all use it, so the showroom must render identically.                                                                                                                        |
| Model source    | `FrameModelSource`. If the colour entry in the catalogue has a `model` path to a `.glb`, load it with `GLTFLoader` from the same origin. Otherwise build the procedural model. Both return the same interface: a group with front, temples and lenses named consistently, a hinge position, and true size in metres.                                                                                                              |
| Engine boundary | `src/tryon/engine.js` exposes `start(videoOrImage)`, `setFrame(productId, colourIndex, sizeId)`, `snapshot()`, `stop()` and `on(event)`. The UI depends only on this interface, so a commercial SDK (Banuba, Fittingbox, GlamAR) could replace it later behind the same API. Write that decision into `docs/decisions.md`.                                                                                                        |
| Loading         | All try-on code, MediaPipe and the model are lazy-loaded only when the shopper taps **Try on**. Show progress: "Loading try-on (about 15 MB, only the first time)". They must not affect the showroom's first load.                                                                                                                                                                                                               |
| Sizes           | Real size variants are stored in the catalogue. There is **no free scaling slider**: it would show sizes we do not sell. The shopper may nudge the frame position (up or down on the nose, about ±3 mm) for comfort, but never its size.                                                                                                                                                                                          |

## Data and API changes (sizes)

Add `sizes` and `defaultSize` to every frame in `data/catalogue.json`:

```json
"sizes": [
  { "id": "S", "lens": 50, "bridge": 17, "temple": 140 },
  { "id": "M", "lens": 52, "bridge": 18, "temple": 145 },
  { "id": "L", "lens": 54, "bridge": 19, "temple": 150 }
],
"defaultSize": "M"
```

**Generating the sample sizes** (from each frame's current `size`, which becomes M):

| Frame type    | Sizes   | Rules                                                                              |
| ------------- | ------- | ---------------------------------------------------------------------------------- |
| Adult optical | S, M, L | S: lens −2, bridge −1, temple 140. L: lens +2, bridge +1, temple +5 (maximum 150). |
| Sunglasses    | M, L    |                                                                                    |
| Atelier       | M, L    |                                                                                    |
| Kids          | S, M    | S: lens −2, bridge −1, temple −5 (minimum 120).                                    |

Each size may have an optional whole-rupee `priceDelta`, which defaults to 0. Every size of a frame shares that frame's colour list.

**Things that must follow from this:**

- **Snapshot test.** This is an intentional catalogue change. Update `tests/fixtures/pre-migration-snapshot.json`, or add a sizes-aware assertion, and record why in `docs/decisions.md`.
- **Shared code:**
  - `shared/schemas.js`: the cart line gains `sizeId`, which is required for frames.
  - `shared/pricing.js`: add `priceDelta`.
  - New `shared/fit.js`: fit maths and thresholds, as pure functions.
- **API:**
  - `GET /products/:id` and `bootstrap` include `sizes`.
  - `cart/quote` and `orders` validate that `sizeId` exists for the product.
  - Order lines and summaries show the size, for example "M · 52□18-145".
  - Update `docs/openapi.yaml`, `docs/api.md` and `scripts/smoke.mjs`. Add a quote with `sizeId: "L"`, and an invalid size that must return 422.
- **Bag storage.** Move to localStorage key `bm-bag-v2`, still holding only id, colour, size, config and quantity. Migrate `bm-bag-v1` lines to the default size once, then delete the old key.
- **Product sheet:**
  - Add a size selector (chips showing "S 50□17-140"). It drives the size diagram (`BM.sizeSVG`), the 3D viewer and the bag line.
  - Add a "Not sure? Try on to see the fit" link.
- **Showroom shelves** show the default size.
- **Frame geometry.** `frame-model.js` must take `{lens, bridge, temple}` in mm and build the true geometry: lens width and height scale from the archetype, the bridge is real, and the temple length is real.

## Try-on realism (this is the core; do not cut corners)

### 1. True size on the face

- **The scale problem.** MediaPipe's facial transformation matrix fits an **average-sized canonical face**. Used alone, every frame looks the same relative size on every face, which is wrong.
- **Measuring the real face:**
  - Measure the shopper's real scale from the iris. The horizontal visible iris diameter is about 11.7 mm on average.
  - Measure both irises using the iris ring landmarks; check the indices against MediaPipe's iris landmark layout (468–477).
  - Take the median over the first 30 good frames (face roughly frontal, both eyes open). Then update slowly, with an exponential moving average over about 5 s.
  - From this, estimate face width in mm, measured cheek to cheek at the temple line (verify the landmark pair, for example 234 and 454).
- **Rendering at true size:**
  - Compute `faceScale = canonicalFaceWidth / measuredFaceWidthMm`, where `canonicalFaceWidth` is measured on MediaPipe's canonical face model between the same landmarks. Verify the canonical model's units.
  - Render the frame in face space at `trueSizeMm × faceScale`.
  - Unit-test this with synthetic landmark sets at known scales: a 140 mm-wide face and a 128 mm frame must give a frame-to-face ratio of 0.914 ± 0.01.
- **Placement:**
  - The bridge rests on the nose bridge (verify the landmark, for example 6 or 168).
  - Lens centres line up with the pupils vertically, within the shape's natural offset.
  - Vertex distance is about 12 mm in front of the corneal plane.
  - Pantoscopic tilt is 8–10°.
  - Temples run back to just above the ear line.
- **Camera match.** Match the three.js camera to the projection the transformation matrix assumes (check MediaPipe's face geometry documentation and source for the vertical field of view), then correct any remaining drift by snapping the bridge point to the tracked nose-bridge landmark in screen space every frame.

### 2. Stability

- Smooth pose, position and scale with a **One Euro filter** (tunable `minCutoff` and `beta`; unit-tested).
- Freeze the scale after calibration, apart from the slow update.
- If the face is lost for more than 300 ms:
  - fade the frame out over 150 ms;
  - show "Look at the camera";
  - when the face returns, fade the frame back in without popping.
- Skip a detection when the previous one is still running. Never queue detections.

### 3. Occlusion

- Add an invisible **head occluder** that writes depth only (`colorWrite: false`) and renders before the frame. Use an ellipsoid or capsule fitted to the measured face width and a head depth ratio of about 1.25, attached to the head pose and positioned behind the face surface. Temples must disappear behind the head and ears naturally from about 25–35 mm behind the hinges.
- The nose must never cover the bridge, and the occluder must not clip the lenses or rims when the head turns ±35°.

### 4. Lighting and materials

- **Background.** Draw the video as the background inside the same WebGL scene (a video texture on a full-screen plane, mirrored for the selfie view), so lens blending and tints are correct over the eyes.
- **Light estimation.** About every 500 ms, sample the average colour and brightness of forehead and cheek patches from a small down-scaled copy of the frame. Use them to:
  - set the hemisphere light colour and intensity;
  - set the environment intensity;
  - aim one directional light from the left-to-right cheek brightness difference.
    Smooth all changes.
- **Reflections.** Use an environment map (`RoomEnvironment`, PMREM) for lens and metal reflections.
- **Lenses:**
  - Optical lenses are clear, with a subtle Fresnel edge reflection and a faint anti-reflective coating sheen (green or purple tint at grazing angles).
  - Sunglass lenses use the catalogue tint and opacity. Mirror lenses use the metallic tint.
  - Blue-cut and photochromic preview chips: optional, only if time allows.
- **Shadows:** a soft contact shadow under the rims and nose pads. Draw a blurred, darkened silhouette of the frame front, offset slightly down and back, blended over the face at about 15–25 % opacity.
- **Colour.** sRGB output, tone mapping tuned so the frames sit naturally in the camera image and do not look CG-bright. Use MSAA and a device pixel ratio capped at 2.

### 5. Performance

- **Targets:** at least 24 fps on a mid-range Android phone (about ₹15,000), and at least 30 fps on recent iPhones and laptops.
- **Input:** 640×480 to 1280×720 from the front camera (`facingMode: 'user'`), with `playsinline` and `muted` on the video for iOS.
- **Pause the showroom.** Pause the showroom's render loop (`BM.api.setPaused(true)`) while the try-on is open and resume it on close.
- **Clean up.** Dispose of try-on GPU resources on close.
- **One WebGL context.** Reuse a single try-on renderer and context across sessions. iOS limits contexts.
- **Debug overlay.** `?tryon-debug` shows fps, inference time, the scale estimate and landmark dots. It is off by default and never shipped as visible UI.

## Try-on interface

- **Entry points:**
  - a **Try on** button in the product sheet for every frame, next to "Show in store";
  - a small try-on icon on frame rows in search and browse lists.
    Contact lenses and care products get neither.
- **Privacy notice.** The first time, show one screen with:
  - an icon and the title "Try frames on with your camera";
  - "Your camera runs on this device. Nothing is recorded or sent anywhere.";
  - buttons **Allow camera** and **Use a photo instead**;
  - a link to the privacy note.
    Remember the choice in `bm-settings`; this is not personal data.
- **Live view** (full screen, safe-area aware):
  - **Top:** Close, the frame name and price, and the fit chip ("Good fit", "May feel narrow", "May feel wide") with an info popover explaining it is an estimate.
  - **Bottom:** colour swatches; size chips (S, M, L with mm); a horizontal carousel of other frames in the same section; the capture button; **Add to bag**.
  - **Fit nudge:** up and down buttons (±1 mm per tap, ±3 mm limit, and a reset).
  - **Previous and next frame:** swipe on mobile, arrow keys on desktop.
  - All text sits on readable surfaces over the video, in both themes.
- **Fit guide.** In `shared/fit.js`, compute `diff = frameTotalWidthMm − faceWidthMm`, using the model's real outer width:
  - below −8 mm: narrow;
  - from −8 to +4 mm: good;
  - above +4 mm: wide.
    Keep these thresholds as named constants, and document them as starting values to tune with real customers. Suggest the best size: "Size L may fit you better".
- **Photos:**
  - Capture composites the video and the frame at full resolution.
  - Keep up to 4 photos in memory as `blob:` URLs.
  - **Compare** shows them side by side with the frame, colour and size under each.
  - **Save** downloads the image. On mobile, use the Web Share API with files when available.
  - Revoke all blob URLs when the try-on closes.
- **Add to bag.** Opens the product's lens configurator with the chosen colour and size preselected, so the existing lens and prescription flow continues.
- **Photo fallback.** If the camera is denied, unavailable or the shopper prefers, accept a front-facing photo (JPEG, PNG or HEIC where the browser supports it; limit 10 MB). Process it in `IMAGE` mode with the same controls. Show a clear message when no face or more than one face is found.
- **Error messages:**
  - Camera blocked: "Camera is blocked. Allow it in your browser settings, or use a photo instead."
  - Try-on fails to start: "Try-on couldn't start on this device. You can still use a photo."
  - Insecure page: "Camera needs a secure (https) page."
- **Accessibility.** Every control is keyboard reachable with visible focus. Fit changes are announced through `aria-live`. With reduced motion, use fades instead of slides.

## Security and privacy

- `vercel.json`:
  - change `Permissions-Policy` from `camera=()` to `camera=(self)`, and keep the rest;
  - add `'wasm-unsafe-eval'` to `script-src`, which WebAssembly needs;
  - change nothing else, unless a real violation proves it necessary. If you move inference into a Web Worker, add `worker-src 'self'` only then.
- Add a long-term immutable cache header for `/vendor/mediapipe/(.*)`. The version is in the path.
- **Camera handling:**
  - stop every camera track on close, `pagehide` and `visibilitychange` (hidden);
  - restart only on the shopper's action;
  - never call `getUserMedia` before the shopper taps **Allow camera**.
- **No face data leaves the device.** Never send frames, landmarks, measurements or photos to the server, analytics or logs. Face geometry is biometric data; keep it in memory only and drop it on close.
- **Analytics.** Add a no-op `track(event, props)` with privacy-safe events only: `tryon_open`, `tryon_size_change`, `tryon_colour_change`, `tryon_photo`, `tryon_add_to_bag`, and `fit_result` as good, narrow or wide (no measurements). It is wired later to DGCC.
- Add a short **privacy note** (`docs/privacy-try-on.md`, and a link in the try-on UI) that explains on-device processing in plain language.

## Phases

Commit at the end of each phase on `feature/virtual-try-on`.

1. **Baseline.**
   - Run `npm ci`, `npm run check` and the smoke test against `npm run preview`.
   - Write the design note in `docs/decisions.md`: build in-house with MediaPipe, with an engine interface so a vendor SDK can be swapped in.
2. **Frame model extraction.**
   - Move the geometry and materials into `src/three/frame-model.js`, parameterised by size in mm.
   - Add `FrameModelSource` (`.glb` or procedural).
   - Prove the showroom is unchanged: 188 products, same placement, and a visual check of a few shelves.
3. **Sizes end to end.**
   - Catalogue data, schemas and pricing.
   - API, OpenAPI, smoke test, bag v2 migration, product sheet size selector, size diagram and 3D viewer.
   - Tests.
4. **Try-on engine.**
   - Camera and image input, the MediaPipe set-up script and self-hosting.
   - Pose, scale calibration, placement, One Euro filter, occluder, lighting, shadow, render loop, snapshot, cleanup.
5. **Try-on interface.**
   - Entry points, privacy notice, live view, sizes, colours, carousel, fit guide, nudge, photos and compare, add to bag, photo fallback, errors, accessibility.
6. **Security and delivery.**
   - CSP and permissions changes, cache headers, lazy loading, the bundle-size check (the showroom's first load must not grow by more than 10 KB gzipped), and the analytics no-op.
7. **Tests and docs.** See the next two sections.

## Tests and verification

- **Unit tests (Vitest):**
  - iris-to-millimetre scale and face width;
  - `faceScale` and the true-size ratio test above;
  - fit thresholds and size suggestion;
  - the One Euro filter;
  - size generation rules;
  - schemas and quote with `sizeId`;
  - the bag v1 to v2 migration;
  - `frame-model` outer width for each size, within ±0.5 mm of `2 × lens + bridge + endpieces`.
- **Face data.** Use **synthetic landmark sets** generated from the canonical face model at known scales and poses. Do **not** add real people's photos to the repo. If you need a real photo for manual checks, use one the developer provides locally, and keep it gitignored under `tests/local/`.
- **Smoke test.** Covers sizes in the quote, a 422 for an invalid size, and the `camera=(self)` header.
- **Browser checks.** Use headless Playwright if available:
  - the try-on loads with a fake camera (Chromium's `--use-fake-device-for-media-stream` and `--use-fake-ui-for-media-stream`);
  - there are no CSP violations and no console errors;
  - the camera stops on close;
  - the showroom resumes.
    List any check you could not run.
- **Device checklist.** Write `docs/try-on-testing.md` for the team to run by hand on:
  - a mid-range Android phone in Chrome;
  - an iPhone in Safari;
  - a desktop in Chrome or Edge with a webcam.
    It covers bright and dim light, with and without glasses, a beard, head turns of ±35°, distances of 30–80 cm, and all three sizes, with expected results and a column for fps.

## Documentation

- **`docs/try-on.md`** is the technical guide:
  - the architecture diagram in text;
  - the landmark indices used;
  - the scale maths;
  - the tunable constants and where they live;
  - how to add an artist `.glb` (orientation +Z front, 1 unit = 1 m, bridge at the origin, named parts);
  - how to swap in a vendor SDK.
- **`docs/privacy-try-on.md`.**
- **`docs/try-on-testing.md`.**
- **Update** `README.md`, `docs/setup-and-deploy.md` (the HTTPS note for phones, the `copy-mediapipe` step, the header changes), `docs/api.md`, `docs/openapi.yaml` and `CLAUDE.md` (architecture, commands, the new CSP and permissions invariants; under 200 lines).

## Acceptance criteria

- [ ] `npm run check` passes and `npm audit` reports 0 vulnerabilities. The smoke test passes against `npm run preview`.
- [ ] The showroom is unchanged: 188 products, same first-load size within 10 KB gzipped, no CSP violations.
- [ ] Every frame shows **Try on**. The try-on loads lazily, shows progress, and works on desktop with a webcam and on an uploaded photo.
- [ ] The frame sits on the nose bridge, lines up with the eyes, and follows head turns of ±35° without visible lag or jitter at 24 fps or more on a mid-range phone, per the device checklist.
- [ ] Temples disappear behind the head. Lenses show reflections, and sun lenses are tinted correctly. A soft contact shadow is visible.
- [ ] Switching between S, M and L changes the frame on the face to the true size immediately. The fit chip updates. The chosen size flows to the bag, quote and order.
- [ ] Synthetic-landmark tests prove true relative size within ±1 %.
- [ ] Photos, compare, save and add to bag work. Blob URLs are revoked and camera tracks are stopped on close.
- [ ] No camera frames, landmarks, measurements or photos leave the device, and none are in logs, URLs or storage. The only CSP and permissions changes are `'wasm-unsafe-eval'` and `camera=(self)`.
- [ ] Docs are complete enough for the 3D team to add artist models and for QA to run the device checklist without asking.

## When you finish

Reply with:

1. what changed, by phase;
2. the exact commands to run, test, preview and smoke-test;
3. how to test on a phone over HTTPS;
4. measured fps and inference times on what you could test;
5. anything you could not verify, any deviation from this brief, and why;
6. suggested next steps:
   - artist `.glb` models for the bestsellers;
   - a pupillary distance estimate for the prescription form, clearly labelled as an estimate;
   - try-on analytics in DGCC;
   - share-to-WhatsApp of try-on photos through WaMark, only with explicit consent.

If anything in this brief conflicts with how the code actually works, keep the existing behaviour, note the conflict in `docs/decisions.md`, and say so in your reply.
