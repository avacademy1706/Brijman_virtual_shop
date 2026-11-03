# Camera try-on

The try-on draws the jewellery on the shopper's live camera image. It runs entirely in the browser: the camera frames go to two small tracking models (MediaPipe Face Landmarker and Hand Landmarker, WebAssembly on the GPU with a CPU fallback) and to the 3D renderer. Nothing is recorded or uploaded.

This guide explains where each piece is placed, how to install and check the models, how to test without a camera, and which numbers to change to tune the fit.

---

## 1. What the shopper sees

1. **Intro card**: what the try-on does, that the video stays on the device, Start camera, or See it in 3D instead.
2. **Live view**: the camera image, mirrored like a mirror on the front camera, with the pieces on it. A status chip shows Starting camera, Loading tracking, Looking for you or Tracking. A short guide line appears only when something is missing ("Raise your hand to see the ring").
3. **Panel**: tabs Earrings, Necklace, Tikka, Nath, Ring and Bangle (a dot marks what is being worn), the pieces for the chosen tab (tap to wear, tap again to take off), the metal swatches and stone chips of the selected piece, the total for everything worn, **Photo** and **Add to bag**. On phones and portrait tablets the panel folds down to the tabs once the shopper is found, so the neck and chest stay visible; the handle or a tab opens it again. On wide screens and phones held sideways the panel is a column on the right. While the intro card is up, the panel waits behind it.
4. **Photo**: the camera image with the jewellery and a small caption, shown in a card. It is saved only when the shopper taps Save photo (or shared with the system share sheet on phones).

Ways in: the Try on button in the top or bottom bar (opens the Rajwada bridal set), Try it on in a product sheet (that piece, in the configured metal and stones), the bridal sets in the lounge (the whole set), and the mirror in the Bridal Lounge.

---

## 2. Where each piece goes

All positions are worked out in the camera image's pixels from a few landmarks, then sizes in millimetres are converted with the shopper's own scale: the width of the face between the cheek landmarks (taken as 140 mm) or the span of the knuckles from index to little finger (72 mm). So a piece stays true to size whether the shopper is near or far.

| Piece    | Tracking | Anchor                                                                                                                        | Orientation                                                                            |
| -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Earrings | Face     | Each earlobe: the jaw landmark in front of the ear (132 / 361), 4 mm out, 4 mm down and 16 mm back                            | Hangs straight down (gravity), turns with 85% of the head's turn, swings as a pendulum |
| Necklace | Face     | The base of the neck: 192 mm below the midpoint of the cheek landmarks (close to the axis the head turns about), 8 mm forward | Follows a third of the head's tilt and about half of its turn, like a real neck        |
| Tikka    | Face     | The top of the face mesh (landmark 10, about the hairline): the pendant starts 8 mm below it, the chain runs up the parting   | Lies along the slope of the forehead                                                   |
| Nath     | Face     | The left nostril (landmark 327), 1.5 mm out                                                                                   | Faces the camera, turned 26° towards the cheek                                         |
| Ring     | Hand     | The ring finger, 36% of the way from the knuckle (13) to the middle joint (14)                                                | Along the finger, head on the back of the hand; sized to the measured finger width     |
| Bangle   | Hand     | 14 mm up the forearm from the wrist (0)                                                                                       | Along the forearm, front towards the back of the hand                                  |

**Smoothing.** Every landmark goes through a One Euro filter: steady when the shopper is still, without lag when they move.

**Earring swing.** Each earring is a damped pendulum whose length comes from the earring's drop. The earlobe's acceleration from frame to frame pushes it, so a quick head turn sets a jhumka swinging, and it settles in about a second.

**Hidden parts.** Invisible depth-only shapes stand in for the head (an ellipsoid behind the face), the neck (a cylinder), the ring finger and the forearm (cylinders). They hide the back of a necklace behind the neck, the far half of a ring and of a bangle, and the far earring once the head turns more than about 30°.

**Light.** The jewellery's exposure follows the brightness of the camera image (sampled twice a second), and diamonds and polki glint as the head moves.

The maths is in `src/tryon/anchors.js` (no browser code, unit-tested); the drawing and the panel in `src/tryon/tryon.js`; the models and smoothing in `src/tryon/tracker.js`.

---

## 3. Installing the models

`npm run dev` and `npm run build` run `scripts/setup-tryon.mjs` first. It:

