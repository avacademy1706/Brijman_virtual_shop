// Showroom interface: welcome, section cards, guided tour, detail sheet, search, bag, checkout and floor plan.
import { BM } from '../core/bm.js';
import '../data/store-layout.js';
import '../data/frames.js';
import '../data/catalogue.js';
import { money, $, h, ic, store, esc } from '../lib/dom.js';
import { drawYou } from '../lib/drawings.js';
import { readBag, writeBag, lineKey } from '../lib/bag-storage.js';
import { sizeOf, sizeMarking, sizeLabel } from '../../shared/fit.js';
import { frontWidthMm } from '../../shared/frame-archetypes.js';
import { LIMITS, TIMEZONE } from '../../shared/constants.js';
import { rxProblems, normalizeRx, normalizeMobile, MSG } from '../../shared/rules.js';
// zod and the schemas load only when a form is used, so the first screen stays light.
let schemasP = null;
const loadSchemas = () =>
  (schemasP ||= import('../../shared/schemas.js').catch((err) => {
    schemasP = null;
    throw err;
  }));
// Like loadSchemas, but shows a message instead of throwing when the network drops.
async function schemasOr(showError) {
  try {
    return await loadSchemas();
  } catch (e) {
    showError('We could not reach the showroom server. Check your connection and try again.');
    return null;
  }
}
import { DATA_SOURCE, ApiError } from '../services/http.js';
import { initLayout, isBottomSheet, isPhone, isCoarse, onLayoutChange, layoutMode, measureChrome } from './layout.js';
import { pushLayer, dropLayer } from './history.js';
import { quoteCart } from '../services/cart-service.js';
import { placeOrder, newIdempotencyKey } from '../services/order-service.js';
import { getSlots, bookEyeTest } from '../services/eye-test-service.js';

const RM = BM.reduceMotion;
void esc;
const ONLINE = DATA_SOURCE === 'api';

/* =====================================================================
   UI STATE
   ===================================================================== */
// The saved bag (src/lib/bag-storage.js) holds only product id, colour, size, lens configuration and quantity.
// Prices are recomputed, and lines that no longer match the catalogue are dropped.
const bagStorage = (() => {
  try {
    const ls = window.localStorage;
    ls.getItem('bm-settings');
    return ls;
  } catch (e) {
    const mem = {};
    return {
      getItem: (k) => mem[k] ?? null,
      setItem: (k, v) => (mem[k] = String(v)),
      removeItem: (k) => delete mem[k],
    };
  }
})();
function loadCart() {
  const out = readBag(bagStorage, BM.byId, BM.LENS);
  out.lines.forEach((l) => (l.unit = BM.priceOf(BM.byId[l.pid], l.cfg, l.size)));
  return out;
}
const initialCart = loadCart();
const S = {
  cart: initialCart.lines,
  // Prescriptions typed for bag lines, by line key. Memory only: never saved to localStorage.
  rx: {},
  quote: { status: ONLINE ? 'idle' : 'offline', data: null, seq: 0, notes: [], removed: null },
  stack: [],
  zone: 'welcome',
  has3D: false,
  failed: false,
  tour: { on: false, i: 0, playing: !RM, timer: null, arrived: false },
  pendingTour: false,
  lastFocus: null,
  cardDismissed: null,
};
S.settings = Object.assign({ move: RM ? 'jump' : 'walk', quality: 'auto', labels: true }, store.get('bm-settings', {}));
BM.settings = S.settings;
const saveCart = () => {
  writeBag(bagStorage, S.cart);
  for (const k of Object.keys(S.rx)) if (!S.cart.some((l) => l.key === k)) delete S.rx[k];
};
const saveSettings = () => store.set('bm-settings', S.settings);

const app = $('#app'),
  sheet = $('#sheet'),
  sheetBody = $('#sheet-body'),
  sheetFoot = $('#sheet-foot'),
  scrim = $('#scrim');
// Layout modes live in src/ui/layout.js (matching main.css). Phones = portrait or landscape phone layouts.
const isNarrow = () => isPhone();
const api = () => (S.has3D ? BM.api : null);

let toastT = null;
function toast(msg, ms) {
  // While the sheet is open the message appears inside it, so nothing floats over the panel.
  const inSheet = sheet && sheet.classList.contains('open');
  const t = inSheet ? $('#sheet-toast') : $('#toast');
  const other = inSheet ? $('#toast') : $('#sheet-toast');
  if (other) other.hidden = true;
  t.textContent = msg;
  t.hidden = false;
  // The toast and the hint share the same spot: the toast wins.
  const hn = $('#hint');
  if (hn) hn.hidden = true;
  clearTimeout(toastT);
  toastT = setTimeout(() => {
    t.hidden = true;
  }, ms || 2400);
}
BM.toast = toast;

function updateBadge() {
  const n = S.cart.reduce((a, l) => a + l.qty, 0),
    b = $('#bag-count');
  b.textContent = n;
  b.hidden = n === 0;
  $('#btn-bag').setAttribute(
    'aria-label',
    n ? 'Open your bag, ' + n + (n === 1 ? ' item' : ' items') : 'Open your bag',
  );
}

/* ---------- Welcome and status ---------- */
function setStatus(state) {
  const st = $('#status'),
    tx = $('#status-text'),
    sp = st.querySelector('.spinner');
  if (state === 'ready') {
    tx.textContent = 'Showroom ready.';
    sp.hidden = true;
    st.classList.add('ok');
  } else if (state === 'fallback') {
    tx.textContent = 'The 3D view can’t run here, so the floor plan stands in. Tap a section to browse it.';
    sp.hidden = true;
    st.classList.add('warn');
  }
}
let hintT = null;
function hideWelcome(showHint) {
  const w = $('#welcome');
  if (w.hidden) return;
  w.hidden = true;
  if (showHint && S.has3D && !S.settings.coachSeen) {
    showCoach();
    return;
  }
  if (showHint && S.has3D) {
    const hn = $('#hint');
    hn.hidden = false;
    clearTimeout(hintT);
    hintT = setTimeout(() => {
      hn.hidden = true;
    }, 6000);
  }
}

/* ---------- Current zone ---------- */
function setZoneName(id) {
  const z = BM.zoneById(id);
  $('#zone-name').textContent = z ? z.name : 'Showroom floor';
}
BM.onZoneChange = (id) => {
  S.zone = id;
  setZoneName(id);
  drawMinimap();
};

/* ---------- Zone card ---------- */
function zoneCount(id) {
  return BM.PRODUCTS.filter((p) => p.zone === id).length;
}
function nextZone(id) {
  const i = BM.TOUR.indexOf(id);
  return BM.TOUR[(i + 1) % BM.TOUR.length];
}
function btn(label, opts) {
  opts = opts || {};
  const b = h('button', {
    class: 'btn' + (opts.primary ? ' primary' : '') + (opts.cls ? ' ' + opts.cls : ''),
    type: 'button',
    id: opts.id || null,
    onclick: opts.onclick,
  });
  if (opts.icon) b.append(ic(opts.icon));
  b.append(h('span', null, label));
  return b;
}
function zoneActions(z) {
  const acts = [];
  const nz = BM.zoneById(nextZone(z.id));
  const next = btn('Next: ' + nz.short, { icon: 'arrow', onclick: () => goZone(nz.id) });
  switch (z.id) {
    case 'welcome':
      acts.push(
        btn('Open directory', { primary: true, icon: 'map', onclick: () => openSheet('directory') }),
        btn('Take the tour', { icon: 'play', onclick: () => startTour(0) }),
      );
      break;
    case 'lensbar':
      acts.push(btn('Open lens guide', { primary: true, icon: 'lens', onclick: () => openSheet('lensguide') }), next);
      break;
    case 'eyetest':
      acts.push(btn('Book a free eye test', { primary: true, icon: 'eye', onclick: () => openSheet('eyetest') }), next);
      break;
    case 'checkout':
      acts.push(
        btn('Open bag', { primary: true, icon: 'bag', onclick: () => openSheet('bag') }),
        btn('Store details', { icon: 'info', onclick: () => openSheet('info') }),
      );
      break;
    default: {
      const n = zoneCount(z.id);
      acts.push(
        btn('Browse ' + n + (z.id === 'contacts' ? ' products' : ' styles'), {
          primary: true,
          icon: 'search',
          onclick: () => openSheet('browse', { zone: z.id }),
        }),
        next,
      );
    }
  }
  return acts;
}
function showZoneCard(id) {
  if (S.tour.on) return;
  if (BM.coachVisible && BM.coachVisible()) return;
  const z = BM.zoneById(id),
    card = $('#zonecard');
  if (!z) {
    card.hidden = true;
    return;
  }
  const idx = BM.TOUR.indexOf(z.id) + 1;
  let eb = 'Section ' + idx + ' of ' + BM.TOUR.length;
  const n = zoneCount(z.id);
  if (n) eb += ' · ' + n + (z.id === 'contacts' ? ' products' : ' styles');
  $('#zc-eyebrow').textContent = eb;
  $('#zc-title').textContent = z.name;
  $('#zc-blurb').textContent = z.blurb;
  const box = $('#zc-actions');
  box.replaceChildren(...zoneActions(z));
  card.hidden = false;
  S.cardZone = id;
}
$('#zc-close').addEventListener('click', () => {
  $('#zonecard').hidden = true;
});

/* ---------- Navigation requests ---------- */
function goZone(id, tag) {
  const a = api();
  if (!a) {
    const z = BM.zoneById(id);
    if (z) openSheet(zoneSheet(id), { zone: id });
    return;
  }
  if (!tag) pauseTour();
  hideWelcome(false);
  if (isNarrow()) closeSheet();
  a.goZone(id, tag);
}
function zoneSheet(id) {
  if (id === 'eyetest') return 'eyetest';
  if (id === 'lensbar') return 'lensguide';
  if (id === 'checkout') return 'bag';
  if (id === 'welcome') return 'directory';
  return 'browse';
}
function locate(pid, ci) {
  const a = api();
  if (!a) return;
  pauseTour();
  hideWelcome(false);
  closeSheet();
  a.goProduct(pid, ci);
}

BM.onArrive = (info) => {
  if (S.tour.on && info.tag === 'tour') {
    tourArrived();
    return;
  }
  if (info.reason === 'product') return;
  if (S.tour.on) return;
  if (!info.zone) {
    $('#zonecard').hidden = true;
    S.cardZone = null;
    return;
  }
  if (info.reason === 'zone' || info.zone !== S.cardZone) {
    S.cardZone = info.zone;
    showZoneCard(info.zone);
  }
};
BM.onUserNav = (kind) => {
  if (kind === 'walk' && BM.coachVisible && BM.coachVisible() && coachStep === 0) {
    coachStep = 1;
    renderCoach();
  }
  hideWelcome(true);
  if (S.tour.on && S.tour.playing) pauseTour();
};
BM.onProductTap = (pid, ci) => {
  hideWelcome(false);
  pauseTour();
  openSheet('product', { pid, ci });
};
BM.onFeatureTap = (action) => {
  hideWelcome(false);
  pauseTour();
  if (action === 'directory') openSheet('directory');
  else if (action === 'lensguide') openSheet('lensguide');
  else if (action === 'eyetest') openSheet('eyetest');
  else if (action === 'bag') openSheet('bag');
};

