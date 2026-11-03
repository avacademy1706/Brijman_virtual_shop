# Taana Studio · Virtual Clothing Showroom

A walkable 3D clothing showroom for the web, with **live cloth simulation** and a **camera try-on**. Visitors walk the store (double-click or double-tap the floor, drag to look around), browse eleven sections, and tap any garment to see it on a mannequin whose fabric is simulated in real time. From the product sheet, the fitting room or the top bar they can turn on their camera: the garment drapes over them and moves as they move, in their chosen size and colour, with a jacket or dupatta layered on top if they like.

It is a static site built with [Vite](https://vite.dev), [three.js](https://threejs.org) and [MediaPipe Pose](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker). It has no backend, needs no secrets and deploys to Vercel as-is. Video never leaves the visitor's device.

> **Sample data.** "Taana Studio", the garments, prices and stock are placeholders. Checkout and alteration booking are demos: they take no payment and create no booking. See [Customise for a client](#8-customise-for-a-client).

## Guides

| Guide                                          | Read it to                                                                                          |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [docs/SETUP-VSCODE.md](docs/SETUP-VSCODE.md)   | Install the tools, open the project in VS Code, run it, debug it                                    |
| [docs/TESTING.md](docs/TESTING.md)             | Run the unit tests and the browser tests on 12 screen sizes; manual checklist before a demo         |
| [docs/RESPONSIVE.md](docs/RESPONSIVE.md)       | See how the layout adapts to phones, tablets, laptops and large screens, and keep it that way       |
| [docs/DEPLOY-VERCEL.md](docs/DEPLOY-VERCEL.md) | Deploy to Vercel from GitHub or the command line, add a domain, gate deploys on tests               |
| [CLAUDE.md](CLAUDE.md)                         | Working guide for Claude Code (architecture, conventions, pitfalls)                                 |
| [docs/prompts/](docs/prompts/README.md)        | Hand Claude Code a ready task: run every test and fix failures, or audit the layout on every screen |

---

## What you need

| Tool           | Version                                 | Get it                                        |
| -------------- | --------------------------------------- | --------------------------------------------- |
| Node.js        | 22.12 up to 24 (24 LTS recommended)     | https://nodejs.org (choose the LTS installer) |
| VS Code        | Any recent version                      | https://code.visualstudio.com                 |
| Git            | Any recent version (for GitHub deploys) | https://git-scm.com                           |
| Vercel account | Free Hobby plan is enough for a demo    | https://vercel.com/signup                     |

```bash
node -v   # should print v22.12.0 or higher, up to v24
```

---

## 1. Open the project in VS Code

1. Unzip `taana-clothing-showroom.zip`, for example to `C:\Projects\taana-clothing-showroom`.
2. In VS Code choose **File → Open Folder…** and pick that folder.
3. Install the recommended extensions when VS Code offers them (Prettier, EditorConfig).
4. Open a terminal with **Terminal → New Terminal**.

## 2. Run it on your computer

```bash
npm ci        # first time: installs the exact versions in package-lock.json
npm run dev   # starts the dev server at http://localhost:5173
```

Before the dev server starts, two setup steps run automatically:

| Step         | Script                    | What it does                                                                                                                                                                                                       | Time                 |
| ------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| Bake drapes  | `scripts/bake-drapes.mjs` | Simulates every garment once (on hangers and mannequins) and stores the resting shapes in `public/drapes/drapes.bin`. Skipped when nothing relevant changed.                                                       | ~15 s when needed    |
| Try-on setup | `scripts/setup-tryon.mjs` | Copies the MediaPipe WebAssembly runtime from `node_modules` into `public/vendor/`, and downloads the two Pose models (about 15 MB) from Google's official model bucket into `public/models/` if they are missing. | ~10 s the first time |

The camera works on **http://localhost** (browsers treat it as secure). On another device you need HTTPS; see [Test on a phone](#test-on-a-phone).

### Test on a phone

`npm run dev:phone` exposes the dev server on your Wi-Fi, so you can walk the store on a phone. **Phone cameras only work over HTTPS**, so for the try-on use a Vercel preview deployment (step 4) or an HTTPS tunnel of your choice. Only expose the dev server on a network you trust.

## 3. Build, check and test

```bash
npm run build     # bake + try-on setup + optimised site in dist/
npm run preview   # serves dist/ at http://localhost:4173 with the same security headers as Vercel
npm run check     # confirms the drapes, the WebAssembly runtime and the pose models are in place
npm test          # unit tests (about 1 minute)
npm run test:e2e  # browser tests on phones, tablets and desktops (first run: npx playwright install chromium)
```

See [docs/TESTING.md](docs/TESTING.md) for what each test covers.

## 4. Deploy to Vercel

The step-by-step guide, including custom domains, phone testing on preview URLs and gating deploys on tests, is [docs/DEPLOY-VERCEL.md](docs/DEPLOY-VERCEL.md). In short:

**From GitHub (recommended).** Push the folder to a GitHub repository, then in Vercel choose **Add New → Project**, import the repository and click **Deploy**. `vercel.json` already sets the framework, the build command and the security headers. There are no environment variables to add.

**From the command line.**

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production
```

The Vercel build runs the same setup as your computer, including the model download from `storage.googleapis.com`. Node 24 is used automatically (from `engines` in `package.json`).

**Pin the models.** Your first `npm run dev` creates `models/models.lock.json` with the SHA-256 of the two downloaded models. Commit it: from then on every build, including Vercel's, refuses a model that does not match.

## 5. What is in the store

Arriving at a section shows its card for five seconds (hovering it keeps it open). Wherever a visitor stands, a small button in the bottom-right corner offers that section's main action (browse its styles, see the looks, start the try-on, open the bag), so everything is reachable with ordinary clicks as well as by tapping the 3D view.

| #   | Section                       | What's there                                                                                              |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Welcome & Directory           | Stylist desk, directory screen with the floor plan                                                        |
| 2   | Festive Edit                  | Turntable podium with three **live-simulated** looks under the ring light                                 |
| 3   | Women · Ethnic                | Three wall bays: face-out display, side-hung rail, folded stacks                                          |
| 4   | Kids                          | Low rail and a round table of folded tees                                                                 |
| 5   | Denim & Basics                | Two-tier table folded by colour, mannequin in a denim shirt                                               |
| 6   | Women · Western               | Wall bay, folded tees, midi dress on a dress form                                                         |
| 7   | Chikankari Studio             | Jaali feature wall, four dark dress forms, shelf of folded pieces                                         |
| 8   | Fitting Rooms & Try-on Mirror | Three curtained cubicles (cloth curtains), the try-on mirror, a live mannequin doing turns and arm raises |
| 9   | Dupatta & Stole Bar           | Table of folded dupattas, stools, one-shoulder drape on a form                                            |
| 10  | Men's Wear                    | Shirts, kurtas, Nehru and bandi jackets                                                                   |
| 11  | Tailoring & Checkout          | Counter (opens the bag) and the tailor's mirror (books an alteration)                                     |

36 sample products across tees, shirts, kurtas, anarkalis, dresses, jackets and dupattas, each with 1 to 6 colours and a full size chart.

## 6. How it works

### The cloth engine (`src/cloth/`)

| File          | Role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sim.js`      | Position-based cloth: Verlet integration, stretch/shear/bend distance constraints with separate stretch and compression stiffness, long-range tethers, kinematic pins, soft "skinning" pulls toward the body, and collisions with spheres, tapered capsules, an elliptic-cylinder torso and planes, with friction. Deformation damping, a stretch cap of about 3% and friction measured against the moving body make it move like woven fabric rather than rubber or jelly. Fabric presets (cotton, linen, rayon, silk, georgette, chiffon, denim) set stiffness, damping and look. |
| `body.js`     | The body model shared by everything: joint names, segment frames, measurements, proportions, and the collision shapes that match the mannequin.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `garments.js` | Pattern builder. A **template** (tee, shirt, kurta, anarkali, dress, Nehru jacket, dupatta) plus **measurements in metres** (chest, hip, length, sleeve) become a particle cloth: body tube with neckline and sloped shoulder seams, armhole-capped sleeves blended between arm and torso, side slits, flares with designed folds, button placket, and dupatta drapes (stole and one shoulder).                                                                                                                                                                                     |
| `poses.js`    | Animated mannequin poses: still, idle, turn, walk, twirl.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `render.js`   | three.js side: procedural fabric prints (block, ikat, chikankari, brocade, paisley, floral, phulkari, checks, stripes, denim), weave normal maps, sheen, zari borders on hems and dupatta edges, compression-driven wrinkles, and the mannequin.                                                                                                                                                                                                                                                                                                                                    |
| `outfit.js`   | One or more layered garments on one body. Used by the live store looks, the product viewer and the camera try-on.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `display.js`  | Hanger and mannequin set-ups and the settle helpers used by the drape bake.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `measure.js`  | Builds a body from the shopper's own height, chest, waist and hip.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

Garments shown in the store are **baked** at build time (their resting drape is simulated once and stored), so the store opens fast. The Festive Edit podium, the fitting-room mannequin, the product viewer and the try-on are **simulated live** every frame. In the product viewer, dragging sideways spins the mannequin itself. A hard flick keeps it turning for a few seconds while the hem flares and a dupatta swings out, then the fabric settles back as it slows down.

### The camera try-on (`src/tryon/`)

1. **Tracking.** MediaPipe Pose Landmarker (WebAssembly, GPU with CPU fallback) finds 33 landmarks per frame. Everything is self-hosted: the runtime from `public/vendor/`, the model from `public/models/`.
2. **Mapping.** Landmarks become joints in metres in the camera's frame. An orthographic overlay camera uses the same metres-per-pixel scale, so cloth lands exactly on the pixels MediaPipe reported. One Euro filters remove jitter without adding lag.
3. **Calibration (first second).** Limb and torso lengths come from the world landmarks. The absolute scale is corrected with a height prior: the shopper's saved height, or a typical height. The torso's real width at chest, waist and hip is measured from the segmentation mask, so the garment covers the shopper's actual outline.
4. **Cloth.** The garment is built for that body and size and simulated on a matching body proxy each frame. Big tracking jumps move the cloth with the body instead of flinging it.
5. **Occlusion.** Depth-only shapes for the head, neck and any forearm or hand in front of the torso let the shopper's real hands pass in front of the garment.
6. **Light.** The garment's exposure follows the room's brightness.

The panel lets the shopper switch garment, size (with a **Fit** badge on the recommended size), colour, a layer on top (jacket or dupatta), the dupatta drape and the body build (slim, regular, broad), take a photo (saved only when they tap Save) and add everything to the bag.

**Privacy.** Frames go from the camera to the GPU and the pose model in the page. Nothing is recorded or uploaded. MediaPipe 1.0 tries to send anonymous usage statistics to `odml.pa.googleapis.com`; the site's Content Security Policy blocks that request, so you will see one blocked request in the browser console. That is intended.

## 7. Security

- **No secrets.** The site needs no API keys or environment variables. `.env` files are gitignored and excluded from Vercel uploads (`.vercelignore`). If you add payments later, see `.env.example`: secrets go in Vercel environment variables and server code only, never with a `VITE_` prefix.
- **Content Security Policy** (`vercel.json`): only this site's own scripts, styles, fonts and requests. `'wasm-unsafe-eval'` is the one addition, and the minimum MediaPipe needs to compile its WebAssembly. No third-party CDN is used at runtime.
- **Permissions-Policy:** `camera=(self)` lets only this site ask for the camera; microphone, location, payment and USB stay off.
- **Model integrity:** `models/models.lock.json` pins each model's SHA-256 after the first download.

## 8. Customise for a client

| What                                   | Where                                                           |
| -------------------------------------- | --------------------------------------------------------------- |
| Store name, hours, services            | `src/data/store-layout.js` → `NY.STORE`                         |
| Sections, tour text, floor plan        | `src/data/store-layout.js` → `NY.ZONES`, `NY.TOUR_TEXT`, `NY.L` |
| Areas visitors may not walk into       | `src/data/store-layout.js` → `NY.noGo` (behind counters, forms) |
| Products, colours, prices, size charts | `src/data/catalogue.js`                                         |
| Which product hangs where              | `src/data/catalogue.js` → `NY.MERCH`                            |
| Colours and fonts of the interface     | `src/styles/main.css` (`:root` tokens), `src/styles/fonts.css`  |

**Add a garment.** Copy a `G(...)` entry in `catalogue.js`. Pick a `template`, a `kind` (`women`, `men`, `kids`; this chooses the size chart and the mannequin), a `fit` (`fitted`, `regular`, `relaxed`, `flowy`), the length `len` in metres at the middle size, a `fabric`, a `pattern` and one or more colours (`base`, `accent`, optional `border` and `trim`). Use `over` to change template details, for example `over: { sleeve: 'long', slit: 0.3 }`. Add it to a bay in `NY.MERCH`. The next `npm run dev` or `npm run build` re-bakes the drapes automatically.

**Real photos instead of prints.** Fabric textures are drawn procedurally in `render.js` (`drawPattern`). To use a client's fabric scans, load an image texture into the same material slot; UVs are in units of 25 cm of fabric.

## 9. Performance

| Setting          | Desktop                     | Phone                              |
| ---------------- | --------------------------- | ---------------------------------- |
| Live store looks | 0.75 resolution, 3 substeps | 0.55 resolution, 2 substeps, 30 Hz |
| Product viewer   | 0.9 resolution              | 0.72 resolution                    |
| Try-on cloth     | 0.85 resolution, 3 substeps | 0.66 resolution, 2 substeps        |
| Pose model       | full (falls back to lite)   | lite                               |

Live looks are only simulated when they are near and in view. **Battery saver** in Store details lowers resolution and turns shadows off.

## 10. Troubleshooting

| Symptom                                         | Fix                                                                                           |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| "Camera access was blocked"                     | Allow the camera for the site (padlock icon in the address bar), then tap Start camera again. |
| Camera works on the laptop but not the phone    | The phone needs HTTPS. Use a Vercel preview URL.                                              |
| "The try-on could not start here"               | Run `npm run setup:tryon` and `npm run check`. The lite model must be in `public/models/`.    |
| Garment looks too small or too big on you       | Save your height and chest in **My measurements**, or use the **Body** options in the try-on. |
| "Drapes missing" in the console                 | Run `npm run bake`.                                                                           |
| A change to a garment doesn't show in the store | The bake is cached by a hash of the cloth code and the catalogue. `npm run bake` forces it.   |
| The 3D view never loads                         | The browser has no WebGL. The floor plan, directory, search and product sheets still work.    |

## 11. Credits and licences

three.js (MIT), MediaPipe Tasks Vision and the Pose Landmarker models (Apache 2.0, Google), Vite (MIT), fonts Unbounded, Hanken Grotesk and Martian Mono (SIL Open Font License, see `src/assets/fonts`). The cloth engine, store, garments and interface are original to this project.
