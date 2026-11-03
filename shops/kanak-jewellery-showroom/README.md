# Kanak Fine Jewellery · Virtual Boutique

A walkable 3D fine-jewellery boutique for the web, with **procedural gold, diamond, polki and pearl pieces**, a **live price breakdown** and a **camera try-on**. Visitors enter through a foyer into a domed marble rotunda with the signature necklace turning on a plinth under a crystal chandelier, then walk through arches into six salons and a private bridal lounge. Every piece can be opened in a 3D studio viewer, configured (metal, carat, diamond quality, stones, size) with the price recalculated from the day's metal rate, and worn on camera: earrings swing from the earlobes, a necklace sits at the base of the neck, a maang tikka on the forehead, a nath at the nostril, rings on the ring finger and bangles at the wrist. A whole bridal set can be worn at once.

It is a static site built with [Vite](https://vite.dev), [three.js](https://threejs.org) and [MediaPipe Face and Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker). It has no backend, needs no secrets and deploys to Vercel as-is. Camera video never leaves the visitor's device.

> **Sample data.** "Kanak", the pieces, the metal rates, stone prices and the store details are placeholders. Checkout and appointment booking are demos: they take no payment and create no booking. See [Customise for a client](#8-customise-for-a-client).

## Guides

| Guide                                                | Read it to                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [docs/SETUP-VSCODE.md](docs/SETUP-VSCODE.md)         | Install the tools, open the project in VS Code, run it, debug it                                    |
| [docs/TESTING.md](docs/TESTING.md)                   | Run the unit tests and the browser tests on 12 screen sizes; manual checklist before a demo         |
| [docs/RESPONSIVE.md](docs/RESPONSIVE.md)             | See how the layout adapts to phones, tablets, laptops and large screens, and keep it that way       |
| [docs/DEPLOY-VERCEL.md](docs/DEPLOY-VERCEL.md)       | Deploy to Vercel from GitHub or the command line, add a domain, gate deploys on tests               |
| [docs/TRYON.md](docs/TRYON.md)                       | How the camera try-on places each kind of jewellery, how to test and tune it                        |
| [docs/JEWELLERY-MODELS.md](docs/JEWELLERY-MODELS.md) | Replace built-in pieces with your 3D team's models (GLB/OBJ): naming, import, fixes                 |
| [CLAUDE.md](CLAUDE.md)                               | Working guide for Claude Code (architecture, conventions, pitfalls)                                 |
| [docs/prompts/](docs/prompts/README.md)              | Hand Claude Code a ready task: run every test and fix failures, or audit the layout on every screen |

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

1. Unzip `kanak-jewellery-showroom.zip`, for example to `C:\Projects\kanak-jewellery-showroom`.
2. In VS Code choose **File → Open Folder…** and pick that folder.
3. Install the recommended extensions when VS Code offers them (Prettier, EditorConfig, Vitest, Playwright).
4. Open a terminal with **Terminal → New Terminal**.

## 2. Run it on your computer

```bash
npm ci        # first time: installs the exact versions in package-lock.json
npm run dev   # starts the dev server at http://localhost:5173
```

Before the dev server starts, the **try-on setup** (`scripts/setup-tryon.mjs`) runs automatically. It copies the MediaPipe WebAssembly runtime from `node_modules` into `public/vendor/`, and downloads the Face Landmarker and Hand Landmarker models (about 12 MB together) from Google's official model bucket into `public/models/` if they are missing. It takes about 10 seconds the first time and nothing afterwards. If the download fails (no internet), the boutique works normally and the try-on shows a clear "model not installed" message; run `npm run setup:tryon` when online.

The camera works on **http://localhost** (browsers treat it as secure). On another device you need HTTPS; see [Test on a phone](#test-on-a-phone).

### Test on a phone

`npm run dev:phone` exposes the dev server on your Wi-Fi, so you can walk the boutique on a phone. **Phone cameras only work over HTTPS**, so for the try-on use a Vercel preview deployment (step 4). Only expose the dev server on a network you trust.

## 3. Build, check and test

```bash
npm run build     # try-on setup + optimised site in dist/
npm run preview   # serves dist/ at http://localhost:4173 with the same security headers as Vercel
npm run check     # confirms the fonts, the WebAssembly runtime and the two tracking models are in place
npm test          # unit tests (about 10 seconds)
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

**Pin the models.** Your first successful `npm run dev` creates `models/models.lock.json` with the SHA-256 of the two downloaded models. Commit it: from then on every build, including Vercel's, refuses a model that does not match.

## 5. What is in the boutique

The floor plan is an octagonal rotunda with eight arched openings. Arriving at a section shows its card for six seconds; wherever a visitor stands, a small button in the bottom-right corner offers that section's main action (today's rates, browse the salon, see the bridal sets, book a viewing), so everything is reachable with ordinary clicks as well as by tapping the 3D view.

| Section               | What's there                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foyer & Today's Rates | Entrance with the brass rate board (today's 24K, 22K, 18K, platinum and silver rates), concierge desk, two glass columns                                             |
| The Rotunda           | White statuario marble with an inlaid star, coffered dome with an oculus, crystal chandelier, the **Maharani Rani Haar** turning under a bell jar, four pillar cases |
| Everyday & Men's      | Chains, pendants, studs, hoops; kadas, rope chains, curb bracelets and signets                                                                                       |
| Temple & Antique Gold | Coin necklaces, peacock chokers, jhumkas, kadas and a sun tikka in 22K antique gold                                                                                  |
| Polki & Kundan        | Rani haars, kundan chokers, chandbalis, tikkas, naths and jadau bangles                                                                                              |
| The Bridal Lounge     | Sofa under an arched gilt mirror, armchairs and a low table of pieces, glass cases with three bridal sets, and the try-on mirror                                     |
| Solitaires & Rings    | Solitaires from 0.30 to 1.50 carat, halos, three-stone rings, eternity and men's bands                                                                               |
| Diamond Atelier       | Diamond necklaces, drops, studs, tennis bracelets and bangles in 18K gold and platinum                                                                               |
| Pearls & Gemstones    | Ruby, emerald and sapphire pieces, South Sea pearls and the Navratna ring                                                                                            |

Each salon has its own velvet colour, three lit wall niches with necklaces on busts, two side cases, a glass counter with stools and a pendant light. 44 sample pieces, 4 bridal sets.

**Prices** follow a jeweller's bill: metal weight × the day's rate for that purity + making charges + stones (per carat, or per piece for pearls and kundan) + 3% GST. The weight follows the metal's density and the size (ring size, bangle size, chain length). Solitaires price by carat band and diamond quality (EF·VVS, GH·VS, IJ·SI). The product sheet shows the full breakdown, the purity with its BIS hallmark and HUID, and the certificate (IGI for solitaires).

## 6. How it works

### The jewellery engine (`src/jewel/`)

Every piece is generated from a short build description in the catalogue (style, sizes, stone cut and size), in millimetres, so a change of metal, stone or size rebuilds it exactly.

| File           | Role                                                                                                                                                                                                                                                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gems.js`      | Faceted stones: round, oval, pear, marquise, cushion, princess and heart brilliants, emerald, baguette and asscher step cuts, cabochons, polki (flat uncut diamonds) and briolettes. Each facet carries an id for the gem shader.                                                                                                                                      |
| `materials.js` | Metals (22K, 18K yellow, rose and white gold, platinum, silver, antique and oxidised finishes) lit by a neutral three-point studio (key, fill and rim soft boxes, a white bounce card) so each metal shows its true colour; a gem shader with refraction, two internal bounces, dispersion ("fire") and gold foil behind polki and kundan; pearls with lustre; enamel. |
| `shapes.js`    | Sweeps, wires, beads, plates with a domed top, outlines (petal, paisley, leaf, crescent), the display bust and the path a chain of a given length takes around the neck.                                                                                                                                                                                               |
| `build.js`     | Builders for rings (solitaire, halo, cocktail, three-stone, cluster, polki, navratna, signet, eternity), earrings (studs, drops, jhumkas, chandbalis, hoops), necklaces (chains, strands, motifs, chokers, rivieras, layered), bangles, bracelets, tikkas and naths.                                                                                                   |
| `kit.js`       | Collects metal geometry by slot and stones by role, then turns them into merged meshes and instanced stones; also records where each stone should sparkle.                                                                                                                                                                                                             |
| `sparkle.js`   | Star-shaped glints that flash as a light reflects off a facet towards the viewer, so diamonds sparkle as you walk past and as you move your head in the try-on.                                                                                                                                                                                                        |
| `stage.js`     | The studio viewer in the product sheet: black velvet, presentation per type (a ring on a dais, a necklace on a bust), drag to turn, pinch or scroll to zoom.                                                                                                                                                                                                           |
| `models.js`    | Loads a piece from the client's 3D model when one has been imported (`npm run models`), as the same kind of kit as a built piece, so metal and stone choices, sparkle, sizes and the try-on work unchanged.                                                                                                                                                            |

### The boutique (`src/scene/`)

Procedural marble, brass, velvet and glass; merged geometry per material (about 150 draw calls); colour-true tone mapping (Khronos PBR Neutral), so 22K gold reads yellow rather than orange; pieces shown a little larger than life in the cases and niches so their colour reads from where the visitor stands; light pools, a soft volumetric light from the oculus and dust in it; a blurred reflection of the room in the marble floor and gentle bloom on the brightest highlights (both switch off on phones and in Battery saver). The walk planner keeps visitors out of the fixtures and from behind the counters.

### The camera try-on (`src/tryon/`)

1. **Tracking.** MediaPipe Face Landmarker for earrings, necklaces, tikkas and naths; Hand Landmarker for rings and bangles. Each model loads only when something that needs it is being worn. Everything is self-hosted: the runtime from `public/vendor/`, the models from `public/models/`.
2. **Anchors.** A few landmarks give each piece its place and orientation: the earlobes below the jaw line, the hairline for the tikka, the left nostril for the nath, the base of the neck for necklaces, the ring finger between the knuckle and the middle joint, and the wrist. Sizes in millimetres are turned into pixels with the measured width of the face or the span of the knuckles, so pieces stay true to size at any distance.
3. **Motion.** One Euro filters remove jitter without lag. Earrings hang from the lobes as small pendulums and swing when the head moves.
4. **Occlusion.** Depth-only shapes for the head, neck, finger and forearm hide the parts of a piece that would be behind the body (the back of a bangle, the far earring when the head turns).
5. **Light.** The jewellery's exposure follows the room's brightness, and glints flash as the head turns.

The panel switches between Earrings, Necklace, Tikka, Nath, Ring and Bangle; several pieces can be worn together. It offers each piece's metals and stones, a photo (saved only when the shopper taps Save) and Add to bag for everything worn. On phones and portrait tablets the panel folds down after the shopper is found, so the neck and chest stay visible. Details: [docs/TRYON.md](docs/TRYON.md).

**Privacy.** Frames go from the camera to the GPU and the tracking models in the page. Nothing is recorded or uploaded. MediaPipe 1.0 tries to send anonymous usage statistics to `odml.pa.googleapis.com`; the site's Content Security Policy blocks that request, so you will see one blocked request in the browser console. That is intended.

## 7. Security

- **No secrets.** The site needs no API keys or environment variables. `.env` files are gitignored and excluded from Vercel uploads (`.vercelignore`). If you add payments later, see `.env.example`: secrets go in Vercel environment variables and server code only, never with a `VITE_` prefix.
- **Content Security Policy** (`vercel.json`): only this site's own scripts, styles, fonts and requests. `'wasm-unsafe-eval'` is the one addition, and the minimum MediaPipe needs to compile its WebAssembly. No third-party CDN is used at runtime; fonts are self-hosted.
- **Permissions-Policy:** `camera=(self)` lets only this site ask for the camera; microphone, location, payment and USB stay off.
- **Model integrity:** `models/models.lock.json` pins each model's SHA-256 after the first download.
- `npm test` includes `security.test.js`, which fails on any credential in the project or the build.

## 8. Customise for a client

| What                                 | Where                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| Store name, hours, address, services | `src/data/store-layout.js` → `NY.STORE`                                      |
| Sections, tour text, room sizes      | `src/data/store-layout.js` → `NY.ZONES`, `NY.TOUR_TEXT`, `NY.L`              |
| Areas visitors may not walk into     | `src/data/store-layout.js` → `NY.noGo` (behind counters, the desk, the sofa) |
| Metal rates, GST, stone prices       | `src/data/catalogue.js` → `NY.RATES`, `NY.STONE`, `NY.solitairePerCt`        |
| Pieces, metals, sizes, stones        | `src/data/catalogue.js` → the `P.push({...})` entries                        |
| Which piece is displayed where       | `src/data/catalogue.js` → `NY.MERCH`                                         |
| Bridal sets                          | `src/data/catalogue.js` → `NY.SETS`                                          |
| Colours and fonts of the interface   | `src/styles/main.css` (`:root` tokens), `src/styles/fonts.css`               |

**Today's rates.** In a live deployment the rates would come from the jeweller's system each morning. The demo reads `NY.RATES`; replace it with a fetch from your own API (same origin, so the CSP allows it) and keep the label that says when the rates were set.

**Use your own 3D models.** Put `<product id>.glb` (or `.obj`) in `models/jewellery/` and run `npm run models`; the piece is replaced in the store, the viewer and the try-on, with metal and stone choices still working. See [docs/JEWELLERY-MODELS.md](docs/JEWELLERY-MODELS.md).

**Add a piece.** Copy a `P.push({...})` entry in `catalogue.js`: give it an id, name, `zone` (salon), `type`, metals, weight in grams at the default size, making charge, stones and a `build` block (copy one from a similar piece and change the style or sizes). `tryon` is the slot it is worn in (`ear`, `neck`, `forehead`, `nose`, `finger`, `wrist`). Add it to a display in `NY.MERCH`. `npm test` checks that it builds, that its price adds up and that it fits the triangle budget. `tools/gallery.html` (with `npm run dev`) shows every piece in the studio.

## 9. Performance

| Setting             | Desktop            | Phone                                   |
| ------------------- | ------------------ | --------------------------------------- |
| Pieces in the store | detail 0.35        | detail 0.25                             |
| Product viewer      | detail 0.9         | detail 0.7                              |
| Try-on              | detail 0.8         | detail 0.6                              |
| Reflections, bloom  | on (Auto and High) | bloom only (Auto); off in Battery saver |

The boutique holds about 110 displayed pieces. Graphics quality (Auto, High, Battery saver) is in Store details; Auto lowers the resolution by itself if the frame rate drops, and the scene redraws less often when nothing moves.

## 10. Troubleshooting

| Symptom                                         | Fix                                                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| "Camera access was blocked"                     | Allow the camera for the site (padlock icon in the address bar), then tap Start camera again.   |
| Camera works on the laptop but not the phone    | The phone needs HTTPS. Use a Vercel preview URL.                                                |
| "The face/hand tracking model is not installed" | Run `npm run setup:tryon` (needs internet) and `npm run check`.                                 |
| Earrings sit too high or low on you             | Tuning values are in `FACE_MM` in `src/tryon/anchors.js`; see [docs/TRYON.md](docs/TRYON.md).   |
| The 3D view never loads                         | The browser has no WebGL. The floor plan, directory, search, product sheets and bag still work. |
| The boutique runs slowly on an old laptop       | Store details → Graphics → Battery saver.                                                       |

## 11. Credits and licences

three.js (MIT), MediaPipe Tasks Vision and the Face and Hand Landmarker models (Apache 2.0, Google), Vite (MIT), fonts Cormorant Garamond and Jost (SIL Open Font License, see `src/assets/fonts`). The jewellery engine, the boutique, the pieces and the interface are original to this project.
