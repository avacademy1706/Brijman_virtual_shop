# Brijman Eyewear · Virtual Showroom

A walkable 3D eyewear showroom for the web. Visitors tap the floor to walk (the route goes around fixtures), drag to look around, and use the floor plan, directory, guided tour or search to find a section or frame. Tapping a frame opens its colours, size guide, lens options and prescription entry, and items go into a bag with a demo checkout.

It is a static site. It is built with [Vite](https://vite.dev) and [three.js](https://threejs.org), has no backend and needs no secrets. It deploys to Vercel as-is.

**Everything is in this folder:** the source code, the fonts (`src/assets/fonts`), the favicon, and every 3D model and texture from the showroom as `.glb` and `.png` files in [`assets-3d/`](assets-3d/README.md). That is the full store, 39 fixtures, all 92 frames in every colour, 7 contact lens and care products, a frame library and 23 textures. The only things downloaded during setup are the code libraries (three.js, Vite and Prettier), by `npm ci`.

> **Sample data.** "Brijman Eyewear", the frames, prices and stock levels are placeholders. Checkout and eye-test booking are demos: they take no payment and create no booking. See [Customise for a client](#6-customise-for-a-client).

---

## What you need

| Tool           | Version                                 | Get it                                        |
| -------------- | --------------------------------------- | --------------------------------------------- |
| Node.js        | 22.12 or newer (24 LTS recommended)     | https://nodejs.org (choose the LTS installer) |
| VS Code        | Any recent version                      | https://code.visualstudio.com                 |
| Git            | Any recent version (for GitHub deploys) | https://git-scm.com                           |
| Vercel account | Free Hobby plan is enough for a demo    | https://vercel.com/signup                     |

Check Node after installing. Open a new terminal and run:

```bash
node -v   # should print v22.12.0 or higher
npm -v
```

---

## 1. Open the project in VS Code

1. Unzip `brijman-virtual-showroom.zip` somewhere simple, for example `C:\Projects\brijman-virtual-showroom`.
2. In VS Code choose **File → Open Folder…** and pick that folder.
3. When VS Code suggests the recommended extensions (Prettier, EditorConfig), click **Install**.
4. Open a terminal with **Terminal → New Terminal** (or <kbd>Ctrl</kbd>+<kbd>`</kbd>).

## 2. Run it on your computer

```bash
npm ci        # installs the exact package versions from package-lock.json
npm run dev   # starts the dev server
```

Open **http://localhost:5173**. Edits to files in `src/` reload the page automatically.

You can also start the dev server from VS Code with **Terminal → Run Build Task…** (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>). To debug in Chrome or Edge, start the dev server first, then press <kbd>F5</kbd>.

**Test on your phone.** Run `npm run dev:phone` instead. Vite prints a `Network:` address such as `http://192.168.1.20:5173`; open it on a phone connected to the same Wi-Fi. Only do this on a network you trust, because it makes the dev server reachable from other devices on that network.

## 3. Build and check the production version

```bash
npm run build     # writes the optimised site to dist/
npm run preview   # serves dist/ at http://localhost:4173
```

`npm run preview` sends the same security headers as Vercel (it reads them from `vercel.json`). If something works in `dev` but breaks in `preview`, the browser console will show which header blocked it.

## 4. Deploy to Vercel

### Option A: GitHub and the Vercel dashboard (recommended)

Every push to GitHub then deploys automatically, and every pull request gets its own preview link.

1. Create an empty **private** repository on GitHub, for example `brijman-virtual-showroom`.
2. In the VS Code terminal, inside the project folder:

   ```bash
   git init
   git add .
   git commit -m "Virtual showroom: first version"
   git branch -M main
   git remote add origin https://github.com/YOUR-ACCOUNT/brijman-virtual-showroom.git
   git push -u origin main
   ```

   `.gitignore` already keeps `node_modules`, `dist`, `.vercel` and any `.env` files out of Git.

3. Go to https://vercel.com/new, choose **Import Git Repository** and pick the repository.
4. Vercel reads `vercel.json`, so the settings fill in by themselves:
   - Framework Preset: **Vite**
   - Install Command: `npm ci`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Environment Variables: **none needed**
5. Click **Deploy**. After about a minute you get a link like `https://brijman-virtual-showroom.vercel.app`.

From now on, `git push` to `main` updates the live site.

### Option B: Vercel CLI from the VS Code terminal

```bash
npx vercel login      # opens the browser to sign in
npx vercel            # first run: answer the prompts, creates a preview deployment
npx vercel --prod     # publishes to your production URL
```

At the first prompt choose your account, say **No** to linking an existing project, and accept the detected settings. The CLI writes a `.vercel/` folder, which is gitignored.

## 5. Use your own domain (optional)

In Vercel open the project, then **Settings → Domains → Add**, for example `showroom.clientdomain.com`. Vercel shows the DNS record to add (usually a `CNAME` to `cname.vercel-dns.com`). HTTPS certificates are issued automatically.

**Embedding in the client's website.** The headers allow the showroom to be framed only by its own domain. To embed it in an `<iframe>` on another site, change `frame-ancestors 'self'` in `vercel.json` to `frame-ancestors 'self' https://www.clientdomain.com` and remove the `X-Frame-Options` header. A plain link or button to the showroom needs no change.

## 6. Customise for a client

Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> and search for `Brijman` to find every place the placeholder brand appears.

| To change                                          | Edit                                                                                                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Store name, hours, services, address               | `src/data/store-layout.js` → `BM.STORE`                                                                                                                                    |
| Section names, descriptions, tour text, tour order | `src/data/store-layout.js` → `BM.ZONES`, `BM.TOUR`, `BM.TOUR_TEXT`                                                                                                         |
| Floor plan and fixture positions (metres)          | `src/data/store-layout.js` → `BM.L`                                                                                                                                        |
| Frames, colours, sizes, prices                     | `src/data/catalogue.js` → the `F(...)` lines. Arguments: id, name, section, shape, material, price in ₹, `[lens, bridge, temple]` in mm, weight in g, colours, description |
| Which frame sits on which shelf                    | `src/data/catalogue.js` → `BM.MERCH`                                                                                                                                       |
| Lens types, coatings and their prices              | `src/data/catalogue.js` → `BM.LENS`                                                                                                                                        |
| Frame shapes (outline maths)                       | `src/data/frames.js` → `BM.ARCH`, `BM.SHAPES`                                                                                                                              |
| Brand colours, fonts, spacing                      | `src/styles/main.css` → the `:root` block at the top                                                                                                                       |
| Logo and title in the top bar, welcome text        | `index.html`                                                                                                                                                               |
| Shop signs, directory screen, materials, lighting  | `src/scene/showroom.js`                                                                                                                                                    |
| Browser tab title and description                  | `index.html` `<head>`                                                                                                                                                      |

Frames are generated from their real millimetre sizes, so a 53□18-145 frame renders 53 mm wide on the shelf and in the detail viewer.

## 7. Security notes

- **No secrets anywhere.** The site has no API keys, tokens or environment variables. Everything in `src/` ends up in the public JavaScript bundle, so never put a secret there.
- **When you add real payments or an order API** (for example Razorpay):
  - put secret keys in Vercel → **Settings → Environment Variables**, and locally in a `.env` file (already gitignored). See `.env.example`.
  - never give a secret a `VITE_` prefix. Vite copies every `VITE_` variable into the public bundle.
  - read secrets only in server code: a Vercel Function in an `api/` folder. The browser calls that function, and only the function talks to the payment provider.
  - verify payment webhooks with the provider's signature check before marking an order paid.
- **Security headers** in `vercel.json`:
  - a strict Content-Security-Policy (scripts and fonts only from this site, no third-party calls), no-sniff, a referrer policy, and HSTS.
  - a permissions policy that turns off camera, microphone, location and payment APIs.
  - if you later add a camera try-on, analytics or a payment script, you must add their domains to the CSP and change `camera=()` in the permissions policy, or the browser will block them.
- **Fonts are self-hosted** in `src/assets/fonts` (SIL Open Font License, licence files included), so no Google Fonts request leaves the visitor's browser.
- **Prescription values** typed in the demo stay in the visitor's browser for that order only and are never sent anywhere. Before collecting real prescriptions, add consent text, encrypt the data in transit and at rest, and set a deletion policy. India's DPDP Rules require full compliance by 13 May 2027.
- **Dependencies** are pinned to exact versions in `package-lock.json`, and `npm audit` reported 0 vulnerabilities when this pack was built. Run `npm audit` again before each release.

## 8. Before going live

- [ ] Replace the brand, catalogue, prices and stock with the client's real data.
- [ ] Connect a real checkout and booking, or remove those buttons. The demo checkout says clearly that no payment is taken.
- [ ] Edit `public/robots.txt` to allow indexing. It currently asks search engines not to index the sample site.
- [ ] Add the client's domain in Vercel and check the HTTPS certificate is issued.
- [ ] Test on a mid-range Android phone and an iPhone over mobile data.

## Troubleshooting

| Problem                                             | Fix                                                                                                                                                                     |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm` is not recognised                             | Install Node.js, then close and reopen VS Code so the terminal picks up the new path.                                                                                   |
| PowerShell says "running scripts is disabled"       | Use `npx vercel` as shown above, switch the VS Code terminal to **Command Prompt**, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.                  |
| `npm ci` fails with a lockfile error                | Delete `node_modules` and run `npm install`, then commit the updated `package-lock.json`.                                                                               |
| The page shows a floor plan instead of the 3D store | The browser has WebGL turned off or unavailable. Turn on hardware acceleration in the browser settings. The floor plan still lets visitors browse every section.        |
| The 3D view is slow on a phone                      | Open **Info → Picture quality → Battery saver**. Automatic mode also lowers resolution when the frame rate drops.                                                       |
| Build warns about chunk size                        | Expected: three.js is about 600 kB (about 160 kB gzipped). It loads after the interface, so the page is usable while it downloads.                                      |
| Vercel build uses the wrong Node version            | `package.json` asks for Node 22.12 or newer, which Vercel maps to its Node 24 runtime. You can also set it under **Settings → Build and Deployment → Node.js Version**. |

## Project structure

```
brijman-virtual-showroom/
├─ index.html               Page shell: top bar, floor-plan card, section and tour cards, detail sheet
├─ assets-3d/               Every 3D model (.glb) and texture (.png), with catalogue.csv and its own README
│  ├─ showroom/             The complete store with all products placed
│  ├─ fixtures/             39 fixtures, one file each
│  ├─ frames/               92 frames by section, every colour, plus the frame library
│  ├─ products/             Contact lens and care products
│  └─ textures/             Source textures and shop signs
├─ public/                  Copied as-is: favicon.svg, robots.txt
├─ src/
│  ├─ main.js               Entry: fonts, styles, UI, then the 3D scene as a separate chunk
│  ├─ assets/fonts/         Hanken Grotesk, Martian Mono and Unbounded (woff2) with licences
│  ├─ core/bm.js            Shared namespace for data and the UI ↔ 3D bridge
│  ├─ data/
│  │  ├─ store-layout.js    Store details, floor plan, sections, tour, fixture footprints
│  │  ├─ frames.js          Frame shapes and the lens outline generator
│  │  └─ catalogue.js       Products, shelf merchandising, lenses, pricing
│  ├─ lib/
│  │  ├─ dom.js             DOM, formatting and storage helpers
│  │  └─ drawings.js        SVG frame drawings, size diagram, canvas floor plan
│  ├─ ui/app.js             Interface: navigation, tour, search, product sheet, bag, checkout
│  ├─ scene/showroom.js     3D store, frames, walk planner, labels, product viewer
│  └─ styles/               main.css (design tokens, light and dark, all styles) and fonts.css
├─ scripts/check-assets.mjs Confirms every file in assets-3d/catalogue.json is present
├─ vercel.json              Vercel build settings and security headers
├─ vite.config.js           Build settings; preview uses the Vercel headers
├─ .vscode/                 Recommended extensions, format on save, tasks, debug configs
├─ .env.example             Where secrets would go later (none needed now)
├─ .vercelignore            Keeps assets-3d/ out of Vercel uploads (the site does not need it)
└─ package.json             Scripts and pinned dependency versions
```

### Scripts

| Command                | What it does                                                   |
| ---------------------- | -------------------------------------------------------------- |
| `npm run dev`          | Dev server at http://localhost:5173 with live reload           |
| `npm run dev:phone`    | Same, reachable from phones on your Wi-Fi                      |
| `npm run build`        | Production build into `dist/`                                  |
| `npm run preview`      | Serves `dist/` with the production security headers            |
| `npm run format`       | Formats all files with Prettier                                |
| `npm run assets:check` | Confirms every 3D model and texture in `assets-3d/` is present |
