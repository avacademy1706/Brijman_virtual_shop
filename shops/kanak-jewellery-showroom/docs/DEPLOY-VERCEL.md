# Deploying to Vercel

The boutique is a static site. Vercel installs the dependencies, runs the build (which copies the MediaPipe runtime and downloads the face and hand tracking models) and serves `dist/` with the security headers from `vercel.json`. No server, database or environment variable is needed.

**Before you start:** the project builds on your computer (`npm run build`), `npm test` passes, and you have a [Vercel account](https://vercel.com/signup) and, for option A, a [GitHub account](https://github.com/signup).

---

## 1. What `vercel.json` already sets

| Setting            | Value                                                           | Why                                                                                                 |
| ------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Framework          | `vite`                                                          | Vercel's Vite defaults                                                                              |
| Install command    | `npm ci`                                                        | Installs exactly the versions in `package-lock.json`                                                |
| Build command      | `npm run build`                                                 | Copy the MediaPipe runtime, download the models, Vite build                                         |
| Output directory   | `dist`                                                          |                                                                                                     |
| Ignored build step | `git diff HEAD^ HEAD --quiet -- .`                              | Builds only when a commit changes this folder (useful when the three projects share one repository) |
| Security headers   | CSP, Permissions-Policy, HSTS and others                        | See [Security](#6-security-checklist)                                                               |
| Cache headers      | One year for hashed assets and the runtime, one week for models | Fast repeat visits                                                                                  |

Node.js 24 is used, taken from `engines` in `package.json`. Do not override these settings in the Vercel dashboard; leave **Build and Output Settings** on their defaults.

---

## 2. Option A: deploy from GitHub (recommended)

Every push then deploys automatically: pushes to `main` go to production, other branches and pull requests get their own preview URL.

1. **Create a repository.** On GitHub choose **New repository**, name it (for example `kanak-boutique`), keep it **Private**, and do not add a README or .gitignore (the project has them).
2. **Push the project.** In the VS Code terminal, inside the project folder:

   ```bash
   git init
   git add .
   git commit -m "Kanak virtual boutique"
   git branch -M main
   git remote add origin https://github.com/<your-account>/kanak-boutique.git
   git push -u origin main
   ```

   Check first that `git status` lists no `.env` file. `.gitignore` already excludes `.env`, `node_modules/`, `dist/`, the downloaded models and test output.

3. **Import into Vercel.** In Vercel choose **Add New → Project**, pick the repository and click **Import**. Vercel detects Vite and reads `vercel.json`. Leave every setting as it is and click **Deploy**.

   If this folder is one of the three projects in the `plexus-virtual-showrooms` master repository, set **Root Directory** to this project's folder before clicking **Deploy** (see `DEPLOY-VERCEL.md` in the master folder).

4. **Wait for the build** (about 1 to 2 minutes). The log shows `[setup-tryon] …` (runtime copied, models downloaded; on Vercel the build stops with a clear message if a model cannot be downloaded, so a deployment never goes live without a working try-on) and Vite's output. Open the URL Vercel gives you.

### Pin the tracking models

The first `npm run dev` or `npm run build` on your computer creates `models/models.lock.json` with the SHA-256 of the two downloaded models (face and hand). Commit it:

```bash
git add models/models.lock.json
git commit -m "Pin tracking model checksums"
git push
```

From then on every build, including Vercel's, refuses a model file whose checksum differs.

---

## 3. Option B: deploy from the command line

```bash
npm i -g vercel        # once
vercel login           # once; opens the browser
vercel                 # preview deployment: answer the questions, accept the detected settings
vercel --prod          # production deployment
```

The CLI uploads the project (minus the files in `.vercelignore`: `.env` files, `node_modules`, `dist`, test output) and Vercel builds it.

---

## 4. Custom domain

1. In the project choose **Settings → Domains → Add**, and enter the domain, for example `boutique.example.com`.
2. Vercel shows the DNS record to create at your domain registrar: a `CNAME` to `cname.vercel-dns.com` for a subdomain, or an `A` record for the root domain.
3. When the record is live, Vercel issues the HTTPS certificate automatically. HTTPS is required for the camera try-on.

---

## 5. Testing on phones before going live

The camera only works over HTTPS, so use a **preview deployment**:

- With GitHub: push a branch (`git checkout -b test-phone`, commit, `git push -u origin test-phone`). Vercel comments the preview URL on the pull request and lists it under **Deployments**.
- With the CLI: `vercel` (without `--prod`).

Open the preview URL on the phone and go through the manual checklist in [TESTING.md](TESTING.md#4-manual-checklist-before-a-client-demo-or-a-production-deploy). Preview deployments are protected by Vercel Authentication by default; sign in on the phone, or share a link from **Deployment → Share**.

---

## 6. Security checklist

- [ ] **No secrets.** The site needs none. `npm test` (security.test.js) fails if a credential appears anywhere in the project or the build.
- [ ] **No `.env` uploaded.** `.gitignore` and `.vercelignore` exclude `.env` and `.env.*` (except `.env.example`).
- [ ] **Future secrets** (payments, an order API) go in **Settings → Environment Variables** and are read only in server code under `/api`. Never give a secret a `VITE_` prefix: Vite copies those into the public JavaScript.
- [ ] **Headers.** After deploying, check them:

  ```bash
  curl -sI https://<your-deployment>.vercel.app | grep -iE "content-security|permissions-policy|strict-transport|x-frame|x-content-type"
  ```

  You should see the Content Security Policy (`default-src 'self'`, `connect-src 'self'`), `camera=(self)`, HSTS, `X-Frame-Options: SAMEORIGIN` and `X-Content-Type-Options: nosniff`.

- [ ] **Browser console** on the live site: no errors, except one blocked request to `odml.pa.googleapis.com` once the try-on starts. That is MediaPipe's usage statistics, blocked on purpose by `connect-src 'self'`.
- [ ] **Dependencies.** Run `npm audit` before a release; it should report 0 vulnerabilities.

---

## 7. Deploy only when tests pass

By default Vercel deploys every push, whatever the tests say. Two ways to gate it:

**Run the unit tests in the Vercel build** (simplest; adds about a minute). Change the build command in `vercel.json`:

```json
"buildCommand": "npm test && npm run build"
```

A failing test then fails the deployment, and the previous production deployment stays live.

**Or use GitHub checks.** The included workflow (`.github/workflows/ci.yml`) runs the unit tests and the build on every push. In GitHub choose **Settings → Branches → Add branch protection rule** for `main`, tick **Require status checks to pass** and select **test**. Work on branches, open pull requests, and merge only when the check is green; Vercel deploys `main` after the merge.

---

## 8. Live gold rates (when you are ready)

The demo prices use the sample rates in `src/data/catalogue.js` (`NY.RATES`). For live rates, add a Vercel function, for example `api/rates.js`, that reads the jeweller's rate source (its credentials in **Settings → Environment Variables**, read only inside the function) and returns `{ gold24, platinum, silver, gstPct, label }`. In `app.js`, fetch `/api/rates` on load and replace `NY.RATES` before prices are shown. Because the function is on the same origin, the CSP (`connect-src 'self'`) already allows it; never call a third-party rates API from the browser and never put its key in front-end code.

---

## 9. Rolling back

In Vercel open **Deployments**, find the last good deployment, open its menu and choose **Promote to Production** (or **Instant Rollback**). The change is immediate; no rebuild is needed.

---

## 10. Troubleshooting

| Symptom in the Vercel build log or on the site           | Fix                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci` fails: lockfile out of sync                     | Run `npm install` on your computer, commit `package-lock.json`, push again.                                                                                                                                                                                                                                   |
| `[setup-tryon] … does not match models/models.lock.json` | The model file changed upstream or the lock is wrong. Delete `public/models/*.task` locally, run `npm run setup:tryon`, check, commit the new lock.                                                                                                                                                           |
| `[setup-tryon] could not download …`                     | Temporary network problem at Google's model bucket. Redeploy. The boutique still works; only the try-on needs the models (it shows a clear message without them).                                                                                                                                             |
| `[setup-tryon] Build stopped: …`                         | Vercel could not download a tracking model after three tries (a short outage at Google's model bucket). Click **Redeploy** on the failed deployment; the live site keeps the previous version meanwhile. To deploy without the camera try-on on purpose, add the environment variable `TRYON_OPTIONAL` = `1`. |
| Site loads but shows only the floor plan                 | The visitor's browser has WebGL turned off. Browsing, prices and the bag still work.                                                                                                                                                                                                                          |
| Camera try-on does not start on the phone                | Use the HTTPS URL (all Vercel URLs are). Allow the camera in the browser's site settings.                                                                                                                                                                                                                     |
| Fonts or styles missing, console shows CSP errors        | Something was inlined as a `data:` URL. Keep `assetsInlineLimit: 0` in `vite.config.js`.                                                                                                                                                                                                                      |
| A change does not appear after deploying                 | Hard-reload (Ctrl+Shift+R). Assets are cached for a year but have new file names on every build; `index.html` itself is not cached.                                                                                                                                                                           |
