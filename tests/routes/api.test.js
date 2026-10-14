// Route tests through Hono's app.request(): no network, no server.
import { describe, it, expect } from 'vitest';

import { createApp } from '../../server/app.js';

// 09:30 IST on Wednesday 14 October 2026.
const NOW = Date.parse('2026-10-14T04:00:00Z');
const app = createApp({ now: () => NOW });

const get = (path, headers) => app.request(path, { headers });
const post = (path, body, headers = {}) =>
  app.request(path, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const json = async (res) => res.json();

const zero = { type: 'zero', index: '156', coats: [] };
const sv = { type: 'sv', index: '160', coats: ['bc'], rx: 'now' };
const line = (o) => Object.assign({ productId: 'm01', colourIndex: 0, config: zero, qty: 1 }, o);
const rx = { r: { sph: -1.25, cyl: 0, axis: null }, l: { sph: -1, cyl: -0.5, axis: 90 }, pd: 63 };
const contact = { name: 'Asha Rao', mobile: '9876543210' };
const order = (o) => Object.assign({ lines: [line()], contact, delivery: { method: 'store' }, consent: true }, o);

describe('common behaviour', () => {
  it('sends X-Request-Id and nosniff, and never CORS headers', async () => {
    const res = await get('/api/v1/health', { Origin: 'https://evil.example' });
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
  it('answers 404 with the error envelope for unknown routes', async () => {
    const res = await get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect((await json(res)).error.code).toBe('not_found');
  });
  it('answers 405 with an Allow header for a wrong method', async () => {
    const res = await get('/api/v1/cart/quote');
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
    const res2 = await post('/api/v1/health', {});
    expect(res2.status).toBe(405);
  });
  it('answers 415 for a body that is not JSON', async () => {
    const res = await app.request('/api/v1/cart/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'hello',
    });
    expect(res.status).toBe(415);
  });
  it('answers 400 for malformed JSON', async () => {
    const res = await post('/api/v1/cart/quote', '{"lines": [');
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe('malformed_json');
  });
  it('answers 413 for a body over 16 KB, declared or not', async () => {
    const big = JSON.stringify({ lines: [], pad: 'x'.repeat(17000) });
    expect((await post('/api/v1/cart/quote', big)).status).toBe(413);
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode(big));
        c.close();
      },
    });
    const res = await app.request('/api/v1/cart/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: stream,
      duplex: 'half',
    });
    expect(res.status).toBe(413);
  });
  it('answers 500 with a generic message and no stack when something breaks', async () => {
    const broken = createApp({
      repo: { getCatalogue: () => Promise.reject(new Error('disk on fire')), getLenses: async () => ({}) },
    });
    const res = await broken.request('/api/v1/products/m01');
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).not.toMatch(/disk on fire|at |\.js/);
  });
});

describe('GET /api/v1/health', () => {
  it('reports ok, the data source and version, uncached', async () => {
    const res = await get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await json(res)).data).toMatchObject({ status: 'ok', dataSource: 'static', version: '1.0.0' });
  });
});

describe('GET /api/v1/bootstrap and /store and /lenses', () => {
  it('returns everything the first screen needs with an ETag and CDN caching', async () => {
    const res = await get('/api/v1/bootstrap');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=300, stale-while-revalidate=86400');
    const etag = res.headers.get('etag');
    expect(etag).toMatch(/^".+"$/);
    const { data } = await json(res);
    expect(data.products).toHaveLength(48);
    expect(data.zones).toHaveLength(10);
    expect(Object.keys(data)).toEqual(['store', 'zones', 'tour', 'tourText', 'products', 'merchandising', 'lenses']);
    const again = await get('/api/v1/bootstrap', { 'If-None-Match': 'W/' + etag });
    expect(again.status).toBe(304);
  });
  it('returns store details and lens options', async () => {
    const s = await json(await get('/api/v1/store'));
    expect(s.data.store.name).toBe('Brijman Eyewear');
    expect(s.data.tour).toHaveLength(10);
    const l = await json(await get('/api/v1/lenses'));
    expect(l.data.types.map((t) => t.p)).toEqual([0, 1200, 2400, 4900]);
  });
});

