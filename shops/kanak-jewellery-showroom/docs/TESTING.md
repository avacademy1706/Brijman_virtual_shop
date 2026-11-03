# Testing

The project has two automated test suites and a short manual checklist.

| Suite                    | Tool                                 | What it covers                                                                                                                                             | Command            | Time                         |
| ------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------- |
| Unit tests               | [Vitest](https://vitest.dev)         | Catalogue and prices, floor plan and keep-out areas, the jewellery engine (every piece in every metal), try-on placement maths, thumbnails, security rules | `npm test`         | about 10 seconds             |
| Browser and device tests | [Playwright](https://playwright.dev) | The real site in Chromium on 12 screens (phones, tablets, laptops, large desktops) plus a browser without WebGL: layout, walking, try-on, headers          | `npm run test:e2e` | 10 to 40 minutes (see below) |
| Manual checks            | A real phone and a real camera       | Things a test cannot judge: how the metal and stones look, tracking a real face and hand                                                                   | see the checklist  | 10 minutes                   |

Run the unit tests after every change. Run the browser tests before every deployment to production.

---

## 1. Unit tests

```bash
npm test             # runs every unit test once
npm run test:watch   # re-runs the affected tests whenever you save a file
```

The tests live in `tests/unit/` and run in Node (no browser):

| File                   | Checks                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalogue.test.js`    | Every piece has a unique id, a name, a known type, salon, metals and stones, a valid try-on slot and default size. Every price breakdown adds up (metal weight × rate, making, stones, 3% GST); heavier metals, bigger sizes, bigger solitaires and better diamond quality cost more. Sets and displays use real pieces in metals they are offered in; counters hold no necklaces. |
| `store-layout.test.js` | A rotunda and eight rooms joined by arches, inside the bounds; side frames evenly spaced. Each section's viewpoint is inside the boutique and its own section, outside every fixture and keep-out area. The tour visits every section once. Every counter has a keep-out area behind it; the arch into every room is walkable.                                                     |
| `jewel.test.js`        | Every gem cut is a finite faceted stone; carat and millimetre conversions agree; the necklace path hangs lower the longer the chain. **Every piece builds in every metal** at store and viewer detail with finite bounds, a plausible size for its type, under the triangle budget, with its stones; earrings provide a single earring for the try-on.                             |
| `anchors.test.js`      | Try-on maths with synthetic landmarks: the face frame recovers turns and scale; earlobes, tikka, nath and neck land where they should; the far earring fades when the head turns; the necklace barely moves when the head turns; the ring sits on the ring finger with its head towards the camera; the bangle at the wrist; smoothing and the earring swing settle.               |
| `models.test.js`       | Imported 3D models: designer-style files (metres, named materials, a ring on its side, a pair of earrings, an OBJ in centimetres) import with the right units, sit within 2.5 mm of the built-in piece, keep ring size scaling, stone roles and sparkle, fit the triangle budgets, are skipped when unchanged, and a missing file falls back to the built-in piece.                |
| `drawings.test.js`     | Every piece draws a valid SVG thumbnail in every metal, with unique ids and nothing that could run script.                                                                                                                                                                                                                                                                         |
| `helpers.test.js`      | Rupee formatting with Indian digit grouping and HTML escaping.                                                                                                                                                                                                                                                                                                                     |
| `security.test.js`     | No credentials anywhere in the project or in the built site, no source maps in `dist/`, no `VITE_` variables in runtime code, `.env` files ignored by git and Vercel, a strict Content Security Policy and the other security headers, and no third-party requests in runtime code.                                                                                                |

`security.test.js` never opens a `.env` file. It only checks that such files are ignored.

### Adding a unit test

Create `tests/unit/<topic>.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { NY } from '../../src/core/ny.js';
import '../../src/data/catalogue.js';

describe('my topic', () => {
  it('does what it should', () => {
    expect(NY.byId.s01.price).toBeGreaterThan(0);
  });
});
```

Data modules attach to the shared `NY` object and run in Node, so import `src/core/ny.js` first and then the data files you need. The jewellery engine (`src/jewel/`) and the try-on maths (`src/tryon/anchors.js`) are plain JavaScript and can be imported directly.

---

## 2. Browser and device tests

### First run

```bash
npx playwright install chromium   # downloads the test browser once (about 150 MB)
npm run test:e2e                  # builds the site, starts a preview server and runs every browser test
npm run test:report               # opens the HTML report with screenshots of every screen
```

On Linux, if the browser reports missing system libraries, run `npx playwright install --with-deps chromium` once.

The tests run against the **production build** served by `vite preview`, which sends the same security headers as Vercel. If a preview server is already running on port 4173 the tests reuse it, so after a code change stop it (or build again) before testing.

### Screens covered

| Project             | Screen                | Size (CSS px) | Notes                                            |
| ------------------- | --------------------- | ------------- | ------------------------------------------------ |
| `phone-small`       | iPhone SE (1st gen)   | 320 × 568     | The smallest phone still in use                  |
| `phone`             | iPhone 13 / 14        | 390 × 664     | Notch and home bar emulated (safe areas)         |
| `phone-large`       | iPhone 15 Pro Max     | 430 × 739     | Dynamic Island and home bar emulated             |
| `android`           | Pixel 7               | 412 × 839     |                                                  |
| `phone-landscape`   | iPhone 13, landscape  | 750 × 342     | Notch at the side, home bar at the bottom        |
| `android-landscape` | Pixel 7, landscape    | 863 × 360     |                                                  |
| `tablet`            | iPad Mini             | 768 × 1024    |                                                  |
| `tablet-landscape`  | iPad Mini, landscape  | 1024 × 768    |                                                  |
| `tablet-large`      | iPad Pro 11           | 834 × 1194    |                                                  |
| `laptop`            | Laptop                | 1366 × 768    | Also runs the walking, security and try-on tests |
| `desktop`           | Full HD monitor       | 1920 × 1080   |                                                  |
| `desktop-xl`        | QHD monitor           | 2560 × 1440   |                                                  |
| `no-webgl`          | Browser without WebGL | 1366 × 768    | Floor-plan fallback                              |

All projects use Chromium with the device's size, pixel ratio and touch input. Notch and home-bar areas are emulated with Chromium's safe-area override, so the tests catch anything drawn under them.

### What the browser tests check

| File               | Checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout.spec.js`   | On every screen: the welcome card, the top bar, the floor plan, the section card, the corner button, the bottom bar, the product sheet with its 3D viewer, price breakdown and Add to bag button, the bag, today's rates and the settings panel all lie inside the safe area; floating controls never cover each other; the page never scrolls sideways; on touch screens buttons are at least 40 px; no errors in the console. A screenshot of each step goes into the report. |
| `walking.spec.js`  | Every section can be reached from the entrance, every keep-out area is closed and nothing outside the walls is walkable. One click on the floor only marks the spot; a second click walks there. A click while walking stops the walk. A tap on a wall or fixture stops square in front of it, at least 0.9 m back.                                                                                                                                                             |
| `tryon.spec.js`    | With Chrome's fake camera (a test pattern) the try-on opens with a bridal set, the camera starts and face tracking loads (or, if the models were not installed, a clear message and the 3D viewer are offered), the panel fits, and a ring can be added, on a laptop and a phone.                                                                                                                                                                                               |
| `security.spec.js` | The security headers are sent, every request during a visit goes to the site itself, and `.env`, `package.json` and `vercel.json` are not served.                                                                                                                                                                                                                                                                                                                               |
| `fallback.spec.js` | Without WebGL the floor plan appears, search and the product sheet work, and Add to bag works.                                                                                                                                                                                                                                                                                                                                                                                  |

### Useful commands

```bash
npm run test:devices                                  # only the layout test, on every screen
npx playwright test --project=phone                   # every test on one screen
npx playwright test --project=phone --project=laptop  # two screens
npx playwright test --ui                              # interactive runner: watch each step, time-travel screenshots
npx playwright test --headed --project=laptop         # watch the browser while it runs
npx playwright show-trace test-results/<folder>/trace.zip   # step-by-step replay of a failed test
```

Screenshots of every step are saved to `test-results/screens/<project>-<step>.png`.

### Why the browser tests take a while

The tests render the 3D store with software WebGL (SwiftShader), so they also run on machines and CI runners without a graphics card. On a recent laptop the full run takes about 10 minutes; on a small cloud machine up to 40. `playwright.config.js` runs two tests at a time (raise `workers` on a fast machine) and gives the two large-desktop screens a longer time limit, since they render the most pixels.

### Try-on without a camera

The browser test cannot show a real face to the fake camera, so placement is covered by `anchors.test.js` and by the simulator: with `npm run dev`, open `/tools/tryon-sim.html`. It runs the real try-on module on a painted mannequin with synthetic face and hand landmarks. Useful addresses:

| Address                                          | Shows                                                       |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `/tools/tryon-sim.html?set=rajwada`              | The Rajwada bridal set (chandbalis, rani haar, tikka, nath) |
| `/tools/tryon-sim.html?set=temple&yaw=25`        | Head turned 25°: the necklace stays put, earrings follow    |
| `/tools/tryon-sim.html?set=temple&move=1`        | Head swaying: the earrings swing                            |
| `/tools/tryon-sim.html?pid=s02&hand=1`           | A ring on the ring finger                                   |
| `/tools/tryon-sim.html?pid=p05&hand=1&handY=500` | Bangles at the wrist                                        |

Use Chrome's device toolbar to check phone, tablet and desktop sizes. See [TRYON.md](TRYON.md) for tuning.

---

## 3. Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request on GitHub:

1. `npm ci`, then `npm run format:check`
2. `npm test` (unit tests)
3. `npm run build` and `npm run check`

The browser tests run when you start the workflow by hand (**Actions → CI → Run workflow**, tick **Run browser tests**), because they take longer. The HTML report is attached to the run as an artifact.

If the repository is connected to Vercel, Vercel still deploys every push. To block deployments when tests fail, see [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md#7-deploy-only-when-tests-pass).

---

## 4. Manual checklist (before a client demo or a production deploy)

Use a real phone on the Vercel preview URL (the camera needs HTTPS) and a laptop.

**Boutique**

- [ ] Welcome card, tour start, Explore on my own.
- [ ] Double-click (double-tap on a phone) the floor to walk; a single click only marks the spot.
- [ ] Double-click a wall, a poster or a fixture: you walk to a spot square in front of it, a little way back, and face it. Double-click the floor right by a wall: you stop about a metre short of it.
- [ ] Try to walk behind a salon counter, the concierge desk and the lounge sofa with the keys: you cannot.
- [ ] Tap a necklace on a bust, a ring on a block, earrings on a stand and a bangle in a case; the product sheet opens.
- [ ] The Rani Haar turns under the dome; diamonds sparkle as you walk past.
- [ ] Section card closes by itself after six seconds; the corner button offers the section's action.

**Product sheet**

- [ ] Drag to turn the piece, pinch or scroll to zoom. Metals look like metal (no black or copper flat areas), stones are bright with colour fire.
- [ ] Change metal, carat, diamond quality, stone and size: the piece rebuilds and the price breakdown follows.
- [ ] Today's rates (foyer board or bottom bar) match the prices in the breakdown.

**Camera try-on (good light, one person in view)**

- [ ] Open a bridal set from the lounge; Start camera; allow the camera; earrings, necklace, tikka and nath appear within a few seconds.
- [ ] Turn your head slowly left and right: earrings swing and the far one disappears behind your head; the necklace stays on your neck.
- [ ] Choose Ring, hold up your hand with its back to the camera: the ring sits on your ring finger; choose Bangle: it sits at your wrist and the back half hides behind your arm.
- [ ] On a phone or a portrait tablet the panel folds down once you are found; tap the handle or a tab to open it.
- [ ] Change metal and stone, take a photo, add everything to the bag.

**Every screen**

- [ ] Rotate the phone to landscape and back; nothing is cut off or hidden behind the notch.
- [ ] On an iPad and a laptop, open the product sheet and the bag.

**Security**

- [ ] Browser console: no errors except one blocked request to `odml.pa.googleapis.com` after the try-on starts (MediaPipe's usage statistics, blocked on purpose).
- [ ] `npm run check` passes (the two tracking models are installed and match `models/models.lock.json`).
- [ ] `npm test` passes, including `security.test.js`.
