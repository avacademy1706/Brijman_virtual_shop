# Setting up in VS Code

A step-by-step guide from an empty computer to the showroom running locally, with tests and debugging. Windows, macOS and Linux work the same way; commands are typed in the VS Code terminal.

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

1. Unzip `taana-clothing-showroom.zip` into a folder, preferably one whose path has no spaces, for example `C:\Projects\taana-clothing-showroom` or `~/Projects/taana-clothing-showroom`.
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
npm run dev     # starts the showroom at http://localhost:5173
```

Before the dev server starts, two setup steps run on their own:

1. **Bake drapes** (`scripts/bake-drapes.mjs`, about 20 s the first time): simulates every garment on its hanger or mannequin once and stores the result in `public/drapes/`. It is skipped when nothing relevant changed.
2. **Try-on setup** (`scripts/setup-tryon.mjs`, about 10 s the first time): copies the MediaPipe runtime into `public/vendor/` and downloads the two pose models (about 15 MB) into `public/models/`.

Open http://localhost:5173 in Chrome. The camera try-on works on `localhost` without HTTPS.

Stop the server with <kbd>Ctrl</kbd>+<kbd>C</kbd> in the terminal.

### Run tasks without typing

**Terminal → Run Task…** lists the ready-made tasks from `.vscode/tasks.json`:

| Task                             | Same as                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| Start showroom (dev server)      | `npm run dev` (also <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>) |
| Build for production             | `npm run build`                                                    |
| Preview production build         | `npm run preview`                                                  |
| Run unit tests                   | `npm test`                                                         |
| Run browser tests on all screens | `npm run test:e2e`                                                 |
| Open browser test report         | `npm run test:report`                                              |

---

## 4. Debug in the browser from VS Code

1. Start the dev server (`npm run dev`).
2. Open **Run and Debug** (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd>) and pick **Debug showroom in Chrome** (or Edge), then press <kbd>F5</kbd>.
3. Set breakpoints in any file under `src/`; they stop in VS Code while you use the showroom in the launched browser.

To debug a unit test, open it, and in the **Testing** panel right-click the test and choose **Debug Test**.

Handy in the browser console: `NY.api.where()` (your position), `NY.api.stats()` (draw calls, triangles, live cloth), `NY.api.navGrid()` (walk grid), `NY.tryonState` (try-on state), `NY.byId.k01` (a product).

---

## 5. Test

```bash
npm test                          # unit tests, about 1 minute
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

The terminal prints a **Network** address such as `http://192.168.1.20:5173`. Open it on a phone on the same Wi-Fi to walk the store. The phone camera needs HTTPS, so for the try-on use a Vercel preview deployment ([DEPLOY-VERCEL.md](DEPLOY-VERCEL.md#5-testing-on-phones-before-going-live)). Only expose the dev server on a network you trust.

To check the phone layouts on your computer, use Chrome DevTools: <kbd>F12</kbd>, then the device toolbar (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd>), and pick a device. See [RESPONSIVE.md](RESPONSIVE.md) for what to look at.

---

## 7. Build and deploy

```bash
npm run build     # production site in dist/
npm run preview   # serves dist/ at http://localhost:4173 with the same security headers as Vercel
npm run check     # confirms the drapes, the WebAssembly runtime and the pose models are in place
```

Then follow [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md).

---

## 8. Project map

```
index.html               page shell: top bar, floor plan, cards, bottom bar, sheet
src/main.js              entry: styles, interface, then the 3D scene (loaded on demand)
src/ui/app.js            panels, product sheet, bag, checkout demo, settings, floor plan, try-on hand-off
src/scene/showroom.js    the 3D store: fixtures, garments, walking, picking, camera, product viewer
src/data/catalogue.js    products, size charts, what hangs where
src/data/store-layout.js floor plan, sections, tour, fixtures, keep-out areas
src/cloth/               cloth engine: solver, body, garment patterns, poses, rendering
src/tryon/               camera try-on: pose tracking and the cloth overlay
src/styles/main.css      all styles, including the phone, tablet and landscape layouts
scripts/                 drape bake, try-on setup, asset check
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
| `[setup-tryon] … download failed`                        | No internet or the download was blocked. The store works; the try-on needs the model. Run `npm run setup:tryon` again when online.                |
| Browser tests: "Executable doesn't exist"                | Run `npx playwright install chromium`.                                                                                                            |
| Blank 3D view                                            | The browser has WebGL off (check `chrome://gpu`). The floor plan fallback still works.                                                            |