1. copies the MediaPipe WebAssembly runtime from `node_modules/@mediapipe/tasks-vision/wasm` into `public/vendor/mediapipe/1.0.1/wasm/`;
2. downloads, only if missing, from Google's official MediaPipe model bucket:
   - `face_landmarker.task` (about 4 MB) → `public/models/`
   - `hand_landmarker.task` (about 8 MB) → `public/models/`
3. records each file's SHA-256 in `models/models.lock.json` the first time. Commit that file; afterwards a model that does not match is refused.

Check with `npm run check`. Run `npm run setup:tryon` to retry a failed download. `node scripts/setup-tryon.mjs --offline` copies the runtime only.

Without the models the boutique works normally. The try-on starts the camera, then says that the face (or hand) tracking model is not installed and offers the 3D viewer instead.

Each model loads only when it is needed: the hand model is not downloaded by the browser until the shopper wears a ring or a bangle.

---

## 4. Testing

| How                                  | What it covers                                                                                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test` (`anchors.test.js`)       | The placement maths with a synthetic face and hand: turns, scale, every anchor, hiding the far earring, the neck staying put, smoothing and swing                    |
| `/tools/tryon-sim.html`              | The real try-on module, panel and renderer on a painted mannequin with synthetic tracking (see the address list in [TESTING.md](TESTING.md#try-on-without-a-camera)) |
| `npm run test:e2e` (`tryon.spec.js`) | The try-on opens, the camera starts with Chrome's fake camera, tracking loads or the missing-model message shows, the panel fits the screen                          |
| A real camera                        | Tracking a real face and hand in real light: see the checklist in [TESTING.md](TESTING.md#4-manual-checklist-before-a-client-demo-or-a-production-deploy)            |

Add `?tryondebug=1` to the site's address to see the tracked landmarks and anchors as dots over the camera image (earlobes red, tikka blue, nath green, neck white, ring and bangle on the hand).

---

## 5. Tuning the fit

Faces and hands differ. The defaults suit an average adult; adjust them in `src/tryon/anchors.js` and check with the simulator and a real camera.

| Constant                        | Default | Change it when                                                           |
| ------------------------------- | ------- | ------------------------------------------------------------------------ |
| `FACE_MM.width`                 | 140     | All face jewellery looks too big (raise it) or too small (lower it)      |
| `FACE_MM.lobeDown` / `lobeBack` | 4 / 16  | Earrings hang below the lobe or float in front of the ear                |
| `FACE_MM.lobeOut`               | 4       | Earrings sit inside the face outline or too far out                      |
| `FACE_MM.tikkaDown`             | 8       | The tikka's pendant sits too high in the hair or too low on the forehead |
| `FACE_MM.nathOut` / `nathFwd`   | 1.5 / 1 | The nath's piercing point is off the nostril                             |
| `FACE_MM.neckDown` / `neckFwd`  | 192 / 8 | Necklaces sit too high on the neck or too low on the chest               |
| `HAND_MM.knuckles`              | 72      | Rings and bangles look too big (raise it) or too small (lower it)        |
| `HAND_MM.ringAt`                | 0.36    | The ring sits too close to the knuckle or the middle joint               |
| `HAND_MM.bangleUp`              | 14      | The bangle sits on the hand instead of the wrist, or too far up the arm  |

Smoothing: `VecFilter` settings in `tracker.js` (`1.4, 0.035` for the face, `1.6, 0.05` for the hand). Lower the first number for steadier but slower pieces. Earring swing: `Swing` in `anchors.js` (damping `c`, the angle limit `lim`).

Detail of the pieces in the try-on: `buildPiece(..., coarse ? 0.6 : 0.8)` in `tryon.js`.

---

## 6. Limits

- One face and one hand are tracked. With two people in view, the try-on may follow either; the intro asks for one person.
- Hair over the ears hides real earlobes but not the drawn earrings, so earrings can look as if they are in front of hair. The intro suggests tucking hair behind the ears.
- Rings and bangles are placed for the back of the hand facing the camera; with the palm towards the camera the ring head is drawn on the palm side.
- The neck position is estimated from the face; a high collar or a very long neck can put a necklace slightly high or low. The tuning table above covers this.
- Browsers allow the camera only on `https://` addresses and `http://localhost`.

---

## 7. Privacy and security

- Video frames never leave the device: `connect-src 'self'` in the Content Security Policy means the page cannot send data anywhere but its own site, and the try-on sends nothing there either.
- MediaPipe tries to send anonymous usage statistics to `odml.pa.googleapis.com`; the policy blocks it. One blocked request in the console is expected.
- The camera stops when the try-on closes, when the tab is hidden and when the page is left.
- `Permissions-Policy: camera=(self)` lets only this site ask for the camera.
