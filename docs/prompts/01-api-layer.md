# Brijman Virtual Showroom: API layer, local run and Vercel deployment

This file has two parts:

- **Part 1 is for you.** It covers setup, how to start Claude Code, how to run the result and how to put it live on Vercel.
- **Part 2 is the brief Claude Code follows.** In the Claude Code panel in VS Code, send: `Follow @docs/prompts/01-api-layer.md`

---

# Part 1: Steps for you

## 1.1 What you will end up with

- **The same 3D showroom**, now backed by an API: `/api/v1/...` for catalogue, products, lens options, cart prices, demo orders, eye-test slots and bookings.
- **Data in JSON files** (`data/*.json`). Changing a price there updates the shelves, product sheet, bag and checkout everywhere.
- **One command to run the site and the API locally**: `npm run dev`.
- **A Vercel setup ready for production.** That means the API rewrite, the Mumbai (`bom1`) function region, security headers, and a smoke test to check a live deployment.
- **Docs**: `docs/setup-and-deploy.md`, `docs/api.md`, `docs/openapi.yaml` and `docs/backend-integration.md`, which explains how to connect the real backend later.

Payments, a database, WhatsApp and DGCC are **not** included. The API leaves ready-made hooks for them.

## 1.2 Install once

| Tool                  | Version                       | Link                                                                 |
| --------------------- | ----------------------------- | -------------------------------------------------------------------- |
| Node.js               | 24 LTS (22.12 or newer works) | https://nodejs.org                                                   |
| Git                   | latest                        | https://git-scm.com                                                  |
| VS Code               | latest                        | https://code.visualstudio.com                                        |
| Claude Code extension | latest                        | VS Code → Extensions (Ctrl+Shift+X) → search "Claude Code" → Install |
| GitHub account        | free                          | https://github.com                                                   |
| Vercel account        | Hobby (free) is enough        | https://vercel.com/signup                                            |

Check in a new terminal: `node -v` should print v22.12 or higher, and `git --version` should print a version.

## 1.3 Put the files in place

1. Unzip `brijman-virtual-showroom.zip`, for example to `C:\Projects\brijman-virtual-showroom`.
2. Unzip `claude-code-kit.zip` **inside that folder**. `CLAUDE.md` should sit next to `package.json`, and this file should be at `docs/prompts/01-api-layer.md`.
3. Open the folder in VS Code (**File → Open Folder**).
4. Open a terminal (**Terminal → New Terminal**) and run `npm ci`.

## 1.4 Run the task in Claude Code

1. Click the Spark icon in the top-right of the editor (open any file first) and sign in.
2. Type `/context` and check that `CLAUDE.md` is listed under Memory files.
3. Send: `Follow @docs/prompts/01-api-layer.md`. Pick the file from the `@` suggestions so it attaches.
4. To review the approach first, send `/plan Follow @docs/prompts/01-api-layer.md` instead, then approve the plan.
5. Claude Code works through six phases and commits after each one on the branch `feature/api-layer`.
6. It will ask before it runs any `vercel` command or `git push`. That is set in `.claude/settings.json`. It cannot read `.env` files.
7. At the end it replies with a summary, the exact commands, and anything it could not verify.

## 1.5 Run it on your computer (after the task finishes)

```bash
npm ci              # installs the new packages (hono, zod, vitest)
npm run dev         # site and API at http://localhost:5173
npm test            # automated tests
npm run check       # format check, tests and production build, in one go
npm run build
npm run preview     # production build and API at http://localhost:4173, with live security headers
npm run smoke -- http://localhost:4173   # checks the API and headers against the running preview
```

Quick checks in the browser:

- http://localhost:5173/api/v1/health should show `{"data":{"status":"ok",...}}`
- Open a frame, choose single vision, enter a prescription and add it to the bag. The bag shows "Prices confirmed".
- Check out with a test name and mobile, for example `9876543210`. You get an `BM-DEMO-…` reference and nothing is charged.
- Open **Eye test** and book a slot. You get an `BM-ET-DEMO-…` reference.

No `.env` file is needed. Everything runs on the static data.

