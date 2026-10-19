# Virtual try-on: technical guide

The try-on puts a frame on the shopper's face at its real size, live from the front camera or on an uploaded photo. Everything runs in the browser. No camera frame, landmark, measurement or photo is sent anywhere.

## Architecture

```
Product sheet / search row ── "Try on" ──► src/ui/app.js  openTryOn()   (dynamic import, nothing loads before this)
                                               │
                                               ▼
                                     src/tryon/ui.js  (interface: privacy notice, mirror, sizes, colours, carousel,
                                               │        fit chip, nudge, photos, compare, add to bag, photo fallback)
                                               │  uses only the engine API
                                               ▼
                                     src/tryon/engine.js
                                       start(source) · setFrame(productId, colourIndex, sizeId) · setNudge(mm)
                                       snapshot() · stop() · on(event, fn)
                                               │
              ┌────────────────────────────────┼───────────────────────────────────┐
              ▼                                ▼                                   ▼
  @mediapipe/tasks-vision 1.0.1      src/tryon/face-math.js              src/three/frame-model.js
  FaceLandmarker (VIDEO / IMAGE)      pose fit, iris scale, placement,   frame geometry at real mm size,
  self-hosted under                   occluder, calibration              materials, named parts, hinges
  /vendor/mediapipe/…                 src/tryon/one-euro.js (smoothing)  (shared with the showroom)
                                      shared/canonical-face.js
                                      shared/fit.js (fit guide, sizes)
```

Render: one three.js `WebGLRenderer`, reused for every session (iOS limits WebGL contexts). The video (or photo) is a full-screen textured plane drawn first; the frame, an invisible head occluder and a contact shadow sit in a "head" group posed every frame. The camera is orthographic in video-pixel space, and the canvas is mirrored with CSS for the selfie view.

Per video frame: `detectForVideo` (synchronous, so detections never queue) → landmarks → pose fit → calibration → One Euro smoothing → place frame and occluder → render.

## Landmarks used

MediaPipe Face Mesh with iris refinement (478 points). Indices are checked against the canonical model in `tests/unit/face-math.test.js`.

| Purpose                       | Indices                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Nose bridge (snap point)      | 168                                                                                     |
| Nose ridge (bridge clearance) | 168, 6, 197, 195, 5, 4                                                                  |
| Face width (temple line)      | 234 and 454                                                                             |
| Iris rings                    | 468–472 (right), 473–477 (left); diameter = 469↔471, 474↔476                            |
| Eye corners (pupil height)    | 33, 133, 362, 263                                                                       |
| Eyelids (eyes open check)     | 159/145, 386/374                                                                        |
| Light sampling                | forehead 151, cheeks 50 and 280                                                         |
| Pose fit (rigid set)          | `RIGID` in `face-math.js`: forehead, nose, eye corners, cheekbones, temples (39 points) |

## Scale maths (true size)