/* ---------- Guided tour ---------- */
function setTourPressed(on) {
  for (const id of ['btn-tour', 'bb-tour']) {
    const b = $('#' + id);
    if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}
function startTour(i) {
  if (!S.has3D) {
    S.pendingTour = true;
    hideWelcome(false);
    toast('The tour starts as soon as the showroom is ready.');
    return;
  }
  clearTimeout(S.tour.timer);
  S.tour.on = true;
  S.tour.i = Math.max(0, Math.min(BM.TOUR.length - 1, i || 0));
  S.tour.playing = !RM;
  S.tour.arrived = false;
  hideWelcome(false);
  if (isNarrow()) closeSheet();
  $('#zonecard').hidden = true;
  $('#tourcard').hidden = false;
  setTourPressed(true);
  if (!tourLayer)
    tourLayer = pushLayer('tour', () => {
      tourLayer = null;
      endTour(true);
    });
  renderTour();
  api().goZone(BM.TOUR[S.tour.i], 'tour');
}
let tourLayer = null;
function renderTour() {
  const id = BM.TOUR[S.tour.i],
    z = BM.zoneById(id);
  BM.tourTarget = id;
  $('#tc-step').textContent = 'Stop ' + (S.tour.i + 1) + ' of ' + BM.TOUR.length;
  $('#tc-title').textContent = z.name;
  $('#tc-text').textContent = S.tour.arrived ? BM.TOUR_TEXT[id] : 'Walking there…';
  $('#tc-prev').disabled = S.tour.i === 0;
  const last = S.tour.i === BM.TOUR.length - 1;
  $('#tc-next span').textContent = last ? 'Finish tour' : 'Next stop';
  const play = $('#tc-play');
  play.replaceChildren(ic(S.tour.playing ? 'pause' : 'play'), h('span', null, S.tour.playing ? 'Pause' : 'Play'));
  play.setAttribute('aria-pressed', S.tour.playing ? 'true' : 'false');
  const bar = $('#tc-bar');
  bar.classList.remove('run');
  if (S.tour.playing && S.tour.arrived) {
    void bar.offsetWidth;
    bar.classList.add('run');
  }
  const extra = $('#tc-extra');
  extra.replaceChildren();
  if (S.tour.arrived) {
    const n = zoneCount(id);
    if (n)
      extra.append(
        btn('Browse here', {
          cls: 'small',
          onclick: () => {
            pauseTour();
            openSheet('browse', { zone: id });
          },
        }),
      );
    else if (id === 'eyetest')
      extra.append(
        btn('Book a test', {
          cls: 'small',
          onclick: () => {
            pauseTour();
            openSheet('eyetest');
          },
        }),
      );
    else if (id === 'lensbar')
      extra.append(
        btn('Lens guide', {
          cls: 'small',
          onclick: () => {
            pauseTour();
            openSheet('lensguide');
          },
        }),
      );
    else if (id === 'checkout')
      extra.append(
        btn('Open bag', {
          cls: 'small',
          onclick: () => {
            pauseTour();
            openSheet('bag');
          },
        }),
      );
  }
}
function tourArrived() {
  S.tour.arrived = true;
  renderTour();
  clearTimeout(S.tour.timer);
  if (S.tour.playing) S.tour.timer = setTimeout(nextStop, 7500);
}
function nextStop() {
  clearTimeout(S.tour.timer);
  if (S.tour.i >= BM.TOUR.length - 1) {
    endTour();
    return;
  }
  S.tour.i++;
  S.tour.arrived = false;
  renderTour();
  api() && api().goZone(BM.TOUR[S.tour.i], 'tour');
}
function prevStop() {
  clearTimeout(S.tour.timer);
  if (S.tour.i === 0) return;
  S.tour.i--;
  S.tour.arrived = false;
  renderTour();
  api() && api().goZone(BM.TOUR[S.tour.i], 'tour');
}
function pauseTour() {
  if (!S.tour.on || !S.tour.playing) return;
  S.tour.playing = false;
  clearTimeout(S.tour.timer);
  renderTour();
}
function togglePlay() {
  if (!S.tour.on) return;
  S.tour.playing = !S.tour.playing;
  clearTimeout(S.tour.timer);
  if (S.tour.playing) {
    if (S.tour.arrived) S.tour.timer = setTimeout(nextStop, 7500);
    else api() && api().goZone(BM.TOUR[S.tour.i], 'tour');
  }
  renderTour();
}
function endTour(fromHistory) {
  if (fromHistory !== true && tourLayer) dropLayer(tourLayer);
  tourLayer = null;
  BM.tourTarget = null;
  clearTimeout(S.tour.timer);
  S.tour.on = false;
  $('#tourcard').hidden = true;
  setTourPressed(false);
  showZoneCard(S.zone);
}
$('#tc-next').addEventListener('click', nextStop);
$('#tc-prev').addEventListener('click', prevStop);
$('#tc-play').addEventListener('click', togglePlay);
$('#tc-exit').addEventListener('click', () => endTour());
function tourButton() {
  if (S.tour.on) endTour();
  else startTour(BM.TOUR.indexOf(S.zone) > 0 ? BM.TOUR.indexOf(S.zone) : 0);
}

/* =====================================================================
   SHEET (one panel: right side on desktop, bottom sheet on phones)
   ===================================================================== */
// Scroll only the sheet body to show an element. scrollIntoView would also scroll the
// full-screen #app container (overflow: hidden is still scrollable by script) and shift the page.
function scrollSheetTo(el) {
  const top = el.getBoundingClientRect().top - sheetBody.getBoundingClientRect().top + sheetBody.scrollTop;
  sheetBody.scrollTo({ top: Math.max(0, top - sheetBody.clientHeight / 2), behavior: RM ? 'auto' : 'smooth' });
}
// The app is a fixed full-screen stage. If focus or a browser feature ever scrolls it, put it back.
app.addEventListener('scroll', () => {
  if (app.scrollLeft || app.scrollTop) app.scrollTo(0, 0);
});
window.addEventListener('scroll', () => {
  if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
});

const VIEWS = {};
let current = null;
// One history entry per view in the sheet: Back steps back through nested views, then closes the sheet.
let sheetLayers = [];
function sheetHistoryBack() {
  sheetLayers.pop();
  teardown();
  S.stack.pop();
  if (!S.stack.length) {
    finishClose();
    return;
  }
  renderSheet();
}
function openSheet(view, data, push) {
  teardown();
  if (!push) {
    S.stack = [];
    // Replacing the views: keep one history entry for the sheet and drop the nested ones.
    if (sheetLayers.length > 1) {
      dropLayer(sheetLayers[1]);
      sheetLayers = [sheetLayers[0]];
    }
  }
  if (!sheet.classList.contains('open')) S.lastFocus = document.activeElement;
  // The coach mark steps aside while a panel is open and comes back afterwards.
  if (BM.coachVisible && BM.coachVisible()) {
    $('#coach').hidden = true;
    S.coachPaused = true;
  }
  S.stack.push({ view, data: data || {} });
  if (sheetLayers.length < S.stack.length) sheetLayers.push(pushLayer('sheet', sheetHistoryBack));
  renderSheet();
  sheet.classList.add('open');
  sheet.removeAttribute('inert');
  sheet.setAttribute('aria-hidden', 'false');
  app.classList.add('sheet-open');
  scrim.hidden = !isBottomSheet();
  if (isBottomSheet() && api()) api().setPaused(true);
  setTimeout(() => {
    const t = $('#sheet-title');
    t && t.focus({ preventScroll: true });
  }, 30);
}
function teardown() {
  if (current && current.unmount) {
    try {
      current.unmount();
    } catch (e) {
      console.warn(e);
    }
  }
  current = null;
}
function renderSheet() {
  const top = S.stack[S.stack.length - 1];
  const v = VIEWS[top.view](top.data);
  current = v;
  $('#sheet-title').textContent = v.title;
  $('#sheet-back').hidden = S.stack.length < 2;
  sheetBody.replaceChildren(v.body);
  sheetBody.scrollTop = 0;
  if (v.foot) {
    sheetFoot.replaceChildren(v.foot);
    sheetFoot.hidden = false;
  } else {
    sheetFoot.replaceChildren();
    sheetFoot.hidden = true;
  }
  if (v.mount) v.mount();
}
function backSheet() {
  if (sheetLayers.length) dropLayer(sheetLayers.pop());
  teardown();
  S.stack.pop();
  if (!S.stack.length) {
    finishClose();
    return;
  }
  renderSheet();
}
function closeSheet() {
  if (!sheet.classList.contains('open')) return;
  if (sheetLayers.length) dropLayer(sheetLayers[0]);
  sheetLayers = [];
  finishClose();
}
function finishClose() {
  if (!sheet.classList.contains('open')) return;
  sheetLayers = [];
  $('#sheet-toast').hidden = true;
  if (S.coachPaused) {
    S.coachPaused = false;
    $('#coach').hidden = false;
  }
  teardown();
  S.stack = [];
  sheet.classList.remove('open');
  sheet.setAttribute('inert', '');
  sheet.setAttribute('aria-hidden', 'true');
  app.classList.remove('sheet-open');
  scrim.hidden = true;
  if (api()) api().setPaused(false);
  const f = S.lastFocus;
  S.lastFocus = null;
  if (f && f.focus && document.contains(f)) {
    try {
      f.focus({ preventScroll: true });
    } catch (e) {
      /* ignore */
    }
  }
}
sheetBody.addEventListener('focusin', (e) => {
  const el = e.target;
  if (!el.matches || !el.matches('input, select, textarea')) return;
  // Wait for the keyboard to finish opening, then bring the field into the visible part of the sheet.
  setTimeout(() => {
    if (!document.contains(el) || document.activeElement !== el) return;
    const r = el.getBoundingClientRect(),
      b = sheetBody.getBoundingClientRect();
    const vv = window.visualViewport;
    const bottom = Math.min(b.bottom, vv ? vv.offsetTop + vv.height : innerHeight);
    if (r.top < b.top + 8 || r.bottom > bottom - 8) scrollSheetTo(el);
  }, 320);
});
$('#sheet-close').addEventListener('click', closeSheet);
$('#sheet-back').addEventListener('click', backSheet);
scrim.addEventListener('click', closeSheet);
// A tap in the 3D view acts on pointerup, and the browser then sends a click at the same point. If that tap opened
// the bottom sheet, the click would land on the backdrop (closing the sheet again) or on a button in the sheet.
document.addEventListener(
  'click',
  (e) => {
    const t = BM.lastSceneTap;
    if (!t || performance.now() - t.t > 700 || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 40) return;
    BM.lastSceneTap = null;
    if (e.target.id === 'scene') return;
    e.preventDefault();
    e.stopPropagation();
  },
  true,
);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sheet.classList.contains('open')) {
    e.preventDefault();
    closeSheet();
  }
});

/* ---------- Shared bits for views ---------- */
function section(title, ...kids) {
  return h('section', { class: 'section' }, title ? h('h3', { class: 'sec-title' }, title) : null, ...kids);
}
function priceTag(p) {
  return p.type === 'frame' ? money(p.price) : 'from ' + money(Math.min(...p.packs.map((x) => x.p)));
}
function metaLine(p) {
  if (p.type !== 'frame') return p.type === 'care' ? 'Lens care' : 'Contact lenses';
  return BM.SHAPE_LABEL[BM.ARCH[p.arch].shape] + ' · ' + p.mat;
}
function dots(p) {
  if (p.type !== 'frame') return null;
  return h(
    'span',
    { class: 'dots', 'aria-label': p.colors.length + ' colours' },
    p.colors.map((c) =>
      h('span', {
        class: 'dot',
        style: 'background:' + (c.sw2 ? 'linear-gradient(90deg,' + c.sw + ' 50%,' + c.sw2 + ' 50%)' : c.sw),
      }),
    ),
  );
}
function productRow(p, opts) {
  opts = opts || {};
  const row = h('div', { class: 'row' });
  const hit = h(
    'button',
    { class: 'row-hit', type: 'button', onclick: () => openSheet('product', { pid: p.id, ci: 0 }, true) },
    h('span', { class: 'thumb', html: BM.frameSVG(p, 0, 96, 40) }),
    h(
      'span',
      { class: 'row-main' },
      h('span', { class: 'row-name' }, p.name),
      h('span', { class: 'row-meta' }, metaLine(p)),
    ),
  );
  const side = h('div', { class: 'row-side' }, h('span', { class: 'row-price' }, priceTag(p)), dots(p));
  row.append(hit, side);
  const btns = h('div', { class: 'row-btns' });
  if (p.type === 'frame') {
    const tb = h('button', {
      class: 'locate',
      type: 'button',
      title: 'Try on',
      'aria-label': 'Try on ' + p.name,
      onclick: () => openTryOn(p.id, 0),
    });
    tb.append(ic('face'));
    btns.append(tb);
  }
  if (S.has3D && opts.locate !== false) {
    const lb = h('button', {
      class: 'locate',
      type: 'button',
      title: 'Show in store',
      'aria-label': 'Show ' + p.name + ' in the store',
      onclick: () => locate(p.id, 0),
    });
    lb.append(ic('locate'));
    btns.append(lb);
  }
  if (btns.children.length) row.append(btns);
  else row.classList.add('no-locate');
  return row;
}

