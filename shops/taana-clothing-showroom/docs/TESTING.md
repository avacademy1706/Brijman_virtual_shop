# Testing

The project has two automated test suites and a short manual checklist.

| Suite                    | Tool                                 | What it covers                                                                                                                                    | Command            | Time                         |
| ------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------- |
| Unit tests               | [Vitest](https://vitest.dev)         | Catalogue and size charts, floor plan and keep-out areas, cloth engine, garment patterns, baked drapes, helpers, security rules                   | `npm test`         | about 1 minute               |
| Browser and device tests | [Playwright](https://playwright.dev) | The real site in Chromium on 12 screens (phones, tablets, laptops, large desktops) plus a browser without WebGL: layout, walking, try-on, headers | `npm run test:e2e` | 10 to 40 minutes (see below) |
| Manual checks            | A real phone and a real camera       | Things a test cannot judge: how the fabric looks and moves, tracking a real person                                                                | see the checklist  | 10 minutes                   |

Run the unit tests after every change. Run the browser tests before every deployment to production.

---

## 1. Unit tests

```bash
npm test             # bakes the drapes if needed, then runs every unit test once
npm run test:watch   # re-runs the affected tests whenever you save a file
```

The tests live in `tests/unit/` and run in Node (no browser):

| File                   | Checks                                                                                                                                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalogue.test.js`    | Every product has a unique id, a name, a whole-rupee price, valid colours, a known fabric, template, size chart and section. Sizes grow in chest and length. The recommended size never shrinks for a bigger chest. Every garment is shown somewhere in the store.                    |
| `store-layout.test.js` | Sections lie inside the store and do not overlap; each section's viewpoint is inside that section, outside every fixture and keep-out area. The tour visits every section once. Keep-out areas close the spaces behind the counter, desk and dress forms but leave their fronts open. |
| `garments.test.js`     | Every product builds a valid cloth mesh at phone and desktop resolution, in its smallest and largest size. A ray dropped onto the top of each shoulder must hit fabric (no open shoulder seams). Settled garments stay outside the mannequin.                                         |
| `cloth-sim.test.js`    | Every fabric preset stays stable during a fast spin. Cloth rests in the same shape whatever the frame timing (no shaking on 120 Hz or busy screens) and stays still once at rest. Collisions push fabric out of spheres and capsules and respect collision groups.                    |
| `body.test.js`         | Body proportions, the sloped shoulder line, collision shapes (each with a group), body frames, measurements from a camera pose, and bodies built from a shopper's height, chest, waist and hip.                                                                                       |
| `drapes.test.js`       | The baked drapes exist, cover every hanger garment and mannequin look, and have exactly the particle counts the browser builds. Decoded positions are finite and inside their bounds.                                                                                                 |
| `helpers.test.js`      | Rupee formatting with Indian digit grouping and HTML escaping.                                                                                                                                                                                                                        |
| `security.test.js`     | No credentials anywhere in the project or in the built site, no source maps in `dist/`, no `VITE_` variables in runtime code, `.env` files ignored by git and Vercel, a strict Content Security Policy and the other security headers, and no third-party requests in runtime code.   |

`security.test.js` never opens a `.env` file. It only checks that such files are ignored.

### Adding a unit test

Create `tests/unit/<topic>.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { NY } from '../../src/core/ny.js';
import '../../src/data/catalogue.js';

describe('my topic', () => {
  it('does what it should', () => {
    expect(NY.byId.k01.price).toBeGreaterThan(0);
  });
});
```

Data modules attach to the shared `NY` object and run in Node, so import `src/core/ny.js` first and then the data files you need. The cloth engine (`src/cloth/`) is plain JavaScript and can be imported directly.

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

| File               | Checks                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout.spec.js`   | On every screen: the welcome card, the top bar, the floor plan, the section card, the corner button, the bottom bar, the product sheet with its Add to bag button, the bag and the settings panel all lie inside the safe area; floating controls never cover each other; the page never scrolls sideways; on touch screens buttons are at least 40 px; no errors in the console. A screenshot of each step goes into the report. |
| `walking.spec.js`  | Every section can be reached from the entrance and every keep-out area is closed. One click on the floor only marks the spot; a second click walks there. A click while walking stops the walk. A tap on a wall or fixture stops square in front of it, at least 0.9 m back.                                                                                                                                                      |
| `tryon.spec.js`    | With Chrome's fake camera (a test pattern) the try-on opens, the pose model loads and the camera starts, on a laptop and a phone.                                                                                                                                                                                                                                                                                                 |
| `security.spec.js` | The security headers are sent, every request during a visit goes to the site itself, and `.env`, `package.json` and `vercel.json` are not served.                                                                                                                                                                                                                                                                                 |
| `fallback.spec.js` | Without WebGL the floor plan appears, search and the product sheet work, and Add to bag works.                                                                                                                                                                                                                                                                                                                                    |

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

**Store**

- [ ] Welcome card, tour start, Explore on my own.
- [ ] Double-click (double-tap on a phone) the floor to walk; a single click only marks the spot.
- [ ] Double-click a wall, a poster or a fixture: you walk to a spot square in front of it, a little way back, and face it. Double-click the floor right by a wall: you stop about a metre short of it.
- [ ] Try to walk behind the checkout counter, the stylist desk and the dress forms with the keys: you cannot.
- [ ] Tap a garment on a hanger, a folded stack and a mannequin; the product sheet opens.
- [ ] Section card closes by itself after five seconds; the corner button offers the section's action.

**Product viewer**

- [ ] Still, Turn, Walk and Twirl modes; drag to spin and flick hard: the fabric swings and settles without wobbling.
- [ ] Change colour and size; the cloth rebuilds. Dupattas: switch Stole and One shoulder.
- [ ] Look closely at the shoulders and armholes: no dark gaps.

**Camera try-on (one person in view)**

- [ ] Start camera; allow the camera; the garment appears on you within a few seconds.
- [ ] Raise your arms, turn sideways: the sleeves follow, nothing tears at the shoulders.
- [ ] Change size and colour, add a jacket or dupatta, take a photo.

**Every screen**

- [ ] Rotate the phone to landscape and back; nothing is cut off or hidden behind the notch.
- [ ] On an iPad and a laptop, open the product sheet and the bag.

**Security**

- [ ] Browser console: no errors except one blocked request to `odml.pa.googleapis.com` after the try-on starts (MediaPipe's usage statistics, blocked on purpose).
- [ ] `npm test` passes, including `security.test.js`.
