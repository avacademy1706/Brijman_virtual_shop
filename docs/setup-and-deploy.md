# Setup and deploy

This guide takes you from the project folder to a live URL on Vercel. You don't need any secrets: the showroom runs entirely on the data in `data/*.json`.

## 1. What you get

- **The 3D showroom**: walk, tour, search, product sheet with colours, real sizes (S, M, L) and lens options, and a bag.
- **A virtual try-on**: tap **Try on** on any frame to see it on your face at its true size, live from the camera or on a photo. It runs on the device; nothing from the camera is sent anywhere. See `docs/try-on.md`.
- **An API** at `/api/v1/...` for the catalogue, products, lens options, server-priced bag quotes, demo orders, eye-test slots and demo bookings. See `docs/api.md`.
- **Data in JSON files** (`data/*.json`). Change a price there and it changes on the shelves, in the product sheet, the bag and checkout.
- **One command** runs the site and the API locally: `npm run dev`.
- **Vercel settings** in `vercel.json`: the API rewrite, the Mumbai (`bom1`) function region and the security headers. A smoke test checks a live deployment.

Payments, a database, WhatsApp and the DGCC lead push are not connected yet. The hooks are ready: see `docs/backend-integration.md`.

## 2. Install once

| Tool           | Version                       | Link                          |
| -------------- | ----------------------------- | ----------------------------- |
| Node.js        | 24 LTS (22.12 or newer works) | https://nodejs.org            |
| Git            | latest                        | https://git-scm.com           |
| VS Code        | latest                        | https://code.visualstudio.com |
| GitHub account | free                          | https://github.com            |
| Vercel account | Hobby (free) is enough        | https://vercel.com/signup     |

Open a new terminal and check: `node -v` should print v22.12 or higher, and `git --version` should print a version.

## 3. Open the project

1. Open the `brijman-virtual-showroom` folder in VS Code (**File → Open Folder**). `package.json` should be at the top level.
2. Open a terminal (**Terminal → New Terminal**) and install the exact package versions:

   ```bash
   npm ci
   ```

## 4. Run it on your computer

```bash
npm run dev          # site and API at http://localhost:5173
npm test             # automated tests (Vitest)
npm run check        # format check, tests, production build and the first-load size check, in one go
npm run build        # production build into dist/
npm run preview      # production build and API at http://localhost:4173, with the live security headers
npm run smoke -- http://localhost:4173   # checks the API and headers against the running preview
```

Run `npm run smoke` in a second terminal while `npm run preview` is running.

`dev`, `build` and `preview` first run `scripts/copy-mediapipe.mjs`. It copies the try-on's face-tracking runtime from `node_modules` into `public/vendor/mediapipe/` (gitignored) and checks the face model's SHA-256. If it reports a mismatch, download the model again from the URL in `docs/try-on.md`.

Quick checks in the browser:

- http://localhost:5173/api/v1/health shows `{"data":{"status":"ok",...}}`.
- Open a frame, choose **Single vision**, choose **Enter it now**, type a prescription and add it to the bag. The bag shows **Prices confirmed**.
- Check out with a test name and mobile number, for example `9876543210`. You get a `BM-DEMO-…` reference, and nothing is charged.
- Open **Eye test** and book a slot. You get a `BM-ET-DEMO-…` reference.
- Open a frame, pick a size, tap **Try on** and allow the camera. The frame sits on your face; switching S, M and L changes it. The camera works here because `localhost` counts as secure.

**Test on your phone:** run `npm run dev:phone` and open the `Network:` address it prints, on a phone connected to the same Wi-Fi. Only do this on a network you trust.

**The try-on camera needs HTTPS.** Browsers allow the camera only on `https://` or `localhost`, so it is blocked on the `http://192.168…` address. To test the try-on on a phone, push the branch and open the **Vercel preview** link (log in to Vercel on the phone, because previews are protected), or use the production URL after merging. Then follow `docs/try-on-testing.md`.

**Without the API:** set `VITE_DATA_SOURCE=static` for the build (PowerShell: `$env:VITE_DATA_SOURCE="static"; npm run build`). The site then uses the bundled JSON and never calls `/api`, and checkout and booking say they are unavailable. This is useful for hosting a pure static preview.

## 5. Put it live on Vercel

### Option A: GitHub and the Vercel dashboard (recommended; every push redeploys)

1. Merge the work into your main branch. In the VS Code terminal (if `git branch` shows `master` instead of `main`, use that name):

   ```bash
   git checkout main
   git merge feature/api-layer
   ```

2. Create an empty **private** repository on GitHub named `brijman-virtual-showroom`, then:

   ```bash
   git remote add origin https://github.com/YOUR-ACCOUNT/brijman-virtual-showroom.git
   git push -u origin main
   ```

3. Go to https://vercel.com/new → **Import Git Repository** → pick the repository.
4. The settings fill in from `vercel.json`: Framework **Vite**, Install `npm ci`, Build `npm run build`, Output `dist`. **No environment variables are needed.** Click **Deploy**.
5. Check the live site, using your project's production URL:

   ```bash
   npm run smoke -- https://brijman-virtual-showroom.vercel.app
   ```

   Preview URLs sit behind Vercel login by default, so run the smoke test against production.

### Option B: Vercel CLI from VS Code

```bash
npx vercel login
npx vercel link            # connect this folder to a new or existing Vercel project
npx vercel                 # preview deployment (the first one becomes production)
npx vercel --prod          # production deployment
npm run smoke -- https://YOUR-PROJECT.vercel.app
```

The CLI writes a `.vercel/` folder, which is gitignored.

### Vercel settings to confirm in the dashboard

