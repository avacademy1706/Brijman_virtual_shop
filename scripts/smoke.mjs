// Post-deploy smoke test. Usage: npm run smoke -- <baseUrl>   for example http://localhost:4173
// Node's built-in fetch only, no dependencies. Prints a line per check and exits with code 1 on any failure.
const base = (process.argv[2] || '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(base)) {
  console.error('Give the site address, for example: npm run smoke -- http://localhost:4173');
  process.exit(1);
}

let failures = 0;
function report(ok, name, detail) {
  if (!ok) failures++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail && !ok ? '  (' + detail + ')' : ''));
}
async function check(name, fn) {
  try {
    const res = await fn();
    report(res === true || res === undefined, name, typeof res === 'string' ? res : '');
  } catch (err) {
    report(false, name, err.message);
  }
}
const get = (path, init) => fetch(base + path, Object.assign({ redirect: 'manual' }, init));
const postJSON = (path, body) =>
  get(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const quoteLine = (config, sizeId = 'M') => ({ lines: [{ productId: 'm01', colourIndex: 0, sizeId, config, qty: 1 }] });

await check('GET / returns 200 with a Content-Security-Policy', async () => {
  const r = await get('/');
  if (r.status !== 200) return 'status ' + r.status;
  return r.headers.get('content-security-policy') ? true : 'no CSP header';
});
await check('The site allows the camera for itself only (try-on)', async () => {
  const r = await get('/');
  const pp = r.headers.get('permissions-policy') || '';
  return /camera=(self)/.test(pp) ? true : 'Permissions-Policy: ' + pp;
});
await check('GET /api/v1/health is ok', async () => {
  const r = await get('/api/v1/health');
  const j = await r.json();
  return r.status === 200 && j.data && j.data.status === 'ok' ? true : 'status ' + r.status;
});
await check('GET /api/v1/bootstrap has an ETag and 48 products', async () => {
  const r = await get('/api/v1/bootstrap');
  const j = await r.json();
  if (r.status !== 200) return 'status ' + r.status;
  if (!r.headers.get('etag')) return 'no ETag';
  return j.data.products.length === 48 ? true : j.data.products.length + ' products';
});
await check('GET /api/v1/products/m01 returns 200', async () => {
  const r = await get('/api/v1/products/m01');
  return r.status === 200 ? true : 'status ' + r.status;
});
await check('GET /api/v1/products/zz99 returns 404 with the error envelope', async () => {
  const r = await get('/api/v1/products/zz99');
  const j = await r.json();
  return r.status === 404 && j.error && j.error.code === 'not_found' ? true : 'status ' + r.status;
});
await check('POST /api/v1/cart/quote: m01 zero power totals 2490', async () => {
  const r = await postJSON('/api/v1/cart/quote', quoteLine({ type: 'zero', index: '156', coats: [] }));
  const j = await r.json();
  return r.status === 200 && j.data.total === 2490 ? true : 'got ' + (j.data ? j.data.total : r.status);
});
await check('POST /api/v1/cart/quote: m01 single vision, 1.60, blue-cut totals 5490', async () => {
  const r = await postJSON('/api/v1/cart/quote', quoteLine({ type: 'sv', index: '160', coats: ['bc'], rx: 'later' }));
  const j = await r.json();
  return r.status === 200 && j.data.total === 5490 ? true : 'got ' + (j.data ? j.data.total : r.status);
});
await check('POST /api/v1/cart/quote: m01 size L is priced and labelled', async () => {
  const r = await postJSON('/api/v1/cart/quote', quoteLine({ type: 'zero', index: '156', coats: [] }, 'L'));
  const j = await r.json();
  if (r.status !== 200) return 'status ' + r.status;
  return j.data.lines[0].sizeLabel === 'L · 55□19-150' ? true : 'label ' + j.data.lines[0].sizeLabel;
});
await check('POST /api/v1/cart/quote with an unknown size returns 422', async () => {
  const r = await postJSON('/api/v1/cart/quote', quoteLine({ type: 'zero', index: '156', coats: [] }, 'XL'));
  const j = await r.json();
  return r.status === 422 && j.error.fields['lines.0.sizeId'] ? true : 'status ' + r.status;
});
await check('A text/plain POST returns 415', async () => {
  const r = await get('/api/v1/cart/quote', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' });
  return r.status === 415 ? true : 'status ' + r.status;
});
await check('GET /api/v1/cart/quote returns 405', async () => {
  const r = await get('/api/v1/cart/quote');
  return r.status === 405 ? true : 'status ' + r.status;
});
await check('API responses have nosniff and X-Request-Id, and no Access-Control-Allow-Origin', async () => {
  const r = await get('/api/v1/health', { headers: { Origin: 'https://example.com' } });
  if (r.headers.get('x-content-type-options') !== 'nosniff') return 'missing nosniff';
  if (!r.headers.get('x-request-id')) return 'missing X-Request-Id';
  return r.headers.get('access-control-allow-origin') ? 'CORS header present' : true;
});

console.log(failures ? '\n' + failures + ' check(s) failed.' : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
