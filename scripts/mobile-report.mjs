// Builds reports/mobile-audit/index.html from the audit results (before and after). Works offline.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../reports/mobile-audit/', import.meta.url));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function load(phase) {
  const dir = join(ROOT, phase);
  if (!existsSync(dir)) return {};
  const out = {};
  for (const d of readdirSync(dir)) {
    const f = join(dir, d, 'result.json');
    if (existsSync(f)) out[d] = JSON.parse(readFileSync(f, 'utf8'));
  }
  return out;
}
const before = load('before');
const after = load('after');
const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
if (!keys.length) {
  console.error('No audit results found. Run npm run test:mobile first.');
  process.exit(1);
}

const count = (r) => {
  if (!r) return null;
  const c = r.checks.filter((x) => x.ok !== null);
  return { pass: c.filter((x) => x.ok).length, fail: c.filter((x) => !x.ok).length };
};
const cell = (r) => {
  const c = count(r);
  if (!c) return '<td class="na">—</td>';
  return (
    '<td class="' +
    (c.fail ? 'bad' : 'good') +
    '">' +
    c.pass +
    ' passed' +
    (c.fail ? ', <b>' + c.fail + ' failed</b>' : '') +
    '</td>'
  );
};
const metric = (r, k) => (r && r.metrics && r.metrics[k] != null ? r.metrics[k] : '—');

let rows = '';
for (const k of keys) {
  const b = before[k],
    a = after[k];
  const r = a || b;
  rows +=
    '<tr><td><a href="#' +
    k +
    '">' +
    esc(r.project) +
    '</a></td><td>' +
    esc(r.browser) +
    '</td><td>' +
    r.viewport.width +
    '×' +
    r.viewport.height +
    '</td>' +
    cell(b) +
    cell(a) +
    '<td>' +
    metric(b, 'readyMs') +
    ' / ' +
    metric(a, 'readyMs') +
    '</td><td>' +
    metric(b, 'draws') +
    ' / ' +
    metric(a, 'draws') +
    '</td></tr>';
}

let detail = '';
for (const k of keys) {
  const b = before[k],
    a = after[k];
  const r = a || b;
  const names = [...new Set([...(b ? b.checks : []), ...(a ? a.checks : [])].map((c) => c.step + ' · ' + c.name))];
  const find = (res, n) => res && res.checks.find((c) => c.step + ' · ' + c.name === n);
  const mark = (c) =>
    !c
      ? '<td class="na">—</td>'
      : c.ok === null
        ? '<td class="na">info</td>'
        : c.ok
          ? '<td class="good">pass</td>'
          : '<td class="bad">fail</td>';
  let checks = '';
  for (const n of names) {
    const cb = find(b, n),
      ca = find(a, n);
    const note = (ca && ca.detail) || (cb && cb.detail) || '';
    checks += '<tr><td>' + esc(n) + '</td>' + mark(cb) + mark(ca) + '<td class="note">' + esc(note) + '</td></tr>';
  }
  const shots = (res, phase) =>
    res
      ? res.shots
          .map(
            (s) =>
              '<figure><img loading="lazy" src="' +
              phase +
              '/' +
              k +
              '/' +
              s.file +
              '" alt="' +
              esc(s.label) +
              '"><figcaption>' +
              esc(s.label) +
              '</figcaption></figure>',
          )
          .join('')
      : '<p class="na">Not run.</p>';
  const m = (res) =>
    res
      ? Object.entries(res.metrics)
          .map(([x, y]) => esc(x) + ': ' + esc(y))
          .join(' · ')
      : '—';
  detail +=
    '<section id="' +
    k +
    '"><h2>' +
    esc(r.project) +
    ' <small>' +
    esc(r.browser) +
    ', ' +
    r.viewport.width +
    '×' +
    r.viewport.height +
    (r.touch ? ', touch' : '') +
    '</small></h2><table><tr><th>Check</th><th>Before</th><th>After</th><th>Detail</th></tr>' +
    checks +
    '</table>' +
    '<p class="metrics"><b>Before:</b> ' +
    m(b) +
    '<br><b>After:</b> ' +
    m(a) +
    '</p>' +
    '<h3>Before</h3><div class="shots">' +
    shots(b, 'before') +
    '</div><h3>After</h3><div class="shots">' +
    shots(a, 'after') +
    '</div></section>';
}

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mobile audit</title><style>
:root{color-scheme:light dark;--bg:#f6f7f4;--fg:#15201c;--muted:#56645d;--line:#d4dcd7;--good:#1e6a57;--bad:#a33b28}
@media (prefers-color-scheme:dark){:root{--bg:#0c1210;--fg:#e4ebe7;--muted:#9aa9a2;--line:#2a3531;--good:#66c8ab;--bad:#ff8e77}}
body{margin:0;padding:24px clamp(12px,3vw,32px);background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
h1{margin:0 0 4px}h2{margin:40px 0 8px;border-top:1px solid var(--line);padding-top:24px}h2 small{color:var(--muted);font-weight:400;font-size:14px}
table{border-collapse:collapse;width:100%;margin:8px 0;font-size:14px}td,th{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
.good{color:var(--good);font-weight:600}.bad{color:var(--bad);font-weight:600}.na{color:var(--muted)}.note{color:var(--muted);font-size:13px;max-width:48ch;word-break:break-word}
.shots{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px}figure{margin:0;flex:none}figure img{height:300px;border:1px solid var(--line);border-radius:8px}
figcaption{font-size:12px;color:var(--muted)}.metrics{font-size:13px;color:var(--muted)}.box{border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin:16px 0}
</style></head><body>
<h1>Mobile audit</h1><p class="na">Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Before = the code before the mobile work; after = the current build.</p>
<div class="box"><b>About these results.</b> iPhone and iPad profiles run in Playwright's WebKit, which is close to Safari but not identical. Android profiles run in Chromium with device emulation. 3D runs on software WebGL in a headless browser, so fps and load times are far below what a real phone's GPU gives; use them to compare before and after, not as real-device numbers. The on-screen keyboard, real touch scrolling in WebKit, the Back gesture, notches and in-app browsers need a real device: see <code>docs/mobile-testing.md</code>.</div>
<table><tr><th>Device</th><th>Engine</th><th>Viewport</th><th>Before</th><th>After</th><th>3D ready ms (before / after)</th><th>Draw calls (before / after)</th></tr>${rows}</table>
<div class="box"><b>Manual checks still required on real devices:</b><ul>
<li>The keyboard never hides the focused field or the primary button (iPhone Safari, Chrome Android).</li>
<li>iOS does not zoom when a field is tapped.</li><li>The Back gesture and Android Back button close panels; Back from the bare store leaves normally.</li>
<li>Swipe down on the sheet grip feels natural; a swipe on the product viewer scrolls the sheet (Safari).</li>
<li>Top and bottom bars stay clear of the notch and home indicator, in portrait and landscape.</li>
<li>WhatsApp, Instagram and Facebook in-app browsers: the site works; the try-on shows the "Open in browser" tip where the camera is blocked.</li>
<li>Real fps on a budget Android phone, a mid-range phone and an iPhone (add <code>?tryon-debug</code> for the try-on).</li></ul></div>
${detail}</body></html>`;
writeFileSync(join(ROOT, 'index.html'), html);
console.log('Report written: reports/mobile-audit/index.html (' + keys.length + ' device profiles)');
