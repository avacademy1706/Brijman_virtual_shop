# Mobile testing

How the showroom is tested on phones, tablets and desktops: the automated audit, the baseline findings, and the manual checklist for real devices.

## Automated audit

```bash
npx playwright install chromium webkit firefox   # once: the browsers Playwright downloads
npm run test:mobile                              # build, serve the production build, audit 16 device profiles, write the report
```

Open `reports/mobile-audit/index.html` in a browser (it works offline). It shows, for every device profile in portrait and landscape, a pass or fail table, before-and-after screenshots of each screen, and load time, draw-call, fps and heap figures. `reports/` is gitignored; `tests/mobile/` and `scripts/mobile-report.mjs` are committed.

Profiles: iPhone SE, iPhone 15 Pro and iPad Mini in WebKit (close to Safari, not identical); Pixel 7, Galaxy S9+, Galaxy Tab S4, a 360×800 low-end Android profile (4× CPU throttle, 4G network) and desktops at 1366×768 and 1920×1080 in Chromium. 3D runs on software WebGL in the headless browsers, so fps and load times are far below what a real phone gives: compare before and after, not absolute numbers.

## Reported issues (section 2.0 of the brief)

No rows were reported. The full audit was run instead.

## Baseline findings (before this work)

The first audit on the code before this work: **440 failing checks across 16 profiles** (412 passing). Each item from the brief's section 2.3, with what the audit or the code showed:

| #   | Problem                                | Found                                                                                                                                                                  |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | iOS zooms on input focus               | Yes: search 15 px, checkout and booking inputs 13 px.                                                                                                                  |
| 2   | Sheet cannot scroll from the 3D viewer | Yes: viewer `touch-action: none`; a swipe on it scrolled the sheet 0 px (Chromium touch).                                                                              |
| 3   | Bottom-bar height guessed              | Yes: `--bb-h` was never set (66 px fallback).                                                                                                                          |
| 4   | No Back button support                 | Yes: Back left the site (to `about:blank`) from the directory and the try-on, on every profile.                                                                        |
| 5   | Keyboard hides fields                  | Fields below the fold were outside the visible viewport while typing (iPhone SE, landscape phones).                                                                    |
| 6   | Welcome card overflows                 | Yes in landscape: the card ran from −113 to 244 px on a 320 px tall screen.                                                                                            |
| 7   | Sticky hover on touch                  | Yes: 16 `:hover` rules not gated by `(hover: hover)`.                                                                                                                  |
| 8   | Touch targets too small                | Yes: section labels 25 px tall, brand button 38×33, search and bag 42×40, chips 34 px, sheet close 40 px.                                                              |
| 9   | Text too small                         | Yes: eyebrows 9–10.5 px, brand sub-line 9.5 px, viewer hint and tags 10 px, prescription headers 10 px.                                                                |
| 10  | Section labels overlap                 | Yes in landscape: labels overlapped each other, the floor plan and the section card.                                                                                   |
| 11  | Minimap overlaps labels and hint       | Yes: floor plan × section card and section card × hint in landscape.                                                                                                   |
| 12  | Tap and drag thresholds strict         | Yes: 6 px and 650 ms for every pointer type.                                                                                                                           |
| 13  | Long-press side effects                | No `-webkit-touch-callout`, `user-select` or `touch-action: manipulation` on the canvas and chrome.                                                                    |
| 14  | Pull-to-refresh and overscroll         | No `overscroll-behavior` on `html` and `body`.                                                                                                                         |
| 15  | No swipe-down to close                 | Yes: dragging the grip did not close the sheet.                                                                                                                        |
| 16  | 3D performance on low-end phones       | One instanced mesh per archetype spanning the store; full-detail shelf frames; full-size textures. Walking: 5.6 fps on the throttled low-end profile (software WebGL). |
| 17  | WebGL context loss                     | Only a toast; the environment map was not rebuilt, so a restored context could stay dark.                                                                              |
| 18  | Viewport height                        | `html` padding plus `height: 100%`; no `dvh`; bottom bar not safe-area padded.                                                                                         |

Also found: in landscape the bottom bar and the sheet overlapped the top bar (626×26 px), and the bottom bar overlapped the bottom sheet on every phone (320×69 px).

## After this work

The same audit on the finished build: **836 checks passing, 0 failing** across all 16 profiles (before: 412 passing, 440 failing). Every item above is fixed:

| #   | Fix                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Every input, select and textarea is 16 px on touch screens.                                                                                                                                            |
| 2   | The viewer canvas is `touch-action: pan-y` on touch, with the tilt locked: vertical swipes scroll the sheet, horizontal drags turn the frame, pinch zooms inside the viewer. Desktop keeps full orbit. |
| 3   | `src/ui/layout.js` measures the bottom bar into `--bb-h` with a `ResizeObserver`.                                                                                                                      |
| 4   | `src/ui/history.js`: Back closes sheet views one at a time, the directory, the tour, the try-on and photo compare; Back from the bare store leaves normally.                                           |
| 5   | `--vvh` and `--kb` from `visualViewport`: the bottom sheet sits above the keyboard, and the focused field is scrolled into view inside the sheet only.                                                 |
| 6   | The welcome card never grows past the space between the bars and scrolls inside itself.                                                                                                                |
| 7   | All `:hover` rules are inside `@media (hover: hover) and (pointer: fine)`.                                                                                                                             |
| 8   | 44 px targets on touch screens (labels keep a small pill inside a 44 px button).                                                                                                                       |
| 9   | Minimum 11 px for micro-labels; the pill's label hides below 360 px instead of wrapping.                                                                                                               |
| 10  | Labels avoid each other and all chrome, the tour stop first, then the nearest; at most 4 on phones.                                                                                                    |
| 11  | The floor plan collapses to a button, collapsed by default on phones under 700 px tall and in landscape; the choice is remembered.                                                                     |
| 12  | Touch: 10 px and 500 ms for a tap (mouse: 6 px, 650 ms); a drag never counts as a tap.                                                                                                                 |
| 13  | No callout, magnifier or selection on the canvas and chrome; `touch-action: manipulation` on buttons; `text-size-adjust: 100%`.                                                                        |
| 14  | `overscroll-behavior: none` on `html` and `body`, `contain` on scrolling panels.                                                                                                                       |
| 15  | Drag the grip or header down to close: follows the finger, snaps back under 30 % or a slow flick, never starts while the content is scrolled.                                                          |
| 16  | Quality tiers, per-section instancing and culling, simplified distant frames, texture caps (see below).                                                                                                |
| 17  | "Restoring the 3D view…", full rebuild without a reload; Reload and floor plan offered if it fails. Tested by simulating a lost context.                                                               |
| 18  | Full-bleed app at `100dvh`; safe-area padding on the top bar, bottom bar, sheet footer and try-on.                                                                                                     |

Also new: a top-bar menu in phone landscape, a side-panel sheet in landscape, a 2-step first-visit coach mark, a touch ring where the floor is tapped, a ± button for prescription signs (iPhone's decimal keypad has no minus), keyboard "Next/Done" keys, and an "Open in Chrome or Safari" tip with a copy-link button when an in-app browser blocks the try-on camera.

### Figures (headless browsers, software WebGL; compare before and after only)

| Measure                                    | Before                      | After                                      |
| ------------------------------------------ | --------------------------- | ------------------------------------------ |
| Failing checks (16 profiles)               | 440                         | 0                                          |
| Low-end Android, walking fps (4× throttle) | 5.6 portrait, 3.2 landscape | 11.2 portrait, 8.0 landscape (tier low)    |
| Low-end Android, draw calls while walking  | 64                          | 26 portrait, 68 landscape                  |
| Desktop 1366, draw calls                   | 77                          | 46                                         |
| Desktop triangles rendered                 | 472,504                     | about 147,000, screenshots pixel-identical |
| Low-end JavaScript heap                    | 19.6 MB                     | 20.7 MB                                    |
| First load (gzipped)                       | 31.8 KB (before the try-on) | 38.2 KB (budget +10 KB)                    |

The 3D-ready time on the throttled low-end profile is about 1 s longer (4.9 s), because of the start-up benchmark that picks the quality tier.

## Manual checklist for real devices

Run on at least a budget Android phone, a mid-range Android phone, an iPhone, a tablet, and the WhatsApp in-app browser. Add `?tryon-debug` to the URL for try-on fps.

| Check                                                                  | Expected                                                                                 | Device | Browser | OS  | Pass | fps |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------ | ------- | --- | ---- | --- |
| Open the site, portrait and landscape                                  | Nothing overlaps or is cut off; bars clear of the notch and home indicator               |        |         |     |      |     |
| Tap a text field (search, checkout, eye test)                          | The page does not zoom; the field and the main button stay above the keyboard            |        |         |     |      |     |
| Swipe the sheet grip down                                              | Sheet follows the finger and closes; a short pull snaps back                             |        |         |     |      |     |
| Phone Back button or gesture with a sheet, the tour or the try-on open | It closes; Back again from the store leaves normally                                     |        |         |     |      |     |
| Swipe up on the 3D frame in the product sheet                          | The sheet scrolls                                                                        |        |         |     |      |     |
| Tap the floor, drag, pinch                                             | Ring shows, walks there; drag looks around without walking; pinch zooms                  |        |         |     |      |     |
| Section labels while walking                                           | Never on top of each other or under the bars or cards; at most 4 on a phone              |        |         |     |      |     |
| Rotate the phone with a sheet open                                     | Switches between bottom sheet and side panel without losing your place                   |        |         |     |      |     |
| Info → Picture quality                                                 | Automatic, High, Balanced, Battery saver all work                                        |        |         |     |      |     |
| Leave the app for a minute and come back (iOS especially)              | 3D view returns; if it shows "Restoring the 3D view…", it recovers                       |        |         |     |      |     |
| Walk around for 30 s                                                   | At least 30 fps on a budget phone (Battery saver if needed), 45 on mid-range             |        |         |     |      |     |
| Open the link from WhatsApp, then Try on                               | The site works; if the camera is blocked, the tip offers to copy the link or use a photo |        |         |     |      |     |
| Long-press the 3D view and buttons                                     | No callout, magnifier or text selection                                                  |        |         |     |      |     |
| Pull down on the top bar (Android)                                     | No pull-to-refresh                                                                       |        |         |     |      |     |

## Debugging on real devices

- **Android:** turn on USB debugging (Settings → Developer options), connect the phone by cable, open `chrome://inspect` in Chrome on the computer and click **inspect** under the page.
- **iPhone:** needs a Mac. On the iPhone: Settings → Safari → Advanced → Web Inspector. On the Mac: Safari → Develop → your iPhone → the page.
- **Many devices at once (optional, paid):** BrowserStack or LambdaTest.