The canonical face (`shared/canonical-face.js`, from MediaPipe's `canonical_face_model.obj`) is in centimetres; its width between 234 and 454 is `CANONICAL_FACE_WIDTH` ≈ 15.33 cm.

1. **World points.** Landmarks become video pixels: `Q = (x·W, (1 − y)·H, −z·W)` (MediaPipe's z uses the same scale as x).
2. **Pose.** A similarity Procrustes fit (Horn's quaternion method) finds `s`, `R`, `t` with `Q ≈ s·R·P + t` for the rigid canonical points `P`. Then `t` is corrected so canonical 168 lands exactly on tracked 168.
3. **Real face width.** `faceWidthMm = |Q234 − Q454| / irisDiameterPx × 11.7`. 11.7 mm is the average visible iris diameter, which is why the fit guide is an estimate.
4. **Calibration.** Median of the first 30 good frames (yaw and pitch within ±15°, eye openness above 0.12), then an exponential moving average with a 5 s time constant. Photos use their single measurement.
5. **Frame size.** `faceScale = CANONICAL_FACE_WIDTH / faceWidthMm` (canonical units per real mm). The frame model (metres) is scaled by `1000 × faceScale` inside head space, so on screen it is `trueSizeMm × faceScale × s` pixels wide, the shopper's real proportion. Test: a 128 mm frame on a 140 mm face renders at 0.914 ± 0.01 of the face width.
6. **Placement** (`framePlacement`): lens centres 2 mm below the pupils, lens plane 12 mm (vertex distance) in front of the cornea (upper-lid landmark + 1 mm), bridge at least 1.5 mm clear of the nose ridge, pantoscopic tilt 9°. The shopper can nudge up or down in 2 mm steps, up to ±10 mm; the size never changes.
7. **Occluder** (`occluderEllipsoid`): a depth-only ellipsoid, 1.25 times deeper than wide, at least as wide as the face. Its front stays 8 mm behind the frame front, and its surface crosses the temple line 30 mm behind the hinges, so temples disappear from there. Tests prove the rims and lenses are never hidden for head turns up to ±35°.

## Tunable constants

| Constant                                                                                     | File                         | Default                                                |
| -------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------ |
| `IRIS_DIAMETER_MM`                                                                           | `src/tryon/face-math.js`     | 11.7                                                   |
| `FIT` (vertex distance, tilt, pupil offset, nudge limit)                                     | `src/tryon/face-math.js`     | 12 mm, 9°, 2 mm, ±10 mm in 2 mm steps                  |
| `OCCLUDER` (temple hide distance, front gap, depth ratio)                                    | `src/tryon/face-math.js`     | 30 mm, 8 mm, 1.25                                      |
| `FaceWidthCalibrator` (frames, time constant)                                                | `src/tryon/face-math.js`     | 30 frames, 5 s                                         |
| `FIT_NARROW_BELOW_MM`, `FIT_WIDE_ABOVE_MM`                                                   | `shared/fit.js`              | −8 mm, +4 mm (starting values)                         |
| `ENGINE` (face-lost delay, fade, light sampling, smoothing, shadow opacity, max pixel ratio) | `src/tryon/engine.js`        | 300 ms, 150 ms, 500 ms, One Euro 1.0 Hz / 0.04, 0.2, 2 |
| `ENDPIECE_MM` (frame width beyond 2 × lens + bridge)                                         | `shared/frame-archetypes.js` | per archetype                                          |

The fit guide compares the frame front's outer width with the estimated face width: below −8 mm reads "May feel narrow", above +4 mm "May feel wide", otherwise "Good fit". `suggestSize` proposes the size closest to the middle of the good range. Tune the thresholds with real customers.

## Debug mode

Add `?tryon-debug` to the URL. The try-on shows fps, inference time, the delegate (GPU or CPU), the face-width estimate and calibration progress, head yaw and pitch, eye openness, and landmark dots. It is off by default and is never shown otherwise.

## MediaPipe self-hosting

- `@mediapipe/tasks-vision` is pinned to 1.0.1. `scripts/copy-mediapipe.mjs` runs before `dev`, `build` and `preview` and copies the wasm runtime (SIMD and no-SIMD builds) to `public/vendor/mediapipe/1.0.1/wasm/` (gitignored).
- The face model is committed at `public/vendor/mediapipe/models/float16-1/face_landmarker.task` (Apache-2.0, see `NOTICE.txt`). The copy script checks its SHA-256 (`64184e22…bc9ff`) and stops the build on a mismatch. Official source: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`.
- To upgrade MediaPipe: install the new exact version, update `MEDIAPIPE_VERSION` in `src/tryon/engine.js` (a test checks they match), run `npm run check`, and test on the device checklist.
- `/vendor/mediapipe/(.*)` is cached for a year (immutable), so every file there must have a version in its path.

## Adding an artist model (.glb)

1. Model the frame at **1 unit = 1 m**, front facing **+Z**, the **centre of the bridge at the origin**, lens centres at y = 0.
2. Name the parts: a node `front` (rims, bridge, endpieces), `temples` (both arms) and `lenses`. Lens meshes are recognised by a name containing "lens"; for sunglasses the engine applies the catalogue tint to them.
3. Save it as `public/models/frames/<SKU>_<colour>.glb`, for example `public/models/frames/BM-M01_Jet_black.glb`.
4. In `data/catalogue.json`, add `"model": "/models/frames/BM-M01_Jet_black.glb"` to that colour of that product.

The try-on scales the model so the `front` node's width matches the chosen size's real outer width, and places it like the generated frame. If the file fails to load, the generated frame is used. The `.glb` files in `assets-3d/frames/` are a good starting point (they were checked to load and sit correctly in the try-on).

## Swapping in a vendor SDK

The interface (`src/tryon/ui.js`) uses only the engine API above. To use Banuba, Fittingbox or GlamAR:

1. Write `src/tryon/engine-<vendor>.js` exporting `createEngine({ onProgress })` that returns the same API: `canvas`, `faceWidthMm`, `calibrated`, `on(event, fn)`, `start(source)`, `setFrame(productId, colourIndex, sizeId)` (resolving `{ widthMm, widths: [{id, widthMm}] }`), `setNudge(mm)`, `snapshot()` (a JPEG `Blob`), `resize()`, `stopLoop()` and `stop()`, and the events `face`, `faces`, `fit`, `progress`, `error`.
2. Change the import in `ensureEngine()` in `ui.js`.
3. Add the vendor's origins to the CSP in `vercel.json` only if the SDK needs them, record that in `docs/decisions.md`, and update `docs/privacy-try-on.md` if any data would leave the device.
