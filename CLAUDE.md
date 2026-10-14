# Brijman Virtual Showroom

Walkable 3D eyewear showroom for the web, built by Plexus Digitals. "Brijman Eyewear" and the whole catalogue are sample data. Vite + three.js site with a Hono API (one Vercel Function), deployed on Vercel. Plain JavaScript (ES modules), no UI framework, no TypeScript.

## Commands

- `npm ci`: install exact versions from package-lock.json
- `npm run dev`: site and API at http://localhost:5173 (the API is mounted by `server/vite-api-plugin.js`)
- `npm run build`: production build to `dist/`
- `npm run preview`: serves `dist/` and the API with the production security headers read from `vercel.json`
- `npm test` / `npm run test:watch`: Vitest (tests in `tests/`, no network)
- `npm run check`: format check, tests, build; stops at the first failure
- `npm run smoke -- <baseUrl>`: post-deploy check of the site, API and headers
- `npm run format` / `npm run format:check`: Prettier (printWidth 120, single quotes, trailing commas)
- `npm run assets:check`: confirms every file listed in `assets-3d/catalogue.json` exists
- The developer machine runs Windows. npm scripts must be cross-platform: use Node scripts, not bash, `rm -rf` or `export`.

## Architecture

- `index.html` holds the page shell: top bar, floor-plan card, section and tour cards, detail sheet, welcome card.
- Boot order in `src/main.js`: fonts and CSS → `await loadInitialData()` (`src/services/data-loader.js`: one `GET /api/v1/bootstrap`, or the bundled `data/*.json` in static mode or when the API fails) → import `src/ui/app.js` → lazy-load `src/scene/showroom.js` (three.js chunk).
- Business data lives in `data/*.json`: `store.json` (store, zones, tour, tourText), `catalogue.json`, `merchandising.json`, `lenses.json`, `eye-test.json`.
- Shared namespace `BM` in `src/core/bm.js`, also exposed as `window.BM`:
  - `src/data/catalogue.js`: `installData()` fills `BM.STORE`, `BM.ZONES`, `BM.TOUR`, `BM.TOUR_TEXT`, `BM.PRODUCTS` (41 frames, 7 contact lens or care items), `BM.byId`, `BM.MERCH`, `BM.LENS`, and wraps the pricing helpers (`priceOf`, `cfgSummary`, `needsRx`, `needsAdd`, `lensRules`, `defaultCfg`, `colorOf`)
  - `src/data/store-layout.js`: `BM.L` (floor plan in metres), `BM.OBS` (fixture footprints), `zoneById`, `zoneAt`
  - `src/data/frames.js`: `BM.ARCH` (from `shared/frame-archetypes.js`), `BM.SHAPES`, `BM.outline()`
- `shared/` runs in the browser and Node: `pricing.js` (prices and `cfgProblem`), `rules.js` (prescription, contact and address rules), `schemas.js` (zod, strict objects), `constants.js`, `bootstrap.js`, `frame-archetypes.js`. The browser loads `schemas.js` (zod) lazily.
- `src/services/`: `http.js` (same-origin `/api/v1`, 8 s timeout, `ApiError`, one GET retry; `DATA_SOURCE` from `VITE_DATA_SOURCE`), `cart-service.js`, `order-service.js`, `eye-test-service.js`.
- `src/ui/app.js` holds all interface code:
  - the views: product, browse, search, directory, bag (server quote), rx (prescription for a bag line), checkout, done, eye test, lens guide, info
  - the guided tour and the minimap
  - the bag in localStorage `bm-bag-v1` (pid, ci, cfg, qty only) and settings in `bm-settings`; prescriptions in memory only (`S.rx`)
