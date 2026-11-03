// Boutique interface: welcome, section cards, guided tour, the product sheet with the 3D viewer and live price
// breakdown, wishlist, bag, demo checkout, private-viewing booking, today's rates, size guides, search and the
// floor plan.
import { NY } from '../core/ny.js';
import '../data/store-layout.js';
import '../data/catalogue.js';
import { money, $, h, ic, store, esc } from '../lib/dom.js';
import { drawYou } from '../lib/drawings.js';

const RM = NY.reduceMotion;
void esc;

/* =====================================================================
   UI STATE
   ===================================================================== */
const validLine = (l) => l && NY.byId[l.pid] && l.cfg && NY.METAL[l.cfg.metal];
const S = {
  cart: (store.get('kanak-bag-v1', []) || []).filter(validLine),
  wish: (store.get('kanak-wish-v1', []) || []).filter(validLine),
  stack: [],
  zone: 'foyer',
  has3D: false,
  failed: false,
  tour: { on: false, i: 0, playing: !RM, timer: null, arrived: false },
  pendingTour: false,
  lastFocus: null,
  spot: null,
  nextSpot: null,
};
S.settings = Object.assign(
  { move: RM ? 'jump' : 'walk', walkClick: 'double', look: 'normal', quality: 'auto', labels: true },
  store.get('kanak-settings', {}),
);
NY.settings = S.settings;
const saveCart = () =>
  store.set(
    'kanak-bag-v1',
    S.cart.map((l) => ({ key: l.key, pid: l.pid, cfg: l.cfg, qty: l.qty })),
  );
const saveWish = () =>
  store.set(
    'kanak-wish-v1',
    S.wish.map((l) => ({ pid: l.pid, cfg: l.cfg })),
  );
const saveSettings = () => store.set('kanak-settings', S.settings);
const cfgKey = (pid, cfg) =>
  pid + '|' + JSON.stringify([cfg.metal, cfg.size, cfg.carat || null, cfg.quality || null, cfg.stones || {}]);
const cloneCfg = (cfg) => JSON.parse(JSON.stringify(cfg));

const app = $('#app'),
  sheet = $('#sheet'),
  sheetBody = $('#sheet-body'),
  sheetFoot = $('#sheet-foot'),
  scrim = $('#scrim');
const isNarrow = () => window.matchMedia('(max-width: 760px)').matches;
const api = () => (S.has3D ? NY.api : null);

let toastT = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => {
    t.hidden = true;
  }, 2400);
}
NY.toast = toast;

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
    tx.textContent = 'The boutique is open.';
    sp.hidden = true;
    st.classList.add('ok');
  } else if (state === 'fallback') {
    tx.textContent = 'The 3D view can’t run here, so the floor plan stands in. Tap a section to browse it.';
    sp.hidden = true;
    st.classList.add('warn');
  }
}
NY.onBuildProgress = (t) => {
  if (!S.has3D && !S.failed) $('#status-text').textContent = t;
};
let hintT = null;
const coarsePointer = () => window.matchMedia('(pointer: coarse)').matches;
function walkHint() {
  const one = S.settings.walkClick === 'single';
  if (coarsePointer()) return one ? 'Tap the floor to walk' : 'Double-tap the floor to walk';
  return one ? 'Click the floor to walk' : 'Double-click the floor to walk';
}
function hideWelcome(showHint) {
  const w = $('#welcome');
  if (w.hidden) return;
  w.hidden = true;
  if (showHint && S.has3D) {
    const hn = $('#hint');
    hn.textContent = walkHint() + ' · tap a piece to see it up close';
    hn.hidden = false;
    clearTimeout(hintT);
    hintT = setTimeout(() => {
      hn.hidden = true;
    }, 6000);
  }
}

/* ---------- Current zone ---------- */
function setZoneName(id) {
  const z = NY.zoneById(id);
  $('#zone-name').textContent = z ? z.name : 'The boutique';
}
NY.onZoneChange = (id) => {
  S.zone = id;
  setZoneName(id);
  drawMinimap();
  updateHere();
};

/* ---------- Zone card ---------- */
const zoneItems = (id) => NY.PRODUCTS.filter((p) => p.zone === id);
function zoneCount(id) {
  if (id === 'lounge') return NY.SETS.length;
  return zoneItems(id).length;
}
const zoneUnit = (id) => (id === 'lounge' ? ' bridal sets' : ' pieces');
function nextZone(id) {
  const i = NY.TOUR.indexOf(id);
  return NY.TOUR[(i + 1) % NY.TOUR.length];
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
  const nz = NY.zoneById(nextZone(z.id));
  const next = btn('Next: ' + nz.short, { icon: 'arrow', onclick: () => goZone(nz.id) });
  switch (z.id) {
    case 'foyer':
      acts.push(
        btn('Today’s rates', { primary: true, icon: 'coins', onclick: () => openAtZone(z.id, 'rates') }),
        btn('Book a viewing', { icon: 'calendar', onclick: () => openAtZone(z.id, 'appointment') }),
      );
      break;
    case 'rotunda':
      acts.push(
        btn('See the signature piece', {
          primary: true,
          icon: 'sparkles',
          onclick: () => openAtZone(z.id, 'product', { pid: NY.MERCH.hero[0] }),
        }),
        next,
      );
      break;
    case 'lounge':
      acts.push(
        btn('Bridal sets', { primary: true, icon: 'gift', onclick: () => openAtZone(z.id, 'sets') }),
        btn('Book a viewing', {
          icon: 'calendar',
          onclick: () => openAtZone(z.id, 'appointment', { purpose: 'bridal' }),
        }),
      );
      break;
    default:
      acts.push(
        btn('Browse ' + zoneCount(z.id) + ' pieces', {
          primary: true,
          icon: 'diamond',
          onclick: () => openAtZone(z.id, 'browse', { zone: z.id }),
        }),
        next,
      );
  }
  return acts;
}
function showZoneCard(id) {
  if (S.tour.on) return;
  const z = NY.zoneById(id),
    card = $('#zonecard');
  if (!z) {
    card.hidden = true;
    return;
  }
  const idx = NY.TOUR.indexOf(z.id) + 1;
  let eb = 'Section ' + idx + ' of ' + NY.TOUR.length;
  const n = zoneCount(z.id);
  if (n && z.id !== 'foyer' && z.id !== 'rotunda') eb += ' · ' + n + zoneUnit(z.id);
  $('#zc-eyebrow').textContent = eb;
  $('#zc-title').textContent = z.name;
  $('#zc-blurb').textContent = z.blurb;
  $('#zc-actions').replaceChildren(...zoneActions(z));
  card.hidden = false;
  S.cardZone = id;
  startCardTimer();
}
$('#zc-close').addEventListener('click', () => {
  $('#zonecard').hidden = true;
});
const ZC_SECONDS = 6;
const zcBar = $('#zc-bar');
$('#zonecard').style.setProperty('--zc-time', ZC_SECONDS + 's');
zcBar.addEventListener('animationend', () => {
  $('#zonecard').hidden = true;
});
function startCardTimer() {
  zcBar.classList.remove('run');
  void zcBar.offsetWidth;
  zcBar.classList.add('run');
}

/* ---------- Panels tied to a spot in the store ---------- */
// A panel opened from something in the boutique belongs to that spot and closes when the visitor walks about a
// metre further away than the closest they came. Panels opened from the top or bottom bar stay open.
const LEAVE_BY = 1.0;
const NEAR_MIN = 0.8;
function spotHere(at) {
  const a = api();
  const w = a && a.where ? a.where() : null;
  if (!w) return null;
  const item = at && typeof at.x === 'number' ? [at.x, at.z] : [w.x, w.z];
  return { item, minD: Math.hypot(w.x - item[0], w.z - item[1]) };
}
function openAtSpot(spot, view, data) {
  S.nextSpot = spot;
  openSheet(view, data);
}
const openAtZone = (zone, view, data) => openAtSpot(spotHere(null), view, data);
function checkLeftSpot(x, z) {
  const zone = (NY.zoneAt(x, z) || {}).id || null;
  if (S.cardZone && zone !== S.cardZone && !S.tour.on) {
    $('#zonecard').hidden = true;
    S.cardZone = null;
  }
  const sp = S.spot;
  if (!sp || !sheet.classList.contains('open')) return;
  const d = Math.hypot(x - sp.item[0], z - sp.item[1]);
  if (d < sp.minD) sp.minD = d;
  if (d <= Math.max(sp.minD, NEAR_MIN) + LEAVE_BY) return;
  closeSheet();
  if (api() && api().clearPin) api().clearPin();
}