describe('GET /api/v1/products', () => {
  it('filters by zone, shape, material, polarised, price, type and text', async () => {
    const q = async (s) => (await json(await get('/api/v1/products' + s))).data.map((p) => p.id);
    expect(await q('?zone=kids')).toEqual(['k01', 'k02', 'k03', 'k04', 'k05']);
    expect(await q('?shape=aviator')).toEqual(['s01', 'p04']);
    expect(await q('?material=titanium&zone=men')).toEqual(['m03', 'm06', 'm11']);
    expect(await q('?polarised=true&zone=sun')).toEqual(['s01', 's02', 's05', 's06', 's07']);
    expect(await q('?maxPrice=1300&type=frame')).toEqual(['k01', 'k03', 'k05']);
    expect(await q('?type=care')).toEqual(['c05', 'c06', 'c07']);
    expect(await q('?q=havana%20keyhole')).toEqual(['m09']);
  });
  it('rejects a bad filter with 422', async () => {
    expect((await get('/api/v1/products?maxPrice=cheap')).status).toBe(422);
  });
  it('returns one product, or 404 with the envelope', async () => {
    const ok = await json(await get('/api/v1/products/m01'));
    expect(ok.data).toMatchObject({ id: 'm01', name: 'Arlo', price: 2490 });
    const res = await get('/api/v1/products/zz99');
    expect(res.status).toBe(404);
    expect((await json(res)).error).toMatchObject({ code: 'not_found' });
  });
});

describe('POST /api/v1/cart/quote', () => {
  it('prices on the server: zero power Arlo is ₹2,490', async () => {
    const res = await post('/api/v1/cart/quote', { lines: [line()] });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const { data } = await json(res);
    expect(data).toMatchObject({ total: 2490, subtotal: 2490, delivery: 0, currency: 'INR', taxIncluded: true });
    expect(data.quoteId).toMatch(/^q_[0-9a-f]{24}$/);
  });
  it('single vision, 1.60 and blue-cut is ₹5,490; contacts multiply by quantity', async () => {
    const { data } = await json(
      await post('/api/v1/cart/quote', {
        lines: [line({ config: sv }), line({ productId: 'c01', config: { pack: 1 }, qty: 3 })],
      }),
    );
    expect(data.lines.map((l) => l.lineTotal)).toEqual([5490, 3 * 3950]);
    expect(data.total).toBe(5490 + 11850);
  });
  it('gives the same quoteId for the same bag', async () => {
    const a = (await json(await post('/api/v1/cart/quote', { lines: [line()] }))).data.quoteId;
    const b = (await json(await post('/api/v1/cart/quote', { lines: [line()] }))).data.quoteId;
    expect(a).toBe(b);
  });
  it('rejects unknown products, colours, configs and quantities, per line', async () => {
    const res = await post('/api/v1/cart/quote', {
      lines: [
        line({ productId: 'm99' }),
        line({ colourIndex: 7 }),
        line({ productId: 'k01', config: { type: 'pg', index: '156', coats: [] } }),
        line({ qty: 2 }),
        line({ productId: 'c06', config: { pack: 0 }, colourIndex: 1 }),
      ],
    });
    expect(res.status).toBe(422);
    expect((await json(res)).error.fields).toEqual({
      'lines.0.productId': 'This product is no longer available.',
      'lines.1.colourIndex': 'This colour is not available for Arlo.',
      'lines.2.config': 'This lens type is not available for this frame.',
      'lines.3.qty': 'Frames are added one pair per line.',
      'lines.4.colourIndex': 'This colour is not available for Comfort Drops.',
    });
  });
  it('rejects more than 12 packs, more than 20 lines, empty bags and unknown keys', async () => {
    const pack = line({ productId: 'c06', config: { pack: 0 }, qty: 13 });
    expect((await post('/api/v1/cart/quote', { lines: [pack] })).status).toBe(422);
    expect((await post('/api/v1/cart/quote', { lines: Array(21).fill(line()) })).status).toBe(422);
    expect((await post('/api/v1/cart/quote', { lines: [] })).status).toBe(422);
    expect((await post('/api/v1/cart/quote', { lines: [line({ unitPrice: 1 })] })).status).toBe(422);
    expect((await post('/api/v1/cart/quote', { lines: [line()], total: 1 })).status).toBe(422);
  });
});

