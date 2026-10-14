# Connecting a real backend

Today the API reads `data/*.json` through `StaticRepository` and stores nothing. This guide explains how to connect a real backend, payments, WhatsApp updates and the CRM without changing the frontend.

## How the pieces fit

```
Browser (src/services/*)  ──►  /api/v1/... (server/app.js, Hono)
                                   │
                         server/services/*  (quote, order, booking: uses shared/pricing.js)
                                   │
                         server/repositories/index.js  ── DATA_SOURCE ──►  static | http | (your own)
                                   │
                         server/integrations/*  (payments, notifications, crm: no-ops until configured)
```

The browser only knows `/api/v1`. Everything behind it can change.

## 1. Switch `DATA_SOURCE` to `http`

`HttpRepository` (`server/repositories/http-repository.js`) talks to a backend that implements the **Backend contract** in `docs/openapi.yaml` (`x-backend-contract`).

1. Build or point to a backend that exposes, under one base URL:

   | Method and path        | Returns or accepts                                               |
   | ---------------------- | ---------------------------------------------------------------- |
   | `GET /store`           | Same shape as `data/store.json`                                  |
   | `GET /catalogue`       | Same shape as `data/catalogue.json` (`{ products: [...] }`)      |
   | `GET /merchandising`   | Same shape as `data/merchandising.json`                          |
   | `GET /lenses`          | Same shape as `data/lenses.json`                                 |
   | `GET /eye-test/config` | Same shape as `data/eye-test.json`                               |
   | `POST /orders`         | A priced order (lines, totals, contact, delivery, prescriptions) |
   | `POST /bookings`       | A booking (`bookingRef`, `slotStart`, `name`, `mobile`)          |

   Every request carries the header `X-Api-Key: <BACKEND_API_KEY>`. The key is never put in a URL.

2. In Vercel, set (see the table in section 6):
   - `DATA_SOURCE=http`
   - `BACKEND_API_URL=https://backend.example.com` (https only; plain http is allowed only for `localhost`)
   - `BACKEND_API_KEY=...`
3. Redeploy. `GET /api/v1/health` then reports `"dataSource": "http"`.
4. Run the contract test against the backend from your machine (PowerShell):

   ```powershell
   $env:BACKEND_API_URL = "https://backend.example.com"; $env:BACKEND_API_KEY = "..."; npm test
   ```

   The `HttpRepository contract` tests run only when both variables are set.

Orders sent to the backend include `idempotencyKey` (the browser sends one per checkout attempt). The backend must treat a repeated key as the same order: no second save, charge or message. In static mode nothing is stored, so only the reference is kept stable.

If the backend is down, the API answers `503 backend_unavailable` with a generic message, and the browser falls back to the bundled catalogue.

## 2. Add a Supabase or Postgres repository

1. Create `server/repositories/supabase-repository.js` exporting `createSupabaseRepository()`, returning an object with every method in `server/repositories/contract.js` (`getStore`, `getCatalogue`, `getMerchandising`, `getLenses`, `getEyeTestConfig`, `saveOrder`, `saveBooking`). Return data in the same shapes as `data/*.json`.
2. Add a branch for it in `server/repositories/index.js`, for example `DATA_SOURCE=supabase`.
3. Read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in that file only. Never give them a `VITE_` prefix.
4. Add it to the `suites` list in `tests/repositories/contract.test.js`, skipped unless its env vars are set.
5. Pin the client library to an exact version and record the choice in `docs/decisions.md`.

Suggested tables: `products`, `product_colours`, `merchandising`, `lens_options`, `eye_test_config`, `orders`, `order_lines`, `bookings`. Keep prices in whole rupees (integer) including GST.

`saveOrder` and `saveBooking` should insert, then return `{ persisted: true }`. Keep using the reference the API generates (`orderRef`, `bookingRef`), or replace it with a database sequence.

## 3. Payments with Razorpay

The seam is `server/integrations/payments.js`:

| Function                                     | Planned use                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `createPayment(order)`                       | Create a Razorpay order for `order.total × 100` paise and return its id to the browser |
| `verifyWebhookSignature(rawBody, signature)` | Already implemented: HMAC-SHA256 of the raw body with `RAZORPAY_WEBHOOK_SECRET`        |

Env vars: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.

Steps:

1. Save the order with status `pending_payment` in `saveOrder`.
2. Return the Razorpay order id from `POST /api/v1/orders`, and open Razorpay Checkout in the browser.
3. Add `POST /api/v1/payments/webhook`. Read the raw body before parsing and check it with `verifyWebhookSignature`. Only then mark the order paid.
4. Add `https://checkout.razorpay.com` to `script-src` and `frame-src`, and `https://api.razorpay.com` to `connect-src` in the CSP in `vercel.json`. Change `payment=()` in `Permissions-Policy`. Record the change in `docs/decisions.md`.