/* ---------- Corner button for the section you are standing in ---------- */
function hereAction(id) {
  const n = zoneCount(id);
  switch (id) {
    case 'foyer':
      return { label: 'Today’s rates', icon: 'coins', run: () => openAtZone(id, 'rates') };
    case 'rotunda':
      return {
        label: 'The signature piece',
        icon: 'sparkles',
        run: () => openAtZone(id, 'product', { pid: NY.MERCH.hero[0] }),
      };
    case 'lounge':
      return { label: 'Bridal sets', icon: 'gift', run: () => openAtZone(id, 'sets') };
    default:
      return n
        ? { label: 'Browse ' + n + ' pieces', icon: 'diamond', run: () => openAtZone(id, 'browse', { zone: id }) }
        : null;
  }
}
const here = { zone: null, act: null };
const hereMain = h('button', { class: 'here-main', type: 'button', id: 'here-main' });
const hereMore = h(
  'button',
  {
    class: 'here-more',
    type: 'button',
    id: 'here-more',
    'aria-label': 'Show this section',
    title: 'About this section',
  },
  ic('info'),
);
const hereEl = h(
  'div',
  { class: 'here glass', id: 'here', role: 'group', 'aria-label': 'This section', hidden: true },
  hereMain,
  hereMore,
);
app.append(hereEl);
hereMain.addEventListener('click', () => {
  if (!here.act) return;
  hideWelcome(false);
  here.act.run();
});
hereMore.addEventListener('click', () => {
  if (here.zone) showZoneCard(here.zone);
});
function updateHere() {
  const z = S.zone ? NY.zoneById(S.zone) : null;
  const show =
    !!z &&
    S.has3D &&
    !S.failed &&
    !S.tour.on &&
    $('#welcome').hidden &&
    $('#zonecard').hidden &&
    !sheet.classList.contains('open') &&
    !document.documentElement.classList.contains('tryon-open');
  const act = show ? hereAction(z.id) : null;
  if (!act) {
    hereEl.hidden = true;
    return;
  }
  if (here.zone !== z.id) {
    here.zone = z.id;
    here.act = act;
    hereMain.replaceChildren(
      h('span', { class: 'here-ic' }, ic(act.icon)),
      h('span', { class: 'here-text' }, h('span', { class: 'here-at' }, z.name), h('b', null, act.label)),
    );
    hereMain.setAttribute('aria-label', act.label + ' in ' + z.name);
  }
  hereEl.hidden = false;
}
const hereObs = new MutationObserver(updateHere);
for (const id of ['zonecard', 'tourcard', 'welcome'])
  hereObs.observe($('#' + id), { attributes: true, attributeFilter: ['hidden'] });
hereObs.observe(sheet, { attributes: true, attributeFilter: ['class'] });
hereObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

/* ---------- Navigation requests ---------- */
function goZone(id, tag) {
  const a = api();
  if (!a) {
    if (NY.zoneById(id)) openSheet(zoneSheet(id), { zone: id });
    return;
  }
  if (!tag) pauseTour();
  hideWelcome(false);
  if (isNarrow()) closeSheet();
  a.goZone(id, tag);
}
function zoneSheet(id) {
  if (id === 'foyer') return 'rates';
  if (id === 'lounge') return 'sets';
  if (id === 'rotunda') return 'directory';
  return 'browse';
}
function locate(pid, metal) {
  const a = api();
  if (!a) return;
  pauseTour();
  hideWelcome(false);
  closeSheet();
  if (!a.goProduct(pid, metal)) toast('This piece is shown on request at the counter.');
}
NY.onArrive = (info) => {
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
NY.onUserNav = () => {
  hideWelcome(true);
  if (S.tour.on && S.tour.playing) pauseTour();
};
NY.onProductTap = (pid, cfg, extra) => {
  hideWelcome(false);
  pauseTour();
  openAtSpot(spotHere(extra && extra.at), 'product', { pid, cfg: cfg ? cloneCfg(cfg) : null });
};
NY.onFeatureTap = (action, at) => {
  hideWelcome(false);
  pauseTour();
  const spot = spotHere(at);
  if (action === 'rates') openAtSpot(spot, 'rates');
  else if (action === 'appointment') openAtSpot(spot, 'appointment');
  else if (action === 'tryon') openTryOn();
  else if (action === 'sets') openAtSpot(spot, 'sets');
  else if (action.startsWith('browse:')) openAtSpot(spot, 'browse', { zone: action.slice(7) });
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
    toast('The tour starts as soon as the boutique is ready.');
    return;
  }
  clearTimeout(S.tour.timer);
  S.tour.on = true;
  S.tour.i = Math.max(0, Math.min(NY.TOUR.length - 1, i || 0));
  S.tour.playing = !RM;
  S.tour.arrived = false;
  hideWelcome(false);
  if (isNarrow()) closeSheet();
  $('#zonecard').hidden = true;
  $('#tourcard').hidden = false;
  setTourPressed(true);
  renderTour();
  api().goZone(NY.TOUR[S.tour.i], 'tour');
}
function renderTour() {
  const id = NY.TOUR[S.tour.i],
    z = NY.zoneById(id);
  $('#tc-step').textContent = 'Stop ' + (S.tour.i + 1) + ' of ' + NY.TOUR.length;
  $('#tc-title').textContent = z.name;
  $('#tc-text').textContent = S.tour.arrived ? NY.TOUR_TEXT[id] : 'Walking there…';
  $('#tc-prev').disabled = S.tour.i === 0;
  const last = S.tour.i === NY.TOUR.length - 1;
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
    const small = (label, fn) =>
      extra.append(
        btn(label, {
          cls: 'small',
          onclick: () => {
            pauseTour();
            fn();
          },
        }),
      );
    if (id === 'foyer') small('Today’s rates', () => openAtZone(id, 'rates'));
    else if (id === 'rotunda') small('See the Rani Haar', () => openAtZone(id, 'product', { pid: NY.MERCH.hero[0] }));
    else if (id === 'lounge') small('Bridal sets', () => openAtZone(id, 'sets'));
    else small('Browse here', () => openAtZone(id, 'browse', { zone: id }));
  }
}
function tourArrived() {
  S.tour.arrived = true;
  renderTour();
  clearTimeout(S.tour.timer);
  if (S.tour.playing) S.tour.timer = setTimeout(nextStop, 8000);
}
function nextStop() {
  clearTimeout(S.tour.timer);
  if (S.tour.i >= NY.TOUR.length - 1) {
    endTour();
    return;
  }
  S.tour.i++;
  S.tour.arrived = false;
  renderTour();
  api() && api().goZone(NY.TOUR[S.tour.i], 'tour');
}
function prevStop() {
  clearTimeout(S.tour.timer);
  if (S.tour.i === 0) return;
  S.tour.i--;
  S.tour.arrived = false;
  renderTour();
  api() && api().goZone(NY.TOUR[S.tour.i], 'tour');
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
    if (S.tour.arrived) S.tour.timer = setTimeout(nextStop, 8000);
    else api() && api().goZone(NY.TOUR[S.tour.i], 'tour');
  }
  renderTour();
}
function endTour() {
  clearTimeout(S.tour.timer);
  S.tour.on = false;
  $('#tourcard').hidden = true;
  setTourPressed(false);
  showZoneCard(S.zone);
}
$('#tc-next').addEventListener('click', nextStop);
$('#tc-prev').addEventListener('click', prevStop);
$('#tc-play').addEventListener('click', togglePlay);
$('#tc-exit').addEventListener('click', endTour);
function tourButton() {
  if (S.tour.on) endTour();
  else startTour(NY.TOUR.indexOf(S.zone) > 0 ? NY.TOUR.indexOf(S.zone) : 0);
}

/* =====================================================================
   SHEET (one panel: right side on desktop, bottom sheet on phones)
   ===================================================================== */