/* ---------- View: product ---------- */
VIEWS.product = function (d) {
  const p = BM.byId[d.pid];
  if (d.ci == null) d.ci = 0;
  d.ci =
    ((d.ci % (p.colors ? p.colors.length : 1)) + (p.colors ? p.colors.length : 1)) % (p.colors ? p.colors.length : 1);
  d.cfg = d.cfg || BM.defaultCfg(p);
  d.qty = d.qty || 1;
  if (p.type === 'frame' && !sizeOf(p, d.size)) d.size = p.defaultSize;
  d.rx = d.rx || { r: {}, l: {}, pd: '' };
  const frame = p.type === 'frame';
  const body = h('div', { class: 'pd' });

  const viewer = h('div', { class: 'viewer' });
  const art = h('div', { class: 'viewer-art', html: BM.frameSVG(p, d.ci, 320, 130) });
  viewer.append(art);
  if (frame)
    viewer.append(h('span', { class: 'viewer-hint', id: 'viewer-hint' }, S.has3D ? 'Drag to turn' : 'Front view'));
  body.append(viewer);

  const zone = BM.zoneById(p.zone);
  const eyebrow = frame ? zone.short + (p.sun ? ' · Sunglasses' : ' · Optical frame') : zone.short;
  const head = h(
    'div',
    { class: 'pd-head' },
    h('p', { class: 'eyebrow' }, eyebrow),
    h(
      'div',
      { class: 'pd-title' },
      h('h3', null, p.name),
      h('span', { class: 'price' }, frame ? money(p.price) : priceTag(p)),
    ),
    frame
      ? h(
          'p',
          { class: 'pd-sub' },
          'Frame price includes zero-power anti-glare lenses' +
            (p.sun ? ' (here, the tinted UV400 lenses shown)' : '') +
            '.',
        )
      : null,
    p.tags.length
      ? h(
          'div',
          { class: 'tags' },
          p.tags.map((t) => h('span', { class: 'tag' }, t)),
        )
      : null,
  );
  body.append(head);

  // Colours
  if (frame) {
    const name = h('span', { class: 'swatch-name', id: 'swatch-name' }, BM.colorOf(p, d.ci).n);
    const group = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Colour' });
    p.colors.forEach((c, i) => {
      const b = h('button', {
        class: 'swatch',
        type: 'button',
        role: 'radio',
        'aria-checked': i === d.ci ? 'true' : 'false',
        'aria-label': c.n,
        title: c.n,
        id: 'sw-' + p.id + '-' + i,
        style: 'background:' + (c.sw2 ? 'linear-gradient(135deg,' + c.sw + ' 50%,' + c.sw2 + ' 50%)' : c.sw),
      });
      if (p.sun) b.append(h('span', { class: 'swatch-lens', style: 'background:' + c.l }));
      b.addEventListener('click', () => {
        d.ci = i;
        group.querySelectorAll('.swatch').forEach((s, k) => s.setAttribute('aria-checked', k === i ? 'true' : 'false'));
        name.textContent = c.n;
        art.innerHTML = BM.frameSVG(p, i, 320, 130);
        if (api()) api().setViewerColor(i);
      });
      group.append(b);
    });
    body.append(section('Colour', group, name));

    // Sizes: real variants, each with its own lens, bridge and temple
    const sizeGroup = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Frame size' });
    p.sizes.forEach((sz) => {
      const c = h(
        'button',
        {
          class: 'chip size-chip',
          type: 'button',
          role: 'radio',
          id: 'size-' + p.id + '-' + sz.id,
          'aria-checked': sz.id === d.size ? 'true' : 'false',
          'aria-label': 'Size ' + sz.id + ', ' + sizeMarking(sz),
        },
        h('b', null, sz.id),
        h('span', { class: 'mono' }, sizeMarking(sz)),
      );
      c.addEventListener('click', () => {
        d.size = sz.id;
        sizeGroup.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-checked', x === c ? 'true' : 'false'));
        onSize();
      });
      sizeGroup.append(c);
    });
    const tryLink = h(
      'button',
      { class: 'link-btn try-link', type: 'button', onclick: () => openTryOn(p.id, d.ci, d.size) },
      'Not sure? Try on to see the fit',
    );
    body.append(section('Size', sizeGroup, tryLink));
  }

  // Configurator
  const cfgBox = h('div', { class: 'cfg' });
  body.append(cfgBox);

  // Details
  let sizeText = null,
    codeText = null,
    guideBox = null;
  // Updates everything that depends on the chosen size: specs, size guide, 3D viewer and price.
  function onSize() {
    const sz = sizeOf(p, d.size);
    if (sizeText)
      sizeText.textContent =
        sizeMarking(sz) + ' (size ' + sz.id + ', about ' + Math.round(frontWidthMm(p, sz)) + ' mm wide)';
    if (codeText) codeText.textContent = 'BM-' + p.id.toUpperCase() + '-' + sz.lens;
    if (guideBox) guideBox.innerHTML = BM.sizeSVG(p, sz);
    if (api() && api().setViewerSize) api().setViewerSize(d.size);
    if (typeof refreshTotal === 'function') refreshTotal();
  }
  if (frame) {
    const a = BM.ARCH[p.arch];
    const hash = [...p.id].reduce((x, ch) => x + ch.charCodeAt(0), 0);
    sizeText = h('span', { class: 'mono' });
    codeText = h('span', { class: 'mono' });
    guideBox = h('div', { class: 'sizeguide' });
    const specs = h(
      'dl',
      { class: 'specs' },
      h('dt', null, 'Shape'),
      h('dd', null, BM.SHAPE_LABEL[a.shape]),
      h('dt', null, 'Material'),
      h('dd', null, p.mat),
      h('dt', null, 'Size'),
      h('dd', null, sizeText),
      h('dt', null, 'Weight'),
      h('dd', null, p.weight + ' g'),
      h('dt', null, 'Suits faces'),
      h('dd', null, BM.FACES[a.shape].join(', ')),
      h('dt', null, 'Rim'),
      h('dd', null, a.style === 'combo' ? 'Browline, full rim' : 'Full rim'),
      h('dt', null, 'Stock'),
      h('dd', null, hash % 4 === 0 ? 'Only 2 left in this colour' : 'In stock at this showroom'),
      h('dt', null, 'Code'),
      h('dd', null, codeText),
    );
    body.append(section('Details', h('p', { class: 'pd-desc' }, p.desc), specs));
    body.append(
      section(
        'Size guide',
        guideBox,
        h(
          'p',
          { class: 'field-note' },
          'The three numbers printed inside the temple: lens width, bridge and temple length, in millimetres. Compare them with a pair that fits you well.',
        ),
      ),
    );
  } else {
    body.append(
      section(
        'Details',
        h('p', { class: 'pd-desc' }, p.desc),
        h(
          'p',
          { class: 'field-note' },
          p.type === 'contacts'
            ? 'Choose your power at checkout. A valid contact lens prescription is needed.'
            : 'Suitable for all soft contact lenses.',
        ),
      ),
    );
  }

  // Secondary actions
  const acts = h('div', { class: 'pd-actions' });
  if (frame)
    acts.append(
      btn('Try on', { icon: 'face', id: 'try-on', primary: false, onclick: () => openTryOn(p.id, d.ci, d.size) }),
    );
  if (S.has3D) acts.append(btn('Show in store', { icon: 'locate', onclick: () => locate(p.id, d.ci) }));
  if (frame) acts.append(btn('Book a free eye test', { icon: 'eye', onclick: () => openSheet('eyetest', {}, true) }));
  body.append(acts);

  // Footer
  const totalEl = h('span', { class: 'price' });
  const noteEl = h('small', null);
  const addBtn = btn('Add to bag', { primary: true, icon: 'bag', id: 'add-to-bag' });
  const foot = h('div', { class: 'foot-row' }, h('div', { class: 'foot-total' }, totalEl, noteEl), addBtn);

  function refreshTotal() {
    const unit = BM.priceOf(p, d.cfg, d.size);
    totalEl.textContent = money(unit * (frame ? 1 : d.qty));
    noteEl.textContent = frame
      ? unit > p.price
        ? 'Frame ' + money(p.price) + ' + lenses ' + money(unit - p.price)
        : 'Frame and lenses'
      : d.qty > 1
        ? d.qty + ' × ' + money(unit)
        : p.packs[d.cfg.pack || 0].n;
  }
  function renderCfg() {
    cfgBox.replaceChildren();
    if (!frame) {
      cfgBox.append(
        radioGroup(
          'pk',
          p.type === 'contacts' ? 'Pack' : 'Size',
          p.packs.map((x, i) => ({ id: String(i), n: x.n, pl: money(x.p) })),
          String(d.cfg.pack || 0),
          (v) => {
            d.cfg.pack = +v;
            refreshTotal();
          },
        ),
      );
      const q = h('div', { class: 'qty', role: 'group', 'aria-label': 'Quantity' });
      const val = h('span', { 'aria-live': 'polite' }, String(d.qty));
      const minus = h(
        'button',
        {
          type: 'button',
          'aria-label': 'Fewer',
          onclick: () => {
            d.qty = Math.max(1, d.qty - 1);
            val.textContent = d.qty;
            refreshTotal();
          },
        },
        ic('minus'),
      );
      const plus = h(
        'button',
        {
          type: 'button',
          'aria-label': 'More',
          onclick: () => {
            d.qty = Math.min(12, d.qty + 1);
            val.textContent = d.qty;
            refreshTotal();
          },
        },
        ic('plus'),
      );
      q.append(minus, val, plus);
      cfgBox.append(section('Quantity', q));
      refreshTotal();
      return;
    }
    const rules = BM.lensRules(p);
    if (rules.mode === 'sun') {
      cfgBox.append(
        radioGroup(
          'sl',
          'Lenses',
          BM.LENS.sun.map((o) => ({
            id: o.id,
            n: o.n + (o.id === 'plano' && p.polar ? ', polarised' : ''),
            d: o.d,
            pl: o.p ? '+' + money(o.p) : 'Included',
          })),
          d.cfg.sunlens,
          (v) => {
            d.cfg.sunlens = v;
            renderCfg();
          },
        ),
      );
    } else {
      cfgBox.append(
        radioGroup(
          'lt',
          'Lens type',
          BM.LENS.types
            .filter((t) => rules.types.includes(t.id))
            .map((t) => ({ id: t.id, n: t.n, d: t.d, pl: t.p ? '+' + money(t.p) : 'Included' })),
          d.cfg.type,
          (v) => {
            d.cfg.type = v;
            if (v === 'zero') d.cfg.index = '156';
            renderCfg();
          },
        ),
      );
      cfgBox.append(
        radioGroup(
          'lx',
          'Lens thickness (index)',
          BM.LENS.index
            .filter((t) => rules.index.includes(t.id))
            .map((t) => ({
              id: t.id,
              n: t.n,
              d: t.d,
              pl: t.p ? '+' + money(t.p) : 'Included',
              disabled: d.cfg.type === 'zero' && t.id !== '156',
            })),
          d.cfg.index,
          (v) => {
            d.cfg.index = v;
            refreshTotal();
          },
        ),
      );
      cfgBox.append(
        checkGroup(
          'ct',
          'Coatings',
          BM.LENS.coats.map((t) => ({
            id: t.id,
            n: t.n,
            d: t.d,
            pl: t.p ? '+' + money(t.p) : 'Included',
            fixed: t.fixed,
          })),
          d.cfg.coats,
          (list) => {
            d.cfg.coats = list;
            refreshTotal();
          },
        ),
      );
    }
    if (BM.needsRx(p, d.cfg)) {
      cfgBox.append(
        radioGroup(
          'rx',
          'Prescription',
          BM.LENS.rx.map((o) => ({ id: o.id, n: o.n, d: o.d })),
          d.cfg.rx,
          (v) => {
            d.cfg.rx = v;
            renderCfg();
          },
        ),
      );
      if (d.cfg.rx === 'now') cfgBox.append(rxForm(d, BM.needsAdd(p, d.cfg)));
      if (d.cfg.rx === 'test')
        cfgBox.append(
          h(
            'p',
            { class: 'field-note' },
            'Add the frame to your bag, then pick a slot. The optometrist writes your prescription and we make the lenses.',
          ),
        );
    }
    refreshTotal();
  }
  renderCfg();
  if (frame) onSize();

  addBtn.addEventListener('click', () => {
    if (frame && BM.needsRx(p, d.cfg) && d.cfg.rx === 'now') {
      const errs = validateRx(d.rx, BM.needsAdd(p, d.cfg));
      const box = $('#rx-err');
      if (errs.length) {
        if (box) {
          box.textContent = errs[0];
          box.hidden = false;
          scrollSheetTo(box);
        }
        return;
      }
    }
    if (!addToBag(p, d)) return;
    addBtn.replaceChildren(ic('check'), h('span', null, 'Added'));
    setTimeout(() => {
      if (document.contains(addBtn)) addBtn.replaceChildren(ic('bag'), h('span', null, 'Add to bag'));
    }, 1600);
    if (frame && BM.needsRx(p, d.cfg) && d.cfg.rx === 'test') openSheet('eyetest', {}, true);
  });

  return {
    title: p.name,
    body,
    foot,
    mount() {
      if (frame && api()) {
        const ok = api().mountViewer(viewer, p.id, d.ci, d.size);
        if (ok) art.hidden = true;
      }
    },
    unmount() {
      if (api()) api().unmountViewer();
    },
  };
};

