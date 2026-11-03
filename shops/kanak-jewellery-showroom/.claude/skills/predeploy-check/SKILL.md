---
name: predeploy-check
description: 'Check this project is ready to deploy on Vercel: format, unit tests, build with try-on models, assets, npm audit, secrets and vercel.json.'
disable-model-invocation: true
---

Check that this project (Kanak jewellery boutique) is ready to deploy on Vercel. Read `CLAUDE.md` first; its security rules come before everything else. Never open, print or commit `.env` files. Do not deploy, push or commit; only check and report.

1. Run `npm ci` if `node_modules/` is missing, then `npm run format:check`, `npm test` and `npm run build`. The build runs `scripts/setup-tryon.mjs` first: it must end with "models ready" (or "model ready"). If it says a model is missing, run `npm run setup:tryon` (it needs internet) and build again; without the model the camera try-on will not start.
2. Run `npm run check` (fonts, MediaPipe runtime and models in place) and `npm audit` (must report 0 vulnerabilities).
3. Secrets: search `src/`, `scripts/`, `index.html`, `vercel.json` and `dist/` for anything that looks like a key or token (for example `sk_`, `rzp_live`, `AKIA`, `-----BEGIN`, `Bearer `, `api_key`, `secret`). Check `git status` (if this is a git repository) lists no `.env` file. Report anything found without printing the value.
4. `vercel.json`: framework `vite`, install `npm ci`, build `npm run build`, output `dist`; the Content-Security-Policy keeps `connect-src 'self'` and `'wasm-unsafe-eval'`; Permissions-Policy allows `camera=(self)`.
5. If the user asks for the full check, also run `npx playwright install chromium` (once) and `npm run test:e2e` (every screen size plus the no-WebGL fallback), and look at failures under `test-results/`.
6. Report in a short table: each step, pass or fail, and what to fix. Remind the user that the camera try-on only works over HTTPS, so test it on a phone with the Vercel preview link.
