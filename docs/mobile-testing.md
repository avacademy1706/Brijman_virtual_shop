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

The fixes and the after figures are below once the work is complete.