function radioGroup(name, legend, options, current, onChange) {
  const fs = h('fieldset', { class: 'section opts-group' }, h('legend', { class: 'sec-title' }, legend));
  const box = h('div', { class: 'opts' });
  for (const o of options) {
    const id = 'opt-' + name + '-' + o.id;
    const inp = h('input', { type: 'radio', name: 'opt-' + name, id, value: o.id });
    if (o.id === current) inp.checked = true;
    if (o.disabled) inp.disabled = true;
    inp.addEventListener('change', () => {
      if (inp.checked) onChange(o.id);
    });
    box.append(
      h(
        'label',
        { class: 'opt' + (o.disabled ? ' disabled' : ''), for: id },
        inp,
        h(
          'span',
          { class: 'opt-text' },
          h('span', { class: 'opt-name' }, o.n),
          o.d ? h('span', { class: 'opt-desc' }, o.d) : null,
        ),
        o.pl ? h('span', { class: 'opt-price' }, o.pl) : h('span'),
      ),
    );
  }
  fs.append(box);
  return fs;
}
function checkGroup(name, legend, options, current, onChange) {
  const fs = h('fieldset', { class: 'section opts-group' }, h('legend', { class: 'sec-title' }, legend));
  const box = h('div', { class: 'opts' });
  const sel = new Set(current || []);
  for (const o of options) {
    const id = 'opt-' + name + '-' + o.id;
    const inp = h('input', { type: 'checkbox', id, value: o.id });
    if (o.fixed) {
      inp.checked = true;
      inp.disabled = true;
    } else if (sel.has(o.id)) inp.checked = true;
    inp.addEventListener('change', () => {
      if (inp.checked) sel.add(o.id);
      else sel.delete(o.id);
      onChange([...sel]);
    });
    box.append(
      h(
        'label',
        { class: 'opt' + (o.fixed ? ' fixed' : ''), for: id },
        inp,
        h(
          'span',
          { class: 'opt-text' },
          h('span', { class: 'opt-name' }, o.n),
          o.d ? h('span', { class: 'opt-desc' }, o.d) : null,
        ),
        h('span', { class: 'opt-price' }, o.pl),
      ),
    );
  }
  fs.append(box);
  return fs;
}
function rxForm(d, needAdd) {
  const wrap = h('div', { class: 'rx' });
  const grid = h('div', {
    class: 'rx-grid' + (needAdd ? ' with-add' : ''),
    role: 'group',
    'aria-label': 'Prescription values',
  });
  const heads = ['Eye', 'SPH', 'CYL', 'AXIS'];
  if (needAdd) heads.push('ADD');
  heads.forEach((t) => grid.append(h('span', { class: 'rx-head' }, t)));
  const fields = [
    ['sph', '0.00', '-20', '12', '0.25'],
    ['cyl', '0.00', '-6', '0', '0.25'],
    ['axis', '–', '1', '180', '1'],
  ];
  if (needAdd) fields.push(['add', '+0.00', '0.75', '3.5', '0.25']);
  // Text inputs with the decimal keypad. iPhone's decimal keypad has no minus sign, so a ± button flips the sign of
  // the value being typed (SPH and CYL are often negative).
  let signTarget = null;
  for (const eye of ['r', 'l']) {
    grid.append(h('span', { class: 'rx-eye' }, eye === 'r' ? 'Right' : 'Left'));
    for (const f of fields) {
      const id = 'rx-' + eye + '-' + f[0];
      const inp = h('input', {
        type: 'text',
        id,
        inputmode: 'decimal',
        autocomplete: 'off',
        enterkeyhint: 'next',
        placeholder: f[1],
        'aria-label': (eye === 'r' ? 'Right' : 'Left') + ' eye ' + f[0].toUpperCase(),
      });
      inp.value = d.rx[eye][f[0]] != null ? d.rx[eye][f[0]] : '';
      inp.addEventListener('input', () => {
        d.rx[eye][f[0]] = inp.value;
        const e = $('#rx-err');
        if (e) e.hidden = true;
      });
      if (f[0] !== 'axis') inp.addEventListener('focus', () => (signTarget = inp));
      grid.append(inp);
    }
  }
  const sign = h(
    'button',
    {
      class: 'btn small rx-sign',
      type: 'button',
      'aria-label': 'Switch the value you are typing between plus and minus',
    },
    '± Plus / minus',
  );
  // Keep the keyboard open: do not take focus from the field.
  sign.addEventListener('pointerdown', (e) => e.preventDefault());
  sign.addEventListener('mousedown', (e) => e.preventDefault());
  sign.addEventListener('click', () => {
    const inp = signTarget;
    if (!inp) return;
    const v = inp.value.trim();
    inp.value = v.startsWith('-') ? v.slice(1) : v.startsWith('+') ? '-' + v.slice(1) : '-' + v;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.focus({ preventScroll: true });
  });
  const pd = h('input', {
    type: 'text',
    id: 'rx-pd',
    inputmode: 'decimal',
    autocomplete: 'off',
    enterkeyhint: 'done',
    placeholder: '63',
  });
  pd.value = d.rx.pd || '';
  pd.addEventListener('input', () => {
    d.rx.pd = pd.value;
    const e = $('#rx-err');
    if (e) e.hidden = true;
  });
  wrap.append(
    grid,
    h(
      'div',
      { class: 'rx-signrow' },
      sign,
      h('span', { class: 'field-note' }, 'No minus sign on your keypad? Tap ± while typing a value.'),
    ),
    h('label', { class: 'rx-pd', for: 'rx-pd' }, h('span', null, 'Pupillary distance (PD), mm'), pd),
    h('p', { class: 'field-error', id: 'rx-err', role: 'alert', hidden: true }),
    h(
      'p',
      { class: 'field-note' },
      'Values stay in this browser tab and are sent only with your order. They are never saved on this device. Leave CYL empty if your prescription has none.',
    ),
  );
  return wrap;
}
// Prescription rules live in shared/rules.js, so the form and the API check exactly the same limits.
function validateRx(rx, needAdd) {
  return rxProblems(rx, needAdd).map((e) => e.message);
}
BM.validateRx = validateRx;
// Returns false (and says why) when the line could not be added.
function addToBag(p, d) {
  const cfg = JSON.parse(JSON.stringify(d.cfg));
  if (p.type === 'frame' && !BM.needsRx(p, cfg)) delete cfg.rx;
  const size = p.type === 'frame' ? d.size || p.defaultSize : null;
  const unit = BM.priceOf(p, cfg, size),
    qty = p.type === 'frame' ? 1 : d.qty;
  const key = lineKey(p, d.ci, size, cfg);
  const ex = S.cart.find((l) => l.key === key);
  if (ex) ex.qty = Math.min(LIMITS.maxItemQty, ex.qty + qty);
  else if (S.cart.length >= LIMITS.maxLines) {
    toast('Your bag holds up to ' + LIMITS.maxLines + ' items. Check out or remove one first.', 4000);
    return false;
  } else S.cart.push({ key, pid: p.id, ci: d.ci, size, cfg, qty, unit });
  if (p.type === 'frame' && BM.needsRx(p, cfg) && cfg.rx === 'now') S.rx[key] = normalizeRx(d.rx, BM.needsAdd(p, cfg));
  saveCart();
  updateBadge();
  toast('Added ' + p.name + ' to your bag');
  return true;
}

/* ---------- Virtual try-on (loaded only when used) ---------- */
let tryOnModule = null;
async function openTryOn(pid, ci, sizeId) {
  const p = BM.byId[pid];
  if (!p || p.type !== 'frame') return;
  hideWelcome(false);
  pauseTour();
  if (api()) api().setPaused(true);
  const resume = () => {
    if (api()) api().setPaused(isBottomSheet() && sheet.classList.contains('open'));
  };
  try {
    tryOnModule = tryOnModule || (await import('../tryon/ui.js'));
  } catch (err) {
    console.warn('Try-on failed to load:', err && err.message);
    toast('Try-on couldn’t load. Check your connection and try again.', 4000);
    resume();
    return;
  }
  tryOnModule.openTryOn({
    pid,
    ci: ci || 0,
    sizeId: sizeId || p.defaultSize,
    settings: S.settings,
    saveSettings,
    onClose: resume,
    onAddToBag: (id, colour, size) => openSheet('product', { pid: id, ci: colour, size }),
  });
}
BM.openTryOn = openTryOn;

/* ---------- View: browse a section ---------- */
VIEWS.browse = function (d) {
  const z = BM.zoneById(d.zone);
  const items = BM.PRODUCTS.filter((p) => p.zone === d.zone);
  const body = h('div', { class: 'stack' });
  body.append(h('p', { class: 'lede' }, z.blurb));
  const shapes = [...new Set(items.filter((p) => p.type === 'frame').map((p) => BM.ARCH[p.arch].shape))];
  const list = h('div', { class: 'list' });
  let filter = d.filter || 'all';
  function draw() {
    list.replaceChildren(
      ...items
        .filter((p) => filter === 'all' || (p.type === 'frame' && BM.ARCH[p.arch].shape === filter))
        .map((p) => productRow(p)),
    );
  }
  if (shapes.length > 1) {
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by shape' });
    const mk = (id, label) => {
      const c = h(
        'button',
        {
          class: 'chip',
          type: 'button',
          'aria-pressed': filter === id ? 'true' : 'false',
          id: 'chip-' + d.zone + '-' + id,
        },
        label,
      );
      c.addEventListener('click', () => {
        filter = id;
        d.filter = id;
        chips.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', x === c ? 'true' : 'false'));
        draw();
      });
      return c;
    };
    chips.append(mk('all', 'All'), ...shapes.map((s) => mk(s, BM.SHAPE_LABEL[s])));
    body.append(chips);
  }
  draw();
  body.append(list);
  return { title: z.name, body };
};

/* ---------- View: search ---------- */
const QUICK = [
  ['round', 'Round', (p) => p.type === 'frame' && BM.ARCH[p.arch].shape === 'round'],
  ['cateye', 'Cat-eye', (p) => p.type === 'frame' && BM.ARCH[p.arch].shape === 'cateye'],
  ['titanium', 'Titanium', (p) => p.type === 'frame' && /titanium/i.test(p.mat)],
  ['polar', 'Polarised', (p) => !!p.polar],
  ['under', 'Under ₹2,500', (p) => p.type === 'frame' && p.price < 2500],
  ['kids', 'Kids', (p) => p.zone === 'kids'],
  ['contacts', 'Contact lenses', (p) => p.type === 'contacts'],
];
function haystack(p) {
  const parts = [p.name, p.desc, BM.zoneById(p.zone).name, (p.tags || []).join(' ')];
  if (p.type === 'frame')
    parts.push(
      BM.SHAPE_LABEL[BM.ARCH[p.arch].shape],
      p.mat,
      p.colors.map((c) => c.n).join(' '),
      p.sun ? 'sunglasses sun' : 'eyeglasses spectacles optical',
      p.polar ? 'polarised polarized' : '',
      p.size.join(' '),
    );
  else parts.push(p.type === 'care' ? 'care solution' : 'contact lenses contacts');
  return parts.join(' ').toLowerCase();
}
VIEWS.search = function (d) {
  const body = h('div', { class: 'stack' });
  const input = h('input', {
    type: 'search',
    id: 'search-q',
    placeholder: 'Name, shape, colour or material',
    autocomplete: 'off',
    'aria-label': 'Search the showroom',
  });
  input.value = d.q || '';
  const field = h('label', { class: 'search', for: 'search-q' }, ic('search'), input);
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Quick filters' });
  const count = h('p', { class: 'count', 'aria-live': 'polite' });
  const list = h('div', { class: 'list' });
  let quick = d.quick || null;
  QUICK.forEach(([id, label]) => {
    const c = h(
      'button',
      { class: 'chip', type: 'button', id: 'qf-' + id, 'aria-pressed': quick === id ? 'true' : 'false' },
      label,
    );
    c.addEventListener('click', () => {
      quick = quick === id ? null : id;
      d.quick = quick;
      chips
        .querySelectorAll('.chip')
        .forEach((x) => x.setAttribute('aria-pressed', x.id === 'qf-' + quick ? 'true' : 'false'));
      run();
    });
    chips.append(c);
  });
  function run() {
    const q = input.value.trim().toLowerCase();
    d.q = input.value;
    const words = q.split(/\s+/).filter(Boolean);
    const qf = QUICK.find((x) => x[0] === quick);
    const res = BM.PRODUCTS.filter((p) => (!qf || qf[2](p)) && words.every((w) => haystack(p).includes(w)));
    count.textContent = res.length
      ? res.length + (res.length === 1 ? ' match' : ' matches')
      : 'No matches. Try a shape like “round”, a colour like “havana”, or a material like “titanium”.';
    list.replaceChildren(...res.slice(0, 60).map((p) => productRow(p)));
  }
  input.addEventListener('input', run);
  run();
  body.append(field, chips, count, list);
  return {
    title: 'Find a frame',
    body,
    mount() {
      // Focus the search box with a mouse only: on touch screens it would pop the keyboard over the results.
      if (!isCoarse() && !isNarrow()) setTimeout(() => input.focus({ preventScroll: true }), 60);
    },
  };
};

