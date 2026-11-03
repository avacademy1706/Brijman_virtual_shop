# Camera try-on

The try-on puts the chosen frame on the shopper's face, live, through the camera. It opens from the **Try on** button in the top bar or bottom bar, from **Try on with your camera** and **Find my size with the camera** in a product sheet, and from the round mirror in the lounge.

## What the shopper sees

1. A short card: video stays on the device, frames are shown at their real size, and looking straight at the camera for a moment gives a size suggestion. **Start camera** asks for camera permission; **See it in 3D instead** opens the product sheet.
2. The camera picture with the frame on the face. The frame turns with the head; the temples run back to the ears and disappear behind the head.
3. A panel (bottom on phones, folded down once the face is found; a column on the right on wide screens) with the collections (Sunglasses, Women, Men, Atelier, Kids), the frames, colours, sizes, a **Photo** button and **Add to bag**.
4. A fit readout: "Face ≈ 137 mm · PD ≈ 62.5 mm. Size M (139 mm) is a good fit." The first time the face is measured, the try-on switches to the suggested size (unless the shopper chose one) and says so.

## How it works

| Step        | Where                             | What happens                                                                                                                                                                                                                                                             |
| ----------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tracking    | `src/tryon/tracker.js`            | MediaPipe Face Landmarker (478 points including the irises) runs on each video frame, on the GPU where possible. The landmarks the try-on needs are smoothed with One Euro filters (steady when still, quick when moving).                                               |
| Face frame  | `faceFrame()` in `anchors.js`     | Axes from the cheek landmarks (left-right) and the forehead and chin (up); the third axis points out of the face.                                                                                                                                                        |
| Scale       | `Calibrator` in `anchors.js`      | The iris is about 11.7 mm across in almost every adult. While the shopper faces the camera, the ratio between the iris scale and the cheek width is averaged; after that the steadier cheek width gives pixels per millimetre in every frame, even with the head turned. |
| Measurement | `Calibrator`                      | Face width between the temple landmarks and pupillary distance between the iris centres, averaged over frontal frames only (`canMeasure()`: head turned less than about 15°, both irises clearly seen). Ready after 24 good frames (under a second at 30 fps).           |
| Placement   | `glassesPose()`                   | The frame's centre goes between the pupils, 1.5 mm higher, and 12 mm in front of the eyes (the usual vertex distance), never behind the bridge of the nose. The frame is drawn at its real size: the 3D frame is in metres, scaled by the pixels-per-millimetre value.   |
| Occlusion   | `place()` in `tryon.js`           | A depth-only ellipsoid as wide as the measured temples sits behind the face, so the temples vanish behind the head like behind the ears and hair.                                                                                                                        |
| Light       | `sampleLight()`                   | The average brightness of the picture adjusts the exposure, so the frame is not brighter than the room.                                                                                                                                                                  |
| Size        | `NY.bestSize()` in `catalogue.js` | The size whose frame width (hinge to hinge) is closest to the face width. Within 5 mm is a good fit; wider or narrower is said plainly.                                                                                                                                  |

## Accuracy

Iris-based measurement is typically within 2 to 3 mm for face width and about 1 to 2 mm for PD in good light, facing the camera at arm's length. It is less reliable with heavy glasses on, very dim light, or the head tilted. The readout says "approximate: an optician confirms it at your fitting", and the PD button in the prescription form ("Use 62.5 mm from the try-on") is an offer, not an automatic entry.

## Privacy

- Video goes from the camera to the GPU and the tracking model on the device. Nothing is uploaded or recorded; `connect-src 'self'` in the CSP would block it anyway.
- The photo is created only when the shopper taps **Photo** and saved only when they tap **Save** (or shared with **Share** on phones).
- Measurements are kept in memory for the visit (they help the size note in product sheets) and are never stored or sent.

## Files and setup

The MediaPipe runtime (`public/vendor/mediapipe/<version>/wasm/`) is copied from `node_modules` and the model (`public/models/face_landmarker.task`, Apache 2.0, about 4 MB) is downloaded from Google's MediaPipe model bucket by `scripts/setup-tryon.mjs`. This runs before every `npm run dev` and `npm run build`, so a Vercel build fetches it by itself. The first download pins the model's SHA-256 in `models/models.lock.json`; commit that file so later builds refuse a changed model.

If the model is missing (no internet during the build), the salon works normally and the try-on says the tracking model is not installed and offers the 3D viewer.

## Troubleshooting

| Symptom                                  | Cause and fix                                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "The camera needs a secure (https) page" | Open the site over HTTPS (Vercel, or `localhost`). Phones on `npm run dev:phone` use plain http and cannot open the camera; use a Vercel preview link. |
| "Camera access was blocked"              | Allow the camera for the site in the browser's settings, then reload.                                                                                  |
| "Tracking unavailable … not installed"   | Run `npm run setup:tryon` (needs internet) and rebuild.                                                                                                |
| The frame looks too big or small         | Look straight at the camera for a second so the irises calibrate the scale; avoid strong backlight.                                                    |
| The frame sits a little high or low      | Normal frames sit with the pupils near the lens centre. To change it for every frame, adjust `FACE_MM.lift` (mm) in `src/tryon/anchors.js`.            |
| Slow on an old phone                     | The model falls back to the CPU. Close other camera apps; the 3D salon is paused while the try-on is open.                                             |

## Testing without a camera

`npm run dev`, then open `http://localhost:5173/tools/tryon-sim.html`. A painted face stands in for the camera and its landmarks go through the real anchor maths. Options: `?pid=w01&ci=1&size=S`, `?yaw=25`, `?pitch=10`, `?move=1`, `?temples=128&pd=60` (to see the size suggestion change), `&tryondebug=1`. The unit tests (`tests/unit/anchors.test.js`) check placement and measurement on the same synthetic face at several sizes, distances and head turns.
