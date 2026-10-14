# Brijman Eyewear · Virtual Showroom

A walkable 3D eyewear showroom for the web. Visitors tap the floor to walk (the route goes around fixtures), drag to look around, and use the floor plan, directory, guided tour or search to find a section or frame. Tapping a frame opens its colours, real sizes (S, M, L), size guide, lens options and prescription entry. **Try on** puts the frame on your face at its true size, live from the camera or on a photo, all on the device. Items go into a bag priced by the server, with a demo checkout and eye-test booking.

It is built with [Vite](https://vite.dev), [three.js](https://threejs.org) and a small [Hono](https://hono.dev) API that runs as one Vercel Function. It needs no secrets and deploys to Vercel as-is.

**Everything is in this folder:** the source code, the API, the store data (`data/*.json`), the fonts (`src/assets/fonts`), the favicon, and every 3D model and texture from the showroom as `.glb` and `.png` files in [`assets-3d/`](assets-3d/README.md).

> **Sample data.** "Brijman Eyewear", the frames, prices and stock levels are placeholders. Checkout and eye-test booking are demos: the server checks them and returns a reference, but nothing is charged, booked or stored.

**Step-by-step guide from this folder to a live URL: [docs/setup-and-deploy.md](docs/setup-and-deploy.md).**

---

## Quick start

Needs Node.js 22.12 or newer (24 LTS recommended).

```bash
npm ci            # install the exact package versions
npm run dev       # site and API at http://localhost:5173
```

## Scripts

| Command                  | What it does                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `npm run dev`            | Site and API at http://localhost:5173 with live reload                                  |
| `npm run dev:phone`      | Same, reachable from phones on your Wi-Fi                                               |
| `npm run build`          | Production build into `dist/`                                                           |
| `npm run preview`        | Serves `dist/` and the API at http://localhost:4173 with the production headers         |
| `npm test`               | Runs the tests once (Vitest); `npm run test:watch` keeps them running                   |
| `npm run check`          | Format check, tests, build and the first-load size check; stops at the first failure    |
| `npm run bundle:check`   | After a build: fails if the showroom's first load grew more than 10 KB gzipped          |
| `npm run smoke -- <url>` | Checks a running site and its API, for example `npm run smoke -- http://localhost:4173` |
| `npm run format`         | Formats all files with Prettier                                                         |
| `npm run assets:check`   | Confirms every 3D model and texture in `assets-3d/` is present                          |

## Virtual try-on

Open any frame and tap **Try on** (or the face icon in search results). The camera works on `localhost` and on `https://` only, so test phones on a Vercel preview or the live site, not on `npm run dev:phone`.

- Face tracking is Google's MediaPipe (`@mediapipe/tasks-vision` 1.0.1), self-hosted under `/vendor/mediapipe/`. `scripts/copy-mediapipe.mjs` copies the wasm before `dev`, `build` and `preview` and checks the face model's hash.
- Frames are drawn at their real size from the iris-calibrated face width; the fit chip says "Good fit", "May feel narrow" or "May feel wide" (an estimate).
- Nothing from the camera leaves the device. See [docs/privacy-try-on.md](docs/privacy-try-on.md).
- Technical guide (maths, constants, adding artist `.glb` models, swapping in a vendor SDK): [docs/try-on.md](docs/try-on.md). Device checklist for QA: [docs/try-on-testing.md](docs/try-on-testing.md). Add `?tryon-debug` to the URL to see fps and inference time.

## Deploy

Push to GitHub and import the repository at https://vercel.com/new. `vercel.json` sets everything: the Vite build, the `/api` rewrite, the Mumbai (`bom1`) function region and the security headers. No environment variables are needed. Full steps, the dashboard settings and troubleshooting are in [docs/setup-and-deploy.md](docs/setup-and-deploy.md).

## Change the store data

The catalogue, prices, lens options, shelf placement, sections, tour and eye-test slots live in `data/*.json`. Change a price in `data/catalogue.json` and it changes on the shelves, in the product sheet, the bag and checkout. The table in [docs/setup-and-deploy.md § 7](docs/setup-and-deploy.md#7-change-the-data) lists which file holds what.

## Environment variables

None are needed today. All are optional:

| Variable           | Where   | Values                     | Purpose                                                                            |
| ------------------ | ------- | -------------------------- | ---------------------------------------------------------------------------------- |
| `DATA_SOURCE`      | Server  | `static` (default), `http` | Where the API reads data: `data/*.json` or a backend                               |
| `BACKEND_API_URL`  | Server  | https URL                  | The backend for `DATA_SOURCE=http`                                                 |
| `BACKEND_API_KEY`  | Server  | secret                     | Sent to that backend as the `X-Api-Key` header                                     |
| `VITE_DATA_SOURCE` | Browser | `api` (default), `static`  | `static` builds a site that never calls `/api` (checkout and booking switched off) |

Payment, WhatsApp and CRM variables are listed in `.env.example` and [docs/backend-integration.md](docs/backend-integration.md). Never give a secret a `VITE_` prefix: Vite copies those into the public bundle.

## Documentation

- [docs/setup-and-deploy.md](docs/setup-and-deploy.md): install, run, test, preview, deploy, domains, troubleshooting
- [docs/api.md](docs/api.md): API reference with curl examples
- [docs/openapi.yaml](docs/openapi.yaml): OpenAPI 3.1 contract, including what a future backend must expose
- [docs/backend-integration.md](docs/backend-integration.md): connecting a backend, Supabase, Razorpay, WhatsApp (WaMark), DGCC, rate limiting and DPDP notes
- [docs/try-on.md](docs/try-on.md), [docs/privacy-try-on.md](docs/privacy-try-on.md), [docs/try-on-testing.md](docs/try-on-testing.md): the virtual try-on
- [docs/decisions.md](docs/decisions.md): why things are the way they are

## Security notes

- **No secrets in the browser.** Everything in `src/` ends up in the public bundle. Secrets live only in Vercel environment variables, read by `server/` code.
- **The server sets the prices.** `POST /api/v1/cart/quote` and `POST /api/v1/orders` re-price every line with `shared/pricing.js` and reject unknown products, colours and lens options.
- **Strict input checks.** Request bodies must be JSON, at most 16 KB, and match strict zod schemas (`shared/schemas.js`), which reject unknown keys. Errors never include stack traces.
- **Same origin only.** The API sends no CORS headers, and the CSP keeps `connect-src 'self'`.
- **Personal data.** Name, mobile, address and prescription are sent once with an order or booking. They are never logged, never put in a URL and never saved in localStorage. In static mode the server stores nothing. The browser keeps only the bag (product, colour, lens choice, quantity) and display settings.
- **Security headers** in `vercel.json`: a strict Content-Security-Policy (`'wasm-unsafe-eval'` is the only addition, for the try-on's WebAssembly), nosniff, a referrer policy, HSTS and a permissions policy that allows the camera for this site only (`camera=(self)`) and turns off microphone, location and payment APIs. `npm run preview` sends the same headers.
- **Try-on privacy.** The camera starts only after the shopper allows it, stops on close or when the page is hidden, and no frame, landmark, measurement or photo is uploaded, logged or stored.
- **Fonts are self-hosted**, so no request leaves the visitor's browser for a third party.
- **Dependencies** are pinned to exact versions. `npm audit` reported 0 vulnerabilities when this version was built.

## Project structure

```
brijman-virtual-showroom/
├─ index.html                 Page shell: top bar, floor-plan card, section and tour cards, detail sheet
├─ api/index.js               Vercel Function entry: exports the Hono app's fetch
├─ server/
│  ├─ app.js                  Hono app: request id, headers, logging, rate-limit hook, routes, errors
│  ├─ routes/                 catalogue.js (health, bootstrap, store, products, lenses), commerce.js (cart, orders, eye test)
│  ├─ services/               catalogue, quote, order and eye-test logic
│  ├─ repositories/           contract, StaticRepository (data/*.json), HttpRepository (future backend)
│  ├─ integrations/           payments, notifications, crm: no-ops until configured
│  ├─ lib/                    errors, responses, request helpers, IST dates, hashing
│  └─ vite-api-plugin.js      Serves the API inside npm run dev and npm run preview
├─ shared/                    Runs in the browser and in Node: pricing, rules, zod schemas, constants, frame archetypes,
│                             fit guide and sizes (fit.js), MediaPipe canonical face
├─ data/                      store.json, catalogue.json, merchandising.json, lenses.json, eye-test.json
├─ src/
│  ├─ main.js                 Entry: fonts and styles, load data, then the UI, then the 3D scene
│  ├─ services/               http client, data loader, cart, order and eye-test services
│  ├─ core/bm.js              Shared namespace (window.BM) for data and the UI ↔ 3D bridge
│  ├─ data/                   store-layout.js (floor plan), frames.js (shape maths), catalogue.js (fills BM)
│  ├─ lib/                    DOM helpers, SVG frame drawings, canvas floor plan
│  ├─ ui/app.js               Interface: navigation, tour, search, product sheet (sizes), bag, checkout, eye test
│  ├─ tryon/                  Virtual try-on (lazy): ui.js, engine.js, face-math.js, one-euro.js, analytics.js, tryon.css
│  ├─ three/frame-model.js    Frame geometry at real mm sizes and materials, shared by shelves, viewer and try-on
│  ├─ scene/showroom.js       3D store, frames, walk planner, labels, product viewer
│  ├─ assets/fonts/           Hanken Grotesk, Martian Mono and Unbounded (woff2) with licences
│  └─ styles/                 main.css (design tokens, light and dark) and fonts.css
├─ tests/                     unit, route, Vercel entry and repository contract tests
├─ public/vendor/mediapipe/   Face model (committed) and the wasm runtime (copied at build time, gitignored)
├─ scripts/                   smoke.mjs, check-assets.mjs, copy-mediapipe.mjs, check-bundle.mjs
├─ assets-3d/                 Every 3D model (.glb) and texture (.png), for 3D artists (not loaded by the site)
├─ docs/                      Guides, API reference, OpenAPI, decisions
├─ vercel.json                Build settings, rewrite, region, function limits, security headers
└─ vite.config.js             Build settings and the local API plugin
```