/* ---------- View: directory ---------- */
let bigMap = null;
VIEWS.directory = function () {
  const body = h('div', { class: 'stack' });
  const cv = h('canvas', { id: 'bigmap-canvas', 'aria-label': 'Floor plan. Tap a section to go there.' });
  body.append(h('div', { class: 'bigmap' }, cv));
  body.append(
    h(
      'p',
      { class: 'field-note' },
      'The entrance is at the bottom of the plan. Tap a section on the plan or in the list to go there.',
    ),
  );
  if (S.has3D)
    body.append(
      btn('Take the guided tour', { primary: true, icon: 'play', cls: 'block', onclick: () => startTour(0) }),
    );
  const list = h('div', { class: 'zone-list' });
  BM.TOUR.forEach((id, i) => {
    const z = BM.zoneById(id),
      n = zoneCount(id);
    const b = h(
      'button',
      {
        class: 'zone-row' + (S.zone === id ? ' here' : ''),
        type: 'button',
        onclick: () => {
          if (S.has3D) {
            closeSheet();
            goZone(id);
          } else openSheet(zoneSheet(id), { zone: id }, true);
        },
      },
      h('span', { class: 'zr-num' }, String(i + 1).padStart(2, '0')),
      h(
        'span',
        { class: 'zr-text' },
        h('b', null, z.name),
        h(
          'span',
          null,
          S.zone === id
            ? 'You are here'
            : n
              ? n + (id === 'contacts' ? ' products' : ' styles')
              : z.blurb.split('.')[0],
        ),
      ),
      h('span', { class: 'go' }, S.has3D ? 'Go' : 'Open'),
    );
    list.append(b);
  });
  body.append(list);
  return {
    title: 'Store directory',
    body,
    mount() {
      bigMap = cv;
      drawBigMap();
      cv.addEventListener('click', (e) => {
        const r = cv.getBoundingClientRect();
        if (!bigMap || !bigMap._m) return;
        const w = bigMap._m.toWorld(e.clientX - r.left, e.clientY - r.top);
        const z = BM.zoneAt(w.x, w.z);
        if (S.has3D) {
          closeSheet();
          if (z) goZone(z.id);
          else api().goPoint(w.x, w.z);
        } else if (z) openSheet(zoneSheet(z.id), { zone: z.id }, true);
      });
    },
    unmount() {
      bigMap = null;
    },
  };
};
function drawBigMap() {
  if (!bigMap) return;
  const r = bigMap.getBoundingClientRect();
  if (!r.width) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  bigMap.width = Math.round(r.width * dpr);
  bigMap.height = Math.round(r.height * dpr);
  const g = bigMap.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const m = BM.drawPlan(g, r.width, r.height, { colors: MC, current: S.zone, labels: true, pad: 10 });
  if (S.has3D) drawYou(g, m, mm.pose, { colors: MC, cone: 30, dot: 5 });
  bigMap._m = m;
}

/* ---------- Server prices for the bag ---------- */
const lineName = (l) => (l && BM.byId[l.pid] ? BM.byId[l.pid].name : 'An item');
const needsRxNow = (l) => {
  const p = BM.byId[l.pid];
  return BM.needsRx(p, l.cfg) && l.cfg.rx === 'now';
};
let quoteTimer = null;
// Asks the API for prices. The bag shows the instant estimate until the answer arrives.
function requestQuote(delay) {
  clearTimeout(quoteTimer);
  S.quote.seq++;
  if (!ONLINE || !S.cart.length) {
    S.quote.status = ONLINE ? 'idle' : 'offline';
    S.quote.data = null;
    notifyQuote();
    return;
  }
  S.quote.status = 'loading';
  S.quote.data = null;
  notifyQuote();
  quoteTimer = setTimeout(runQuote, delay || 0);
}
async function runQuote() {
  const seq = ++S.quote.seq;
  const lines = S.cart.slice();
  try {
    const data = await quoteCart(lines);
    if (seq !== S.quote.seq) return;
    const notes = [];
    data.lines.forEach((q, i) => {
      const l = lines[i];
      if (l && l.unit !== q.unitPrice) {
        notes.push('The price of ' + q.name + ' is now ' + money(q.unitPrice) + '.');
        l.unit = q.unitPrice;
      }
    });
    S.quote.status = 'ok';
    S.quote.data = data;
    S.quote.notes = (S.quote.removed ? [S.quote.removed] : []).concat(notes);
  } catch (err) {
    if (seq !== S.quote.seq) return;
    const bad = new Set();
    if (err instanceof ApiError && err.status === 422 && err.fields)
      for (const k of Object.keys(err.fields)) {
        const m = /^lines\.(\d+)\./.exec(k);
        if (m) bad.add(+m[1]);
      }
    if (bad.size) {
      const names = [...bad].map((i) => lineName(lines[i]));
      S.cart = S.cart.filter((l) => !bad.has(lines.indexOf(l)));
      saveCart();
      updateBadge();
      S.quote.removed =
        names.join(', ') +
        (names.length === 1 ? ' is' : ' are') +
        ' no longer available as chosen, so we removed it from your bag.';
      S.quote.notes = [S.quote.removed];
      toast(S.quote.removed, 5000);
      requestQuote(0);
      return;
    }
    S.quote.status = 'error';
    S.quote.data = null;
  }
  notifyQuote();
}
function notifyQuote() {
  if (current && current.onQuote) current.onQuote();
}
// The price shown for a line: the server's when confirmed, otherwise the instant estimate.
function linePrice(l, i) {
  const q = S.quote.status === 'ok' && S.quote.data && S.quote.data.lines[i];
  return q ? q.lineTotal : l.unit * l.qty;
}
function cartTotal() {
  return S.quote.status === 'ok' && S.quote.data ? S.quote.data.total : S.cart.reduce((a, l) => a + l.unit * l.qty, 0);
}
function quoteNote() {
  const st = S.quote.status;
  const text =
    st === 'offline'
      ? 'Estimated prices. Checkout is not available in this preview.'
      : st === 'ok'
        ? 'Prices confirmed'
        : st === 'error'
          ? 'Prices are confirmed at checkout.'
          : 'Checking prices…';
  const p = h('p', { class: 'quote-note' + (st === 'ok' ? ' ok' : ''), role: 'status' });
  if (st === 'ok') p.append(ic('check'));
  p.append(h('span', null, text));
  return p;
}

// "Size M · 52□18-145" for frame lines, nothing for contacts and care.
const lineSize = (l) => {
  const sz = l.size && sizeOf(BM.byId[l.pid], l.size);
  return sz ? 'Size ' + sizeLabel(sz) : '';
};
const itemCount = (n) => n + (n === 1 ? ' item' : ' items');

/* ---------- Form helpers ---------- */
function formField(d, errs, k, label, attrs) {
  const id = 'f-' + k;
  const inp = h('input', Object.assign({ id, 'aria-describedby': id + '-err', enterkeyhint: 'next' }, attrs));
  inp.value = d.f[k] || '';
  const err = h('span', { class: 'field-error', id: id + '-err', 'aria-live': 'polite', hidden: true });
  inp.addEventListener('input', () => {
    d.f[k] = inp.value;
    err.hidden = true;
    inp.removeAttribute('aria-invalid');
  });
  errs[k] = { el: inp, err };
  return h('label', { class: 'field', for: id }, h('span', null, label), inp, err);
}
function consentRow(d, errs, text) {
  const id = 'f-consent';
  const inp = h('input', { type: 'checkbox', id, 'aria-describedby': id + '-err' });
  inp.checked = !!d.consent;
  const err = h('span', { class: 'field-error', id: id + '-err', hidden: true });
  inp.addEventListener('change', () => {
    d.consent = inp.checked;
    err.hidden = true;
    inp.removeAttribute('aria-invalid');
  });
  errs.consent = { el: inp, err };
  return h(
    'div',
    { class: 'consent' },
    h(
      'label',
      { class: 'opt', for: id },
      inp,
      h('span', { class: 'opt-text' }, h('span', { class: 'opt-name' }, text)),
      h('span'),
    ),
    err,
  );
}
// Shows per-field messages. Keys may be API paths such as `contact.mobile`. Returns true if anything was shown.
function showFieldErrors(errs, fields) {
  let first = null;
  for (const [path, message] of Object.entries(fields)) {
    const k = path.split('.').pop();
    const f = errs[k];
    if (!f) continue;
    f.err.textContent = MSG[k] || message;
    f.err.hidden = false;
    f.el.setAttribute('aria-invalid', 'true');
    if (!first) first = f.el;
  }
  if (first) {
    first.focus({ preventScroll: true });
    scrollSheetTo(first);
  }
  return !!first;
}
const prefixed = (obj, pre) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [pre + k, v]));
function busyBtn(b, busy, label) {
  b.disabled = busy;
  b.querySelector('span').textContent = label;
}

/* ---------- View: bag ---------- */
VIEWS.bag = function () {
  const body = h('div', { class: 'stack' });
  if (!S.cart.length) {
    body.append(
      h(
        'div',
        { class: 'empty' },
        h('p', { class: 'empty-title' }, 'Your bag is empty'),
        h('p', null, 'Tap any frame in the store, choose your lenses and add it here.'),
        h(
          'div',
          { class: 'empty-actions' },
          btn('Men’s frames', { onclick: () => openSheet('browse', { zone: 'men' }, true) }),
          btn('Women’s frames', { onclick: () => openSheet('browse', { zone: 'women' }, true) }),
          btn('Sunglasses', { onclick: () => openSheet('browse', { zone: 'sun' }, true) }),
        ),
      ),
    );
    return { title: 'Your bag', body };
  }
  const notes = h('div', { class: 'stack' });
  const list = h('div', { class: 'list' });
  const totals = h('div', { class: 'totals' });
  const status = h('div');
  function rxBlock(l, p) {
    if (!BM.needsRx(p, l.cfg) || l.cfg.rx !== 'now') return null;
    if (S.rx[l.key])
      return h(
        'p',
        { class: 'line-rx' },
        ic('check'),
        h('span', null, 'Prescription added'),
        h(
          'button',
          { class: 'link-btn', type: 'button', onclick: () => openSheet('rx', { key: l.key }, true) },
          'Edit',
        ),
      );
    return h(
      'div',
      { class: 'notice rx-needed' },
      h('b', null, 'Add your prescription'),
      h('span', null, 'Prescriptions are never saved on this device, so add it again or pick another option.'),
      h(
        'div',
        { class: 'card-actions' },
        btn('Enter it now', { cls: 'small', onclick: () => openSheet('rx', { key: l.key }, true) }),
        btn('Add it later', {
          cls: 'small',
          onclick: () => {
            l.cfg.rx = 'later';
            changed();
          },
        }),
        btn('Book an eye test', {
          cls: 'small',
          onclick: () => {
            l.cfg.rx = 'test';
            changed();
            openSheet('eyetest', {}, true);
          },
        }),
      ),
    );
  }
  function draw() {
    notes.replaceChildren(...S.quote.notes.map((n) => h('p', { class: 'notice' }, n)));
    list.replaceChildren(
      ...S.cart.map((l, idx) => {
        const p = BM.byId[l.pid];
        const frame = p.type === 'frame';
        const col = frame ? BM.colorOf(p, l.ci).n : '';
        const q = frame
          ? h('span', { class: 'line-qty' }, '1 pair')
          : h(
              'div',
              { class: 'qty', role: 'group', 'aria-label': 'Quantity for ' + p.name },
              h(
                'button',
                {
                  type: 'button',
                  'aria-label': 'Fewer',
                  onclick: () => {
                    if (l.qty > 1) {
                      l.qty--;
                      changed();
                    }
                  },
                },
                ic('minus'),
              ),
              h('span', null, String(l.qty)),
              h(
                'button',
                {
                  type: 'button',
                  'aria-label': 'More',
                  onclick: () => {
                    if (l.qty < LIMITS.maxItemQty) {
                      l.qty++;
                      changed();
                    }
                  },
                },
                ic('plus'),
              ),
            );
        const rm = h(
          'button',
          {
            class: 'link-btn',
            type: 'button',
            'aria-label': 'Remove ' + p.name,
            onclick: () => {
              S.cart.splice(idx, 1);
              changed();
            },
          },
          'Remove',
        );
        return h(
          'div',
          { class: 'line' },
          h('span', { class: 'thumb', html: BM.frameSVG(p, l.ci, 96, 40) }),
          h(
            'div',
            { class: 'line-main' },
            h(
              'div',
              { class: 'line-top' },
              h('b', null, p.name),
              h('span', { class: 'price sm' }, money(linePrice(l, idx))),
            ),
            h('p', { class: 'line-cfg' }, [col, lineSize(l), BM.cfgSummary(p, l.cfg)].filter(Boolean).join(' · ')),
            h('div', { class: 'line-acts' }, q, rm),
            rxBlock(l, p),
          ),
        );
      }),
    );
    const total = cartTotal();
    totals.replaceChildren(
      h('div', null, h('span', null, 'Subtotal'), h('span', null, money(total))),
      h('div', null, h('span', null, 'Delivery'), h('span', null, 'Free')),
      h('div', { class: 'grand' }, h('span', null, 'Total'), h('span', null, money(total))),
    );
    status.replaceChildren(quoteNote());
  }
  function changed() {
    S.quote.notes = [];
    S.quote.removed = null;
    saveCart();
    updateBadge();
    if (!S.cart.length) {
      requestQuote(0);
      renderSheet();
      return;
    }
    requestQuote(350);
    draw();
  }
  draw();
  body.append(
    notes,
    list,
    totals,
    status,
    h(
      'p',
      { class: 'field-note' },
      'Prices include GST. Every order comes with a free fitting and a 7-day exchange on frames.',
    ),
  );
  const foot = h(
    'div',
    { class: 'foot-row' },
    btn('Continue shopping', { onclick: closeSheet }),
    btn('Checkout', { primary: true, icon: 'arrow', onclick: () => openSheet('checkout', {}, true) }),
  );
  return {
    title: 'Your bag',
    body,
    foot,
    mount() {
      requestQuote(0);
    },
    onQuote() {
      if (!S.cart.length) renderSheet();
      else draw();
    },
  };
};