## 1.6 Put it live on Vercel

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
5. Check the live site:

   ```bash
   npm run smoke -- https://brijman-virtual-showroom.vercel.app
   ```

   Use your project's production URL. Preview URLs are behind Vercel login by default, so run the smoke test against production.

### Option B: Vercel CLI from VS Code

```bash
npx vercel login
npx vercel link            # connect this folder to a new or existing Vercel project
npx vercel                 # preview deployment (the first one becomes production)
npx vercel --prod          # production deployment
npm run smoke -- https://YOUR-PROJECT.vercel.app
```

### Vercel settings to confirm in the dashboard

| Setting               | Where                            | Value                                                                                            |
| --------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------ |
| Node.js version       | Settings → Build and Deployment  | 24.x (set automatically from `package.json`)                                                     |
| Function region       | Settings → Functions             | Mumbai, `bom1` (set by `vercel.json`)                                                            |
| Environment variables | Settings → Environment Variables | None needed today. Add later only when connecting a backend (see `docs/backend-integration.md`). |
| Domain                | Settings → Domains               | Add, for example, `showroom.clientdomain.com` and create the CNAME record Vercel shows           |
| Deployment Protection | Settings → Deployment Protection | Keep the default: previews require login and production stays public                             |

**Before launch:**

- Replace the sample catalogue.
- Allow indexing in `public/robots.txt`.
- Remove or relabel the demo checkout.
- Test on a real Android phone and an iPhone.

## 1.7 If something goes wrong