| Setting               | Where                            | Value                                                                                           |
| --------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------- |
| Node.js version       | Settings → Build and Deployment  | 24.x (set automatically from `package.json`)                                                    |
| Function region       | Settings → Functions             | Mumbai, `bom1` (set by `vercel.json`)                                                           |
| Environment variables | Settings → Environment Variables | None needed today. Add them only when connecting a backend (see `docs/backend-integration.md`). |
| Domain                | Settings → Domains               | Add, for example, `showroom.clientdomain.com` and create the CNAME record Vercel shows          |
| Deployment Protection | Settings → Deployment Protection | Keep the default: previews need a login and production stays public                             |

## 6. Use your own domain

In Vercel open the project, then **Settings → Domains → Add**, for example `showroom.clientdomain.com`. Vercel shows the DNS record to add, usually a `CNAME` to `cname.vercel-dns.com`. HTTPS certificates are issued automatically.

To embed the showroom in an `<iframe>` on another site, change `frame-ancestors 'self'` in `vercel.json` to `frame-ancestors 'self' https://www.clientdomain.com` and remove the `X-Frame-Options` header. A plain link to the showroom needs no change.

## 7. Change the data

| To change                                     | Edit                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------- |
| Store name, hours, services, address          | `data/store.json` → `store`                                                        |
| Section names, blurbs, tour order, tour text  | `data/store.json` → `zones`, `tour`, `tourText`                                    |
| Frames, colours, sizes, prices, contact packs | `data/catalogue.json`                                                              |
| Which product sits on which shelf             | `data/merchandising.json`                                                          |
| Lens types, index, coatings and their prices  | `data/lenses.json`                                                                 |
| Eye-test slot times, hours, closed days       | `data/eye-test.json`                                                               |
| Floor plan and fixture positions (metres)     | `src/data/store-layout.js` → `BM.L`                                                |
| Frame shapes                                  | `shared/frame-archetypes.js` and `src/data/frames.js`                              |
| Brand colours, fonts                          | `src/styles/main.css` → `:root`                                                    |
| Logo, page title, welcome text                | `index.html`                                                                       |
| Shop signs and the directory screen           | `src/scene/showroom.js`                                                            |
| Frame sizes (S, M, L)                         | `data/catalogue.json` → `sizes`, `defaultSize`                                     |
| Artist 3D model for a frame colour (try-on)   | `public/models/frames/…glb` and that colour's `model` field (see `docs/try-on.md`) |

Keep product ids (`m01`, `w03`, `c01`…) and the order of colours stable: saved bags and shelf placement depend on them. After editing, run `npm test` and `npm run dev` to check.

## 8. If something goes wrong

| Problem                                             | Fix                                                                                                                                                                   |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/...` returns 404 on Vercel                    | Check that `vercel.json` has the `/api/(.*)` → `/api` rewrite and that `api/index.js` exists. Redeploy.                                                               |
| `/api/...` works locally but not on Vercel          | Open the deployment's **Logs** tab and look for an import error or a missing file in `server/`, `shared/` or `data/`.                                                 |
| The bag says "Prices are confirmed at checkout"     | The API did not answer. Open `/api/v1/health`. Locally, make sure you used `npm run dev` or `npm run preview`, not a plain file server.                               |
| Console shows CSP errors only on preview links      | The Vercel Toolbar on previews loads scripts from another domain. Turn the toolbar off for the project or ignore it on previews. Never loosen the production CSP.     |
| `npm ci` fails                                      | Delete `node_modules` and run `npm install`, then commit the new `package-lock.json`.                                                                                 |
| PowerShell says "running scripts is disabled"       | Use `npx vercel …`, switch the terminal to Command Prompt, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.                                         |
| Smoke test fails with 401 on a preview URL          | Previews are protected. Run it against the production URL.                                                                                                            |
| The page shows a floor plan instead of the 3D store | WebGL is off or unavailable. Turn on hardware acceleration in the browser. The floor plan still lets visitors browse every section.                                   |
| Try-on says "Camera is blocked" on a phone          | You are on `http://`. Use the Vercel preview or production URL, and allow the camera in the browser's site settings.                                                  |
| Try-on camera works locally but not on Vercel       | Check that `vercel.json` has `camera=(self)` in `Permissions-Policy`.                                                                                                 |
| "Try-on couldn't start on this device"              | Check the browser console for CSP errors, that `vercel.json` has `'wasm-unsafe-eval'` in `script-src`, and that `/vendor/mediapipe/1.0.1/wasm/…` exists in the build. |
| Try-on frame jitters                                | Improve the light and hold the phone at arm's length. Add `?tryon-debug` to the URL: the fps should be 24 or more.                                                    |
| Try-on is slow to start the first time              | The tracking files (about 15 MB) download once and are then cached for a year. The loading screen shows progress.                                                     |
| The 3D view is slow on a phone                      | **Info → Picture quality → Battery saver**. Automatic mode also lowers resolution when the frame rate drops.                                                          |

## 9. Before launch

- [ ] Replace the sample catalogue, prices and stock in `data/*.json`.
- [ ] Allow indexing in `public/robots.txt`.
- [ ] Connect real payments and bookings (`docs/backend-integration.md`), or relabel the demo checkout and booking.
- [ ] Agree retention and deletion periods for personal data (section 8 of `docs/backend-integration.md`).
- [ ] Add the client's domain and check the HTTPS certificate.
- [ ] Set up Vercel WAF rate limits for the API.
- [ ] Run `npm audit` and `npm run check`.
- [ ] Test on a real Android phone and an iPhone over mobile data.
- [ ] Run the try-on device checklist (`docs/try-on-testing.md`) on an Android phone, an iPhone and a desktop.