/* ---------- View: prescription for a bag line ---------- */
const rxToForm = (rx) => {
  const s = (v) => (v == null ? '' : String(v));
  const eye = (e) => ({ sph: s(e.sph), cyl: e.cyl ? s(e.cyl) : '', axis: s(e.axis), add: s(e.add) });
  return rx ? { r: eye(rx.r), l: eye(rx.l), pd: s(rx.pd) } : { r: {}, l: {}, pd: '' };
};
VIEWS.rx = function (d) {
  const l = S.cart.find((x) => x.key === d.key);
  const body = h('div', { class: 'stack' });
  if (!l) {
    body.append(h('p', { class: 'lede' }, 'This item is no longer in your bag.'));
    return { title: 'Prescription', body };
  }
  const p = BM.byId[l.pid];
  const needAdd = BM.needsAdd(p, l.cfg);
  d.rx = d.rx || rxToForm(S.rx[l.key]);
  body.append(
    h(
      'p',
      { class: 'lede' },
      'Type the values from your prescription for ' +
        p.name +
        ' (' +
        BM.cfgSummary(p, { ...l.cfg, rx: 'later' }).split(' · ')[0] +
        ').',
    ),
    rxForm(d, needAdd),
  );
  const save = btn('Save prescription', {
    primary: true,
    icon: 'check',
    onclick: () => {
      const errs = validateRx(d.rx, needAdd);
      const box = $('#rx-err');
      if (errs.length) {
        if (box) {
          box.textContent = errs[0];
          box.hidden = false;
          scrollSheetTo(box);
        }
        return;
      }
      S.rx[l.key] = normalizeRx(d.rx, needAdd);
      l.cfg.rx = 'now';
      saveCart();
      toast('Prescription saved for ' + p.name);
      backSheet();
    },
  });
  return {
    title: 'Prescription',
    body,
    foot: h('div', { class: 'foot-row' }, btn('Cancel', { onclick: backSheet }), save),
  };
};

/* ---------- View: checkout (demo) ---------- */
VIEWS.checkout = function (d) {
  d.delivery = d.delivery || 'home';
  d.f = d.f || { name: '', mobile: '', email: '', line1: '', city: '', pin: '' };
  // One key per checkout attempt: a retried submit after a network error gets the same order reference.
  d.idem = d.idem || newIdempotencyKey();
  const errs = {};
  const body = h('div', { class: 'stack' });
  const missingRx = S.cart.filter((l) => needsRxNow(l) && !S.rx[l.key]);
  if (!ONLINE)
    body.append(
      h(
        'div',
        { class: 'notice' },
        h('b', null, 'Checkout is not available in this preview'),
        h('span', null, 'This copy of the showroom runs without its server, so orders cannot be placed.'),
      ),
    );
  if (missingRx.length)
    body.append(
      h(
        'div',
        { class: 'notice rx-needed' },
        h('b', null, 'Add your prescription first'),
        h(
          'span',
          null,
          missingRx.map(lineName).join(', ') + ' needs a prescription. Enter it, add it later, or book an eye test.',
        ),
        h('div', { class: 'card-actions' }, btn('Back to your bag', { cls: 'small', onclick: backSheet })),
      ),
    );

  const addr = section(
    'Delivery address',
    h(
      'div',
      { class: 'fields' },
      formField(d, errs, 'line1', 'House and street', {
        type: 'text',
        autocomplete: 'address-line1',
        maxlength: '120',
      }),
      formField(d, errs, 'city', 'Town or city', { type: 'text', autocomplete: 'address-level2', maxlength: '60' }),
      formField(d, errs, 'pin', 'PIN code', {
        type: 'text',
        enterkeyhint: 'done',
        autocomplete: 'postal-code',
        inputmode: 'numeric',
        maxlength: '6',
      }),
    ),
  );
  addr.hidden = d.delivery !== 'home';
  body.append(
    radioGroup(
      'dl',
      'Delivery',
      [
        { id: 'home', n: 'Home delivery', d: 'Frames with lenses arrive in 3 to 5 days.', pl: 'Free' },
        { id: 'store', n: 'Pick up at the showroom', d: 'Ready in 2 days. Includes a fitting.', pl: 'Free' },
      ],
      d.delivery,
      (v) => {
        d.delivery = v;
        addr.hidden = v !== 'home';
      },
    ),
    section(
      'Contact',
      h(
        'div',
        { class: 'fields' },
        formField(d, errs, 'name', 'Name', { type: 'text', autocomplete: 'name', maxlength: '60' }),
        formField(d, errs, 'mobile', 'Mobile', {
          type: 'tel',
          autocomplete: 'tel-national',
          inputmode: 'tel',
          maxlength: '16',
          placeholder: '98765 43210',
        }),
        formField(d, errs, 'email', 'Email (optional)', { type: 'email', autocomplete: 'email', maxlength: '254' }),
      ),
    ),
    addr,
  );

  const sum = h('div', { class: 'totals' });
  const status = h('div');
  const totalEl = h('span', { class: 'price' });
  function drawSummary() {
    sum.replaceChildren(
      ...S.cart.map((l, i) =>
        h(
          'div',
          null,
          h('span', null, lineName(l) + (l.size ? ' (' + l.size + ')' : '') + (l.qty > 1 ? ' × ' + l.qty : '')),
          h('span', null, money(linePrice(l, i))),
        ),
      ),
      h('div', { class: 'grand' }, h('span', null, 'To pay'), h('span', null, money(cartTotal()))),
    );
    status.replaceChildren(quoteNote());
    totalEl.textContent = money(cartTotal());
  }
  drawSummary();
  const formErr = h('p', { class: 'field-error', role: 'alert', hidden: true });
  body.append(
    section('Order summary', sum, status),
    consentRow(d, errs, 'I agree that ' + BM.STORE.name + ' may use these details to process this order.'),
    h(
      'div',
      { class: 'notice' },
      h('b', null, 'Demo checkout'),
      h(
        'span',
        null,
        'No payment is taken and nothing is shipped. The order is checked by the server and you get a demo reference. In the live store, the payment gateway (for example Razorpay) opens at this step.',
      ),
    ),
    formErr,
  );

  const placeBtn = btn('Place demo order', { primary: true, icon: 'check', id: 'place-order' });
  placeBtn.disabled = !ONLINE || missingRx.length > 0;
  async function place() {
    formErr.hidden = true;
    for (const f of Object.values(errs)) {
      f.err.hidden = true;
      f.el.removeAttribute('aria-invalid');
    }
    const contact = { name: d.f.name.trim(), mobile: normalizeMobile(d.f.mobile) };
    if (d.f.email.trim()) contact.email = d.f.email.trim();
    const delivery =
      d.delivery === 'home'
        ? { method: 'home', line1: d.f.line1.trim(), city: d.f.city.trim(), pin: d.f.pin.trim() }
        : { method: 'store' };
    const sc = await schemasOr((m) => {
      formErr.textContent = m;
      formErr.hidden = false;
    });
    if (!sc) return;
    const { ContactSchema, DeliverySchema, fieldErrors } = sc;
    const fe = {};
    const c = ContactSchema.safeParse(contact);
    if (!c.success) Object.assign(fe, prefixed(fieldErrors(c.error), 'contact.'));
    const dv = DeliverySchema.safeParse(delivery);
    if (!dv.success) Object.assign(fe, prefixed(fieldErrors(dv.error), 'delivery.'));
    if (!d.consent) fe.consent = MSG.consent;
    if (showFieldErrors(errs, fe)) return;
    const lines = S.cart.map((l) => {
      const o = { productId: l.pid, colourIndex: l.ci, config: l.cfg, qty: l.qty };
      if (l.size) o.sizeId = l.size;
      if (needsRxNow(l)) o.prescription = S.rx[l.key];
      return o;
    });
    busyBtn(placeBtn, true, 'Placing order…');
    try {
      const res = await placeOrder({ lines, contact, delivery, consent: true }, d.idem);
      const n = S.cart.reduce((a, l) => a + l.qty, 0);
      S.cart = [];
      S.rx = {};
      saveCart();
      updateBadge();
      requestQuote(0);
      openSheet('done', { ref: res.orderRef, n, total: res.total, delivery: d.delivery });
    } catch (err) {
      busyBtn(placeBtn, false, 'Place demo order');
      if (err instanceof ApiError && err.status === 422 && err.fields) {
        if (showFieldErrors(errs, err.fields)) return;
        if (Object.keys(err.fields).some((k) => k.startsWith('lines.'))) {
          formErr.textContent = 'Some items in your bag changed. Go back to your bag to check them.';
          formErr.hidden = false;
          scrollSheetTo(formErr);
          requestQuote(0);
          return;
        }
      }
      formErr.textContent = err.message || 'The order could not be placed. Try again.';
      formErr.hidden = false;
      scrollSheetTo(formErr);
    }
  }
  placeBtn.addEventListener('click', place);
  const foot = h(
    'div',
    { class: 'foot-row' },
    h('div', { class: 'foot-total' }, totalEl, h('small', null, itemCount(S.cart.reduce((a, l) => a + l.qty, 0)))),
    placeBtn,
  );
  return {
    title: 'Checkout',
    body,
    foot,
    mount() {
      loadSchemas().catch(() => {});
      if (S.quote.status !== 'ok') requestQuote(0);
    },
    onQuote: drawSummary,
  };
};
VIEWS.done = function (d) {
  const body = h(
    'div',
    { class: 'stack done' },
    h('span', { class: 'done-mark' }, ic('check')),
    h('p', { class: 'eyebrow' }, 'Demo order ' + d.ref),
    h('h3', { class: 'done-title' }, 'Order placed in demo mode'),
    h(
      'p',
      null,
      d.n +
        (d.n === 1 ? ' item' : ' items') +
        ', ' +
        money(d.total) +
        ', ' +
        (d.delivery === 'store' ? 'for pickup at the showroom.' : 'for home delivery.') +
        ' Nothing was charged.',
    ),
    h(
      'p',
      { class: 'field-note' },
      'In the live store this step confirms payment, sends an order update on WhatsApp and passes the order to the showroom team.',
    ),
    btn('Back to the showroom', { primary: true, cls: 'block', onclick: closeSheet }),
  );
  return { title: 'Thank you', body };
};

/* ---------- View: eye test booking (demo) ---------- */
const istDay = (date, opts) =>
  new Date(date + 'T12:00:00+05:30').toLocaleDateString('en-IN', Object.assign({ timeZone: TIMEZONE }, opts));
