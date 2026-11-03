# Brijman Opticals · Virtual Salon

A walkable 3D eyewear salon for the web, designed after a contemporary optical boutique: a herringbone oak floor, white-marble islands with sunglasses on travertine blocks under bronze mushroom lamps, a wall of tall arched niches with one frame to a shelf, a lit white Atelier wall over a drawer cabinet, a navy velvet lounge with a round try-on mirror, backlit campaign posters and pampas in ribbed vases.

Visitors tap the floor to walk (the route goes around fixtures, and stops short of walls), tap a poster, niche or wall to stand square in front of it, drag to look around, and use the floor plan, directory, guided tour or search to find a section or frame. Tapping a frame opens its colours, its three sizes with the face widths each suits, lens options and prescription entry, and items go into a bag with a demo checkout. A **camera try-on** places the chosen frame on the shopper's face at its real size, measures the face width and the pupillary distance, and suggests a size.

It is a static site built with [Vite](https://vite.dev), [three.js](https://threejs.org) and [MediaPipe](https://ai.google.dev/edge/mediapipe) (face tracking, on the device). It has no backend, needs no secrets and deploys to Vercel as it is.

> **Sample data.** The frames, prices, stock levels, address and opening hours are placeholders until Brijman Opticals supplies its own. Checkout and eye-test booking are demos: they take no payment and create no booking. The campaign posters are original artwork with no real brands. See [Customise for a client](#6-customise-for-a-client).

---

## Guides

| Guide                                          | For                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| [docs/SETUP-VSCODE.md](docs/SETUP-VSCODE.md)   | Installing, running and debugging the project in VS Code                |
| [docs/DEPLOY-VERCEL.md](docs/DEPLOY-VERCEL.md) | Publishing on Vercel, custom domain, testing on phones                  |
| [docs/TRYON.md](docs/TRYON.md)                 | How the camera try-on works, its accuracy, privacy and troubleshooting  |
| [docs/TESTING.md](docs/TESTING.md)             | Unit tests, browser tests on 12 screens, the try-on simulator           |
| [docs/RESPONSIVE.md](docs/RESPONSIVE.md)       | Layout rules for phones, tablets and desktops (safe areas, tap targets) |
| [docs/prompts/](docs/prompts/README.md)        | Ready-made Claude Code prompts: test and fix, layout audit, add a frame |
| [CLAUDE.md](CLAUDE.md)                         | Architecture and conventions for developers and Claude Code             |

## What you need

| Tool           | Version                                 | Get it                                        |
| -------------- | --------------------------------------- | --------------------------------------------- |
| Node.js        | 22.12 up to 24 (24 LTS recommended)     | https://nodejs.org (choose the LTS installer) |
| VS Code        | Any recent version                      | https://code.visualstudio.com                 |
| Git            | Any recent version (for GitHub deploys) | https://git-scm.com                           |
| Vercel account | Free Hobby plan is enough for a demo    | https://vercel.com/signup                     |

## 1. Run it on your computer

Unzip `brijman-opticals-salon.zip`, open the folder in VS Code (**File → Open Folder…**) and open a terminal (**Terminal → New Terminal**):

```bash
npm ci        # installs the exact package versions from package-lock.json
npm run dev   # prepares the try-on files, then starts the dev server
```

Open **http://localhost:5173**. The first `npm run dev` copies the MediaPipe runtime into `public/vendor/` and downloads the face tracking model (about 4 MB) into `public/models/`. Without internet the salon still works; the try-on then explains that the model is missing, and `npm run setup:tryon` fetches it later.

Full instructions, debugging and the development pages are in [docs/SETUP-VSCODE.md](docs/SETUP-VSCODE.md).

## 2. Build and check the production version

```bash
npm run build     # writes the optimised site to dist/
npm run preview   # serves dist/ at http://localhost:4173 with the same security headers as Vercel
npm test          # unit tests
npm run check     # fonts, MediaPipe runtime and face model are in place
```

## 3. Deploy to Vercel

Push the folder to a private GitHub repository and import it at https://vercel.com/new. Vercel reads `vercel.json`, so the settings fill in by themselves (framework Vite, `npm ci`, `npm run build`, output `dist`, no environment variables). Step-by-step instructions, the CLI route and a custom domain are in [docs/DEPLOY-VERCEL.md](docs/DEPLOY-VERCEL.md).

The camera works only over HTTPS. Vercel deployments are HTTPS, so test the try-on on phones with a Vercel preview link.

## 4. The salon

| Section             | Where                                     | What                                                                           |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| Entrance            | Glass front, directory screen by the door | Floor plan, guided tour start                                                  |
| Sunglasses Salon    | Centre                                    | Marble island with travertine blocks and a polarised edit on the raised island |
| Lens & Care Counter | Marble counter joined to the island       | Lens samples (lens guide), contact lenses and care, checkout, eye-test booking |
| Men's Gallery       | Right wall, front four arched niches      | Optical frames, one to a shelf                                                 |
| Women's Gallery     | Right wall, back four arched niches       | Optical frames, one to a shelf                                                 |
| Atelier Wall        | Back wall                                 | Premium pieces on a lit white shelf unit and travertine plinths                |
| Little Ones         | Left wall                                 | Kids' frames at a child's eye level                                            |
| Lounge & Try-on     | Front left                                | Navy velvet chairs and the round mirror that opens the camera try-on           |

Every frame is drawn from its real millimetre size: a 52□17-140 frame is 52 mm across the lens in the salon, in the 3D viewer and on the shopper's face.

## 5. Frame sizes and the try-on

Each style comes in **S, M and L** (kids: XS, S and M). M is the size on the catalogue line; S and L change the lens width by 2 mm, the bridge by 1 mm and the temple by 5 mm. The product sheet shows each size's frame width and the face widths it suits.

The try-on measures the shopper's face width at the temples and their pupillary distance, using the iris (about 11.7 mm across in almost every adult) as a ruler. It then suggests the size whose width is closest to the face, and the measured PD can be used in the prescription form. Both are approximate (typically within 2 to 3 mm) and are labelled as such; an optician confirms them at the fitting. Details: [docs/TRYON.md](docs/TRYON.md).

## 6. Customise for a client

Search for `Brijman` and `BRIJMAN` (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd>) to find every place the brand name appears.

| To change                                       | Edit                                                                                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Store name, hours, services, address            | `src/data/store-layout.js` → `NY.STORE`                                                                                                                                  |
| Sections, descriptions, tour text and order     | `src/data/store-layout.js` → `NY.ZONES`, `NY.TOUR`, `NY.TOUR_TEXT`                                                                                                       |
| Floor plan and fixture positions (metres)       | `src/data/store-layout.js` → `NY.L`                                                                                                                                      |
| Frames, colours, sizes, prices                  | `src/data/catalogue.js` → the `F(...)` lines: id, name, section, shape, material, price in ₹, `[lens, bridge, temple]` in mm (size M), weight in g, colours, description |
| Which frame sits where                          | `src/data/catalogue.js` → `NY.MERCH`                                                                                                                                     |
| Size steps (S, M, L)                            | `src/data/catalogue.js` → `NY.SIZES`                                                                                                                                     |
| Lens types, coatings and prices                 | `src/data/catalogue.js` → `NY.LENS`                                                                                                                                      |
| Frame shapes (outline maths)                    | `src/data/frames.js` → `NY.ARCH`, `NY.SHAPES`                                                                                                                            |
| Interior: materials, fixtures, lamps, mirrors   | `src/scene/salon.js`                                                                                                                                                     |
| Floor, marble, posters, wordmark, directory art | `src/scene/textures.js`                                                                                                                                                  |
| Brand colours, fonts, spacing                   | `src/styles/main.css` → the `:root` block at the top                                                                                                                     |
| Logo, title, welcome text                       | `index.html`                                                                                                                                                             |

The posters are drawn in code (`poster()` in `src/scene/textures.js`). To use the client's own campaign images, replace a poster texture with an image file in `src/assets/` (keep it under 300 KB) and make sure the client owns the rights to it.

## 7. Security

- **No secrets anywhere.** The site has no API keys, tokens or environment variables. Everything in `src/` ends up in the public JavaScript bundle, so never put a secret there.
- **When you add real payments or an order API** (for example Razorpay): keep secret keys in Vercel → **Settings → Environment Variables** and in a local `.env` (already gitignored; see `.env.example`), never give a secret a `VITE_` prefix, read secrets only in server code (a Vercel Function in `api/`), and verify payment webhooks with the provider's signature check.
- **Security headers** in `vercel.json`: a strict Content-Security-Policy (scripts, fonts, models and data only from this site; `connect-src 'self'`), no-sniff, a referrer policy, HSTS, and a permissions policy that allows the camera for this site only and turns off the microphone, location and payment APIs.
- **Camera privacy.** Video is processed on the device and never uploaded; nothing is recorded. The try-on photo is created only when the shopper taps Photo and saved only when they tap Save. Face measurements are kept in memory for the visit and never stored or sent.
- **Fonts and tracking files are self-hosted** (Bodoni Moda and Jost under the SIL Open Font License; the MediaPipe runtime and model under Apache 2.0), so no request leaves for Google Fonts or a CDN.
- **Prescription values** typed in the demo stay in the visitor's browser for that order only. Before collecting real prescriptions, add consent text, encrypt the data in transit and at rest, and set a deletion policy (India's DPDP Rules require full compliance by 13 May 2027).
- **Dependencies** are pinned to exact versions in `package-lock.json`; `npm audit` reported 0 vulnerabilities when this pack was built. Run it again before each release.

## 8. Before going live

- [ ] Replace the catalogue, prices, stock, address and hours with Brijman Opticals' real data, and the posters with artwork the client owns.
- [ ] Connect a real checkout and eye-test booking, or remove those buttons. The demo checkout says clearly that no payment is taken.
- [ ] Edit `public/robots.txt` to allow indexing (it asks search engines not to index the sample site).
- [ ] Run `npm run setup:tryon` once and commit `models/models.lock.json`, so every build checks the face model's checksum.
- [ ] Add the client's domain in Vercel and check the HTTPS certificate is issued.
- [ ] Test on a mid-range Android phone and an iPhone over mobile data, including the try-on in daylight and indoor light.