describe('POST /api/v1/orders', () => {
  it('places a demo order, re-priced on the server, and echoes the idempotency key', async () => {
    const key = '3b241101-e2bb-4255-8caf-4136c566a962';
    const body = order({
      lines: [line({ config: sv, prescription: rx })],
      delivery: { method: 'home', line1: '12 MG Road', city: 'Bengaluru', pin: '560001' },
    });
    const res = await post('/api/v1/orders', body, { 'Idempotency-Key': key });
    expect(res.status).toBe(201);
    expect(res.headers.get('idempotency-key')).toBe(key);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const { data } = await json(res);
    expect(data).toMatchObject({ status: 'demo_not_charged', total: 5490, currency: 'INR' });
    expect(data.orderRef).toMatch(/^BM-DEMO-[2-9A-HJ-NP-Z]{6}$/);
    expect(JSON.stringify(data)).not.toMatch(/9876543210|Asha|MG Road/);
    const again = await json(await post('/api/v1/orders', body, { 'Idempotency-Key': key }));
    expect(again.data.orderRef).toBe(data.orderRef);
  });
  it('requires consent, a valid contact and a full home address', async () => {
    const res = await post(
      '/api/v1/orders',
      order({
        consent: false,
        contact: { name: 'A', mobile: '12345' },
        delivery: { method: 'home', line1: '', city: 'X', pin: '12' },
      }),
    );
    expect(res.status).toBe(422);
    const f = (await json(res)).error.fields;
    expect(Object.keys(f).sort()).toEqual([
      'consent',
      'contact.mobile',
      'contact.name',
      'delivery.city',
      'delivery.line1',
      'delivery.pin',
    ]);
  });
  it('needs a valid prescription for lines entered now, and refuses one where none is needed', async () => {
    const missing = await post('/api/v1/orders', order({ lines: [line({ config: sv })] }));
    expect((await json(missing)).error.fields).toHaveProperty(['lines.0.prescription']);
    const bad = { ...rx, l: { sph: -1, cyl: -0.5, axis: null } };
    const wrong = await post('/api/v1/orders', order({ lines: [line({ config: sv, prescription: bad })] }));
    expect((await json(wrong)).error.fields).toEqual({
      'lines.0.prescription.l.axis': 'Left eye: AXIS is a whole number from 1 to 180 when CYL is set.',
    });
    const extra = await post('/api/v1/orders', order({ lines: [line({ prescription: rx })] }));
    expect(extra.status).toBe(422);
    const later = await post('/api/v1/orders', order({ lines: [line({ config: { ...sv, rx: 'later' } })] }));
    expect(later.status).toBe(201);
  });
  it('rejects a malformed Idempotency-Key', async () => {
    expect((await post('/api/v1/orders', order(), { 'Idempotency-Key': 'abc' })).status).toBe(422);
  });
});

describe('eye test', () => {
  it('lists future slots in IST, grouped by day', async () => {
    const res = await get('/api/v1/eye-test/slots?days=3');
    expect(res.status).toBe(200);
    const { data } = await json(res);
    expect(data.timezone).toBe('Asia/Kolkata');
    expect(data.days.map((d) => d.date)).toEqual(['2026-10-14', '2026-10-15', '2026-10-16']);
    expect(data.days[0].slots[0]).toEqual({ time: '10:30', start: '2026-10-14T10:30:00+05:30' });
  });
  it('leaves out slots that have passed', async () => {
    const late = createApp({ now: () => Date.parse('2026-10-14T11:00:00Z') }); // 16:30 IST
    const { data } = await json(await late.request('/api/v1/eye-test/slots?days=1'));
    expect(data.days[0].slots.map((s) => s.time)).toEqual(['18:30']);
  });
  it('validates the range', async () => {
    expect((await get('/api/v1/eye-test/slots?days=15')).status).toBe(422);
    expect((await get('/api/v1/eye-test/slots?from=2026-02-30')).status).toBe(422);
    const far = await json(await get('/api/v1/eye-test/slots?from=2027-01-01'));
    expect(far.data.days).toEqual([]);
  });
  it('books a real future slot in demo mode', async () => {
    const res = await post('/api/v1/eye-test/bookings', {
      slotStart: '2026-10-15T12:00:00+05:30',
      name: 'Asha Rao',
      mobile: '9876543210',
      consent: true,
    });
    expect(res.status).toBe(201);
    const { data } = await json(res);
    expect(data).toMatchObject({ status: 'demo_not_booked', slotStart: '2026-10-15T12:00:00+05:30' });
    expect(data.bookingRef).toMatch(/^BM-ET-DEMO-[2-9A-HJ-NP-Z]{4}$/);
  });
  it('refuses past, unknown and malformed slots', async () => {
    const b = (slotStart) =>
      post('/api/v1/eye-test/bookings', { slotStart, name: 'Asha Rao', mobile: '9876543210', consent: true });
    expect((await b('2026-10-13T12:00:00+05:30')).status).toBe(422);
    expect((await b('2026-10-15T12:15:00+05:30')).status).toBe(422);
    expect((await b('2026-10-15 12:00')).status).toBe(422);
    const noConsent = await post('/api/v1/eye-test/bookings', {
      slotStart: '2026-10-15T12:00:00+05:30',
      name: 'Asha Rao',
      mobile: '9876543210',
    });
    expect((await json(noConsent)).error.fields).toHaveProperty('consent');
  });
});
