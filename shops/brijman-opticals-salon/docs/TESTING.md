# Testing

The project has two automated test suites and a short manual checklist.

| Suite                    | Tool                                 | What it covers                                                                                                                                         | Command            | Time                         |
| ------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ---------------------------- |
| Unit tests               | [Vitest](https://vitest.dev)         | Floor plan and sections, catalogue, sizes and prices, frame geometry at real size, the salon build and its display slots, try-on maths, security rules | `npm test`         | about 5 seconds              |
| Browser and device tests | [Playwright](https://playwright.dev) | The real site in Chromium on 12 screens (phones, tablets, laptops, large desktops) plus a browser without WebGL: layout, walking, try-on, headers      | `npm run test:e2e` | 10 to 40 minutes (see below) |
| Manual checks            | A real phone and a real camera       | Things a test cannot judge: how the salon looks, tracking a real face, the size suggestion against a tape measure                                      | see the checklist  | 10 minutes                   |

Run the unit tests after every change. Run the browser tests before every deployment to production.

---

## 1. Unit tests

```bash
npm test             # runs every unit test once
npm run test:watch   # re-runs the affected tests whenever you save a file
```

The tests live in `tests/unit/` and run in Node (no browser):

| File                   | Checks                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `store-layout.test.js` | The visitor starts at the entrance, clear of fixtures; every fixture is inside the room; the eight arched niches fit the wall and every shelf is in their straight part; the kids' niche is at a child's eye level; walkways are at least 1.4 m. Sections cover the floor without overlapping; each viewpoint is free, in its own section and reachable from the entrance; the tour visits every section once.   |
| `catalogue.test.js`    | 41 frames with complete data; every frame in every colour is on display somewhere; every fixture is filled exactly; styles sit in their own section. Sizes: S < M < L, M is the catalogue size, the suggested size is the closest width, kids' sizes are named XS, S and M, the size does not change the price and shows in the order summary. Lens options add up.                                              |
| `frames.test.js`       | Every frame archetype builds lenses, a front and 14 cm temples with finite geometry. Every product is drawn at its real lens width, and its drawn hinge-to-hinge width equals the width the fit guide uses (within 1.5 mm). Thumbnails and size diagrams are valid SVG with nothing that could run script.                                                                                                       |
| `salon.test.js`        | The whole salon builds in Node: each fixture gives exactly as many display slots as its merchandising list, every slot lies in its section, frames fit inside the niches temples included, island blocks clear the lamp, the scene draws in 20 to 60 batches, and the try-on mirror, directory, lens samples and checkout are tap targets.                                                                       |
| `anchors.test.js`      | Try-on maths on the same synthetic face the simulator paints: face axes and head turns; face width and PD measured to within a millimetre at three face sizes and distances; measuring only while facing the camera; the scale holds when the head turns; the frame sits 12 mm in front of the eyes, centred between the pupils and never inside the bridge of the nose, at three head turns; smoothing settles. |
| `helpers.test.js`      | Rupee formatting with Indian digit grouping and HTML escaping.                                                                                                                                                                                                                                                                                                                                                   |
| `security.test.js`     | No credentials anywhere in the project or in the built site, no source maps in `dist/`, no `VITE_` variables in runtime code, `.env` files ignored by git and Vercel, a strict Content Security Policy and the other security headers, and no third-party requests in runtime code.                                                                                                                              |

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

Data modules attach to the shared `NY` object and run in Node, so import `src/core/ny.js` first and then the data files you need. The frame geometry (`src/frames/geometry.js`), the salon builder (`src/scene/salon.js`) and the try-on maths (`src/tryon/anchors.js`) import directly; see `salon.test.js` for building the scene without a browser.

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

| File               | Checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout.spec.js`   | On every screen: the welcome card, the top bar, the floor plan, the section card, the bottom bar, the product sheet with its 3D viewer, size chips and Add to bag button, the bag (showing the chosen size), the directory and the store details all lie inside the safe area; floating controls never cover each other; the page never scrolls sideways; on touch screens buttons are at least 40 px; no errors in the console. A screenshot of each step goes into the report. |
| `walking.spec.js`  | Every section can be reached from the entrance, nothing inside the false walls is walkable, a tap on the floor walks there, and a tap on a poster stops square in front of it, 1.3 to 2.8 m away.                                                                                                                                                                                                                                                                                |
| `tryon.spec.js`    | With Chrome's fake camera (a test pattern) the try-on opens with the chosen frame and size, the camera starts and face tracking loads (or, if the model was not installed, a clear message and the 3D viewer are offered, which opens the product in the same size), the panel fits, and a size can be changed and added to the bag, on a laptop and a phone.                                                                                                                    |
| `security.spec.js` | The security headers are sent, every request during a visit goes to the site itself, and `.env`, `package.json` and `vercel.json` are not served.                                                                                                                                                                                                                                                                                                                                |
| `fallback.spec.js` | Without WebGL the floor plan appears, search and the product sheet work, and Add to bag works.                                                                                                                                                                                                                                                                                                                                                                                   |

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

The tests render the 3D salon with software WebGL (SwiftShader), so they also run on machines and CI runners without a graphics card. On a recent laptop the full run takes about 10 minutes; on a small cloud machine up to 40. `playwright.config.js` runs two tests at a time (raise `workers` on a fast machine) and gives the two large-desktop screens a longer time limit, since they render the most pixels.

### Try-on without a camera

The browser test cannot show a real face to the fake camera, so placement and measurement are covered by `anchors.test.js` and by the simulator: with `npm run dev`, open `/tools/tryon-sim.html`. It runs the real try-on module on a painted face with synthetic landmarks. Useful addresses:

| Address                                             | Shows                                                                        |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `/tools/tryon-sim.html?pid=w01`                     | Mira, a cat-eye, facing the camera                                           |
| `/tools/tryon-sim.html?pid=s04&yaw=25`              | Round sunglasses with the head turned: the far temple hides                  |
| `/tools/tryon-sim.html?pid=m01&move=1`              | The head turning slowly                                                      |
| `/tools/tryon-sim.html?pid=s01&temples=128&pd=60`   | A narrow face: after a moment the try-on measures 128 mm and suggests size S |
| `/tools/tryon-sim.html?pid=w03&size=L&tryondebug=1` | Size L with the tracked landmarks drawn as dots                              |

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

**Salon**

- [ ] Welcome card, tour start, Explore on my own.
- [ ] Tap the floor to walk; try to walk through an island, the counter or a chair with the keys: you cannot.
- [ ] Tap a poster, an arched niche (between frames), the Atelier wall and a bare wall: you stop square in front of each, far enough back to see it whole above the section card. Tap the floor right by a wall: you stop about a metre short of it.
- [ ] Tap a frame on an island block, in an arched niche, on the Atelier wall and in the kids' niche; the product sheet opens.
- [ ] Tap the round mirror in the lounge; the try-on opens. Tap the directory screen by the door; the directory opens.
- [ ] Marble, oak, travertine and velvet read as those materials; the niches and the Atelier wall look lit.

**Product sheet**

- [ ] Drag to turn the frame, pinch or scroll to zoom. Change colour and size: the frame changes and the size drawing follows.
- [ ] Choose a lens type, thickness and coatings: the price follows. Enter a prescription; errors are explained.

**Camera try-on (good light, one person in view)**

- [ ] Start camera; allow the camera; the frame appears on your face within a few seconds.
- [ ] Look straight at the camera: within a second the face width and PD appear and a size is suggested. Check the face width against a tape measure held across your temples; it should be within about 3 mm.
- [ ] Turn your head slowly left and right: the frame follows and the far temple disappears behind your head.
- [ ] Try S, M and L: the frame visibly narrows and widens. Try sunglasses: your eyes stay faintly visible.
- [ ] On a phone or a portrait tablet the panel folds down once you are found; tap the handle to open it.
- [ ] Take a photo, add the frame to the bag; in a prescription, the PD button offers the measured value.

**Every screen**

- [ ] Rotate the phone to landscape and back; nothing is cut off or hidden behind the notch.
- [ ] On an iPad and a laptop, open the product sheet and the bag.

**Security**

- [ ] Browser console: no errors except one blocked request to `odml.pa.googleapis.com` after the try-on starts (MediaPipe's usage statistics, blocked on purpose).
- [ ] `npm run check` passes (the face tracking model is installed and matches `models/models.lock.json`).
- [ ] `npm test` passes, including `security.test.js`.
