// Development gallery: every catalogue piece in the product studio, with metal, stone and detail switches.
// Run `npm run dev`, then open http://localhost:5173/tools/gallery.html (add ?id=<product id> to open one piece).
// Not part of the production build.
import { NY } from '../src/core/ny.js';
import '../src/data/catalogue.js';
import { JewelStage } from '../src/jewel/stage.js';
import { pieceKit } from '../src/jewel/source.js';
import { METALS } from '../src/jewel/materials.js';

const qs = new URLSearchParams(location.search);
const canvas = document.getElementById('stage');
const stage = new JewelStage({ renderer: null, still: qs.has('still') });
canvas.replaceWith(stage.domElement);
stage.domElement.id = 'stage';
const bar = document.getElementById('bar'),
  info = document.getElementById('info');

const sel = (opts, cur, on) => {
  const s = document.createElement('select');
  for (const [v, n] of opts) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = n;
    if (v === cur) o.selected = true;
    s.append(o);
  }
  s.addEventListener('change', () => on(s.value));
  bar.append(s);
  return s;
};
const P = NY.PRODUCTS;
let cur = NY.byId[qs.get('id')] || P[0];
let metal = qs.get('metal') || cur.metals[0];
let q = parseFloat(qs.get('q') || '0.9');
async function draw() {
  const cfg = NY.defaultCfg(cur);
  if (!cur.metals.includes(metal)) metal = cur.metals[0];
  cfg.metal = metal;
  const t0 = performance.now();
  const kit = await pieceKit(cur, NY.buildCfg(cur, cfg), q, q < 0.5 ? 'store' : 'full');
  const t1 = performance.now();
  const r = stage.show(kit, { type: cur.type, metal, stones: NY.stonesFor(cur, cfg), whiteClaws: cur.whiteClaws });
  const z = parseFloat(qs.get('z') || '1');
  if (z !== 1) {
    stage.camera.position.sub(stage.controls.target).multiplyScalar(z).add(stage.controls.target);
    stage.controls.update();
  }
  info.textContent =
    cur.id +
    ' · ' +
    cur.name +
    ' · ' +
    Math.round(kit.tris() / 1000) +
    'k triangles · ' +
    r.glints +
    ' glints · built in ' +
    Math.round(t1 - t0) +
    ' ms' +
    (kit.model ? ' · 3D model' : ' · built in');
  window.__ready = true;
}
sel(
  P.map((p) => [p.id, p.id + ' · ' + p.name]),
  cur.id,
  (v) => {
    cur = NY.byId[v];
    draw();
  },
);
sel(
  Object.keys(METALS)
    .filter((k) => k !== 'ox')
    .map((k) => [k, METALS[k].n]),
  metal,
  (v) => {
    metal = v;
    draw();
  },
);
sel(
  [
    ['0.35', 'Store detail'],
    ['0.9', 'Viewer detail'],
  ],
  String(q),
  (v) => {
    q = parseFloat(v);
    draw();
  },
);
function resize() {
  stage.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();
draw();
function loop(now) {
  requestAnimationFrame(loop);
  stage.render(now);
}
requestAnimationFrame(loop);
window.__show = (id, m, qq) => {
  cur = NY.byId[id];
  if (m) metal = m;
  if (qq) q = qq;
  draw();
};
