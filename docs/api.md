# Brijman Eyewear showroom API

This is the API behind the Brijman Eyewear virtual showroom. It serves the catalogue, prices the bag on the server, takes demo orders and books demo eye tests.

The machine-readable spec is [`openapi.yaml`](./openapi.yaml). The examples below run against `npm run dev` at `http://localhost:5173`.

## Conventions

### Base path and origin

- Every route sits under `/api/v1`.
- The API is same-origin only. It sends no CORS headers, so other sites can't call it from a browser.
- Every GET route also answers HEAD.

### Envelope

A success body looks like this:

```json
{ "data": { "...": "..." }, "meta": { "requestId": "523f4a1b-c3c9-4c8b-9eb1-65e963666d7e" } }
```

`GET /products` also puts `count` in `meta`.

An error body looks like this:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Some details need fixing.",
    "fields": { "contact.mobile": "..." }
  }
}
```

`fields` appears only on 422 errors. Each key is the path of the bad field, for example `lines.0.config`, and each value is the first message for it. The key `_` means the top-level body, for example an unknown top-level key. Messages are plain English and safe to show to visitors.

### Status and error codes

| Status | `error.code`             | When                                                                                       |
| ------ | ------------------------ | ------------------------------------------------------------------------------------------ |
| 200    | none                     | Success.                                                                                   |
| 201    | none                     | Order or booking accepted (demo).                                                          |
| 304    | none                     | `If-None-Match` matches the current ETag. No body. Bootstrap, store and lenses only.       |
| 400    | `malformed_json`         | The body is not valid JSON.                                                                |
| 404    | `not_found`              | No route matches, or no product has that id.                                               |
| 405    | `method_not_allowed`     | The path exists but not for this method. The `Allow` header lists the methods it accepts.  |
| 413    | `payload_too_large`      | The body is over 16 KB.                                                                    |
| 415    | `unsupported_media_type` | A POST without `Content-Type: application/json`.                                           |
| 422    | `validation_failed`      | The input breaks a schema or business rule. See `fields`.                                  |
| 500    | `internal_error`         | Something broke on the server. The message is generic and never includes a stack trace.    |
| 503    | `backend_unavailable`    | Only when `DATA_SOURCE=http`: the backend failed, timed out (5 s) or sent a non-JSON body. |

### Request bodies

- Send POST bodies as JSON with `Content-Type: application/json`. A charset parameter is fine.
- The limit is 16 KB (16,384 bytes). The API checks `Content-Length` first, then counts the bytes it reads, so a body without a declared length is also cut off.
- Bodies are strict. Unknown keys fail with 422, at any level. You can't send a price, a total or anything else the schema does not list.

### Headers

- `X-Request-Id`: a UUID on every response, including errors and 304. The same value is in `meta.requestId`. Quote it when you report a problem. Server logs carry the id, route, status and duration only, never bodies or personal data.
- `X-Content-Type-Options: nosniff` on every response.

### Caching

| Routes                                             | `Cache-Control`                                      | ETag |
| -------------------------------------------------- | ---------------------------------------------------- | ---- |
| `/bootstrap`, `/store`, `/lenses`                  | `public, s-maxage=300, stale-while-revalidate=86400` | Yes  |
| `/products`, `/products/{id}`                      | `public, s-maxage=300, stale-while-revalidate=86400` | No   |
| `/health`, `/cart/quote`, `/orders`, `/eye-test/*` | `no-store`                                           | No   |
| Every error response                               | `no-store`                                           | No   |

The CDN keeps cacheable responses for 5 minutes, then serves them stale for up to a day while it fetches a fresh copy. Send an ETag back in `If-None-Match` to get `304 Not Modified`. Weak tags (`W/"..."`) and comma-separated lists work.

### Money and time

- Prices are whole rupees, GST included. Currency is always `INR` and `taxIncluded` is always `true`. Delivery is always ₹0.
- Dates and times are India Standard Time (Asia/Kolkata, UTC+05:30, no daylight saving). Slot times carry the `+05:30` offset. `/health` reports `time` in UTC.

### Demo mode

With `DATA_SOURCE=static` (the default) the API reads `data/*.json` and stores nothing.

- Orders are checked and priced, then return a reference like `BM-DEMO-7LYFBQ` and status `demo_not_charged`. Nothing is saved or charged.
- Bookings are checked against real slots, then return a reference like `BM-ET-DEMO-J57X` and status `demo_not_booked`. Nothing is saved.
- References use the characters `2-9` and `A-Z` without `I` and `O`, so they are easy to read out on the phone.
- Send an `Idempotency-Key` (a UUID) with an order and the same key always returns the same `orderRef`. Bookings take no key; each call gets a new random reference.
- Order responses never echo the name, mobile or address.

## Business rules

The API enforces these rules on every quote and order. Prices come from `data/lenses.json`, so editing that file changes them everywhere.

### Lens prices (added to the frame price)

| Option                                 | Price                  |
| -------------------------------------- | ---------------------- |
| Zero power (`zero`)                    | ₹0                     |
| Single vision (`sv`)                   | ₹1,200                 |
| Bifocal (`bf`)                         | ₹2,400                 |
| Progressive (`pg`)                     | ₹4,900                 |
| Index 1.56 Standard (`156`)            | ₹0                     |
| Index 1.60 Thin (`160`)                | ₹900                   |
| Index 1.67 Extra thin (`167`)          | ₹2,200                 |
| Index 1.74 Ultra thin (`174`)          | ₹4,500                 |
| Anti-glare and scratch guard           | Included on every lens |
| Blue-cut filter (`bc`)                 | ₹900                   |
| Photochromic (`ph`)                    | ₹1,900                 |
| Sun: non-prescription UV400 (`plano`)  | ₹0                     |
| Sun: prescription sun lenses (`rxsun`) | ₹2,900                 |

Example: Arlo (₹2,490) with single vision, 1.60 and blue-cut is ₹2,490 + ₹1,200 + ₹900 + ₹900 = ₹5,490.

### Lens configuration

- **Optical frames** send `{ type, index, coats?, rx? }`. Both `type` and `index` are required.
- **Zero power** must use index `156`. The index adds nothing to a zero-power price.
- **Coatings**: `coats` may hold `bc` and `ph`, each at most once. Don't send `ag`: it is always included, and sending it fails.
- **Kids' optical frames** take `zero` or `sv` only, at index `156` or `160`.
- **Sunglasses** (any frame with `sun: true`, including kids' sunglasses) take `{ sunlens, rx? }` only. Lens type, index and coatings are rejected.
- **Contacts and care** take `{ pack }` only, where `pack` is an index into the product's `packs`.
- `rx` says how the prescription will be shared: `later`, `now` or `test` (book an eye test first).

### Bag lines

- A bag holds 1 to 20 lines.
- **Frames**: `qty` must be 1. Add a second pair as a second line, so each pair can carry its own prescription. `colourIndex` must be below the frame's number of colours.
- **Contacts and care**: `qty` from 1 to 12 packs. `colourIndex` must be 0.

### Prescriptions (orders only)

A line needs a prescription when its lenses are made to a prescription (any type except `zero`, or `rxsun`) **and** `config.rx` is `now`. Any other line must not carry one.

| Field  | Range                  | Step | Notes                                      |
| ------ | ---------------------- | ---- | ------------------------------------------ |
| `sph`  | -20.00 to +12.00       | 0.25 | Required for each eye.                     |
| `cyl`  | -6.00 to 0.00          | 0.25 | Required; send 0 when blank.               |
| `axis` | 1 to 180, whole number | 1    | Required when `cyl` is not 0, else `null`. |
| `add`  | +0.75 to +3.50         | 0.25 | Required for bifocal and progressive.      |
| `pd`   | 50 to 76 mm            | any  | One value for both eyes.                   |

### Contact and address

- `name`: 2 to 60 characters, no leading or trailing spaces, no `< > { }`.
- `mobile`: 10 digits starting with 6, 7, 8 or 9. No `+91` or `0` prefix.
- `email`: optional, up to 254 characters.
- Home delivery needs `line1` (3 to 120 characters), `city` (2 to 60) and a 6-digit `pin` that does not start with 0.
- `consent` must be `true`.

## Endpoints

### GET /api/v1/health

Reports status, data source and version. Never cached.

```bash
curl http://localhost:5173/api/v1/health
```

```json
{
  "data": { "status": "ok", "dataSource": "static", "version": "1.0.0", "time": "2026-10-14T09:22:20.458Z" },
  "meta": { "requestId": "523f4a1b-c3c9-4c8b-9eb1-65e963666d7e" }
}
```

### GET /api/v1/bootstrap

Everything the first screen needs: store details, zones, tour, all products, merchandising (which product sits on which shelf) and lens options. Cached, with an ETag.

```bash
curl -i http://localhost:5173/api/v1/bootstrap
curl -i http://localhost:5173/api/v1/bootstrap -H 'If-None-Match: "1440f4e1cbbb3a1b07c34070abb07d3c"'
```

```json
{
  "data": {
    "store": { "name": "Brijman Eyewear", "tagline": "Opticians and eyewear studio", "...": "..." },
    "zones": [{ "id": "welcome", "name": "Welcome & Directory", "...": "..." }],
    "tour": ["welcome", "kids", "men", "sun", "contacts", "premium", "eyetest", "lensbar", "women", "checkout"],
    "tourText": { "welcome": "This is the entrance. ..." },
    "products": [{ "id": "m01", "name": "Arlo", "price": 2490, "...": "..." }],
    "merchandising": { "men": [["m03", "m04", "m11", "m08"]], "...": "..." },
    "lenses": { "types": [], "index": [], "coats": [], "sun": [], "rx": [] }
  },
  "meta": { "requestId": "..." }
}
```

The second call answers `304 Not Modified` with no body when the tag still matches.

### GET /api/v1/store

Store details, zones, tour and tour narration. Cached, with an ETag.

```bash
curl http://localhost:5173/api/v1/store
```

```json
{
  "data": {
    "store": {
      "name": "Brijman Eyewear",
      "hours": "Open daily, 10:30 am to 9:00 pm",
      "services": ["Free eye test with an optometrist", "..."]
    },
    "zones": [{ "id": "kids", "name": "Kids Corner", "short": "Kids", "blurb": "...", "...": "..." }],
    "tour": ["welcome", "kids", "..."],
    "tourText": { "welcome": "..." }
  },
  "meta": { "requestId": "..." }
}
```

### GET /api/v1/products

Searches the catalogue. Every filter is optional and filters combine. Unknown parameters are ignored. Results keep catalogue order.

| Parameter   | Meaning                                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `zone`      | Exact zone id: `men`, `women`, `sun`, `kids`, `premium` or `contacts`. Up to 20 characters.                      |
| `q`         | Free text, up to 80 characters. Every word must appear in the name, description, material, tags or colour names. |
| `shape`     | Frame shape: `rect`, `square`, `round`, `oval`, `cateye`, `oversize`, `geo`, `aviator` or `brow`.                |
| `material`  | Part of the material name, any case, for example `titanium`.                                                     |
| `polarised` | `true` for polarised only, `false` for everything else.                                                          |
| `maxPrice`  | Whole rupees, 0 to 10,00,000. Frames use the frame price; contacts and care use their cheapest pack.             |
| `type`      | `frame`, `contacts` or `care`.                                                                                   |

```bash
curl "http://localhost:5173/api/v1/products?zone=kids&maxPrice=1300"
```

```json
{
  "data": [
    {
      "id": "k01",
      "name": "Pip",
      "zone": "kids",
      "arch": "roundA",
      "mat": "TR90",
      "price": 1290,
      "size": [44, 16, 125],
      "weight": 12,
      "colors": [{ "n": "Sky blue", "a": "#5fa9dc", "sw": "#5fa9dc" }],
      "desc": "A flexible round for ages 4 to 8, with soft temple tips.",
      "type": "frame",
      "tags": ["Flexible"],
      "kids": true
    }
  ],
  "meta": { "requestId": "...", "count": 3 }
}
```

A contact lens or care product has `packs` instead of `price` and `colors`:

```json
{
  "id": "c01",
  "name": "Brijman Daily 1-Day",
  "zone": "contacts",
  "type": "contacts",
  "color": "#3f88c5",
  "packs": [
    { "n": "30 lenses", "p": 1450 },
    { "n": "90 lenses", "p": 3950 }
  ],
  "desc": "...",
  "tags": ["Daily"]
}
```

A bad filter answers 422 with the message "Check the search filters.":

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Check the search filters.",
    "fields": { "maxPrice": "Invalid input: expected number, received NaN" }
  }
}
```

### GET /api/v1/products/{id}

One product by id, for example `m01`.

```bash
curl http://localhost:5173/api/v1/products/m01
```

```json
{
  "data": {
    "id": "m01",
    "name": "Arlo",
    "zone": "men",
    "mat": "Acetate",
    "price": 2490,
    "type": "frame",
    "...": "..."
  },
  "meta": { "requestId": "..." }
}
```

An unknown id answers 404:

```json
{ "error": { "code": "not_found", "message": "No product with id \"zz99\"." } }
```

### GET /api/v1/lenses

Lens types, index, coatings, sun lens options and prescription options, with prices. Cached, with an ETag.

```bash
curl http://localhost:5173/api/v1/lenses
```

```json
{
  "data": {
    "types": [
      { "id": "zero", "n": "Zero power", "d": "No prescription. Anti-glare lenses for screens or style.", "p": 0 },
      { "id": "sv", "n": "Single vision", "d": "One power, for distance or for reading.", "p": 1200 }
    ],
    "index": [{ "id": "156", "n": "1.56 Standard", "d": "Good for low powers.", "p": 0 }],
    "coats": [
      { "id": "ag", "n": "Anti-glare and scratch guard", "d": "Included on every lens.", "p": 0, "fixed": true }
    ],
    "sun": [{ "id": "plano", "n": "Non-prescription UV400", "d": "The lenses shown on the frame.", "p": 0 }],
    "rx": [{ "id": "later", "n": "Add it after ordering", "d": "Share a photo of your prescription later." }]
  },
  "meta": { "requestId": "..." }
}
```

### POST /api/v1/cart/quote

Prices a bag on the server. The browser shows these as the confirmed prices. The same bag always gets the same `quoteId`.

Body: `{ "lines": [CartLine, ...] }`, 1 to 20 lines. Each line is `{ productId, colourIndex, config, qty }`.

```bash
curl -X POST http://localhost:5173/api/v1/cart/quote \
  -H "Content-Type: application/json" \
  -d '{"lines":[
        {"productId":"m01","colourIndex":0,"config":{"type":"sv","index":"160","coats":["bc"],"rx":"now"},"qty":1},
        {"productId":"c01","colourIndex":0,"config":{"pack":1},"qty":3}
      ]}'
```

```json
{
  "data": {
    "quoteId": "q_3e6e32d63e0f19228b08f913",
    "currency": "INR",
    "taxIncluded": true,
    "lines": [
      {
        "productId": "m01",
        "name": "Arlo",
        "colourIndex": 0,
        "colour": "Jet black",
        "config": { "type": "sv", "index": "160", "coats": ["bc"], "rx": "now" },
        "summary": "Single vision · 1.60 Thin · Blue-cut filter · Prescription entered",
        "qty": 1,
        "unitPrice": 5490,
        "lineTotal": 5490
      },
      {
        "productId": "c01",
        "name": "Brijman Daily 1-Day",
        "colourIndex": 0,
        "colour": null,
        "config": { "pack": 1 },
        "summary": "90 lenses",
        "qty": 3,
        "unitPrice": 3950,
        "lineTotal": 11850
      }
    ],
    "subtotal": 17340,
    "delivery": 0,
    "total": 17340
  },
  "meta": { "requestId": "..." }
}
```

Lines that break a rule answer 422, one message per line:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Some items in your bag need attention.",
    "fields": {
      "lines.0.productId": "This product is no longer available.",
      "lines.1.colourIndex": "This colour is not available for Arlo.",
      "lines.2.config": "This lens type is not available for this frame.",
      "lines.3.qty": "Frames are added one pair per line."
    }
  }
}
```

### POST /api/v1/orders

Places a demo order. The API validates the body, re-prices every line, checks prescriptions and returns a reference. Nothing is stored or charged. Answers 201.

Header `Idempotency-Key` is optional. It must be a UUID, or the API answers 422. The same key always gives the same `orderRef`, and the response echoes the key back.

Body: `{ lines, contact, delivery, consent }`. Lines are bag lines plus an optional `prescription`. `delivery` is `{ "method": "store" }` or `{ "method": "home", line1, city, pin }`.

```bash
curl -X POST http://localhost:5173/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 3b241101-e2bb-4255-8caf-4136c566a962" \
  -d '{
        "lines":[{"productId":"m01","colourIndex":0,
                  "config":{"type":"sv","index":"160","coats":["bc"],"rx":"now"},"qty":1,
                  "prescription":{"r":{"sph":-1.25,"cyl":0,"axis":null},"l":{"sph":-1,"cyl":-0.5,"axis":90},"pd":63}}],
        "contact":{"name":"Asha Rao","mobile":"9876543210"},
        "delivery":{"method":"home","line1":"12 MG Road","city":"Bengaluru","pin":"560001"},
        "consent":true
      }'
```

```json
{
  "data": {
    "orderRef": "BM-DEMO-7LYFBQ",
    "status": "demo_not_charged",
    "quoteId": "q_063d1b2aca30fbf237119383",
    "currency": "INR",
    "taxIncluded": true,
    "delivery": { "method": "home", "fee": 0 },
    "lines": [
      {
        "productId": "m01",
        "name": "Arlo",
        "colour": "Jet black",
        "summary": "Single vision · 1.60 Thin · Blue-cut filter · Prescription entered",
        "qty": 1,
        "unitPrice": 5490,
        "lineTotal": 5490,
        "...": "..."
      }
    ],
    "subtotal": 5490,
    "total": 5490
  },
  "meta": { "requestId": "..." }
}
```

A wrong prescription answers 422 with the first problem for that line:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Some prescriptions need fixing.",
    "fields": { "lines.0.prescription.l.axis": "Left eye: AXIS is a whole number from 1 to 180 when CYL is set." }
  }
}
```

The API checks the body in this order: Idempotency-Key, Content-Type, size, JSON, schema, bag rules, then prescriptions. A body with errors at several stages reports only the first stage.

### GET /api/v1/eye-test/slots

Free eye-test slots, grouped by IST date. Never cached.

| Parameter | Meaning                                                                     |
| --------- | --------------------------------------------------------------------------- |
| `from`    | First date, `YYYY-MM-DD`, IST. Defaults to today. A past date starts today. |
| `days`    | 1 to 14 days to cover. Defaults to 7.                                       |

With the current `data/eye-test.json`:

- Slots start at 10:30, 12:00, 14:30, 16:00 and 18:30, and last 20 minutes.
- Slots that start within the next 30 minutes are left out.
- The booking window is 14 days, counting today. Later days are never returned, so a `from` past the window gives `"days": []`.
- Days with no free slot, closed dates and closed weekdays are left out.

```bash
curl "http://localhost:5173/api/v1/eye-test/slots?days=2"
```

```json
{
  "data": {
    "timezone": "Asia/Kolkata",
    "durationMinutes": 20,
    "days": [
      {
        "date": "2026-10-14",
        "slots": [
          { "time": "10:30", "start": "2026-10-14T10:30:00+05:30" },
          { "time": "12:00", "start": "2026-10-14T12:00:00+05:30" }
        ]
      },
      { "date": "2026-10-15", "slots": [{ "time": "10:30", "start": "2026-10-15T10:30:00+05:30" }] }
    ]
  },
  "meta": { "requestId": "..." }
}
```

`days=15` or a date that does not exist, such as `from=2026-02-30`, answers 422.

### POST /api/v1/eye-test/bookings

Books a demo eye test. `slotStart` must be a `start` value that `GET /eye-test/slots` offers right now. Nothing is stored. Answers 201.

Body: `{ slotStart, name, mobile, consent }`.

```bash
curl -X POST http://localhost:5173/api/v1/eye-test/bookings \
  -H "Content-Type: application/json" \
  -d '{"slotStart":"2026-10-15T12:00:00+05:30","name":"Asha Rao","mobile":"9876543210","consent":true}'
```

```json
{
  "data": {
    "bookingRef": "BM-ET-DEMO-J57X",
    "status": "demo_not_booked",
    "slotStart": "2026-10-15T12:00:00+05:30",
    "durationMinutes": 20
  },
  "meta": { "requestId": "..." }
}
```

A past, unknown or malformed slot answers 422:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Some details need fixing.",
    "fields": { "slotStart": "This time is no longer available. Pick another slot." }
  }
}
```

## Backend contract

With `DATA_SOURCE=http` the API reads and writes through a backend instead of `data/*.json`. That backend is not part of this API. The `x-backend-contract` section of [`openapi.yaml`](./openapi.yaml) defines it. In short:

- Base URL from `BACKEND_API_URL`, server side only. It must be https; http works only for `localhost` and `127.0.0.1`.
- Every call sends `X-Api-Key: <BACKEND_API_KEY>`. The key never goes in a URL.
- Reads: `GET /store`, `/catalogue`, `/merchandising`, `/lenses`, `/eye-test/config`, each returning the same shape as the matching data file.
- Writes: `POST /orders` (the priced order with contact, delivery and prescriptions) and `POST /bookings`. Return any JSON body with a 2xx status.
- A failure, a non-JSON body or no answer within 5 seconds makes the API answer `503 backend_unavailable`.