The server always computes the amount. Never accept an amount from the browser.

## 4. WhatsApp updates through WaMark

The seam is `server/integrations/notifications.js`: `sendOrderUpdate(order)` and `sendBookingUpdate(booking)`. The order and booking services already call both.

Env vars: `WAMARK_API_URL`, `WAMARK_API_KEY`.

Send only what the message needs (first name, reference, slot time). Use approved WhatsApp templates. Never log the phone number or message body.

## 5. Leads to DGCC

The seam is `server/integrations/crm.js`: `pushLead(event)`, called with `{ type: 'order' | 'booking', ref }`.

Env vars: `DGCC_API_URL`, `DGCC_API_KEY`.

Today the event carries only the type and reference. Add contact fields only once the client has agreed what DGCC may receive, and add that purpose to the consent text in checkout and booking.

## 6. Environment variables in Vercel

Set them in **Project → Settings → Environment Variables**. None are needed in static mode.

| Variable                  | Production | Preview            | Development (`vercel dev`) | Notes                                         |
| ------------------------- | ---------- | ------------------ | -------------------------- | --------------------------------------------- |
| `DATA_SOURCE`             | `http`     | `static` or `http` | `static`                   | Default `static`                              |
| `BACKEND_API_URL`         | ✓          | staging backend    | optional                   | https only                                    |
| `BACKEND_API_KEY`         | ✓          | staging key        | optional                   | Mark as Sensitive                             |
| `RAZORPAY_KEY_ID`         | live key   | test key           | test key                   |                                               |
| `RAZORPAY_KEY_SECRET`     | live       | test               | test                       | Sensitive                                     |
| `RAZORPAY_WEBHOOK_SECRET` | live       | test               | test                       | Sensitive                                     |
| `WAMARK_API_URL` / `_KEY` | ✓          | sandbox            | not set                    | Leave unset in Preview to avoid real messages |
| `DGCC_API_URL` / `_KEY`   | ✓          | not set            | not set                    |                                               |
| `VITE_DATA_SOURCE`        | not set    | not set            | not set                    | Public. `static` only for an API-free build   |

Rules:

- Never prefix a secret with `VITE_`. Vite copies every `VITE_` variable into the public bundle.
- Use test or sandbox keys in Preview and Development, and live keys only in Production.
- Do not run `vercel env pull` on shared machines. If you must have a local `.env`, it is gitignored.

## 7. Rate limiting with Vercel WAF

An in-memory limiter does not work on serverless, because every function instance has its own memory. `server/app.js` has a marked `RATE LIMIT HOOK` where a shared store (for example Upstash Redis) could plug in. The simpler option is the Vercel Firewall:

1. Open **Project → Firewall → Configure → New Rule**.
2. Rule "API writes": if **Request Path** starts with `/api/v1/orders` or `/api/v1/eye-test/bookings` and **Method** is `POST`, then **Rate Limit**: fixed window, 10 requests per 60 seconds per IP, action **Deny** (429).
3. Rule "API reads": path starts with `/api/`, 300 requests per 60 seconds per IP.
4. Save and publish. Check the Firewall overview after a day and adjust.

## 8. Personal data (India's DPDP Act)

Names, mobile numbers, email addresses, delivery addresses and prescriptions are personal data. Prescriptions are health data, so treat them as sensitive.

- **Collect the minimum.** Checkout asks for name, mobile, optional email and, for home delivery, one address line, city and PIN code.
- **Consent.** Checkout and booking require a ticked consent box naming the purpose. If data is used for anything else (marketing, DGCC leads), ask separately.
- **Never log it.** The API logs only route, status, duration and request id. Keep it that way in every new repository and integration.
- **Never in URLs or localStorage.** The browser keeps only the bag (product, colour, lens configuration, quantity) and display settings.
- **Retention.** Decide and write down how long each kind of record is kept. A suggestion: orders 8 years for tax records, but delete prescriptions 12 months after delivery; bookings 12 months; delete abandoned or failed orders after 30 days.
- **Deletion.** Provide a way to erase a person's data on request (for example `DELETE` by mobile number in the backend admin), and erase it from WaMark and DGCC too.
- **Security.** TLS everywhere, encryption at rest, access limited to staff who need it, and an audit log of who viewed prescriptions.
- **Breaches.** Have a plan to notify the Data Protection Board and the people affected.
- The DPDP Rules require full compliance by 13 May 2027.