| Problem                                        | Fix                                                                                                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/api/...` returns 404 on Vercel               | Check that `vercel.json` has the `/api/(.*)` → `/api` rewrite and that `api/index.js` exists. Redeploy.                                                                  |
| `/api/...` works locally but not on Vercel     | Open the deployment's **Logs** tab in Vercel and look for an import error or a missing file in `server/` or `data/`.                                                     |
| Console shows CSP errors only on preview links | The Vercel Toolbar on previews loads scripts from another domain. Either turn the toolbar off for the project or ignore it on previews. Never loosen the production CSP. |
| `npm ci` fails                                 | Delete `node_modules` and run `npm install`, then commit the new `package-lock.json`.                                                                                    |
| PowerShell says "running scripts is disabled"  | Use `npx vercel …`, switch the terminal to Command Prompt, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.                                            |
| Smoke test fails with 401 on a preview URL     | Previews are protected. Run it against the production URL.                                                                                                               |

---

# Part 2: Brief for Claude Code

You are working in the Brijman Virtual Showroom project.

**Read first:**

- `CLAUDE.md` and `README.md`.
- If `CLAUDE.md` is missing, the rules in "Project rules (summary)" below apply.
- Then read, before changing anything: `src/main.js`, `src/core/bm.js`, `src/data/store-layout.js`, `src/data/frames.js`, `src/data/catalogue.js`, `src/ui/app.js` (bag, checkout, eye test and product views, and `validateRx`), the data reads at the top of `src/scene/showroom.js`, `vercel.json`, `vite.config.js` and `package.json`.

## Project rules (summary)

- **Stack.** Plain JavaScript ES modules, Vite 8, three.js 0.180.0 (pinned), Node 22.12 or newer. No TypeScript, no UI framework.
- **Windows.** The developer works on Windows. npm scripts must be cross-platform, so use Node scripts rather than bash.
- **Secrets:**
  - Never read, print, stage or commit `.env` files or credentials, except `.env.example`.
  - Secrets live only in Vercel environment variables, or in a local `.env` that is gitignored. Read them only in server code.
  - Never give a secret a `VITE_` prefix.
- **Server checks.** The server recomputes all prices and totals and validates every input. Responses never include stack traces.
- **Personal data.** Names, mobile numbers, addresses and prescriptions are personal data under India's DPDP Act. Never log them, never put them in URLs or localStorage, and never persist them in static mode.
- **Same-origin only.** The browser talks only to its own origin and the CSP stays `connect-src 'self'`. Keep `assetsInlineLimit: 0`.
- **Look and feel.** Keep the design, copy and behaviour as they are. Everything must work at 390 px and on desktop, in light and dark themes.
- **Working style:**
  - Work in large batches and do not stop for routine confirmations.
  - Ask only before irreversible or genuinely ambiguous decisions.
  - Record decisions in `docs/decisions.md`.

## Goal

The data that drives the store is now hard-coded in JavaScript:

- catalogue
- lens options and prices
- shelf placement
- store details
- eye test slots

Move it into JSON files and serve it through an API on Vercel.

The frontend gets its data and sends orders and bookings only through that API, using a small service layer.

The API reads through a **repository** interface. Today the only implementation is `StaticRepository`, which reads the JSON files. Later a real backend (our Node server, Supabase or DGCC) replaces it by changing an environment variable and adding one repository file. The frontend does not change when that happens.

Everything that works today must keep working, look the same and stay as fast. That includes the 3D store, tour, search, product sheet, lens configurator and bag.

You also set up local running, tests, a smoke test and the Vercel configuration, and you write the setup and deploy guide.

## Decisions already made (follow these)

| Area               | Decision                                                                                                                                                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API runtime        | One Vercel Function, `api/index.js`, exporting `export default { fetch: app.fetch }`. The router is a Hono app in `server/app.js` with `basePath('/api')`. Vercel recommends one shared function with a router rather than one function per endpoint.                         |
| Routing on Vercel  | Add the rewrite `{ "source": "/api/(.*)", "destination": "/api" }` to `vercel.json`. Prove with a test, and with `vercel dev` if it is available, that the original path reaches the router.                                                                                  |
| Versioning         | All routes live under `/api/v1/…`.                                                                                                                                                                                                                                            |
| Validation         | Zod schemas in `shared/schemas.js`, used by both the server and the browser. There is one source of rules.                                                                                                                                                                    |
| Shared logic       | Pricing and lens rules move to `shared/pricing.js`. They are pure functions with no DOM or Node APIs.                                                                                                                                                                         |
| Data files         | Business data goes in `data/*.json`. The 3D layout (`BM.L`, `BM.OBS`) and the frame shape maths (`BM.ARCH`, `BM.SHAPES`, `outline`) stay in code.                                                                                                                             |
| Data source switch | Server: `DATA_SOURCE=static` (default) or `http`. Browser: `VITE_DATA_SOURCE=api` (default) or `static`. The browser flag is public and never carries a secret.                                                                                                               |
| Local API          | The Vite plugin `server/vite-api-plugin.js` mounts the same Hono app on `/api` in `configureServer` and `configurePreviewServer`, so `npm run dev` and `npm run preview` serve the API without Vercel login. `vercel dev` must also work.                                     |
| Tests              | Vitest. Test routes with Hono's `app.request()`, with no network calls.                                                                                                                                                                                                       |
| Versions           | Pin every new package to an exact version released at least two weeks ago. `npm audit` must report 0 vulnerabilities. Expected additions: `hono`, `zod`, `vitest`, and `@hono/node-server` if the Vite plugin needs it. Justify anything beyond these in `docs/decisions.md`. |

## Target structure

```
api/index.js                     Vercel entry: exports the Hono app's fetch
server/
  app.js                         Hono app: request id, body-size guard, error handler, routes, rate-limit hook
  routes/                        health, bootstrap, store, products, lenses, cart, orders, eye-test
  services/                      quote, order and booking logic (uses shared/ and a repository)
  repositories/
    index.js                     picks the repository from DATA_SOURCE
    static-repository.js         reads data/*.json; fully implemented
    http-repository.js           future backend over HTTP: implemented against docs/openapi.yaml, never used by default
    contract.js                  JSDoc interface that every repository implements
  integrations/                  payments.js, notifications.js, crm.js: no-op adapters
  lib/                           errors, response helpers, IST date utilities
  vite-api-plugin.js
shared/
  pricing.js                     priceOf, lensRules, defaultCfg, needsRx, needsAdd, cfgSummary (moved, unchanged)
  schemas.js                     zod schemas: cart line, lens config, prescription, contact, address, order, booking
  constants.js                   limits, currency, timezone
data/
  store.json                     store details, zones (names, blurbs, view and anchor points), tour order and text
  catalogue.json                 products with explicit colour objects
  merchandising.json             was BM.MERCH
  lenses.json                    was BM.LENS
  eye-test.json                  slot times, opening hours, duration, booking window in days, closed dates
src/services/
  http.js                        fetch wrapper: same-origin, 8 s timeout, typed errors, one retry for GET
  data-loader.js                 loads initial data (api or static) and fills BM in today's shape
  cart-service.js, order-service.js, eye-test-service.js
scripts/smoke.mjs                post-deploy check against any base URL
tests/                           unit, route, repository-contract and snapshot tests
docs/setup-and-deploy.md, docs/api.md, docs/openapi.yaml, docs/backend-integration.md, docs/decisions.md
```

## Data migration rules

- Do not retype data by hand. Write a one-off Node script that imports the current data modules and writes the JSON files:
  - stub `window` and `matchMedia` for `src/core/bm.js`;
  - write colours as plain objects with the existing fields `n`, `a`, `k`, `tl`, `matte`, `m`, `l`, `lk`, `sw`, `sw2`.
- Before migrating, save a snapshot of the current `BM.PRODUCTS`, `BM.MERCH`, `BM.LENS`, `BM.STORE`, `BM.ZONES`, `BM.TOUR` and `BM.TOUR_TEXT` to `tests/fixtures/pre-migration-snapshot.json`.
- Add a test that rebuilds `BM` from the JSON and deep-compares it with the snapshot. Delete the one-off script once that test passes.
- After migration:
  - `src/data/catalogue.js` and `src/data/store-layout.js` no longer define business data;
  - `data-loader.js` fills `BM` in the same shape as today, including `BM.byId`;
  - the UI and the 3D scene keep reading `BM` unchanged.

## Boot order (important)

The 3D scene reads `BM.PRODUCTS`, `BM.MERCH`, `BM.L` and `BM.OBS` synchronously when it loads. `src/main.js` must therefore:

1. load fonts and CSS;
2. `await loadInitialData()` (one call to `GET /api/v1/bootstrap`, or the bundled JSON in static mode);
3. fill `BM`;
4. import `src/ui/app.js`;
5. lazy-import the scene.

While data loads, the welcome card's status line shows "Loading the showroom…".

If the API fails in `api` mode:

- fall back to the bundled JSON;
- show a short, non-blocking toast: "Showing the saved catalogue. Prices are confirmed at checkout.";
- leave checkout and booking enabled; they still need the API and show a clear error if it is down.

## API (v1)

All responses are JSON. Success responses use `{ "data": …, "meta": {…} }` and errors use `{ "error": { "code", "message", "fields"? } }`. Use these statuses:

- 400 for malformed JSON
- 404 for an unknown route or id
- 405 for a wrong method
- 413 for a body over 16 KB
- 415 for a content type that is not JSON
- 422 when validation fails
- 500 for anything else, with a generic message

Every response carries `X-Request-Id`.

| Method and path                  | Purpose                                                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/health`             | Liveness                                                       | `{ status, dataSource, version, time }`. Response is `no-store`.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `GET /api/v1/bootstrap`          | Everything the first screen needs in one call                  | Store, zones, tour, catalogue, merchandising and lenses. Add an `ETag` and `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`.                                                                                                                                                                                                                                                                                                                               |
| `GET /api/v1/store`              | Store details, zones, tour                                     | Cached like bootstrap.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `GET /api/v1/products`           | Search and filter                                              | Query: `zone`, `q`, `shape`, `material`, `polarised`, `maxPrice`, `type`. The UI keeps its instant client-side search.                                                                                                                                                                                                                                                                                                                                                        |
| `GET /api/v1/products/:id`       | One product                                                    | 404 if unknown.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `GET /api/v1/lenses`             | Lens types, index, coatings, sun options, prescription options | Cached.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `POST /api/v1/cart/quote`        | Server prices for a bag                                        | Body: `{ lines: [{ productId, colourIndex, config, qty }] }`. Recompute with `shared/pricing.js`. Return each line's unit price and line total, plus subtotal, delivery, total, `currency: "INR"`, `taxIncluded: true` and a `quoteId` (a hash of the inputs and prices). Reject unknown products, out-of-range colours, configs not allowed for the product, and quantity rules broken (frames are 1; contacts and care up to 12; at most 20 lines). Response is `no-store`. |
| `POST /api/v1/orders`            | Demo order                                                     | Body: lines, contact (name; Indian mobile of 10 digits starting 6–9; optional email), delivery (`home` with line1, city, 6-digit PIN code, or `store`), prescriptions per line where needed, and `consent: true`. Validate and re-quote, then return `{ orderRef: "BM-DEMO-XXXXXX", status: "demo_not_charged", total, lines }`. Store nothing in static mode. Accept an `Idempotency-Key` header (a UUID) and echo it back. Response is `no-store`.                          |
| `GET /api/v1/eye-test/slots`     | Available slots                                                | Query: `from` (YYYY-MM-DD) and `days` (1–14). Generated from `data/eye-test.json` in IST (Asia/Kolkata), never server UTC. Past slots are excluded.                                                                                                                                                                                                                                                                                                                           |
| `POST /api/v1/eye-test/bookings` | Demo booking                                                   | Body: `{ slotStart, name, mobile, consent: true }`. The slot must exist and be in the future. Returns `{ bookingRef: "BM-ET-DEMO-XXXX", status: "demo_not_booked" }`. Response is `no-store`.                                                                                                                                                                                                                                                                                 |

Keep these business rules exactly as they are now; tests must cover each one:

- Lens type: zero power ₹0, single vision ₹1,200, bifocal ₹2,400, progressive ₹4,900.
- Lens index: 1.56 ₹0, 1.60 ₹900, 1.67 ₹2,200, 1.74 ₹4,500.
- Coatings: anti-glare included, blue-cut ₹900, photochromic ₹1,900.
- Prescription sun lenses add ₹2,900.
- Kids' frames allow only zero power and single vision, at index 1.56 or 1.60.
- Zero power always uses index 1.56. Sunglasses use the sun lens options only.
- Prescription limits:
  - SPH −20.00 to +12.00 in 0.25 steps;
  - CYL −6.00 to 0.00 in 0.25 steps;
  - AXIS a whole number from 1 to 180, required when CYL is not 0;
  - ADD +0.75 to +3.50, required for bifocal and progressive;
  - PD 50 to 76 mm.
- Delivery is free and prices include GST.

## Frontend changes

- **`src/services/http.js`:**
  - relative `/api/v1/...` URLs only;
  - 8 s `AbortController` timeout;
  - parse the error envelope into an `ApiError` with `code`, `message` and `fields`;
  - retry a GET once on network failure; never retry a POST.
- **Bag:**
  - On open, call `cart/quote` and show the server totals with the label "Prices confirmed".
  - If a price has changed, update the line and show a short note.
  - If a product no longer exists, remove it and say which one.
  - Show the instant client estimate while the quote loads.
- **Prescriptions:**
  - Today the typed prescription is validated but not attached to the bag line. Attach it to the line in memory only, never in localStorage, and send it with the order.
  - After a reload, a line that needs a prescription shows "Add your prescription" with the options to enter it, add it later, or book an eye test.
- **Checkout:**
  - Add contact fields (name, mobile, optional email) and address fields for home delivery (line1, city, PIN code), styled like the existing forms.
  - Validate inline with the shared schemas.
  - Add a consent checkbox: "I agree that Brijman Eyewear may use these details to process this order."
  - Place the order through the API and show the returned reference.
  - Keep the "Demo checkout" notice.
  - Generate the idempotency key once per checkout attempt.
- **Eye test:**
  - Load slots from the API and show only real, future slots.
  - Submit the booking through the API.
  - Show the reference from the response, and keep the demo wording.
- **localStorage** keeps only `bm-bag-v1` (product id, colour index, lens config, quantity) and `bm-settings`. Never store contact details, addresses or prescription values there.

## Security requirements

- No CORS headers: the API is same-origin only. Do not add `Access-Control-Allow-Origin`.
- Check the body size before parsing, require `Content-Type: application/json` on POST, and use strict object schemas that reject unknown keys.
- Log only route, status, duration and request id. Never log bodies or personal data.
- Rate limiting is not done in this task, because an in-memory limiter is useless on serverless. Add a marked hook in `server/app.js` and document Vercel WAF rate limiting in `docs/backend-integration.md`.
- `HttpRepository`:
  - reads `BACKEND_API_URL` and `BACKEND_API_KEY` on the server only;
  - sends the key as a header, never in a URL;
  - throws a clear "not configured" error if either variable is missing.
- Update `.env.example` with `DATA_SOURCE`, `BACKEND_API_URL`, `BACKEND_API_KEY`, `VITE_DATA_SOURCE` and a comment for each. Names only, no values.
- Add `CLAUDE.local.md` and `.claude/settings.local.json` to `.gitignore`.

## Future hooks (seams only)

Create `server/integrations/payments.js`, `notifications.js` and `crm.js`:

| File               | Planned use                                  | Functions                                                            |
| ------------------ | -------------------------------------------- | -------------------------------------------------------------------- |
| `payments.js`      | Razorpay                                     | `createPayment(order)`, `verifyWebhookSignature(rawBody, signature)` |
| `notifications.js` | WhatsApp updates through WaMark              | `sendOrderUpdate(order)`, `sendBookingUpdate(booking)`               |
| `crm.js`           | Pushing orders and bookings to DGCC as leads | `pushLead(event)`                                                    |

Each function returns `{ skipped: true, reason: 'not_configured' }` until its env vars exist. The order and booking services call these hooks already. Document each hook's planned env vars in `docs/backend-integration.md`.

## Local run setup

`package.json` scripts, all cross-platform:

| Script           | Command and purpose                                                               |
| ---------------- | --------------------------------------------------------------------------------- |
| `dev`            | `vite`: site and API on port 5173 through the Vite plugin                         |
| `dev:phone`      | `vite --host`                                                                     |
| `build`          | `vite build`                                                                      |
| `preview`        | `vite preview`: production build, API and the security headers from `vercel.json` |
| `test`           | `vitest run`                                                                      |
| `test:watch`     | `vitest`                                                                          |
| `check`          | format check, then tests, then build; stop at the first failure                   |
| `smoke`          | `node scripts/smoke.mjs`; the base URL comes as an argument                       |
| Keep as they are | `format`, `format:check`, `assets:check`                                          |

`scripts/smoke.mjs <baseUrl>` uses Node's built-in `fetch` and no dependencies. It prints a pass or fail line for each check and exits with code 1 on any failure. It checks:

- `/` returns 200 with a `Content-Security-Policy` header;
- `GET /api/v1/health` returns 200 with `status: "ok"`;
- `GET /api/v1/bootstrap` returns 200, an `ETag`, and 48 products;
- `GET /api/v1/products/m01` returns 200, and `/api/v1/products/zz99` returns 404 with the error envelope;
- `POST /api/v1/cart/quote` for `m01`, colour 0:
  - with zero power the total is 2490;
  - with single vision, index 1.60 and blue-cut the total is 5490;
- a `text/plain` POST returns 415, and a `GET` on `/api/v1/cart/quote` returns 405;
- API responses have `X-Content-Type-Options: nosniff` and `X-Request-Id`, and no `Access-Control-Allow-Origin`.

## Vercel setup

Final `vercel.json`. Keep the existing headers and add the rest:

- `framework: "vite"`, `installCommand: "npm ci"`, `buildCommand: "npm run build"`, `outputDirectory: "dist"`
- `regions: ["bom1"]` (Mumbai, the closest region to our users; Hobby plans allow one region)
- `functions: { "api/index.js": { "maxDuration": 10 } }`
- `rewrites: [{ "source": "/api/(.*)", "destination": "/api" }]`
- the existing security headers on `/(.*)`, and the long-term cache header on `/assets/(.*)`
- no `Cache-Control` rule for `/api` in `vercel.json`; each route sets its own `Cache-Control`

Also:

- Keep `.vercelignore` excluding `assets-3d/`. Make sure `data/`, `server/` and `shared/` are **not** ignored, because the function needs them.
- `engines.node` stays `>=22.12.0`, which Vercel maps to its Node 24 runtime.
- **Do not deploy by yourself.** If the Vercel CLI is installed and logged in, you may _ask_ to run `npx vercel` for a preview. The `.claude/settings.json` file will prompt the user. Otherwise, write the exact commands in your final reply.
- Never run `vercel env pull`, and never create or read `.env` files.

## Documentation

- **`docs/setup-and-deploy.md`** is the human guide. Base it on Part 1 of this file, but update it to match exactly what you built: install, run, test, preview, the smoke test, Vercel options A and B, the dashboard settings table, domains, troubleshooting, and the before-launch checklist.
- **`docs/openapi.yaml`** is OpenAPI 3.1 for every endpoint, with schemas and error responses. It is the contract a future backend must implement.
- **`docs/api.md`** is a readable reference with a curl example for each endpoint.
- **`docs/backend-integration.md`** must explain:
  - how to switch `DATA_SOURCE` to `http`;
  - what the backend must expose;
  - how to add a Supabase or Postgres repository;
  - where Razorpay, WhatsApp (WaMark) and DGCC connect;
  - which env vars go in Vercel, and in which environment (Production, Preview, Development);
  - Vercel WAF rate limiting;
  - the DPDP notes on retention and deletion.
- **`README.md`**: update the run, test and deploy sections and the env var table, and link to `docs/setup-and-deploy.md`.
- **`CLAUDE.md`**: update the Architecture and Commands sections, keeping the file under 200 lines.
- **`docs/decisions.md`**: an entry for every non-obvious choice.

## Phases

Commit at the end of each phase on branch `feature/api-layer`. If the folder is not a git repository yet, run `git init`, commit the untouched project as "Baseline before API layer", then create the branch.

1. **Baseline.** Run `npm ci`, `npm run build` and `npm run assets:check`. Save the data snapshot. Add Vitest and a first passing test.
2. **Shared and data.** Create `shared/`, migrate the data to `data/*.json`, and add `data-loader.js` in static mode. Prove the behaviour is identical with the snapshot test and the preview.
3. **Server.** Add the repositories, services, routes, error handling, `api/index.js` and the Vite plugin. Write route tests for every endpoint, covering success and error cases. Write a repository contract test that runs against `StaticRepository` and is skipped for `HttpRepository` unless its env vars are set.
4. **Frontend integration.** Switch to `api` mode by default. Update the bag, checkout and eye test views and add the fallback.
5. **Local run and Vercel config.** Add the scripts, `scripts/smoke.mjs`, the final `vercel.json` and `.env.example`, and run the smoke test against `npm run preview`.
6. **Docs and hardening.** Write all the docs and review security: scan `dist/` for anything that looks like a key, run `npm audit`, and check the CSP in the preview. Merge-ready, but do not push.

## Acceptance criteria

- [ ] `npm run check` passes and `npm audit` reports 0 vulnerabilities.
- [ ] `npm run dev` and `npm run preview` both serve `/api/v1/health`. `npm run smoke -- http://localhost:4173` passes every check.
- [ ] In the preview at 1366 px and 390 px width, all of these work with no console errors and no CSP violations. Use headless Playwright if available, and list any check you could not run.
  - walking, tour, search and the product sheet;
  - adding a single-vision frame with a prescription;
  - the bag showing the server quote;
  - a demo order returning an `BM-DEMO-` reference;
  - an eye test booking.
- [ ] The snapshot test proves the catalogue, prices, lenses, merchandising, zones and tour are unchanged.
- [ ] Changing a price in `data/catalogue.json` changes it everywhere, with no other file edited.
- [ ] A build with `VITE_DATA_SOURCE=static` works with no `/api`. Checkout and booking then show a clear "unavailable" message.
- [ ] The 3D scene renders 188 products on display, the same as today.
- [ ] No personal data in logs, URLs or localStorage. No `VITE_` secret anywhere. No external origins added.
- [ ] `vercel.json` has the rewrite, the `bom1` region, the function `maxDuration` and the security headers. `.vercelignore` excludes only `assets-3d/`.
- [ ] `docs/setup-and-deploy.md` lets a new developer go from zip to live URL without asking anyone.

## When you finish

Reply with:

1. what changed, grouped by phase;
2. the exact commands to run, test, preview, smoke-test and deploy;
3. the Vercel settings to confirm, and the env vars to set (none for static mode);
4. anything you could not verify, any deviation from this brief, and why;
5. suggested next tasks: a Supabase repository, Razorpay payments, WhatsApp updates through WaMark, and the DGCC lead push.

If anything in this brief conflicts with how the code actually works, keep the existing behaviour, note the conflict in `docs/decisions.md`, and mention it in your reply.