function scrollSheetTo(el) {
  const top = el.getBoundingClientRect().top - sheetBody.getBoundingClientRect().top + sheetBody.scrollTop;
  sheetBody.scrollTo({ top: Math.max(0, top - sheetBody.clientHeight / 2), behavior: RM ? 'auto' : 'smooth' });
}
void scrollSheetTo;
app.addEventListener('scroll', () => {
  if (app.scrollLeft || app.scrollTop) app.scrollTo(0, 0);
});
window.addEventListener('scroll', () => {
  if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
});
const VIEWS = {};
let current = null;
function openSheet(view, data, push) {
  if (!push) {
    teardown();
    S.stack = [];
    S.spot = S.nextSpot || null;
  } else teardown();
  S.nextSpot = null;
  if (!sheet.classList.contains('open')) S.lastFocus = document.activeElement;
  S.stack.push({ view, data: data || {} });
  renderSheet();
  sheet.classList.add('open');
  sheet.removeAttribute('inert');
  sheet.setAttribute('aria-hidden', 'false');
  app.classList.add('sheet-open');
  scrim.hidden = !isNarrow();
  if (isNarrow() && api()) api().setPaused(true);
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
  teardown();
  S.stack.pop();
  if (!S.stack.length) {
    closeSheet();
    return;
  }
  renderSheet();
}
function closeSheet() {
  if (!sheet.classList.contains('open')) return;
  teardown();
  S.stack = [];
  S.spot = null;
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
$('#sheet-close').addEventListener('click', closeSheet);
$('#sheet-back').addEventListener('click', backSheet);
scrim.addEventListener('click', closeSheet);
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
function metaLine(p, cfg) {
  return p.cat + ' · ' + NY.METAL[(cfg && cfg.metal) || p.metal].short;
}
function thumb(p, cfg) {
  return h('span', { class: 'thumb', html: NY.pieceSVG(p, cfg || NY.defaultCfg(p), 56, 56) });
}
function productRow(p, opts) {
  opts = opts || {};
  const cfg = opts.cfg || NY.defaultCfg(p);
  const row = h('div', { class: 'row' });
  const hit = h(
    'button',
    { class: 'row-hit', type: 'button', onclick: () => openSheet('product', { pid: p.id, cfg: cloneCfg(cfg) }, true) },
    thumb(p, cfg),
    h(
      'span',
      { class: 'row-main' },
      h('span', { class: 'row-name' }, p.name),
      h('span', { class: 'row-meta' }, opts.meta || metaLine(p, cfg)),
    ),
  );
  const side = h(
    'div',
    { class: 'row-side' },
    h('span', { class: 'row-price' }, money(NY.priceOf(p, cfg).total)),
    metalDots(p),
  );
  row.append(hit, side);
  if (S.has3D && opts.locate !== false && api().hasProduct(p.id)) {
    const lb = h('button', {
      class: 'locate',
      type: 'button',
      title: 'Show in the boutique',
      'aria-label': 'Show ' + p.name + ' in the boutique',
      onclick: () => locate(p.id, cfg.metal),
    });
    lb.append(ic('locate'));
    row.append(lb);
  } else row.classList.add('no-locate');
  return row;
}
function metalDots(p) {
  return h(
    'span',
    { class: 'dots', 'aria-label': p.metals.length + (p.metals.length === 1 ? ' metal' : ' metals') },
    p.metals.map((m) => h('span', { class: 'dot', style: 'background:' + NY.METAL[m].swatch })),
  );
}
function chipGroup(name, label, options, cur, onPick, opts) {
  opts = opts || {};
  const g = h('div', { class: 'chips' + (opts.cls ? ' ' + opts.cls : ''), role: 'radiogroup', 'aria-label': label });
  options.forEach((o) => {
    const c = h(
      'button',
      {
        class: 'chip' + (o.badge ? ' has-badge' : '') + (o.swatch ? ' has-swatch' : ''),
        type: 'button',
        role: 'radio',
        id: name + '-' + String(o.id).replace(/[^a-z0-9]/gi, ''),
        'aria-checked': String(o.id) === String(cur) ? 'true' : 'false',
        disabled: o.disabled || null,
      },
      o.swatch ? h('span', { class: 'chip-sw', style: 'background:' + o.swatch, 'aria-hidden': 'true' }) : null,
      o.n,
      o.badge ? h('span', { class: 'chip-badge' }, o.badge) : null,
    );
    c.addEventListener('click', () => {
      g.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-checked', x === c ? 'true' : 'false'));
      onPick(o.id);
    });
    g.append(c);
  });
  return g;
}
const ROLE_LABEL = {
  main: 'Stone',
  accent: 'Accent stones',
  drop: 'Drops',
  side: 'Side stones',
  pearl: 'Pearl colour',
  band: 'Band stones',
};
const PEARL_NAMES = { white: 'White', cream: 'Cream', gold: 'Golden', black: 'Tahitian black', pink: 'Pink' };
const PEARL_SW = { white: '#f3eee4', cream: '#f1e4c8', gold: '#e9c98e', black: '#3a3a40', pink: '#f2d6cf' };

/** Price breakdown table. */
function breakdown(p, cfg) {
  const pr = NY.priceOf(p, cfg);
  const m = NY.METAL[cfg.metal];
  const rows = [
    [m.n, pr.weight.toFixed(2) + ' g × ' + money(pr.rate) + '/g', pr.metal],
    ['Making charges', Math.round(p.making * 100) + '% of metal', pr.making],
    ...pr.stones.map((s) => [s.name, s.detail, s.value]),
  ];
  const t = h('table', { class: 'price-table' });
  const tb = h('tbody');
  for (const [a, b, v] of rows)
    tb.append(
      h('tr', null, h('th', { scope: 'row' }, h('span', null, a), h('small', null, b)), h('td', null, money(v))),
    );
  tb.append(h('tr', { class: 'sub' }, h('th', { scope: 'row' }, 'Subtotal'), h('td', null, money(pr.subtotal))));
  tb.append(
    h(
      'tr',
      null,
      h('th', { scope: 'row' }, h('span', null, 'GST'), h('small', null, NY.RATES.gstPct + '%')),
      h('td', null, money(pr.gst)),
    ),
  );
  tb.append(h('tr', { class: 'grand' }, h('th', { scope: 'row' }, 'Total'), h('td', null, money(pr.total))));
  t.append(tb);
  return t;
}

/* ---------- View: product ---------- */
VIEWS.product = function (d) {
  const p = NY.byId[d.pid];
  if (!d.cfg) d.cfg = NY.defaultCfg(p);
  const cfg = d.cfg;
  if (!p.metals.includes(cfg.metal)) cfg.metal = p.metal;
  const body = h('div', { class: 'pd' });

  // 3D viewer (or the drawing when there is no WebGL)
  const viewer = h('div', { class: 'viewer jewel' });
  const art = h('div', { class: 'viewer-art', html: NY.pieceSVG(p, cfg, 180, 180) });
  viewer.append(art);
  if (S.has3D)
    viewer.append(h('span', { class: 'viewer-hint', id: 'viewer-hint' }, 'Drag to turn · pinch to look closer'));
  body.append(viewer);

  const zone = NY.zoneById(p.zone);
  const priceEl = h('span', { class: 'price' });
  const head = h(
    'div',
    { class: 'pd-head' },
    h('p', { class: 'eyebrow' }, zone.short + ' · ' + p.cat),
    h('div', { class: 'pd-title' }, h('h3', null, p.name), priceEl),
    h('p', { class: 'pd-sub', id: 'pd-sub' }),
    p.tags.length
      ? h(
          'div',
          { class: 'tags' },
          p.tags.map((t) => h('span', { class: 'tag' }, t)),
        )
      : null,
  );
  body.append(head);

  // actions: try on, wishlist, book a viewing
  const wished = () => S.wish.some((w) => w.pid === p.id);
  const wishBtn = btn(wished() ? 'Saved' : 'Save', {
    icon: 'heart',
    cls: 'wish' + (wished() ? ' on' : ''),
    id: 'pd-wish',
    onclick: () => {
      const i = S.wish.findIndex((w) => w.pid === p.id);
      if (i >= 0) S.wish.splice(i, 1);
      else S.wish.push({ pid: p.id, cfg: cloneCfg(cfg) });
      saveWish();
      wishBtn.classList.toggle('on', wished());
      wishBtn.querySelector('span').textContent = wished() ? 'Saved' : 'Save';
      toast(wished() ? 'Saved to your wishlist' : 'Removed from your wishlist');
    },
  });
  wishBtn.setAttribute('aria-pressed', wished() ? 'true' : 'false');
  const tryRow = h(
    'div',
    { class: 'tryon-cta' },
    p.tryon
      ? btn('Try on ' + (NY.TRYON_LABEL[p.tryon] || ''), {
          primary: true,
          icon: 'camera',
          id: 'pd-tryon',
          onclick: () => openTryOn({ pid: p.id, cfg: cloneCfg(cfg) }),
        })
      : null,
    wishBtn,
    btn('Book a viewing', {
      icon: 'calendar',
      onclick: () =>
        openSheet(
          'appointment',
          { pid: p.id, purpose: /bridal|Bridal/.test(p.tags.join(' ')) ? 'bridal' : 'piece' },
          true,
        ),
    }),
  );
  body.append(tryRow);

  // options
  const refresh = () => {
    const pr = NY.priceOf(p, cfg);
    priceEl.textContent = money(pr.total);
    footPrice.textContent = money(pr.total);
    footNote.textContent = NY.cfgSummary(p, cfg);
    const m = NY.METAL[cfg.metal];
    $('#pd-sub', body).textContent =
      pr.weight.toFixed(2) +
      ' g ' +
      m.n +
      (pr.caratTotal ? ' · ' + pr.caratTotal.toFixed(2) + ' ct diamonds' : '') +
      ' · hallmark ' +
      m.mark;
    bdBox.replaceChildren(breakdown(p, cfg));
    art.innerHTML = NY.pieceSVG(p, cfg, 180, 180);
  };
  const viewerRefresh = () => {
    if (api()) api().updateViewer({ pid: p.id, cfg });
  };
  const metalName = h('span', { class: 'swatch-name' }, NY.METAL[cfg.metal].n);
  if (p.metals.length > 1) {
    const sw = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Metal' });
    p.metals.forEach((k) => {
      const m = NY.METAL[k];
      const b = h('button', {
        class: 'swatch metal',
        type: 'button',
        role: 'radio',
        'aria-checked': k === cfg.metal ? 'true' : 'false',
        'aria-label': m.n,
        title: m.n,
        id: 'mt-' + p.id + '-' + k,
        style:
          'background: radial-gradient(circle at 32% 28%, #fffaf0 0 12%, ' +
          m.swatch +
          ' 46%, #00000033 100%), ' +
          m.swatch,
      });
      b.addEventListener('click', () => {
        cfg.metal = k;
        sw.querySelectorAll('.swatch').forEach((s) => s.setAttribute('aria-checked', s === b ? 'true' : 'false'));
        metalName.textContent = m.n;
        refresh();
        viewerRefresh();
      });
      sw.append(b);
    });
    body.append(section('Metal', sw, metalName));
  } else body.append(section('Metal', h('p', { class: 'field-note plain' }, NY.METAL[cfg.metal].n + ' only.')));

  if (p.caratOptions) {
    body.append(
      section(
        'Centre stone',
        chipGroup(
          'ct',
          'Carat weight',
          p.caratOptions.map((c) => ({ id: c, n: c.toFixed(2) + ' ct' })),
          cfg.carat,
          (v) => {
            cfg.carat = Number(v);
            refresh();
            viewerRefresh();
          },
        ),
      ),
    );
  }
  if (p.quality) {
    body.append(
      section(
        'Diamond quality',
        chipGroup(
          'dq',
          'Diamond colour and clarity',
          NY.QUALITY.map((q) => ({ id: q.id, n: q.n })),
          cfg.quality,
          (v) => {
            cfg.quality = v;
            refresh();
            qNote.textContent = NY.QUALITY.find((q) => q.id === v).d + '.';
          },
        ),
      ),
    );
    const qNote = h(
      'p',
      { class: 'field-note' },
      (NY.QUALITY.find((q) => q.id === cfg.quality) || NY.QUALITY[1]).d + '.',
    );
    body.lastChild.append(qNote);
  }
  for (const role in p.stoneOptions || {}) {
    const opts = p.stoneOptions[role];
    const isPearl = role === 'pearl';
    body.append(
      section(
        ROLE_LABEL[role] || 'Stone',
        chipGroup(
          'st-' + role,
          ROLE_LABEL[role] || 'Stone',
          opts.map((k) => ({
            id: k,
            n: isPearl ? PEARL_NAMES[k] || k : (NY.STONE[k] || { n: k }).n,
            swatch: isPearl ? PEARL_SW[k] : (NY.STONE[k] || {}).swatch,
          })),
          cfg.stones[role],
          (v) => {
            cfg.stones[role] = v;
            refresh();
            viewerRefresh();
          },
        ),
      ),
    );
  }
  if (p.sizes) {
    const sizes = NY.sizesOf(p);
    let ctl;
    if (p.sizes === 'ring') {
      ctl = h('select', { id: 'pd-size', 'aria-label': 'Ring size' });
      for (const s of sizes) {
        const o = h('option', { value: s.id }, 'Size ' + s.n + ' · ' + s.mm.toFixed(1) + ' mm');
        if (s.id === cfg.size) o.selected = true;
        ctl.append(o);
      }
      ctl.addEventListener('change', () => {
        cfg.size = Number(ctl.value);
        refresh();
        viewerRefresh();
      });
      ctl = h('label', { class: 'field select', for: 'pd-size' }, h('span', null, 'Indian ring size'), ctl);
    } else
      ctl = chipGroup(
        'sz',
        'Size',
        sizes.map((s) => ({ id: s.id, n: s.n })),
        cfg.size,
        (v) => {
          cfg.size = sizes.find((s) => String(s.id) === String(v)).id;
          refresh();
          viewerRefresh();
        },
      );
    const label = { ring: 'Ring size', bangle: 'Bangle size', chain: 'Length', wrist: 'Wrist size' }[p.sizes];
    body.append(
      section(
        label,
        ctl,
        h(
          'button',
          { class: 'link-btn', type: 'button', onclick: () => openSheet('sizeguide', { kind: p.sizes }, true) },
          'How to find your size',
        ),
      ),
    );
  }

  // price breakdown
  const bdBox = h('div', { class: 'breakdown' });
  body.append(
    section(
      'How the price is worked out',
      bdBox,
      h(
        'p',
        { class: 'field-note' },
        NY.RATES.label + '. The final price is fixed at the day’s gold rate when you buy.',
      ),
      h('button', { class: 'link-btn', type: 'button', onclick: () => openSheet('rates', {}, true) }, 'Today’s rates'),
    ),
  );

  // details
  const specs = h('dl', { class: 'specs' });
  const addSpec = (k, v) => specs.append(h('dt', null, k), h('dd', null, v));
  addSpec('Purity', NY.METAL[cfg.metal].n + ', BIS hallmark with HUID');
  if (p.stones.some((s) => s.kind === 'diamond'))
    addSpec('Certificate', p.caratOptions ? 'IGI certificate for the centre stone' : 'Diamond quality card');
  addSpec('Code', h('span', { class: 'mono' }, 'KN-' + p.id.toUpperCase()));
  addSpec(
    'Care',
    /pearl/i.test(p.tags.join(' ')) || p.stones.some((s) => s.kind === 'pearl' || s.kind === 'southsea')
      ? 'Put pearls on last, wipe with a soft cloth, keep away from perfume.'
      : 'Store separately in the Kanak box; clean with mild soap and a soft brush.',
  );
  addSpec('Exchange', 'Lifetime exchange at the day’s gold rate; diamonds at 90% of their value.');
  body.append(section('Details', h('p', { class: 'pd-desc' }, p.desc), specs));

  const acts = h('div', { class: 'pd-actions' });
  if (S.has3D && api().hasProduct(p.id))
    acts.append(btn('Show in the boutique', { icon: 'locate', onclick: () => locate(p.id, cfg.metal) }));
  body.append(acts);

  // footer
  const addBtn = btn('Add to bag', { primary: true, icon: 'bag', id: 'add-to-bag' });
  const footPrice = h('span', { class: 'price' });
  const footNote = h('small', null);
  const foot = h('div', { class: 'foot-row' }, h('div', { class: 'foot-total' }, footPrice, footNote), addBtn);
  addBtn.addEventListener('click', () => {
    addToBag(p, cfg);
    addBtn.replaceChildren(ic('check'), h('span', null, 'Added'));
    setTimeout(() => {
      if (document.contains(addBtn)) addBtn.replaceChildren(ic('bag'), h('span', null, 'Add to bag'));
    }, 1600);
  });
  refresh();
  return {
    title: p.name,
    body,
    foot,
    mount() {
      if (api()) {
        const ok = api().mountViewer(viewer, { pid: p.id, cfg });
        if (ok) art.hidden = true;
      }
    },
    unmount() {
      if (api()) api().unmountViewer();
    },
  };
};

function radioGroup(name, legend, options, cur, onChange) {
  const fs = h('fieldset', { class: 'section opts-group' }, h('legend', { class: 'sec-title' }, legend));
  const box = h('div', { class: 'opts' });
  for (const o of options) {
    const id = 'opt-' + name + '-' + o.id;
    const inp = h('input', { type: 'radio', name: 'opt-' + name, id, value: o.id });
    if (o.id === cur) inp.checked = true;
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
function addToBag(p, cfg) {
  const c = cloneCfg(cfg);
  const key = cfgKey(p.id, c);
  const ex = S.cart.find((l) => l.key === key);
  if (ex) ex.qty = Math.min(6, ex.qty + 1);
  else S.cart.push({ key, pid: p.id, cfg: c, qty: 1 });
  saveCart();
  updateBadge();
  toast('Added ' + p.name + ' to your bag');
}
NY.addToBag = (pid, cfg) => addToBag(NY.byId[pid], cfg || NY.defaultCfg(NY.byId[pid]));

/* ---------- View: browse a salon ---------- */
VIEWS.browse = function (d) {
  const z = NY.zoneById(d.zone);
  const items = zoneItems(d.zone);
  const body = h('div', { class: 'stack' });
  body.append(h('p', { class: 'lede' }, z.blurb));
  const types = [...new Set(items.map((p) => p.type))];
  const list = h('div', { class: 'list' });
  let filter = d.filter || 'all';
  function draw() {
    list.replaceChildren(...items.filter((p) => filter === 'all' || p.type === filter).map((p) => productRow(p)));
  }
  if (types.length > 1) {
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by kind' });
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
    chips.append(mk('all', 'All'), ...types.map((t) => mk(t, NY.TYPE_LABEL[t])));
    body.append(chips);
  }
  draw();
  body.append(list);
  return { title: z.name, body };
};

/* ---------- View: bridal sets ---------- */
VIEWS.sets = function () {
  const body = h('div', { class: 'stack' });
  body.append(h('p', { class: 'lede' }, NY.zoneById('lounge').blurb));
  for (const set of NY.SETS) {
    const ps = set.pieces.map((id) => NY.byId[id]);
    const total = ps.reduce((a, p) => a + p.price, 0);
    const card = h(
      'div',
      { class: 'look-card' },
      h(
        'div',
        { class: 'look-art' },
        ps.slice(0, 4).map((p) => h('span', { html: NY.pieceSVG(p, NY.defaultCfg(p), 46, 46) })),
      ),
      h(
        'div',
        { class: 'look-main' },
        h('p', { class: 'eyebrow' }, ps.length + ' pieces · from ' + money(total)),
        h('b', null, set.name),
        h('span', { class: 'row-meta' }, set.blurb),
        h(
          'div',
          { class: 'list compact' },
          ps.map((p) => productRow(p, { locate: false })),
        ),
        h(
          'div',
          { class: 'card-actions' },
          btn('Try on the set', {
            cls: 'small primary',
            icon: 'camera',
            onclick: () => openTryOn({ set: set.id }),
          }),
          btn('Book a bridal viewing', {
            cls: 'small',
            icon: 'calendar',
            onclick: () => openSheet('appointment', { purpose: 'bridal', set: set.id }, true),
          }),
          btn('Add the set to bag', {
            cls: 'small',
            icon: 'bag',
            onclick: () => {
              for (const p of ps) addToBag(p, NY.defaultCfg(p));
              toast(set.name + ' added to your bag');
            },
          }),
        ),
      ),
    );
    body.append(card);
  }
  return { title: 'Bridal sets', body };
};

/* ---------- View: search ---------- */
const QUICK = [
  ['ring', 'Rings', (p) => p.type === 'ring'],
  ['earrings', 'Earrings', (p) => p.type === 'earrings'],
  ['necklace', 'Necklaces', (p) => p.type === 'necklace'],
  ['pendant', 'Pendants', (p) => p.type === 'pendant'],
  ['bangle', 'Bangles', (p) => p.type === 'bangle' || p.type === 'bracelet'],
  ['diamond', 'Diamond', (p) => p.stones.some((s) => s.kind === 'diamond')],
  ['polki', 'Polki & Kundan', (p) => p.stones.some((s) => s.kind === 'polki' || s.kind === 'kundan')],
  ['22k', '22K gold', (p) => p.metals.includes('y22') || p.metals.includes('ant')],
  ['bridal', 'Bridal', (p) => p.tags.includes('Bridal')],
  ['under50', 'Under ₹50,000', (p) => p.price < 50000],
  ['men', 'Men', (p) => p.gender === 'men'],
  ['tryon', 'Try-on ready', (p) => !!p.tryon],
];
function haystack(p) {
  const parts = [
    p.name,
    p.desc,
    p.cat,
    NY.zoneById(p.zone).name,
    p.tags.join(' '),
    NY.TYPE_LABEL[p.type],
    p.metals.map((m) => NY.METAL[m].n).join(' '),
  ];
  parts.push(p.stones.map((s) => (NY.STONE[s.kind] || { n: s.kind }).n).join(' '));
  for (const r in p.stoneOptions || {}) parts.push(p.stoneOptions[r].map((k) => (NY.STONE[k] || { n: k }).n).join(' '));
  if (p.gender === 'men') parts.push('men mens gents');
  return parts.join(' ').toLowerCase();
}
VIEWS.search = function (d) {
  const body = h('div', { class: 'stack' });
  const input = h('input', {
    type: 'search',
    id: 'search-q',
    placeholder: 'Name, stone, metal or style',
    autocomplete: 'off',
    'aria-label': 'Search the boutique',
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
    const res = NY.PRODUCTS.filter((p) => (!qf || qf[2](p)) && words.every((w) => haystack(p).includes(w)));
    count.textContent = res.length
      ? res.length + (res.length === 1 ? ' piece' : ' pieces')
      : 'Nothing found. Try “jhumka”, a stone like “emerald”, or a metal like “platinum”.';
    list.replaceChildren(...res.slice(0, 60).map((p) => productRow(p)));
  }
  input.addEventListener('input', run);
  run();
  body.append(field, chips, count, list);
  return {
    title: 'Find a piece',
    body,
    mount() {
      if (!isNarrow()) setTimeout(() => input.focus({ preventScroll: true }), 60);
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
  NY.TOUR.forEach((id, i) => {
    const z = NY.zoneById(id),
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
            : n && id !== 'foyer' && id !== 'rotunda'
              ? n + zoneUnit(id)
              : z.blurb.split('.')[0],
        ),
      ),
      h('span', { class: 'go' }, S.has3D ? 'Go' : 'Open'),
    );
    list.append(b);
  });
  body.append(list);
  return {
    title: 'Boutique directory',
    body,
    mount() {
      bigMap = cv;
      drawBigMap();
      cv.addEventListener('click', (e) => {
        const r = cv.getBoundingClientRect();
        if (!bigMap || !bigMap._m) return;
        const w = bigMap._m.toWorld(e.clientX - r.left, e.clientY - r.top);
        const z = NY.zoneAt(w.x, w.z);
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
  const m = NY.drawPlan(g, r.width, r.height, { colors: MC, current: S.zone, labels: true, pad: 10 });
  if (S.has3D) drawYou(g, m, mm.pose, { colors: MC, cone: 30, dot: 5 });
  bigMap._m = m;
}

/* ---------- View: bag and wishlist ---------- */
const lineTotal = (l) => NY.priceOf(NY.byId[l.pid], l.cfg).total * l.qty;
const bagTotal = () => S.cart.reduce((a, l) => a + lineTotal(l), 0);
VIEWS.bag = function (d) {
  d.tab = d.tab || 'bag';
  const body = h('div', { class: 'stack' });
  const tabs = chipGroup(
    'bag-tab',
    'Bag or wishlist',
    [
      { id: 'bag', n: 'Bag (' + S.cart.reduce((a, l) => a + l.qty, 0) + ')' },
      { id: 'wish', n: 'Wishlist (' + S.wish.length + ')' },
    ],
    d.tab,
    (v) => {
      d.tab = v;
      renderSheet();
    },
    { cls: 'tabs' },
  );
  body.append(tabs);
  if (d.tab === 'wish') {
    if (!S.wish.length)
      body.append(
        h(
          'div',
          { class: 'empty' },
          h('p', { class: 'empty-title' }, 'No saved pieces yet'),
          h('p', null, 'Tap the heart on any piece to keep it here.'),
        ),
      );
    else
      body.append(
        h(
          'div',
          { class: 'list' },
          S.wish.map((w) => productRow(NY.byId[w.pid], { cfg: w.cfg, meta: NY.cfgSummary(NY.byId[w.pid], w.cfg) })),
        ),
      );
    return { title: 'Your wishlist', body };
  }
  if (!S.cart.length) {
    body.append(
      h(
        'div',
        { class: 'empty' },
        h('p', { class: 'empty-title' }, 'Your bag is empty'),
        h('p', null, 'Tap any piece in the boutique, choose the metal and size, and add it here.'),
        h(
          'div',
          { class: 'empty-actions' },
          btn('Solitaires', { onclick: () => openSheet('browse', { zone: 'solitaire' }, true) }),
          btn('Bridal sets', { onclick: () => openSheet('sets', {}, true) }),
          btn('Everyday', { onclick: () => openSheet('browse', { zone: 'everyday' }, true) }),
        ),
      ),
    );
    return { title: 'Your bag', body };
  }
  const list = h('div', { class: 'list' });
  const totals = h('div', { class: 'totals' });
  function draw() {
    list.replaceChildren(
      ...S.cart.map((l, idx) => {
        const p = NY.byId[l.pid];
        const val = h('span', null, String(l.qty));
        const q = h(
          'div',
          { class: 'qty', role: 'group', 'aria-label': 'Quantity for ' + p.name },
          h(
            'button',
            { type: 'button', 'aria-label': 'Fewer', onclick: () => l.qty > 1 && (l.qty--, changed()) },
            ic('minus'),
          ),
          val,
          h(
            'button',
            { type: 'button', 'aria-label': 'More', onclick: () => l.qty < 6 && (l.qty++, changed()) },
            ic('plus'),
          ),
        );
        const rm = h(
          'button',
          { class: 'link-btn', type: 'button', onclick: () => (S.cart.splice(idx, 1), changed()) },
          'Remove',
        );
        return h(
          'div',
          { class: 'line' },
          thumb(p, l.cfg),
          h(
            'div',
            { class: 'line-main' },
            h(
              'div',
              { class: 'line-top' },
              h('b', null, p.name),
              h('span', { class: 'price sm' }, money(lineTotal(l))),
            ),
            h('p', { class: 'line-cfg' }, NY.cfgSummary(p, l.cfg)),
            h('div', { class: 'line-acts' }, q, rm),
          ),
        );
      }),
    );
    const sub = bagTotal();
    totals.replaceChildren(
      h('div', null, h('span', null, 'Pieces'), h('span', null, money(sub))),
      h('div', null, h('span', null, 'Insured delivery'), h('span', null, 'Free')),
      h('div', { class: 'grand' }, h('span', null, 'Total (incl. GST)'), h('span', null, money(sub))),
    );
  }
  function changed() {
    saveCart();
    updateBadge();
    if (!S.cart.length) {
      renderSheet();
      return;
    }
    draw();
  }
  draw();
  body.append(
    list,
    totals,
    h(
      'p',
      { class: 'field-note' },
      'Prices are worked out from today’s sample rates and include 3% GST. Every piece ships insured, with its hallmark and certificates.',
    ),
  );
  const foot = h(
    'div',
    { class: 'foot-row' },
    btn('Continue', { onclick: closeSheet }),
    btn('Checkout', { primary: true, icon: 'arrow', onclick: () => openSheet('checkout', {}, true) }),
  );
  return { title: 'Your bag', body, foot };
};

/* ---------- View: checkout (demo) ---------- */
VIEWS.checkout = function (d) {
  d.delivery = d.delivery || 'home';
  const body = h('div', { class: 'stack' });
  const sub = bagTotal();
  body.append(
    radioGroup(
      'dl',
      'Delivery',
      [
        { id: 'home', n: 'Insured home delivery', d: 'Arrives in 3 to 6 days, signed for in person.', pl: 'Free' },
        {
          id: 'store',
          n: 'Collect at the boutique',
          d: 'Ready in 2 days. We size and polish it in front of you.',
          pl: 'Free',
        },
      ],
      d.delivery,
      (v) => {
        d.delivery = v;
      },
    ),
  );
  const sum = h('div', { class: 'totals' });
  S.cart.forEach((l) => {
    const p = NY.byId[l.pid];
    sum.append(
      h('div', null, h('span', null, p.name + (l.qty > 1 ? ' × ' + l.qty : '')), h('span', null, money(lineTotal(l)))),
    );
  });
  sum.append(h('div', { class: 'grand' }, h('span', null, 'To pay'), h('span', null, money(sub))));
  body.append(section('Order summary', sum));
  body.append(
    h(
      'div',
      { class: 'notice' },
      h('b', null, 'Demo checkout'),
      h(
        'span',
        null,
        'No payment is taken and no order is created. In the live store, the payment gateway (for example Razorpay) opens at this step and the rate is locked for 15 minutes.',
      ),
    ),
  );
  const foot = h(
    'div',
    { class: 'foot-row' },
    h(
      'div',
      { class: 'foot-total' },
      h('span', { class: 'price' }, money(sub)),
      h('small', null, S.cart.reduce((a, l) => a + l.qty, 0) + ' pieces'),
    ),
    btn('Place demo order', {
      primary: true,
      icon: 'check',
      onclick: () => {
        const ref = 'KN-DEMO-' + String(Math.floor(1000 + Math.random() * 9000));
        const n = S.cart.reduce((a, l) => a + l.qty, 0);
        S.cart = [];
        saveCart();
        updateBadge();
        S.stack = [];
        openSheet('done', { ref, n, total: sub, delivery: d.delivery });
      },
    }),
  );
  return { title: 'Checkout', body, foot };
};
VIEWS.done = function (d) {
  const body = h(
    'div',
    { class: 'stack done' },
    h('span', { class: 'done-mark' }, ic('check')),
    h('p', { class: 'eyebrow' }, 'Demo order ' + d.ref),
    h('h3', { class: 'done-title' }, 'Thank you'),
    h(
      'p',
      null,
      d.n +
        (d.n === 1 ? ' piece' : ' pieces') +
        ', ' +
        money(d.total) +
        ', ' +
        (d.delivery === 'store' ? 'to collect at the boutique.' : 'for insured delivery.') +
        ' Nothing was charged.',
    ),
    h(
      'p',
      { class: 'field-note' },
      'In the live store this step confirms payment, sends the invoice with hallmark and certificate details on WhatsApp, and passes the order to the boutique.',
    ),
    btn('Back to the boutique', { primary: true, cls: 'block', onclick: closeSheet }),
  );
  return { title: 'Order placed', body };
};

/* ---------- View: book a private viewing (demo) ---------- */
VIEWS.appointment = function (d) {
  const body = h('div', { class: 'stack' });
  body.append(
    h(
      'p',
      { class: 'lede' },
      d.pid
        ? 'See ' + NY.byId[d.pid].name + ' in person, or on a video call with one of our jewellers.'
        : 'Sit down with a jeweller in the Bridal Lounge, or on a video call. Bring your family; we keep an hour for you.',
    ),
  );
  const days = [];
  const now = new Date();
  for (let i = 1; i <= 7; i++) days.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i));
  d.day = d.day == null ? 0 : d.day;
  d.slot = d.slot || '12:00';
  d.purpose = d.purpose || 'piece';
  d.mode = d.mode || 'store';
  const msg = h('p', { class: 'notice ok', role: 'status', hidden: true });
  const purposes = radioGroup(
    'ap',
    'What is it for',
    [
      { id: 'bridal', n: 'Bridal jewellery', d: 'Sets for the wedding and the functions around it.' },
      { id: 'engagement', n: 'Engagement ring', d: 'Choose the diamond and the setting together.' },
      {
        id: 'piece',
        n: 'A particular piece',
        d: d.pid ? NY.byId[d.pid].name : 'Anything you have seen in the boutique.',
      },
      { id: 'custom', n: 'Made to order', d: 'Your own design, or an heirloom reset.' },
      { id: 'exchange', n: 'Old gold exchange', d: 'Valued at the day’s rate, tested in front of you.' },
    ],
    d.purpose,
    (v) => {
      d.purpose = v;
      msg.hidden = true;
    },
  );
  const mode = chipGroup(
    'ap-mode',
    'Where',
    [
      { id: 'store', n: 'At the boutique' },
      { id: 'video', n: 'Video call' },
    ],
    d.mode,
    (v) => {
      d.mode = v;
      msg.hidden = true;
    },
  );
  const dayChips = chipGroup(
    'ap-day',
    'Day',
    days.map((t, i) => ({
      id: i,
      n: t.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
    })),
    d.day,
    (v) => {
      d.day = Number(v);
      msg.hidden = true;
    },
  );
  const slotChips = chipGroup(
    'ap-slot',
    'Time',
    ['11:30', '13:00', '15:00', '17:00', '19:00'].map((s) => ({ id: s, n: s })),
    d.slot,
    (v) => {
      d.slot = v;
      msg.hidden = true;
    },
  );
  const name = h('input', { type: 'text', id: 'ap-name', autocomplete: 'name', placeholder: 'Your name' });
  const phone = h('input', {
    type: 'tel',
    id: 'ap-phone',
    autocomplete: 'tel',
    inputmode: 'tel',
    placeholder: 'Mobile number',
  });
  name.value = d.name || '';
  phone.value = d.phone || '';
  name.addEventListener('input', () => (d.name = name.value));
  phone.addEventListener('input', () => (d.phone = phone.value));
  const err = h('p', { class: 'field-error', role: 'alert', hidden: true });
  const form = h(
    'form',
    { class: 'stack', novalidate: true },
    purposes,
    section('Where', mode),
    section('Day', dayChips),
    section('Time', slotChips),
    h(
      'div',
      { class: 'fields' },
      h('label', { class: 'field', for: 'ap-name' }, h('span', null, 'Name'), name),
      h('label', { class: 'field', for: 'ap-phone' }, h('span', null, 'Mobile'), phone),
    ),
    err,
    btn('Request this time', { primary: true, cls: 'block', id: 'ap-submit' }),
    msg,
  );
  form.querySelector('#ap-submit').type = 'submit';
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!name.value.trim() || !/^[+\d][\d\s-]{6,}$/.test(phone.value.trim())) {
      err.textContent = 'Please add your name and a mobile number we can call.';
      err.hidden = false;
      return;
    }
    err.hidden = true;
    const t = days[d.day];
    msg.textContent =
      (d.mode === 'video' ? 'Video call' : 'Viewing') +
      ' noted for ' +
      t.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) +
      ' at ' +
      d.slot +
      '. This is a demo, so no booking was made and nothing was sent.';
    msg.hidden = false;
  });
  body.append(form);
  return { title: 'Book a private viewing', body };
};

/* ---------- View: today's rates ---------- */
VIEWS.rates = function () {
  const R = NY.RATES;
  const body = h('div', { class: 'stack' });
  body.append(
    h(
      'p',
      { class: 'lede' },
      'Every price in the boutique is worked out live from these rates, the weight of the metal, the making charge and the stones.',
    ),
  );
  const t = h('table', { class: 'price-table rates' });
  const tb = h('tbody');
  for (const [n, k] of [
    ['24K gold (999)', null],
    ['22K gold (916)', 'y22'],
    ['18K gold (750)', 'y18'],
    ['Platinum 950', 'pt'],
    ['Silver 925', 'ag'],
  ])
    tb.append(
      h('tr', null, h('th', { scope: 'row' }, n), h('td', null, money(k ? NY.metalRate(k) : R.gold24) + ' /g')),
    );
  t.append(tb);
  body.append(
    section(
      'Today’s rates',
      t,
      h('p', { class: 'field-note' }, R.label + '. In the live store the rates update every morning.'),
    ),
  );
  body.append(
    section(
      'How a price is made',
      h(
        'ol',
        { class: 'steps' },
        h('li', null, h('b', null, 'Metal'), h('span', null, 'Weight in grams × today’s rate for that purity.')),
        h(
          'li',
          null,
          h('b', null, 'Making charges'),
          h('span', null, 'A percentage of the metal value, from 9% for plain chains to 22% for fine diamond work.'),
        ),
        h(
          'li',
          null,
          h('b', null, 'Stones'),
          h(
            'span',
            null,
            'Carat weight × the rate for that stone and quality. Pearls and kundan are priced per piece.',
          ),
        ),
        h('li', null, h('b', null, 'GST'), h('span', null, R.gstPct + '% on the total.')),
      ),
    ),
  );
  const ex = NY.byId.e01;
  body.append(section('Example: ' + ex.name + ', 18″', breakdown(ex, NY.defaultCfg(ex))));
  body.append(
    section(
      'Our promises',
      h(
        'ul',
        { class: 'ticks' },
        NY.STORE.services.map((s) => h('li', null, ic('check'), h('span', null, s))),
      ),
    ),
  );
  return { title: 'Today’s rates', body };
};

/* ---------- View: size guides ---------- */
VIEWS.sizeguide = function (d) {
  const kind = d.kind || 'ring';
  const body = h('div', { class: 'stack' });
  const tabs = chipGroup(
    'sg',
    'Size chart',
    [
      { id: 'ring', n: 'Rings' },
      { id: 'bangle', n: 'Bangles' },
      { id: 'chain', n: 'Chains' },
      { id: 'wrist', n: 'Bracelets' },
    ],
    kind,
    (v) => {
      d.kind = v;
      renderSheet();
    },
  );
  body.append(tabs);
  const table = (head, rows) =>
    h(
      'div',
      { class: 'size-table-wrap' },
      h(
        'table',
        { class: 'size-table' },
        h(
          'thead',
          null,
          h(
            'tr',
            null,
            head.map((x) => h('th', { scope: 'col' }, x)),
          ),
        ),
        h(
          'tbody',
          null,
          rows.map((r) =>
            h(
              'tr',
              null,
              r.map((c, i) => (i ? h('td', null, c) : h('th', { scope: 'row' }, c))),
            ),
          ),
        ),
      ),
    );
  if (kind === 'ring') {
    body.append(
      h(
        'p',
        { class: 'lede' },
        'Wrap a strip of paper or a thread around the base of your finger, mark where it meets, and measure the length in millimetres. That is the circumference; pick the size closest to it. Or measure the inside of a ring that fits.',
      ),
      table(
        ['Indian size', 'Inside diameter', 'Circumference'],
        NY.RING_SIZES.map(([n, mm]) => [String(n), mm.toFixed(1) + ' mm', (mm * Math.PI).toFixed(1) + ' mm']),
      ),
      h(
        'p',
        { class: 'field-note' },
        'Fingers swell in the evening and in summer. Between two sizes, choose the larger. We resize free within 30 days.',
      ),
    );
  } else if (kind === 'bangle') {
    body.append(
      h(
        'p',
        { class: 'lede' },
        'Bring your thumb and little finger together, as if putting on a bangle, and measure across the widest part of your hand. Pick the bangle whose inside diameter is just larger.',
      ),
      table(
        ['Size', 'Inside diameter'],
        NY.BANGLE_SIZES.map(([n, mm]) => [n, mm.toFixed(1) + ' mm']),
      ),
    );
  } else if (kind === 'chain') {
    body.append(
      h(
        'p',
        { class: 'lede' },
        '16″ sits at the base of the neck, 18″ on the collarbone, 20″ to 22″ just below it, and 24″ or more on the chest. Chokers are about 14″ and tie with a dori.',
      ),
      table(
        ['Length', 'Where it sits'],
        [
          ['14″', 'Choker, high on the neck'],
          ['16″', 'Base of the neck'],
          ['18″', 'On the collarbone'],
          ['20″', 'Just below the collarbone'],
          ['22″ to 24″', 'Upper chest'],
          ['28″', 'Long necklaces and haars'],
        ],
      ),
    );
  } else {
    body.append(
      h('p', { class: 'lede' }, 'Measure around your wrist just above the bone and add about 1.5 cm for comfort.'),
      table(
        ['Size', 'Bracelet length'],
        NY.WRIST_SIZES.map(([n, mm]) => [n, (mm / 10).toFixed(1) + ' cm']),
      ),
    );
  }
  return { title: 'Size guide', body };
};

/* ---------- View: store details and settings ---------- */
VIEWS.info = function () {
  const st = NY.STORE;
  const body = h('div', { class: 'stack' });
  // This shop is one of several in the Plexus marketplace.
  body.append(
    h('a', { class: 'btn market-link', href: '/' }, ic('back'), h('span', null, 'All shops in the marketplace')),
  );
  body.append(
    section(
      st.full,
      h('p', { class: 'lede' }, st.tagline + '. ' + st.hours + '.'),
      h(
        'ul',
        { class: 'ticks' },
        st.services.map((s) => h('li', null, ic('check'), h('span', null, s))),
      ),
      h('p', { class: 'field-note' }, st.address),
      h(
        'div',
        { class: 'card-actions' },
        btn('Today’s rates', { icon: 'coins', onclick: () => openSheet('rates', {}, true) }),
        btn('Book a viewing', { icon: 'calendar', onclick: () => openSheet('appointment', {}, true) }),
      ),
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
          h('b', null, walkHint().replace(' to walk', '')),
          h(
            'span',
            null,
            'Walk to that spot. The route goes around cases and never behind a counter. Click or tap while walking to stop.',
          ),
        ),
        h('li', null, h('b', null, 'Drag'), h('span', null, 'Look around. Pinch or scroll to look closer at a case.')),
        h(
          'li',
          null,
          h('b', null, 'Tap a piece'),
          h('span', null, 'Open it in 3D with its metals, stones, sizes and price.'),
        ),
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
  const press = coarsePointer() ? 'tap' : 'click';
  const walkClick = radioGroup(
    'wc',
    'Walking by ' + press,
    [
      {
        id: 'double',
        n: coarsePointer() ? 'Double-tap' : 'Double-click',
        d: `The first ${press} marks the spot, a second ${press} on it walks there. A stray ${press} never moves you.`,
      },
      {
        id: 'single',
        n: coarsePointer() ? 'Single tap' : 'Single click',
        d: `Walk as soon as you ${press} the floor.`,
      },
    ],
    S.settings.walkClick,
    (v) => {
      S.settings.walkClick = v;
      saveSettings();
    },
  );
  const look = radioGroup(
    'lk',
    'Look speed',
    [
      { id: 'slow', n: 'Slow', d: 'Small, precise turns when you drag.' },
      { id: 'normal', n: 'Normal', d: 'The default.' },
      { id: 'fast', n: 'Fast', d: 'Large turns for a quick look around.' },
    ],
    S.settings.look,
    (v) => {
      S.settings.look = v;
      saveSettings();
    },
  );
  const qual = radioGroup(
    'ql',
    'Picture quality',
    [
      { id: 'auto', n: 'Automatic', d: 'Adjusts to keep movement smooth.' },
      { id: 'high', n: 'High', d: 'Reflections in the marble and glow on every highlight. Uses more battery.' },
      { id: 'low', n: 'Battery saver', d: 'Lower resolution, no reflections or glow.' },
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
  body.append(move, walkClick, look, qual, section('Labels', h('div', { class: 'opts' }, labRow)));
  body.append(
    h(
      'p',
      { class: 'field-note' },
      'This is a prototype with sample pieces, rates and prices. Every piece is modelled in 3D from its specification; replace the catalogue, rates and branding with the client’s own.',
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
const mm = { cv: $('#minimap-canvas'), pose: { x: NY.START.x, z: NY.START.z, yaw: 0, hfov: 1.4, path: null }, m: null };
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
  mm.m = NY.drawPlan(g, r.width, r.height, { colors: MC, current: S.zone, pad: 3 });
  drawYou(g, mm.m, mm.pose, { colors: MC, cone: r.width < 150 ? 16 : 24, dot: r.width < 150 ? 3.5 : 4.5 });
}
let mmQueued = false;
NY.onMove = (x, z) => checkLeftSpot(x, z);
NY.onPose = (pose) => {
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
  if (!NY.inside(w.x, w.z)) return;
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
  const m = NY.drawPlan(g, r.width, Math.max(160, r.height - top - bottom), {
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
  const z = NY.zoneAt(w.x, w.z);
  if (z) openSheet(zoneSheet(z.id), { zone: z.id });
});
NY.fail3D = function (err) {
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
  if (!S.has3D) NY.fail3D(new Error('3D view did not load in time'));
}, 45000);
NY.attach3D = function (a) {
  clearTimeout(failTimer);
  NY.api = a;
  S.has3D = true;
  if (S.failed) {
    S.failed = false;
    $('#scene').hidden = false;
    $('#plan-fallback').hidden = true;
    $('#minimap').hidden = false;
    $('#w-tour').hidden = false;
    $('#btn-tour').hidden = false;
    $('#bb-tour').hidden = false;
    $('#status').classList.remove('warn');
    $('#w-explore').querySelector('span').textContent = 'Explore on my own';
  }
  setStatus('ready');
  app.classList.add('has3d');
  updateHere();
  a.setLabels(S.settings.labels);
  drawMinimap();
  if (S.pendingTour) {
    S.pendingTour = false;
    startTour(0);
  }
};

/* =====================================================================
   CAMERA TRY-ON (loaded on demand, so the boutique opens fast)
   ===================================================================== */
let tryonMod = null;
async function openTryOn(o) {
  o = o || {};
  hideWelcome(false);
  pauseTour();
  if (!tryonMod) {
    toast('Opening the try-on…');
    try {
      tryonMod = await import('../tryon/tryon.js');
    } catch (e) {
      console.warn(e);
      toast('The try-on could not load. Check your connection and try again.');
      return;
    }
  }
  closeSheet();
  if (api()) api().setPaused(true);
  tryonMod.openTryOn(
    Object.assign(
      {
        onClose() {
          if (api()) api().setPaused(false);
        },
        addToBag(pid, cfg) {
          addToBag(NY.byId[pid], cfg);
        },
        openProduct(pid, cfg) {
          openSheet('product', { pid, cfg: cloneCfg(cfg) });
        },
        toast,
      },
      o,
    ),
  );
}
NY.openTryOn = openTryOn;

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
$('#w-tryon').addEventListener('click', () => openTryOn());
$('#zone-pill').addEventListener('click', () => openSheet('directory'));
$('#brand-btn').addEventListener('click', () => openSheet('info'));
$('#btn-tour').addEventListener('click', tourButton);
$('#btn-dir').addEventListener('click', () => openSheet('directory'));
$('#btn-tryon').addEventListener('click', () => openTryOn());
$('#btn-search').addEventListener('click', () => openSheet('search'));
$('#btn-bag').addEventListener('click', () => openSheet('bag'));
$('#bb-dir').addEventListener('click', () => openSheet('directory'));
$('#bb-tour').addEventListener('click', tourButton);
$('#bb-tryon').addEventListener('click', () => openTryOn());
$('#bb-rates').addEventListener('click', () => openSheet('rates'));
$('#bb-info').addEventListener('click', () => openSheet('info'));
setZoneName('foyer');
updateBadge();
drawMinimap();
requestAnimationFrame(drawMinimap);