VIEWS.eyetest = function (d) {
  const body = h('div', { class: 'stack' });
  body.append(
    h(
      'p',
      { class: 'lede' },
      'A 20-minute test with an optometrist: vision on the Snellen chart, refraction, and a check of your current glasses. Free, with no obligation to buy.',
    ),
  );
  if (!ONLINE) {
    body.append(
      h(
        'div',
        { class: 'notice' },
        h('b', null, 'Online booking is not available in this preview'),
        h('span', null, 'Visit the showroom to book a free eye test. ' + BM.STORE.hours + '.'),
      ),
    );
    return { title: 'Book a free eye test', body };
  }
  d.f = d.f || { name: '', mobile: '' };
  const box = h('div', { class: 'stack' });
  body.append(box);
  let alive = false;
  let slots = null;
  async function load() {
    box.replaceChildren(
      h(
        'p',
        { class: 'status', role: 'status' },
        h('span', { class: 'spinner', 'aria-hidden': 'true' }),
        h('span', null, 'Loading free slots…'),
      ),
    );
    try {
      slots = await getSlots(7);
      if (alive) render();
    } catch (err) {
      if (!alive) return;
      box.replaceChildren(
        h('div', { class: 'notice' }, h('b', null, 'Slots could not load'), h('span', null, err.message)),
        btn('Try again', { onclick: load }),
      );
    }
  }
  function render() {
    const days = slots.days;
    if (!days.length) {
      box.replaceChildren(
        h(
          'div',
          { class: 'notice' },
          h('b', null, 'No free slots this week'),
          h('span', null, 'Visit the showroom or try again tomorrow. ' + BM.STORE.hours + '.'),
        ),
      );
      return;
    }
    d.day = Math.min(d.day || 0, days.length - 1);
    const pickSlot = () => {
      const list = days[d.day].slots;
      if (!list.some((s) => s.start === d.slot)) d.slot = (list.find((s) => s.time === '12:00') || list[0]).start;
    };
    pickSlot();
    const errs = {};
    const msg = h('p', { class: 'notice ok', role: 'status', hidden: true });
    const slotChips = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Time' });
    const drawSlots = () => {
      slotChips.replaceChildren(
        ...days[d.day].slots.map((s) => {
          const c = h(
            'button',
            {
              class: 'chip',
              type: 'button',
              role: 'radio',
              id: 'et-slot-' + s.time.replace(':', ''),
              'aria-checked': s.start === d.slot ? 'true' : 'false',
            },
            s.time,
          );
          c.addEventListener('click', () => {
            d.slot = s.start;
            slotChips
              .querySelectorAll('.chip')
              .forEach((x) => x.setAttribute('aria-checked', x === c ? 'true' : 'false'));
            msg.hidden = true;
          });
          return c;
        }),
      );
    };
    const dayChips = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Day' });
    days.forEach((day, i) => {
      const c = h(
        'button',
        {
          class: 'chip',
          type: 'button',
          role: 'radio',
          id: 'et-day-' + i,
          'aria-checked': i === d.day ? 'true' : 'false',
        },
        istDay(day.date, { weekday: 'short', day: 'numeric', month: 'short' }),
      );
      c.addEventListener('click', () => {
        d.day = i;
        pickSlot();
        dayChips
          .querySelectorAll('.chip')
          .forEach((x, k) => x.setAttribute('aria-checked', k === i ? 'true' : 'false'));
        drawSlots();
        msg.hidden = true;
      });
      dayChips.append(c);
    });
    drawSlots();
    const submit = btn('Request this slot', { primary: true, cls: 'block', id: 'et-submit' });
    submit.type = 'submit';
    const form = h(
      'form',
      { class: 'stack', novalidate: true },
      section('Day', dayChips),
      section('Time', slotChips),
      h(
        'div',
        { class: 'fields' },
        formField(d, errs, 'name', 'Name', {
          type: 'text',
          autocomplete: 'name',
          maxlength: '60',
          placeholder: 'Your name',
        }),
        formField(d, errs, 'mobile', 'Mobile', {
          type: 'tel',
          enterkeyhint: 'done',
          autocomplete: 'tel-national',
          inputmode: 'tel',
          maxlength: '16',
          placeholder: 'Mobile number',
        }),
      ),
      consentRow(d, errs, 'I agree that ' + BM.STORE.name + ' may use these details to book my eye test.'),
      submit,
      msg,
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submit.disabled) return;
      msg.hidden = true;
      for (const f of Object.values(errs)) {
        f.err.hidden = true;
        f.el.removeAttribute('aria-invalid');
      }
      const booking = { slotStart: d.slot, name: d.f.name.trim(), mobile: normalizeMobile(d.f.mobile), consent: true };
      const sc = await schemasOr((m) => {
        msg.className = 'notice';
        msg.textContent = m;
        msg.hidden = false;
      });
      if (!sc) return;
      const { BookingSchema, fieldErrors } = sc;
      const fe = {};
      const r = BookingSchema.safeParse(booking);
      if (!r.success) Object.assign(fe, fieldErrors(r.error));
      if (!d.consent) fe.consent = MSG.consent;
      if (showFieldErrors(errs, fe)) return;
      busyBtn(submit, true, 'Requesting…');
      try {
        const res = await bookEyeTest(booking);
        msg.className = 'notice ok';
        msg.textContent =
          'Slot noted for ' +
          istDay(d.slot.slice(0, 10), { weekday: 'long', day: 'numeric', month: 'long' }) +
          ' at ' +
          d.slot.slice(11, 16) +
          '. Reference ' +
          res.bookingRef +
          '. This is a demo, so no booking was made.';
      } catch (err) {
        msg.className = 'notice';
        if (err instanceof ApiError && err.fields && err.fields.slotStart) {
          d.flash = 'That time is no longer free. Pick another slot.';
          slots = await getSlots(7).catch(() => slots);
          if (alive) render();
          return;
        }
        if (err instanceof ApiError && err.fields && showFieldErrors(errs, err.fields)) {
          busyBtn(submit, false, 'Request this slot');
          return;
        }
        msg.textContent = err.message || 'The slot could not be requested. Try again.';
      }
      busyBtn(submit, false, 'Request this slot');
      msg.hidden = false;
    });
    box.replaceChildren(form);
    if (d.flash) {
      msg.className = 'notice';
      msg.textContent = d.flash;
      msg.hidden = false;
      d.flash = null;
    }
  }
  return {
    title: 'Book a free eye test',
    body,
    mount() {
      alive = true;
      loadSchemas().catch(() => {});
      load();
    },
    unmount() {
      alive = false;
    },
  };
};

/* ---------- View: lens guide ---------- */
VIEWS.lensguide = function () {
  const body = h('div', { class: 'stack' });
  body.append(
    h('p', { class: 'lede' }, 'What the Lens Bar explains, in one place. Prices are added to the frame price.'),
  );
  const types = h(
    'div',
    { class: 'guide' },
    BM.LENS.types.map((t) =>
      h(
        'div',
        { class: 'guide-row' },
        h('b', null, t.n),
        h('span', null, t.d),
        h('span', { class: 'opt-price' }, t.p ? '+' + money(t.p) : 'Included'),
      ),
    ),
  );
  body.append(section('Lens types', types));
  const coats = h(
    'div',
    { class: 'guide' },
    BM.LENS.coats.map((t) =>
      h(
        'div',
        { class: 'guide-row' },
        h('b', null, t.n),
        h('span', null, t.d),
        h('span', { class: 'opt-price' }, t.p ? '+' + money(t.p) : 'Included'),
      ),
    ),
  );
  body.append(section('Coatings', coats));
  const bars = h('div', { class: 'bars' });
  BM.LENS.index.forEach((t) => {
    const n = parseFloat(t.n);
    const rel = (1.56 - 1) / (n - 1);
    bars.append(
      h(
        'div',
        { class: 'bar-row' },
        h('span', { class: 'mono' }, n.toFixed(2)),
        h('span', { class: 'bar' }, h('span', { style: 'width:' + (rel * 100).toFixed(1) + '%' })),
        h('span', { class: 'bar-val' }, Math.round(rel * 100) + '%'),
      ),
    );
  });
  body.append(
    section(
      'Index and thickness',
      bars,
      h(
        'p',
        { class: 'field-note' },
        'Relative edge thickness for the same prescription, estimated from (n − 1). Higher-index lenses bend light more, so they can be thinner.',
      ),
    ),
  );
  return { title: 'Lens guide', body };
};

/* ---------- View: store details and settings ---------- */
VIEWS.info = function () {
  const st = BM.STORE;
  const body = h('div', { class: 'stack' });
  body.append(
    section(
      st.name,
      h('p', { class: 'lede' }, st.tagline + '. ' + st.hours + '.'),
      h(
        'ul',
        { class: 'ticks' },
        st.services.map((s) => h('li', null, ic('check'), h('span', null, s))),
      ),
      h('p', { class: 'field-note' }, st.address),
    ),
  );
  body.append(
    section(
      'Moving around',
      h(
        'ul',
        { class: 'keys' },
        h(
          'li',
          null,
          h('b', null, 'Tap the floor'),
          h('span', null, 'Walk to that spot. The route goes around fixtures.'),
        ),
        h('li', null, h('b', null, 'Drag'), h('span', null, 'Look around. Pinch or scroll to zoom in on a shelf.')),
        h('li', null, h('b', null, 'Section labels'), h('span', null, 'Tap a floating label to walk to that section.')),
        h(
          'li',
          null,
          h('b', null, 'Keyboard'),
          h('span', null, 'W A S D or the arrow keys to walk and turn. Esc closes this panel.'),
        ),
      ),
    ),
  );
  const move = radioGroup(
    'mv',
    'Movement',
    [
      { id: 'walk', n: 'Walk', d: 'Glide along the route.' },
      { id: 'jump', n: 'Jump', d: 'Fade straight to the spot. Easier if motion bothers you.' },
    ],
    S.settings.move,
    (v) => {
      S.settings.move = v;
      saveSettings();
    },
  );
  const qual = radioGroup(
    'ql',
    'Picture quality',
    [
      { id: 'auto', n: 'Automatic', d: 'Chosen for this device, and lowered if movement gets slow.' },
      { id: 'high', n: 'High', d: 'Sharpest, with soft shadows on computers. Uses more battery.' },
      { id: 'medium', n: 'Balanced', d: 'Sharp enough, no shadows, simpler distant frames.' },
      { id: 'low', n: 'Battery saver', d: 'Lower resolution, smaller textures, simplest frames.' },
    ],
    S.settings.quality,
    (v) => {
      S.settings.quality = v;
      saveSettings();
      if (api()) api().setQuality(v);
    },
  );
  const lab = h('input', { type: 'checkbox', id: 'set-labels' });
  lab.checked = !!S.settings.labels;
  lab.addEventListener('change', () => {
    S.settings.labels = lab.checked;
    saveSettings();
    if (api()) api().setLabels(lab.checked);
  });
  const labRow = h(
    'label',
    { class: 'opt', for: 'set-labels' },
    lab,
    h(
      'span',
      { class: 'opt-text' },
      h('span', { class: 'opt-name' }, 'Show section labels'),
      h('span', { class: 'opt-desc' }, 'Floating names you can tap to walk there.'),
    ),
    h('span'),
  );
  body.append(move, qual, section('Labels', h('div', { class: 'opts' }, labRow)));
  body.append(
    h(
      'p',
      { class: 'field-note' },
      'This is a prototype with sample stock and prices. Frames are drawn from their real millimetre sizes; replace the catalogue and branding with the client’s own.',
    ),
  );
  return { title: 'Store details', body };
};

/* =====================================================================
   MINIMAP
   ===================================================================== */
function cssVar(n) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
}
function mapColors() {
  return {
    floor: cssVar('--map-floor'),
    wall: cssVar('--map-wall'),
    item: cssVar('--map-item'),
    zone: cssVar('--map-zone'),
    zoneOn: cssVar('--map-zone-on'),
    you: cssVar('--map-you'),
    text: cssVar('--map-text'),
  };
}
let MC = mapColors();
const mm = { cv: $('#minimap-canvas'), pose: { x: 0, z: 7.25, yaw: 0, hfov: 1.4, path: null }, m: null };
function drawMinimap() {
  const cv = mm.cv,
    r = cv.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.round(r.width * dpr),
    Hh = Math.round(r.height * dpr);
  if (cv.width !== W || cv.height !== Hh) {
    cv.width = W;
    cv.height = Hh;
  }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, r.width, r.height);
  mm.m = BM.drawPlan(g, r.width, r.height, { colors: MC, current: S.zone, pad: 3 });
  drawYou(g, mm.m, mm.pose, { colors: MC, cone: r.width < 150 ? 16 : 24, dot: r.width < 150 ? 3.5 : 4.5 });
}
let mmQueued = false;
BM.onPose = (pose) => {
  mm.pose = pose;
  if (mmQueued) return;
  mmQueued = true;
  requestAnimationFrame(() => {
    mmQueued = false;
    drawMinimap();
    if (bigMap) drawBigMap();
  });
};
mm.cv.addEventListener('click', (e) => {
  if (isNarrow() || !S.has3D || !mm.m) {
    openSheet('directory');
    return;
  }
  const r = mm.cv.getBoundingClientRect();
  const w = mm.m.toWorld(e.clientX - r.left, e.clientY - r.top);
  if (w.x < BM.L.x0 || w.x > BM.L.x1 || w.z < BM.L.z0 || w.z > BM.L.z1) return;
  pauseTour();
  hideWelcome(false);
  api().goPoint(w.x, w.z);
});
$('#minimap-open').addEventListener('click', () => openSheet('directory'));
const themeObs = new MutationObserver(() => {
  MC = mapColors();
  drawMinimap();
  if (S.failed) drawFallback();
});
themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
if (window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onScheme = () => {
    MC = mapColors();
    drawMinimap();
    if (S.failed) drawFallback();
  };
  if (mq.addEventListener) mq.addEventListener('change', onScheme);
  else if (mq.addListener) mq.addListener(onScheme);
}

