# Try-on device checklist

Run this by hand before each release that touches the try-on. Use the production URL or a Vercel preview (the camera needs `https://`; previews need you to be logged in to Vercel on the device). Add `?tryon-debug` to the URL to see fps and inference time.

## Devices

| #   | Device                                  | Browser        |
| --- | --------------------------------------- | -------------- |
| A   | Mid-range Android phone (about ₹15,000) | Chrome         |
| B   | iPhone (recent iOS)                     | Safari         |
| C   | Desktop or laptop with a webcam         | Chrome or Edge |

## Setup checks (each device)

| Check                                                                                    | Expected                                                                                 | A   | B   | C   |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --- | --- | --- |
| Open any frame, tap **Try on**                                                           | Privacy screen: "Try frames on with your camera" with Allow camera / Use a photo instead |     |     |     |
| First open shows "Loading try-on (about 15 MB, only the first time)" with a progress bar | Loads; a second open is quick                                                            |     |     |     |
| Tap **Allow camera**                                                                     | Browser asks for the camera once; the mirror appears                                     |     |     |     |
| Close (✕)                                                                                | Camera light turns off; the showroom is back where it was                                |     |     |     |
| Reopen                                                                                   | No privacy screen; camera starts directly                                                |     |     |     |
| Switch tabs and come back                                                                | Camera paused message; "Turn the camera back on" restarts it                             |     |     |     |
| Deny the camera in browser settings, reopen                                              | "Camera is blocked. Allow it in your browser settings, or use a photo instead."          |     |     |     |
| **Use a photo** with a clear selfie                                                      | Frame on the face, fit chip shown                                                        |     |     |     |
| Photo with two people                                                                    | "More than one face is in this photo…"                                                   |     |     |     |
| Photo with no face                                                                       | "No face found in this photo…"                                                           |     |     |     |

## Realism checks

Record fps from the debug overlay. Targets: at least 24 fps on device A, at least 30 fps on B and C.

| Scenario                                  | Expected                                                                         | A fps | A ok | B fps | B ok | C fps | C ok |
| ----------------------------------------- | -------------------------------------------------------------------------------- | ----- | ---- | ----- | ---- | ----- | ---- |
| Bright light, facing the camera at ~50 cm | Bridge on the nose, lens centres just below the pupils, steady (no jitter)       |       |      |       |      |       |      |
| Dim light                                 | Still tracks; frame looks lit like the face, not glowing                         |       |      |       |      |       |      |
| Wearing your own glasses                  | Tracks; the new frame sits over them                                             |       |      |       |      |       |      |
| Beard                                     | Tracks normally                                                                  |       |      |       |      |       |      |
| Head turned left 35°                      | Frame follows without lag; far temple hidden behind the head; rims never cut off |       |      |       |      |       |      |
| Head turned right 35°                     | Same                                                                             |       |      |       |      |       |      |
| Nod up and down                           | Frame stays on the nose                                                          |       |      |       |      |       |      |
| 30 cm from the camera                     | Frame stays the same real size relative to the face                              |       |      |       |      |       |      |
| 80 cm from the camera                     | Same                                                                             |       |      |       |      |       |      |
| Look away, then back                      | "Look at the camera" after a moment; frame fades out and back in without jumping |       |      |       |      |       |      |
| Sunglasses (for example Kite)             | Tinted lenses, eyes dimmed behind them; mirror lenses look metallic              |       |      |       |      |       |      |
| Clear lenses                              | Faint reflection and coating sheen at an angle                                   |       |      |       |      |       |      |
| Contact shadow                            | Soft shadow under the rims on the face                                           |       |      |       |      |       |      |

## Sizes, colours and flow

| Check                                              | Expected                                                                                                 | A   | B   | C   |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --- | --- | --- |
| Switch S → M → L                                   | Frame grows on the face immediately; fit chip updates ("Good fit" / "May feel narrow" / "May feel wide") |     |     |     |
| Tap the fit chip                                   | Explains it is an estimate; may suggest "Size L may fit you better"                                      |     |     |     |
| Nudge up / down / reset                            | Frame moves about 1 mm per tap, at most 3 mm; size never changes                                         |     |     |     |
| Change colour                                      | Frame colour changes in place                                                                            |     |     |     |
| Swipe left / right (phone) or arrow keys (desktop) | Next / previous frame in the same section                                                                |     |     |     |
| Tap a frame in the carousel                        | That frame goes on                                                                                       |     |     |     |
| Take 4 photos                                      | Shutter flash; "Photos (4)"; a 5th asks you to remove one                                                |     |     |     |
| Compare                                            | Photos side by side with frame, colour and size under each                                               |     |     |     |
| Save a photo                                       | Phone: share sheet with the image. Desktop: the image downloads                                          |     |     |     |
| **Add to bag**                                     | Try-on closes; product sheet opens with the same colour and size selected                                |     |     |     |
| Finish checkout                                    | Bag, quote and order show the size, for example "Size M · 53□18-145"                                     |     |     |     |
| Keyboard only (desktop)                            | Every control reachable with Tab, visible focus, Esc closes                                              |     |     |     |
| Screen reader                                      | Fit changes and size changes are announced                                                               |     |     |     |
| Reduced motion on                                  | Fades instead of flashes and slides                                                                      |     |     |     |
| Dark mode                                          | All controls readable over the video                                                                     |     |     |     |

Note any failure with the device, browser version, light conditions and a screenshot (never commit photos of real people to the repository).