- `src/scene/showroom.js` builds the store procedurally, places products from `BM.MERCH`, and runs the walk planner (A*), floating labels and the 3D product viewer. It talks to the UI only through `BM` callbacks: `attach3D`, `onProductTap`, `onFeatureTap`, `onArrive`, `onZoneChange`, `onPose`, `onUserNav`, `fail3D`.
- API: `api/index.js` (Vercel entry) → `server/app.js` (Hono, `basePath('/api')`, routes under `/v1`). `server/routes/` → `server/services/` → `server/repositories/` (`DATA_SOURCE=static|http`) and `server/integrations/` (payments, notifications, crm: no-ops until configured). See `docs/api.md` and `docs/openapi.yaml`.
- `src/lib/dom.js` has the DOM helpers `h`, `$`, `ic` and `money` (en-IN, ₹). `src/lib/drawings.js` has the SVG frame drawings, the size diagram and the canvas floor plan.
- `src/styles/main.css` holds the design tokens for light and dark themes and all styles. `src/styles/fonts.css` and `src/assets/fonts/` hold the self-hosted fonts.
- `assets-3d/` holds exported GLB models and PNG textures for 3D artists. The site does not load them, `.vercelignore` excludes them from deploys, and they must not be edited by hand.

## Invariants

- The 3D scene reads `BM.PRODUCTS`, `BM.MERCH`, `BM.L` and `BM.OBS` synchronously when it loads. `loadInitialData()` must fill `BM`, in the same shape, before `ui/app.js` and the scene are imported. `tests/unit/snapshot.test.js` guards the shape.
- Units:
  - 3D is in metres.
  - Frame sizes are `[lens, bridge, temple]` in mm.
  - Prices are whole rupees, including GST.
  - Dates and times are in IST (Asia/Kolkata).
- Product ids (`m01`, `w03`, `s05`, `k01`, `p02`, `c01`…) and colour indexes are stable keys. Saved bags and shelf placement depend on them.
- Keep the current design, copy and behaviour unless a task says otherwise. Every change must work at 390 px width and on desktop, in light and dark themes, with keyboard focus states and reduced motion respected.
- The browser makes no requests to other origins. The CSP in `vercel.json` is `default-src 'self'`. Adding an external origin means changing the CSP on purpose and saying so in the summary.
- Keep `build.assetsInlineLimit: 0` in `vite.config.js`. Inlined data: fonts break the `font-src 'self'` policy.
- three.js is pinned at 0.180.0, Vite at 8.x, and Node must be 22.12 or newer.
- Every new dependency is pinned to an exact version and must be justified. Prefer none.

## Security (top priority)

- Never read, print, echo, stage or commit `.env` files or other credentials. `.env.example` is the only exception. Refer to secrets by variable name only. `.claude/settings.json` denies reading them as well.
- Secrets live in Vercel environment variables, and locally in a gitignored `.env`. Read them only in server code (`api/`, `server/`).
- Never give a secret a `VITE_` prefix: Vite puts every `VITE_` variable into the public bundle.
- The server recomputes prices, totals and availability. Never trust these values from the client.
- Validate every API input against a schema. Limit request body size. Return generic error messages with no stack traces.
- Names, phone numbers, addresses and prescriptions are personal data under India's DPDP Act:
  - Collect the minimum.
  - Never log them.
  - Never put them in URLs or localStorage.
  - Do not persist them while the data source is static.
- If you find a secret in code, logs, git history or the built bundle, stop and flag it.
- Before finishing a task, run `npm audit` and search `dist/` for anything that looks like a key or token.

## Code style

- ES modules, small focused files, and JSDoc on exported functions. Run Prettier on every change.
- `shared/` code must run in both the browser and Node, so it must not use DOM or Node-only APIs.
- User-facing copy is plain, short and in the active voice. Format numbers the en-IN way (₹2,490).
- Error messages say what went wrong and how to fix it.

## Working style

- Work in large batches. Do not stop for confirmation on routine steps. Ask only before decisions that are irreversible or genuinely ambiguous.
- Write changes directly into this project. Work on a feature branch and commit at each milestone with a clear message. Never push without being asked.
- Record significant decisions in `docs/decisions.md` (date, decision, reason).
- A task is done when:
  - `npm run format:check`, the tests and `npm run build` all pass;
  - `npm run preview` shows no console errors or CSP violations at desktop and 390 px width;
  - the docs and this file reflect the changes;
  - you have given a short summary of what changed, how to run it, and what is left.