/* =====================================================================
   FALLBACK (no WebGL): the floor plan becomes the main view
   ===================================================================== */
let fbMap = null;
function drawFallback() {
  const cv = $('#plan-fallback'),
    r = cv.getBoundingClientRect();
  if (!r.width) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr);
  cv.height = Math.round(r.height * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = cssVar('--bg');
  g.fillRect(0, 0, r.width, r.height);
  const top = isNarrow() ? 140 : 96,
    bottom = isNarrow() ? 90 : 40;
  g.save();
  g.translate(0, top);
  const m = BM.drawPlan(g, r.width, Math.max(160, r.height - top - bottom), {
    colors: MC,
    current: null,
    labels: true,
    pad: 20,
  });
  g.restore();
  fbMap = { m, top };
}
$('#plan-fallback').addEventListener('click', (e) => {
  if (!fbMap) return;
  const r = e.currentTarget.getBoundingClientRect();
  const w = fbMap.m.toWorld(e.clientX - r.left, e.clientY - r.top - fbMap.top);
  const z = BM.zoneAt(w.x, w.z);
  if (z) openSheet(zoneSheet(z.id), { zone: z.id });
});
// Build progress from the 3D scene, shown on the welcome card until the store is ready.
BM.loadStatus = (text) => {
  if (S.has3D || S.failed) return;
  const t = $('#status-text');
  if (t) t.textContent = text;
};
// Graphics context loss: tell the visitor, recover without a reload, or offer a reload and the floor plan.
BM.onGraphics = (state) => {
  const box = $('#restore');
  if (state === 'restored') {
    box.hidden = true;
    return;
  }
  if (state === 'lost') {
    box.replaceChildren(
      h(
        'p',
        { class: 'status' },
        h('span', { class: 'spinner', 'aria-hidden': 'true' }),
        h('span', null, 'Restoring the 3D view…'),
      ),
    );
    box.hidden = false;
    return;
  }
  box.replaceChildren(
    h('p', null, h('b', null, 'The 3D view could not be restored.')),
    h(
      'div',
      { class: 'card-actions' },
      btn('Reload', { primary: true, onclick: () => location.reload() }),
      btn('Use the floor plan', {
        onclick: () => {
          box.hidden = true;
          BM.fail3D(new Error('graphics context lost'), true);
        },
      }),
    ),
  );
  box.hidden = false;
};
BM.fail3D = function (err, force) {
  if (force && S.has3D) {
    S.has3D = false;
    app.classList.remove('has3d');
  }
  if (S.has3D || S.failed) return;
  S.failed = true;
  if (err) console.warn('3D view unavailable:', err);
  $('#scene').hidden = true;
  $('#plan-fallback').hidden = false;
  $('#minimap').hidden = true;
  setStatus('fallback');
  $('#w-tour').hidden = true;
  $('#btn-tour').hidden = true;
  $('#bb-tour').hidden = true;
  $('#w-explore').querySelector('span').textContent = 'Browse the sections';
  drawFallback();
};
const failTimer = setTimeout(() => {
  if (!S.has3D) BM.fail3D(new Error('3D view did not load in time'));
}, 25000);

BM.attach3D = function (a) {
  clearTimeout(failTimer);
  BM.api = a;
  S.has3D = true;
  if (S.failed) {
    S.failed = false;
    $('#scene').hidden = false;
    $('#plan-fallback').hidden = true;
    $('#minimap').hidden = false;
    $('#w-tour').hidden = false;
    $('#btn-tour').hidden = false;
    $('#bb-tour').hidden = false;
    const st = $('#status');
    st.classList.remove('warn');
    $('#w-explore').querySelector('span').textContent = 'Explore on my own';
  }
  setStatus('ready');
  app.classList.add('has3d');
  a.setLabels(S.settings.labels);
  drawMinimap();
  if (S.pendingTour) {
    S.pendingTour = false;
    startTour(0);
  }
};

/* =====================================================================
   WIRING
   ===================================================================== */
function onResize() {
  drawMinimap();
  if (bigMap) drawBigMap();
  if (S.failed) drawFallback();
}
window.addEventListener('resize', onResize);

$('#w-tour').addEventListener('click', () => startTour(0));
$('#w-explore').addEventListener('click', () => {
  hideWelcome(true);
  if (S.failed) openSheet('directory');
  else showZoneCard(S.zone);
});
$('#zone-pill').addEventListener('click', () => openSheet('directory'));
$('#brand-btn').addEventListener('click', () => openSheet('info'));
$('#btn-tour').addEventListener('click', tourButton);
$('#btn-dir').addEventListener('click', () => openSheet('directory'));
$('#btn-search').addEventListener('click', () => openSheet('search'));
$('#btn-bag').addEventListener('click', () => openSheet('bag'));
$('#bb-dir').addEventListener('click', () => openSheet('directory'));
$('#bb-tour').addEventListener('click', tourButton);
$('#bb-eye').addEventListener('click', () => {
  if (S.has3D) goZone('eyetest');
  else openSheet('eyetest');
});
$('#bb-info').addEventListener('click', () => openSheet('info'));

/* ---------- Swipe down on the sheet's grip or header to close it (bottom sheet only) ---------- */
(function sheetDrag() {
  const grip = sheet.querySelector('.sheet-grip'),
    head = sheet.querySelector('.sheet-head');
  let st = null;
  const start = (e) => {
    if (!isBottomSheet() || !sheet.classList.contains('open')) return;
    if (e.target.closest && e.target.closest('button')) return;
    // Never while the content is scrolled away from the top, and never at the screen edges (system Back swipe).
    if (sheetBody.scrollTop > 0) return;
    if (e.clientX < 16 || e.clientX > window.innerWidth - 16) return;
    const now = performance.now();
    st = { id: e.pointerId, y0: e.clientY, dy: 0, ly: e.clientY, lt: now, v: 0 };
    sheet.classList.add('dragging');
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      /* synthetic events cannot be captured */
    }
  };
  const move = (e) => {
    if (!st || e.pointerId !== st.id) return;
    const now = performance.now();
    st.v = (e.clientY - st.ly) / Math.max(1, now - st.lt);
    st.ly = e.clientY;
    st.lt = now;
    st.dy = Math.max(0, e.clientY - st.y0);
    sheet.style.transform = 'translateY(' + st.dy + 'px)';
  };
  const end = (e) => {
    if (!st || e.pointerId !== st.id) return;
    const h = sheet.getBoundingClientRect().height;
    // Close when pulled past 30 % of the height, or flicked down fast enough; otherwise snap back.
    const close = st.dy > h * 0.3 || (st.v > 0.6 && st.dy > 24);
    st = null;
    sheet.classList.remove('dragging');
    sheet.style.transform = '';
    if (close) closeSheet();
  };
  for (const el of [grip, head]) {
    if (!el) continue;
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
})();

/* ---------- First-visit coach mark: tap to walk, drag to look ---------- */
const coachEl = $('#coach');
let coachStep = 0;
function coachSteps() {
  const touch = isCoarse();
  return [
    {
      icon: '<path d="M12 21c4-4 6.5-7.2 6.5-10.3a6.5 6.5 0 1 0-13 0C5.5 13.8 8 17 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
      title: touch ? 'Tap the floor to walk there' : 'Click the floor to walk there',
      text: 'The route goes around fixtures. A ring marks where you are going.',
    },
    {
      icon: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
      title: 'Drag to look around',
      text: touch
        ? 'Pinch to zoom in on a shelf. Tap a frame for its details.'
        : 'Scroll to zoom. Click a frame for its details.',
    },
  ];
}
function renderCoach() {
  const steps = coachSteps(),
    st = steps[coachStep];
  const last = coachStep === steps.length - 1;
  const icon = h('span', {
    class: 'ic',
    html:
      '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      st.icon +
      '</svg>',
  });
  coachEl.replaceChildren(
    h('div', { class: 'coach-step' }, icon, h('span', null, h('b', null, st.title), h('span', null, st.text))),
    h(
      'div',
      { class: 'coach-foot' },
      h('span', { class: 'eyebrow' }, 'Step ' + (coachStep + 1) + ' of ' + steps.length),
      h(
        'span',
        { class: 'card-actions' },
        last ? null : btn('Skip', { cls: 'small', onclick: () => finishCoach() }),
        btn(last ? 'Got it' : 'Next', {
          primary: true,
          cls: 'small',
          id: 'coach-next',
          onclick: () => (last ? finishCoach() : ((coachStep += 1), renderCoach())),
        }),
      ),
    ),
  );
}
function showCoach() {
  coachStep = 0;
  $('#zonecard').hidden = true;
  coachEl.hidden = false;
  renderCoach();
  setTimeout(() => {
    const b = $('#coach-next');
    if (b) b.focus({ preventScroll: true });
  }, 30);
}
function finishCoach() {
  if (coachEl.hidden) return;
  coachEl.hidden = true;
  S.settings.coachSeen = true;
  saveSettings();
  showZoneCard(S.zone);
}
BM.coachVisible = () => !coachEl.hidden;

// Section labels avoid the chrome: tell the 3D view whenever a card, the coach mark, the hint or the floor plan
// appears, disappears or moves.
if (window.MutationObserver) {
  let queued = false;
  const relabel = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (api() && api().refreshLabels) api().refreshLabels();
    });
  };
  const mo = new MutationObserver(relabel);
  for (const sel of ['#zonecard', '#tourcard', '#coach', '#hint', '#minimap', '#minimap-toggle', '#menu', '#welcome'])
    if ($(sel)) mo.observe($(sel), { attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
  mo.observe(app, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', relabel);
}

/* ---------- Layout: floor-plan collapse, landscape menu, rotation ---------- */
initLayout();
// The floor plan starts collapsed on short phones and in landscape, unless the visitor chose otherwise.
function minimapOpen() {
  if (S.settings.minimap === 'open') return true;
  if (S.settings.minimap === 'closed') return false;
  const m = layoutMode();
  return !(m === 'phone-landscape' || (m === 'phone' && window.innerHeight < 700));
}
function applyMinimap() {
  app.classList.toggle('minimap-closed', !minimapOpen());
  measureChrome();
  drawMinimap();
}
function setMinimap(open) {
  S.settings.minimap = open ? 'open' : 'closed';
  saveSettings();
  applyMinimap();
  const target = open ? $('#minimap-close') : $('#minimap-toggle');
  if (target) target.focus({ preventScroll: true });
}
$('#minimap-close').addEventListener('click', (e) => {
  e.stopPropagation();
  setMinimap(false);
});
$('#minimap-toggle').addEventListener('click', () => setMinimap(true));
applyMinimap();

// Phone landscape: the bottom bar's actions live in a top-bar menu.
const menuBtn = $('#btn-menu'),
  menu = $('#menu');
function closeMenu(focusBtn) {
  if (menu.hidden) return;
  menu.hidden = true;
  menuBtn.setAttribute('aria-expanded', 'false');
  if (focusBtn) menuBtn.focus({ preventScroll: true });
}
menuBtn.addEventListener('click', () => {
  const open = menu.hidden;
  menu.hidden = !open;
  menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) {
    const first = menu.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  }
});
menu.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  closeMenu(false);
  const act = b.dataset.act;
  if (act === 'directory') openSheet('directory');
  else if (act === 'tour') tourButton();
  else if (act === 'eyetest') {
    if (S.has3D) goZone('eyetest');
    else openSheet('eyetest');
  } else if (act === 'info') openSheet('info');
});
document.addEventListener('pointerdown', (e) => {
  if (!menu.hidden && !menu.contains(e.target) && !menuBtn.contains(e.target)) closeMenu(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !menu.hidden) {
    e.preventDefault();
    closeMenu(true);
  }
});

// Rotating the phone or resizing changes the layout: keep the floor plan, sheet and 3D pause consistent.
onLayoutChange(() => {
  closeMenu(false);
  applyMinimap();
  if (sheet.classList.contains('open')) {
    scrim.hidden = !isBottomSheet();
    if (api()) api().setPaused(isBottomSheet());
  }
  onResize();
});

const nStyles = BM.PRODUCTS.filter((p) => p.type === 'frame').length;
$('#welcome-lede').textContent =
  'Ten sections, ' + nStyles + ' frame styles and a working bag. Every frame is drawn from its real millimetre size.';
setZoneName('welcome');
updateBadge();
drawMinimap();
requestAnimationFrame(drawMinimap);
if (initialCart.dropped) {
  saveCart();
  const n = initialCart.dropped;
  toast(
    n +
      (n === 1 ? ' item in your bag is' : ' items in your bag are') +
      ' no longer available, so we removed ' +
      (n === 1 ? 'it.' : 'them.'),
    5000,
  );
}
