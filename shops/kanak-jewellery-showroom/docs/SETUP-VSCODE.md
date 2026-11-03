# Setting up in VS Code

A step-by-step guide from an empty computer to the boutique running locally, with tests and debugging. Windows, macOS and Linux work the same way; commands are typed in the VS Code terminal.

---

## 1. Install the tools (once)

| Tool          | Version                            | Download                           | Check in a terminal |
| ------------- | ---------------------------------- | ---------------------------------- | ------------------- |
| Node.js       | 22.12 up to 24; 24 LTS recommended | https://nodejs.org (LTS installer) | `node -v`, `npm -v` |
| VS Code       | Any recent version                 | https://code.visualstudio.com      | `code --version`    |
| Git           | Any recent version                 | https://git-scm.com                | `git --version`     |
| Google Chrome | Any recent version (for debugging) | https://www.google.com/chrome      |                     |

On Windows, tick **Add to PATH** in the Node.js installer, then restart VS Code so its terminal picks up `node` and `npm`. If you use nvm, `nvm use` reads the version from `.nvmrc`.

---

## 2. Open the project

1. Unzip `kanak-jewellery-showroom.zip` into a folder, preferably one whose path has no spaces, for example `C:\Projects\kanak-jewellery-showroom` or `~/Projects/kanak-jewellery-showroom`.
2. In VS Code choose **File → Open Folder…** and select that folder (the one containing `package.json`).
3. When VS Code asks **Do you trust the authors?**, choose **Yes**.
4. VS Code offers to install the **recommended extensions**. Accept. They are listed in `.vscode/extensions.json`:

   | Extension       | What it does here                                                           |
   | --------------- | --------------------------------------------------------------------------- |
   | Prettier        | Formats every file on save (settings in `.prettierrc.json`)                 |
   | EditorConfig    | Line endings and indentation from `.editorconfig`                           |
   | Vitest          | Runs and debugs unit tests from the Testing panel (flask icon)              |
   | Playwright Test | Runs the browser tests from the Testing panel, with a "show browser" option |

