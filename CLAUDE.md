# Brijman Virtual Showroom

Walkable 3D eyewear showroom for the web, built by Plexus Digitals. "Brijman Eyewear" and the whole catalogue are sample data. Static Vite + three.js site deployed on Vercel. Plain JavaScript (ES modules), no UI framework, no TypeScript.

## Commands

- `npm ci`: install exact versions from package-lock.json
- `npm run dev`: dev server at http://localhost:5173
- `npm run build`: production build to `dist/`
- `npm run preview`: serves `dist/` with the production security headers read from `vercel.json`
- `npm run format` / `npm run format:check`: Prettier (printWidth 120, single quotes, trailing commas)
- `npm run assets:check`: confirms every file listed in `assets-3d/catalogue.json` exists
- The developer machine runs Windows. npm scripts must be cross-platform: use Node scripts, not bash, `rm -rf` or `export`.

## Architecture

- `index.html` holds the page shell: top bar, floor-plan card, section and tour cards, detail sheet, welcome card.
- `src/main.js` loads fonts and CSS, imports `src/ui/app.js`, then lazy-loads `src/scene/showroom.js` (three.js) as a separate chunk.
- Shared namespace `BM` in `src/core/bm.js`, also exposed as `window.BM`. Data modules attach to it at import time:
  - `src/data/store-layout.js`: `BM.STORE`, `BM.L` (floor plan in metres), `BM.ZONES` (10 sections), `BM.TOUR`, `BM.TOUR_TEXT`, `BM.OBS` (fixture footprints)
  - `src/data/frames.js`: `BM.ARCH` (frame archetypes, sizes in metres), `BM.SHAPES`, `BM.outline()`
  - `src/data/catalogue.js`: colours, `BM.PRODUCTS` (41 frames and 7 contact lens or care items), `BM.byId`, `BM.MERCH` (which product sits on which shelf), `BM.LENS`, and the pricing helpers `priceOf`, `needsRx`, `needsAdd`, `lensRules`, `defaultCfg`, `cfgSummary`
- `src/ui/app.js` holds all interface code:
  - the views: product, browse, search, directory, bag, checkout, done, eye test, lens guide, info
  - the guided tour and the minimap
  - `validateRx`
  - the bag, stored in localStorage key `bm-bag-v1`, and settings in `bm-settings`
- `src/scene/showroom.js` builds the store procedurally, places products from `BM.MERCH`, and runs the walk planner (A\*), floating labels and the 3D product viewer. It talks to the UI only through `BM` callbacks: `attach3D`, `onProductTap`, `onFeatureTap`, `onArrive`, `onZoneChange`, `onPose`, `onUserNav`, `fail3D`.
- `src/lib/dom.js` has the DOM helpers `h`, `$`, `ic` and `money` (en-IN, ₹). `src/lib/drawings.js` has the SVG frame drawings, the size diagram and the canvas floor plan.
- `src/styles/main.css` holds the design tokens for light and dark themes and all styles. `src/styles/fonts.css` and `src/assets/fonts/` hold the self-hosted fonts.
- `assets-3d/` holds exported GLB models and PNG textures for 3D artists. The site does not load them, `.vercelignore` excludes them from deploys, and they must not be edited by hand.

## Invariants

- The 3D scene reads `BM.PRODUCTS`, `BM.MERCH`, `BM.L` and `BM.OBS` synchronously when it loads. Any data loaded asynchronously must be in `BM`, in the same shape, before `ui/app.js` and the scene are imported.
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