5. Open a terminal: **Terminal → New Terminal** (or <kbd>Ctrl</kbd>+<kbd>`</kbd>).

---

## 3. Install and run

```bash
npm ci          # first time: exact versions from package-lock.json (about 1 minute)
npm run dev     # starts the boutique at http://localhost:5173
```

Before the dev server starts, the **try-on setup** (`scripts/setup-tryon.mjs`, about 10 s the first time) runs on its own: it copies the MediaPipe runtime into `public/vendor/` and downloads the face and hand tracking models (about 12 MB) into `public/models/`. Without internet the boutique still works and the try-on explains that the models are missing; run `npm run setup:tryon` later.

Open http://localhost:5173 in Chrome. The camera try-on works on `localhost` without HTTPS.

Stop the server with <kbd>Ctrl</kbd>+<kbd>C</kbd> in the terminal.

### Run tasks without typing

**Terminal → Run Task…** lists the ready-made tasks from `.vscode/tasks.json`:

| Task                             | Same as                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| Start boutique (dev server)      | `npm run dev` (also <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>) |
| Build for production             | `npm run build`                                                    |
| Preview production build         | `npm run preview`                                                  |
| Run unit tests                   | `npm test`                                                         |
| Run browser tests on all screens | `npm run test:e2e`                                                 |
| Open browser test report         | `npm run test:report`                                              |

---

## 4. Debug in the browser from VS Code

1. Start the dev server (`npm run dev`).
2. Open **Run and Debug** (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd>) and pick **Debug boutique in Chrome** (or Edge), then press <kbd>F5</kbd>.
3. Set breakpoints in any file under `src/`; they stop in VS Code while you use the boutique in the launched browser.

To debug a unit test, open it, and in the **Testing** panel right-click the test and choose **Debug Test**.

Handy in the browser console: `NY.api.where()` (your position), `NY.api.stats()` (draw calls, triangles, sparkles), `NY.api.navGrid()` (walk grid), `NY.byId.p01` (a product), `NY.priceOf(NY.byId.s01)` (a price breakdown).

### Development pages

With the dev server running:

| Page                                       | What it is for                                                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| http://localhost:5173/tools/gallery.html   | Every piece in the studio viewer, with metal, stone and detail switches. `?id=p01` opens one piece.                     |
| http://localhost:5173/tools/tryon-sim.html | The real try-on on a painted mannequin with synthetic tracking. `?set=rajwada`, `?pid=s02&hand=1`, `?yaw=25`, `?move=1` |

`node tools/piece-report.mjs` prints the price, weight, triangle count and size of every piece. None of these are part of the production build.

---

## 5. Test

```bash
npm test                          # unit tests, about 10 seconds
npx playwright install chromium   # once, before the first browser test run
npm run test:e2e                  # every browser test on 12 screens plus a no-WebGL browser
npm run test:report               # report with screenshots of every screen
```

Details, the list of screens and the manual checklist are in [TESTING.md](TESTING.md).

---

## 6. Try it on your phone

```bash
npm run dev:phone
```

The terminal prints a **Network** address such as `http://192.168.1.20:5173`. Open it on a phone on the same Wi-Fi to walk the boutique. The phone camera needs HTTPS, so for the try-on use a Vercel preview deployment ([DEPLOY-VERCEL.md](DEPLOY-VERCEL.md#5-testing-on-phones-before-going-live)). Only expose the dev server on a network you trust.

To check the phone layouts on your computer, use Chrome DevTools: <kbd>F12</kbd>, then the device toolbar (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd>), and pick a device. See [RESPONSIVE.md](RESPONSIVE.md) for what to look at.

---

## 7. Build and deploy

```bash
npm run build     # production site in dist/
npm run preview   # serves dist/ at http://localhost:4173 with the same security headers as Vercel
npm run check     # confirms the fonts, the WebAssembly runtime and the two tracking models are in place
```

Then follow [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md).

---

## 8. Project map

```
index.html               page shell: top bar, floor plan, cards, bottom bar, sheet
src/main.js              entry: fonts and styles, interface, then the 3D scene (loaded on demand)
src/ui/app.js            panels: product configurator and price breakdown, sets, bag, checkout and appointment demos,
                         rates, size guide, settings, floor plan, try-on hand-off
src/scene/               the 3D boutique: architecture, fixtures, display stands, walking, picking, product viewer
src/jewel/               the jewellery engine: stones, metals, gem shader, builders for every kind of piece, sparkle
src/data/catalogue.js    pieces, metal rates, stone prices, size charts, bridal sets, what is displayed where
src/data/store-layout.js floor plan, sections, tour, fixtures, keep-out areas
src/tryon/               camera try-on: face and hand tracking, placement maths, the overlay and its panel
src/styles/main.css      all styles, including the phone, tablet and landscape layouts (tryon.css for the try-on)
scripts/                 try-on setup, asset check
tools/                   development pages: gallery, try-on simulator, piece report
tests/unit/              unit tests (Vitest)
tests/e2e/               browser and device tests (Playwright)
docs/                    these guides
vercel.json              Vercel build settings and security headers
```

`README.md` describes the store and the engine in more depth; `CLAUDE.md` is the working guide for Claude Code.

---

## 9. Common problems

| Problem                                                  | Fix                                                                                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'npm' is not recognized` / `command not found: npm`     | Node.js is not installed or VS Code was open during the install. Install Node.js, restart VS Code.                                                |
| `npm ci` fails behind a company proxy                    | Set the proxy: `npm config set proxy http://proxy:port` and `npm config set https-proxy http://proxy:port`.                                       |
| Port 5173 already in use                                 | Another dev server is running. Stop it, or run `npx vite --port 5174`.                                                                            |
| PowerShell: "running scripts is disabled on this system" | Run once in PowerShell as administrator: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, or switch the VS Code terminal to Command Prompt. |
| `[setup-tryon] could not download …`                     | No internet or the download was blocked. The boutique works; the try-on needs the models. Run `npm run setup:tryon` again when online.            |
| Browser tests: "Executable doesn't exist"                | Run `npx playwright install chromium`.                                                                                                            |
| Blank 3D view                                            | The browser has WebGL off (check `chrome://gpu`). The floor plan fallback still works.                                                            |
