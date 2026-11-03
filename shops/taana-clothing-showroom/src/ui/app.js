// Showroom interface: welcome, section cards, guided tour, product sheet with the mannequin viewer, sizes,
// try-on, search, bag, checkout, alterations and the floor plan.
import { NY } from '../core/ny.js';
import '../data/store-layout.js';
import '../data/catalogue.js';
import { money, $, h, ic, store, esc } from '../lib/dom.js';
import { drawYou } from '../lib/drawings.js';
import { bodyFromMeasurements } from '../cloth/measure.js';
import { defaultMeasurements } from '../cloth/body.js';

const RM = NY.reduceMotion;
void esc;

/* =====================================================================
   UI STATE
   ===================================================================== */
const S = {
  cart: (store.get('taana-bag-v1', []) || []).filter((l) => l && NY.byId[l.pid]),
  stack: [],
  zone: 'welcome',
  has3D: false,
  failed: false,
  tour: { on: false, i: 0, playing: !RM, timer: null, arrived: false },
  pendingTour: false,
  lastFocus: null,
  cardDismissed: null,
  spot: null, // where the open panel belongs in the store (null: opened from the top or bottom bar)
  nextSpot: null,
};
S.settings = Object.assign(
  { move: RM ? 'jump' : 'walk', walkClick: 'double', look: 'normal', quality: 'auto', labels: true },
  store.get('taana-settings', {}),
);
S.body = store.get('taana-body', null); // { kind, height, chest, waist, hip } in cm, on this device only
NY.settings = S.settings;
const saveCart = () =>
  store.set(
    'taana-bag-v1',
    S.cart.map((l) => ({ key: l.key, pid: l.pid, ci: l.ci, cfg: l.cfg, qty: l.qty, unit: l.unit })),
  );
const saveSettings = () => store.set('taana-settings', S.settings);
const KIND_OF = { women: 'female', men: 'male', kids: 'child', free: 'female' };
/** Measurements for the viewer and size advice: the shopper's own if saved for this kind of garment. */
NY.userBody = (kind) => {
  if (!S.body || !S.body.kind) return null;
  const k = kind === 'free' ? 'women' : kind;
  if (S.body.kind !== k) return null;
  return bodyFromMeasurements(k, S.body);
};
NY.savedBody = () => S.body;
const girthOf = (m) => NY.girth(m.chestA, m.chestB);
const mannequinChest = (kind) => girthOf(defaultMeasurements(KIND_OF[kind] || 'female'));
/** Recommended size index for a product: from saved measurements, else the size the mannequin wears. */
function sizeFor(p) {
  if (p.type === 'dupatta') return 0;
  const u = NY.userBody(p.kind);
  return NY.recommendSize(p, u ? girthOf(u) : mannequinChest(p.kind));
}

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
const coarsePointer = () => window.matchMedia('(pointer: coarse)').matches;
/** How to walk by clicking, in words that match the device and the "Walking by click" setting. */
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
    hn.textContent = walkHint() + ' · drag to look around';
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
  $('#zone-name').textContent = z ? z.name : 'Showroom floor';
}
NY.onZoneChange = (id) => {
  S.zone = id;
  setZoneName(id);
  drawMinimap();
  updateHere();
};

/* ---------- Zone card ---------- */
function zoneCount(id) {
  if (id === 'festive') return NY.MERCH.festive.length;
  return NY.PRODUCTS.filter((p) => p.zone === id).length;
}
function zoneUnit(id) {
  return id === 'festive' ? ' looks' : ' styles';
}
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
    case 'welcome':
      acts.push(
        btn('Open directory', { primary: true, icon: 'map', onclick: () => openAtZone(z.id, 'directory') }),
        btn('Take the tour', { icon: 'play', onclick: () => startTour(0) }),
      );
      break;
    case 'festive':
      acts.push(
        btn('See the looks', { primary: true, icon: 'hanger', onclick: () => openAtZone(z.id, 'looks') }),
        next,
      );
      break;
    case 'fitting':
      acts.push(
        btn('Start camera try-on', { primary: true, icon: 'camera', onclick: () => openTryOn() }),
        btn('My measurements', { icon: 'tape', onclick: () => openAtZone(z.id, 'measure') }),
      );
      break;
    case 'dupatta':
      acts.push(
        btn('Browse ' + zoneCount(z.id) + ' styles', {
          primary: true,
          icon: 'search',
          onclick: () => openAtZone(z.id, 'browse', { zone: z.id }),
        }),
        btn('Drape guide', { icon: 'info', onclick: () => openAtZone(z.id, 'drapeguide') }),
      );
      break;
    case 'checkout':
      acts.push(
        btn('Open bag', { primary: true, icon: 'bag', onclick: () => openAtZone(z.id, 'bag') }),
        btn('Book an alteration', { icon: 'scissors', onclick: () => openAtZone(z.id, 'alter') }),
      );
      break;
    default: {
      const n = zoneCount(z.id);
      acts.push(
        btn('Browse ' + n + ' styles', {
          primary: true,
          icon: 'search',
          onclick: () => openAtZone(z.id, 'browse', { zone: z.id }),
        }),
        next,
      );
    }
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
  if (n) eb += ' · ' + n + zoneUnit(z.id);
  $('#zc-eyebrow').textContent = eb;
  $('#zc-title').textContent = z.name;
  $('#zc-blurb').textContent = z.blurb;
  const box = $('#zc-actions');
  box.replaceChildren(...zoneActions(z));
  card.hidden = false;
  S.cardZone = id;
  startCardTimer();
}
$('#zc-close').addEventListener('click', () => {
  $('#zonecard').hidden = true;
});
// The section card closes itself after ZC_SECONDS (the countdown pauses while it is hovered or focused).
// The corner button then offers the same main action, and its (i) brings the card back.
const ZC_SECONDS = 5;
const zcBar = $('#zc-bar');
$('#zonecard').style.setProperty('--zc-time', ZC_SECONDS + 's');
zcBar.addEventListener('animationend', () => {
  $('#zonecard').hidden = true;
});
function startCardTimer() {
  zcBar.classList.remove('run');
  void zcBar.offsetWidth; // restart the countdown
  zcBar.classList.add('run');
}

/* ---------- Panels tied to a spot in the store ---------- */
// A panel opened from something in the store (a garment, a counter, a section card) belongs to that spot.
// It closes as soon as the visitor walks away from it: about a metre further from the item than the closest
// they came (walking towards the item never closes it). Panels opened from a section card, the tour or the
// corner button belong to the place where the visitor stood. Panels opened from the top or bottom bar are
// not tied to a spot and stay open. The section card hides as soon as the visitor is in another section.
const LEAVE_BY = 1.0; // metres
const NEAR_MIN = 0.8; // standing closer than this still counts as this close
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
// The section card can be closed, and it does not appear after "Show in store". This small button in the
// corner stays while the visitor stands in a section, so that counter's main action is always one click
// away, even for someone who never taps the 3D view. It steps aside while the card, tour, a panel or the
// try-on is on screen.
function hereAction(id) {
  const n = zoneCount(id);
  switch (id) {
    case 'welcome':
      return { label: 'Open directory', icon: 'map', run: () => openAtZone(id, 'directory') };
    case 'festive':
      return { label: 'See the ' + n + ' looks', icon: 'hanger', run: () => openAtZone(id, 'looks') };
    case 'fitting':
      return { label: 'Start camera try-on', icon: 'camera', run: () => openTryOn() };
    case 'checkout':
      return { label: 'Open bag', icon: 'bag', run: () => openAtZone(id, 'bag') };
    default:
      return n
        ? { label: 'Browse ' + n + ' styles', icon: 'hanger', run: () => openAtZone(id, 'browse', { zone: id }) }
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
// re-check whenever something that can cover or replace it opens or closes
const hereObs = new MutationObserver(updateHere);
for (const id of ['zonecard', 'tourcard', 'welcome'])
  hereObs.observe($('#' + id), { attributes: true, attributeFilter: ['hidden'] });
hereObs.observe(sheet, { attributes: true, attributeFilter: ['class'] });
hereObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

/* ---------- Navigation requests ---------- */
function goZone(id, tag) {
  const a = api();
  if (!a) {
    const z = NY.zoneById(id);
    if (z) openSheet(zoneSheet(id), { zone: id });
    return;
  }
  if (!tag) pauseTour();
  hideWelcome(false);
  if (isNarrow()) closeSheet();
  a.goZone(id, tag);
}
function zoneSheet(id) {
  if (id === 'fitting') return 'measure';
  if (id === 'festive') return 'looks';
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
NY.onProductTap = (pid, ci, extra) => {
  hideWelcome(false);
  pauseTour();
  openAtSpot(spotHere(extra && extra.at), 'product', { pid, ci, look: extra && extra.look ? extra.look : null });
};
NY.onFeatureTap = (action, at) => {
  hideWelcome(false);
  pauseTour();
  const spot = spotHere(at);
  if (action === 'directory') openAtSpot(spot, 'directory');
  else if (action === 'tryon') openTryOn();
  else if (action === 'tailor') openAtSpot(spot, 'alter');
  else if (action === 'bag') openAtSpot(spot, 'bag');
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
    const n = zoneCount(id);
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
    if (id === 'festive') small('See the looks', () => openAtZone(id, 'looks'));
    else if (id === 'fitting') small('Start try-on', () => openTryOn());
    else if (id === 'checkout') small('Open bag', () => openAtZone(id, 'bag'));
    else if (n) small('Browse here', () => openAtZone(id, 'browse', { zone: id }));
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
    if (S.tour.arrived) S.tour.timer = setTimeout(nextStop, 7500);
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
function openSheet(view, data, push) {
  if (!push) {
    teardown();
    S.stack = [];
    // a fresh panel takes the spot it was opened from; panels pushed on top keep the current one
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
function priceTag(p) {
  return money(p.price);
}
function metaLine(p) {
  const f = NY.FABRIC_INFO[p.fabric];
  const cat =
    p.type === 'dupatta'
      ? p.dims && p.dims.width < 0.8
        ? 'Stole'
        : 'Dupatta'
      : (NY.CAT_LABEL[p.cat] || '').replace(/s$/, '');
  return cat + ' · ' + (f ? f.n : p.fabric);
}
function swatchBg(c) {
  return c.accent ? 'radial-gradient(circle at 70% 30%,' + c.accent + ' 0 22%,transparent 24%),' + c.base : c.base;
}
function dots(p) {
  return h(
    'span',
    { class: 'dots', 'aria-label': p.colors.length + (p.colors.length === 1 ? ' colour' : ' colours') },
    p.colors.map((c) => h('span', { class: 'dot', style: 'background:' + swatchBg(c) })),
  );
}
function thumb(p, ci) {
  return h('span', { class: 'thumb', html: NY.garmentSVG(p, ci || 0, 56, 68) });
}
function productRow(p, opts) {
  opts = opts || {};
  const ci = opts.ci || 0;
  const row = h('div', { class: 'row' });
  const hit = h(
    'button',
    { class: 'row-hit', type: 'button', onclick: () => openSheet('product', { pid: p.id, ci }, true) },
    thumb(p, ci),
    h(
      'span',
      { class: 'row-main' },
      h('span', { class: 'row-name' }, p.name),
      h('span', { class: 'row-meta' }, opts.meta || metaLine(p)),
    ),
  );
  const side = h('div', { class: 'row-side' }, h('span', { class: 'row-price' }, priceTag(p)), dots(p));
  row.append(hit, side);
  if (S.has3D && opts.locate !== false) {
    const lb = h('button', {
      class: 'locate',
      type: 'button',
      title: 'Show in store',
      'aria-label': 'Show ' + p.name + ' in the store',
      onclick: () => locate(p.id, ci),
    });
    lb.append(ic('locate'));
    row.append(lb);
  } else row.classList.add('no-locate');
  return row;
}
function chipGroup(name, label, options, current, onPick, opts) {
  opts = opts || {};
  const g = h('div', { class: 'chips' + (opts.cls ? ' ' + opts.cls : ''), role: 'radiogroup', 'aria-label': label });
  options.forEach((o) => {
    const c = h(
      'button',
      {
        class: 'chip' + (o.badge ? ' has-badge' : ''),
        type: 'button',
        role: 'radio',
        id: name + '-' + String(o.id).replace(/[^a-z0-9]/gi, ''),
        'aria-checked': o.id === current ? 'true' : 'false',
        disabled: o.disabled || null,
      },
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

/* ---------- View: product ---------- */
const MODES = [
  ['still', 'Still'],
  ['turn', 'Turn'],
  ['walk', 'Walk'],
  ['showcase', 'Twirl'],
];
VIEWS.product = function (d) {
  const p = NY.byId[d.pid];
  const nC = p.colors.length;
  d.ci = (((d.ci || 0) % nC) + nC) % nC;
  if (d.si == null) d.si = sizeFor(p);
  d.mode = d.mode || (RM ? 'still' : 'turn');
  d.drape = d.drape || p.drape || 'stole';
  d.alter = !!d.alter;
  const isDup = p.type === 'dupatta';
  const layered = isDup || p.cat === 'jacket';
  const kind = p.kind === 'free' ? (S.body && S.body.kind && S.body.kind !== 'kids' ? S.body.kind : 'women') : p.kind;
  const sizes = NY.sizesOf(p);
  const body = h('div', { class: 'pd' });

  // Viewer: live cloth on a mannequin (3D), or the flat sketch
  const viewer = h('div', { class: 'viewer tall' });
  const art = h('div', { class: 'viewer-art', html: NY.garmentSVG(p, d.ci, 200, 240) });
  viewer.append(art);
  const modeChips = chipGroup(
    'vm',
    'Mannequin motion',
    MODES.map(([id, n]) => ({ id, n })),
    d.mode,
    (v) => {
      d.mode = v;
      if (api()) api().updateViewer({ mode: v });
    },
    { cls: 'viewer-modes' },
  );
  if (S.has3D)
    viewer.append(modeChips, h('span', { class: 'viewer-hint', id: 'viewer-hint' }, 'Live fabric · drag to spin'));
  body.append(viewer);

  const zone = NY.zoneById(p.zone);
  const head = h(
    'div',
    { class: 'pd-head' },
    h('p', { class: 'eyebrow' }, zone.short + ' · ' + metaLine(p)),
    h('div', { class: 'pd-title' }, h('h3', null, p.name), h('span', { class: 'price' }, money(p.price))),
    h(
      'p',
      { class: 'pd-sub' },
      (isDup
        ? 'Free size, ' + p.dims.length + ' m × ' + p.dims.width + ' m'
        : NY.FIT_LABEL[p.fit] + ', ' + NY.FABRIC_INFO[p.fabric].feel.toLowerCase()) + '.',
    ),
    p.tags.length
      ? h(
          'div',
          { class: 'tags' },
          p.tags.map((t) => h('span', { class: 'tag' }, t)),
        )
      : null,
  );
  body.append(head);

  // Try-on call to action
  const measureNote = h('span', { class: 'tryon-note' });
  const tryRow = h(
    'div',
    { class: 'tryon-cta' },
    btn('Try on with camera', {
      primary: true,
      icon: 'camera',
      id: 'pd-tryon',
      onclick: () => openTryOn({ pid: p.id, ci: d.ci, si: d.si, drape: d.drape, look: d.look }),
    }),
    btn(NY.userBody(kind) ? 'Your measurements' : 'Add measurements', {
      icon: 'tape',
      onclick: () => openSheet('measure', { kind }, true),
    }),
    measureNote,
  );
  body.append(tryRow);

  // Colours
  const swName = h('span', { class: 'swatch-name', id: 'swatch-name' }, NY.colorOf(p, d.ci).n);
  const swatches = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Colour' });
  p.colors.forEach((c, i) => {
    const b = h('button', {
      class: 'swatch',
      type: 'button',
      role: 'radio',
      'aria-checked': i === d.ci ? 'true' : 'false',
      'aria-label': c.n,
      title: c.n,
      id: 'sw-' + p.id + '-' + i,
      style: 'background:' + swatchBg(c),
    });
    b.addEventListener('click', () => {
      d.ci = i;
      swatches
        .querySelectorAll('.swatch')
        .forEach((s, k) => s.setAttribute('aria-checked', k === i ? 'true' : 'false'));
      swName.textContent = c.n;
      art.innerHTML = NY.garmentSVG(p, i, 200, 240);
      refreshViewer();
    });
    swatches.append(b);
  });
  body.append(section('Colour', swatches, swName));

  // Size
  const fitLine = h('p', { class: 'fit-line', 'aria-live': 'polite' });
  const rec = sizeFor(p);
  function drawFit() {
    if (isDup) {
      fitLine.textContent = 'One size. Shown as a ' + (d.drape === 'shoulder' ? 'one-shoulder drape' : 'stole') + '.';
      return;
    }
    const u = NY.userBody(p.kind);
    const bodyChest = u ? girthOf(u) : mannequinChest(p.kind);
    const ease = NY.garmentChest(p, d.si) - bodyChest;
    const who = u ? 'On you' : 'On the mannequin';
    fitLine.replaceChildren(
      h('b', null, who + ': ' + NY.fitWord(ease)),
      h(
        'span',
        null,
        ' · ' + Math.round(ease * 100) + ' cm of room at the chest' + (u ? '' : '. Add your measurements for advice.'),
      ),
    );
    measureNote.textContent = u ? 'Size advice uses your measurements.' : '';
  }
  if (!isDup) {
    const sizeChips = chipGroup(
      'sz',
      'Size',
      sizes.map(([n], i) => ({ id: i, n, badge: i === rec ? 'Best fit' : null })),
      d.si,
      (v) => {
        d.si = v;
        d.cfg = null;
        drawFit();
        refreshViewer();
      },
    );
    const guide = h(
      'button',
      { class: 'link-btn', type: 'button', onclick: () => openSheet('sizeguide', { kind: p.kind, pid: p.id }, true) },
      'Size guide',
    );
    body.append(section('Size', sizeChips, fitLine, guide));
  } else {
    const drapeChips = chipGroup(
      'dr',
      'Drape',
      [
        { id: 'stole', n: 'Stole' },
        { id: 'shoulder', n: 'One shoulder' },
      ],
      d.drape,
      (v) => {
        d.drape = v;
        drawFit();
        refreshViewer();
      },
    );
    body.append(section('Drape', drapeChips, fitLine));
  }
  drawFit();
  if (layered)
    body.append(
      h(
        'p',
        { class: 'field-note' },
        'Shown over an ivory kurta. In the camera try-on it layers over the kurta you pick.',
      ),
    );

  // Complete the look
  if (d.look && d.look.length > 1) {
    const others = d.look.filter(([pid]) => pid !== p.id);
    body.append(
      section(
        'Complete the look',
        h(
          'div',
          { class: 'list' },
          others.map(([pid, ci]) => productRow(NY.byId[pid], { ci })),
        ),
      ),
    );
  }

  // Details
  const fab = NY.FABRIC_INFO[p.fabric];
  const specs = h('dl', { class: 'specs' });
  const addSpec = (k, v) => specs.append(h('dt', null, k), h('dd', null, v));
  addSpec('Fabric', fab.n);
  addSpec('Feel', fab.feel);
  if (!isDup) {
    addSpec('Fit', NY.FIT_LABEL[p.fit]);
    const lenEl = h('span', { class: 'mono', id: 'spec-len' });
    const chestEl = h('span', { class: 'mono', id: 'spec-chest' });
    addSpec('Length', lenEl);
    addSpec('Garment chest', chestEl);
    const drawSpecs = () => {
      const sp = NY.specFor(p, d.si, d.ci);
      lenEl.textContent = Math.round(sp.dims.length * 100) + ' cm (size ' + sizes[d.si][0] + ')';
      chestEl.textContent = Math.round(sp.dims.chest * 100) + ' cm';
    };
    drawSpecs();
    d._drawSpecs = drawSpecs;
  } else addSpec('Size', p.dims.length + ' m × ' + p.dims.width + ' m');
  addSpec('Care', fab.care);
  addSpec('Code', h('span', { class: 'mono' }, 'TA-' + p.id.toUpperCase()));
  body.append(section('Details', h('p', { class: 'pd-desc' }, p.desc), specs));

  // Alteration
  if (!isDup) {
    const alt = h('input', { type: 'checkbox', id: 'pd-alter' });
    alt.checked = d.alter;
    alt.addEventListener('change', () => {
      d.alter = alt.checked;
    });
    body.append(
      section(
        'Alteration',
        h(
          'label',
          { class: 'opt', for: 'pd-alter' },
          alt,
          h(
            'span',
            { class: 'opt-text' },
            h('span', { class: 'opt-name' }, 'Hem or sleeve alteration'),
            h('span', { class: 'opt-desc' }, 'Free on full-price pieces. Ready in 2 days at the showroom.'),
          ),
          h('span', { class: 'opt-price' }, 'Free'),
        ),
      ),
    );
  }

  const acts = h('div', { class: 'pd-actions' });
  if (S.has3D) acts.append(btn('Show in store', { icon: 'locate', onclick: () => locate(p.id, d.ci) }));
  body.append(acts);

  // Footer
  const addBtn = btn('Add to bag', { primary: true, icon: 'bag', id: 'add-to-bag' });
  const sizeNote = h('small', null);
  const foot = h(
    'div',
    { class: 'foot-row' },
    h('div', { class: 'foot-total' }, h('span', { class: 'price' }, money(p.price)), sizeNote),
    addBtn,
  );
  const drawNote = () => {
    sizeNote.textContent = isDup ? 'Free size' : 'Size ' + sizes[d.si][0] + ' · ' + NY.colorOf(p, d.ci).n;
  };
  drawNote();
  addBtn.addEventListener('click', () => {
    addToBag(p, d);
    addBtn.replaceChildren(ic('check'), h('span', null, 'Added'));
    setTimeout(() => {
      if (document.contains(addBtn)) addBtn.replaceChildren(ic('bag'), h('span', null, 'Add to bag'));
    }, 1600);
  });

  function viewerLayers() {
    const ex = isDup ? { drape: d.drape } : null;
    if (d.look && d.look.length > 1)
      return d.look.map(([pid, ci]) => {
        const q = NY.byId[pid];
        return [pid, pid === p.id ? d.ci : ci, pid === p.id ? d.si : sizeFor(q), pid === p.id ? ex : null];
      });
    if (layered) {
      const base = NY.BASES[kind === 'men' ? 'men' : 'women'];
      return [
        [
          'base:' + (kind === 'men' ? 'men' : 'women'),
          0,
          NY.recommendSize(base, NY.userBody(base.kind) ? girthOf(NY.userBody(base.kind)) : mannequinChest(base.kind)),
          null,
        ],
        [p.id, d.ci, d.si, ex],
      ];
    }
    return [[p.id, d.ci, d.si, null]];
  }
  const viewerKind = () =>
    d.look && d.look.length > 1 ? NY.byId[d.look[0][0]].kind : layered ? (kind === 'men' ? 'men' : 'women') : p.kind;
  function refreshViewer() {
    drawNote();
    if (d._drawSpecs) d._drawSpecs();
    if (api()) api().updateViewer({ layers: viewerLayers(), kind: viewerKind() });
  }

  return {
    title: p.name,
    body,
    foot,
    mount() {
      if (api()) {
        const ok = api().mountViewer(viewer, { layers: viewerLayers(), kind: viewerKind(), mode: d.mode });
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
function addToBag(p, d) {
  const cfg = { size: p.type === 'dupatta' ? 0 : d.si, alter: !!d.alter };
  const unit = NY.priceOf(p, cfg);
  const key = p.id + '|' + d.ci + '|' + cfg.size + '|' + (cfg.alter ? 1 : 0);
  const ex = S.cart.find((l) => l.key === key);
  if (ex) ex.qty = Math.min(12, ex.qty + 1);
  else S.cart.push({ key, pid: p.id, ci: d.ci, cfg, qty: 1, unit });
  saveCart();
  updateBadge();
  toast('Added ' + p.name + (p.type === 'dupatta' ? '' : ', size ' + NY.SIZES[p.kind][cfg.size][0]) + ' to your bag');
}
NY.addToBag = (pid, ci, si) => addToBag(NY.byId[pid], { ci, si });

/* ---------- View: browse a section ---------- */
VIEWS.browse = function (d) {
  const z = NY.zoneById(d.zone);
  const items = NY.PRODUCTS.filter((p) => p.zone === d.zone);
  const body = h('div', { class: 'stack' });
  body.append(h('p', { class: 'lede' }, z.blurb));
  const cats = [...new Set(items.map((p) => p.cat))];
  const list = h('div', { class: 'list' });
  let filter = d.filter || 'all';
  function draw() {
    list.replaceChildren(...items.filter((p) => filter === 'all' || p.cat === filter).map((p) => productRow(p)));
  }
  if (cats.length > 1) {
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by category' });
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
    chips.append(mk('all', 'All'), ...cats.map((c) => mk(c, NY.CAT_LABEL[c])));
    body.append(chips);
  }
  draw();
  body.append(list);
  return { title: z.name, body };
};

/* ---------- View: the Festive Edit looks ---------- */
VIEWS.looks = function () {
  const body = h('div', { class: 'stack' });
  body.append(h('p', { class: 'lede' }, NY.zoneById('festive').blurb));
  NY.MERCH.festive.forEach((look, i) => {
    const main = NY.byId[look.pieces[0][0]];
    const total = look.pieces.reduce((a, [pid]) => a + NY.byId[pid].price, 0);
    const card = h(
      'div',
      { class: 'look-card' },
      h(
        'div',
        { class: 'look-art' },
        look.pieces.map(([pid, ci]) => h('span', { html: NY.garmentSVG(NY.byId[pid], ci, 64, 78) })),
      ),
      h(
        'div',
        { class: 'look-main' },
        h(
          'p',
          { class: 'eyebrow' },
          'Look ' + (i + 1) + ' · ' + look.pieces.length + (look.pieces.length === 1 ? ' piece' : ' pieces'),
        ),
        h('b', null, look.pieces.map(([pid]) => NY.byId[pid].name).join(' + ')),
        h('span', { class: 'row-meta' }, money(total) + ' for the look'),
        h(
          'div',
          { class: 'card-actions' },
          btn('View the look', {
            cls: 'small',
            onclick: () => openSheet('product', { pid: main.id, ci: look.pieces[0][1], look: look.pieces }, true),
          }),
          btn('Try it on', {
            cls: 'small',
            icon: 'camera',
            onclick: () => openTryOn({ pid: main.id, ci: look.pieces[0][1], look: look.pieces, drape: look.drape }),
          }),
        ),
      ),
    );
    body.append(card);
  });
  return { title: 'Festive Edit', body };
};

/* ---------- View: search ---------- */
const QUICK = [
  ['kurta', 'Kurtas', (p) => p.cat === 'kurta'],
  ['anarkali', 'Anarkalis', (p) => p.cat === 'anarkali'],
  ['dress', 'Dresses', (p) => p.cat === 'dress'],
  ['shirt', 'Shirts', (p) => p.cat === 'shirt'],
  ['tee', 'Tees', (p) => p.cat === 'tee'],
  ['jacket', 'Jackets', (p) => p.cat === 'jacket'],
  ['dupatta', 'Dupattas', (p) => p.type === 'dupatta'],
  ['chikan', 'Chikankari', (p) => p.pattern === 'chikan'],
  ['silk', 'Silk', (p) => p.fabric === 'silk'],
  ['under', 'Under ₹1,500', (p) => p.price < 1500],
  ['kids', 'Kids', (p) => p.kind === 'kids'],
  ['men', 'Men', (p) => p.kind === 'men'],
];
function haystack(p) {
  const parts = [
    p.name,
    p.desc,
    NY.zoneById(p.zone).name,
    (p.tags || []).join(' '),
    NY.CAT_LABEL[p.cat] || '',
    NY.FABRIC_INFO[p.fabric].n,
    p.pattern,
  ];
  parts.push(p.colors.map((c) => c.n).join(' '));
  if (p.kind === 'kids') parts.push('kids children boys girls');
  if (p.kind === 'men') parts.push('men mens');
  if (p.kind === 'women') parts.push('women womens ladies');
  return parts.join(' ').toLowerCase();
}
VIEWS.search = function (d) {
  const body = h('div', { class: 'stack' });
  const input = h('input', {
    type: 'search',
    id: 'search-q',
    placeholder: 'Name, colour, fabric or style',
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
    const res = NY.PRODUCTS.filter((p) => (!qf || qf[2](p)) && words.every((w) => haystack(p).includes(w)));
    count.textContent = res.length
      ? res.length + (res.length === 1 ? ' match' : ' matches')
      : 'No matches. Try a style like “anarkali”, a colour like “indigo”, or a fabric like “linen”.';
    list.replaceChildren(...res.slice(0, 60).map((p) => productRow(p)));
  }
  input.addEventListener('input', run);
  run();
  body.append(field, chips, count, list);
  return {
    title: 'Find a style',
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
        h('span', null, S.zone === id ? 'You are here' : n ? n + zoneUnit(id) : z.blurb.split('.')[0]),
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

/* ---------- View: bag ---------- */
VIEWS.bag = function () {
  const body = h('div', { class: 'stack' });
  if (!S.cart.length) {
    body.append(
      h(
        'div',
        { class: 'empty' },
        h('p', { class: 'empty-title' }, 'Your bag is empty'),
        h('p', null, 'Tap any garment in the store, pick a size and add it here.'),
        h(
          'div',
          { class: 'empty-actions' },
          btn('Women · Ethnic', { onclick: () => openSheet('browse', { zone: 'ethnic' }, true) }),
          btn('Men’s wear', { onclick: () => openSheet('browse', { zone: 'mens' }, true) }),
          btn('Festive Edit', { onclick: () => openSheet('looks', {}, true) }),
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
          val,
          h(
            'button',
            {
              type: 'button',
              'aria-label': 'More',
              onclick: () => {
                if (l.qty < 12) {
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
          thumb(p, l.ci),
          h(
            'div',
            { class: 'line-main' },
            h(
              'div',
              { class: 'line-top' },
              h('b', null, p.name),
              h('span', { class: 'price sm' }, money(l.unit * l.qty)),
            ),
            h('p', { class: 'line-cfg' }, [NY.colorOf(p, l.ci).n, NY.cfgSummary(p, l.cfg)].filter(Boolean).join(' · ')),
            h('div', { class: 'line-acts' }, q, rm),
          ),
        );
      }),
    );
    const sub = S.cart.reduce((a, l) => a + l.unit * l.qty, 0);
    totals.replaceChildren(
      h('div', null, h('span', null, 'Subtotal'), h('span', null, money(sub))),
      h('div', null, h('span', null, 'Delivery'), h('span', null, sub >= 999 ? 'Free' : money(79))),
      h('div', { class: 'grand' }, h('span', null, 'Total'), h('span', null, money(sub + (sub >= 999 ? 0 : 79)))),
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
      'Prices include GST. Free delivery over ₹999. 15-day exchange, store credit or refund.',
    ),
  );
  const foot = h(
    'div',
    { class: 'foot-row' },
    btn('Continue shopping', { onclick: closeSheet }),
    btn('Checkout', { primary: true, icon: 'arrow', onclick: () => openSheet('checkout', {}, true) }),
  );
  return { title: 'Your bag', body, foot };
};
const bagTotal = () => {
  const sub = S.cart.reduce((a, l) => a + l.unit * l.qty, 0);
  return sub + (sub >= 999 ? 0 : 79);
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
        { id: 'home', n: 'Home delivery', d: 'Arrives in 3 to 5 days.', pl: sub >= 999 ? 'Free' : 'Included' },
        { id: 'store', n: 'Pick up at the showroom', d: 'Ready in 2 days. Try it on at the counter.', pl: 'Free' },
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
      h(
        'div',
        null,
        h('span', null, p.name + (l.qty > 1 ? ' × ' + l.qty : '')),
        h('span', null, money(l.unit * l.qty)),
      ),
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
        'No payment is taken and no order is created. In the live store, the payment gateway (for example Razorpay) opens at this step.',
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
      h('small', null, S.cart.reduce((a, l) => a + l.qty, 0) + ' items'),
    ),
    btn('Place demo order', {
      primary: true,
      icon: 'check',
      onclick: () => {
        const ref = 'TA-DEMO-' + String(Math.floor(1000 + Math.random() * 9000));
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

/* ---------- View: alteration booking (demo) ---------- */
VIEWS.alter = function (d) {
  const body = h('div', { class: 'stack' });
  body.append(
    h(
      'p',
      { class: 'lede' },
      'Our tailor shortens hems and sleeves, takes in side seams and adds dupatta tassels. Free on full-price pieces; most jobs are ready in 2 days.',
    ),
  );
  const days = [];
  const now = new Date();
  for (let i = 1; i <= 6; i++) days.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i));
  d.day = d.day == null ? 0 : d.day;
  d.slot = d.slot || '12:00';
  d.job = d.job || 'hem';
  const msg = h('p', { class: 'notice ok', role: 'status', hidden: true });
  const jobs = radioGroup(
    'aj',
    'What needs doing',
    [
      { id: 'hem', n: 'Hem length', d: 'Kurtas, dresses and anarkalis.', pl: 'Free' },
      { id: 'sleeve', n: 'Sleeve length', d: 'Shorten or taper.', pl: 'Free' },
      { id: 'fit', n: 'Take in or let out', d: 'Side seams, up to 4 cm.', pl: '₹250' },
      { id: 'tassel', n: 'Dupatta tassels', d: 'Hand-tied silk tassels.', pl: '₹350' },
    ],
    d.job,
    (v) => {
      d.job = v;
      msg.hidden = true;
    },
  );
  const dayChips = chipGroup(
    'al-day',
    'Day',
    days.map((t, i) => ({
      id: i,
      n: t.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
    })),
    d.day,
    (v) => {
      d.day = v;
      msg.hidden = true;
    },
  );
  const slotChips = chipGroup(
    'al-slot',
    'Time',
    ['11:30', '13:00', '15:30', '17:00', '19:30'].map((s) => ({ id: s, n: s })),
    d.slot,
    (v) => {
      d.slot = v;
      msg.hidden = true;
    },
  );
  const name = h('input', { type: 'text', id: 'al-name', autocomplete: 'name', placeholder: 'Your name' });
  const phone = h('input', {
    type: 'tel',
    id: 'al-phone',
    autocomplete: 'tel',
    inputmode: 'tel',
    placeholder: 'Mobile number',
  });
  name.value = d.name || '';
  phone.value = d.phone || '';
  name.addEventListener('input', () => (d.name = name.value));
  phone.addEventListener('input', () => (d.phone = phone.value));
  const form = h(
    'form',
    { class: 'stack', novalidate: true },
    jobs,
    section('Day', dayChips),
    section('Time', slotChips),
    h(
      'div',
      { class: 'fields' },
      h('label', { class: 'field', for: 'al-name' }, h('span', null, 'Name'), name),
      h('label', { class: 'field', for: 'al-phone' }, h('span', null, 'Mobile'), phone),
    ),
    btn('Request this slot', { primary: true, cls: 'block', id: 'al-submit' }),
    msg,
  );
  form.querySelector('#al-submit').type = 'submit';
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = days[d.day];
    msg.textContent =
      'Fitting noted for ' +
      t.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) +
      ' at ' +
      d.slot +
      '. This is a demo, so no booking was made.';
    msg.hidden = false;
  });
  body.append(form);
  return { title: 'Book an alteration', body };
};

/* ---------- View: drape guide ---------- */
VIEWS.drapeguide = function () {
  const body = h('div', { class: 'stack' });
  body.append(h('p', { class: 'lede' }, 'Two easy ways to wear a dupatta or stole. Both are in the try-on.'));
  const guide = (rows) =>
    h(
      'div',
      { class: 'guide' },
      rows.map(([n, t]) => h('div', { class: 'guide-row' }, h('b', null, n), h('span', null, t), h('span'))),
    );
  body.append(
    section(
      'Drapes',
      guide([
        [
          'Stole',
          'Lay the middle behind your neck and let both ends fall in front, over the shoulders. Good with straight kurtas and jackets.',
        ],
        [
          'One shoulder',
          'Pleat one end over the left shoulder: a short end in front, a long end behind. Good with anarkalis and festive wear.',
        ],
      ]),
    ),
  );
  body.append(
    section(
      'How fabrics hang',
      guide(
        Object.values(NY.FABRIC_INFO)
          .filter((f) => ['Silk', 'Chiffon', 'Cotton', 'Georgette'].includes(f.n))
          .map((f) => [f.n, f.feel + '. ' + f.care]),
      ),
    ),
  );
  return { title: 'Drape guide', body };
};

/* ---------- View: size guide ---------- */
VIEWS.sizeguide = function (d) {
  const kind = d.kind || 'women';
  const body = h('div', { class: 'stack' });
  body.append(
    h(
      'p',
      { class: 'lede' },
      'Measure around the fullest part of your chest, with the tape level and snug but not tight. Pick the size whose body chest is closest.',
    ),
  );
  const tabs = chipGroup(
    'sg',
    'Size chart',
    [
      { id: 'women', n: 'Women' },
      { id: 'men', n: 'Men' },
      { id: 'kids', n: 'Kids' },
    ],
    kind,
    (v) => {
      d.kind = v;
      drawTable(v);
    },
  );
  const tableBox = h('div', { class: 'size-table-wrap' });
  const p = d.pid ? NY.byId[d.pid] : null;
  function drawTable(k) {
    const rows = NY.SIZES[k];
    const head = ['Size', 'Body chest'];
    if (p && p.kind === k) head.push('This garment', 'Length');
    const t = h(
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
    );
    const tb = h('tbody');
    rows.forEach(([n, c], i) => {
      const cells = [
        h('th', { scope: 'row' }, n),
        h('td', null, Math.round(c * 100) + ' cm · ' + Math.round((c * 100) / 2.54) + ' in'),
      ];
      if (p && p.kind === k) {
        const sp = NY.specFor(p, i, 0);
        cells.push(
          h('td', null, Math.round(sp.dims.chest * 100) + ' cm'),
          h('td', null, Math.round(sp.dims.length * 100) + ' cm'),
        );
      }
      tb.append(h('tr', null, cells));
    });
    t.append(tb);
    tableBox.replaceChildren(t);
  }
  drawTable(kind);
  body.append(tabs, tableBox);
  body.append(
    h(
      'p',
      { class: 'field-note' },
      'Garment chest includes the ease for each cut: fitted pieces have about 5 cm of room, relaxed pieces about 15 cm.',
    ),
    btn('Save my measurements', { icon: 'tape', cls: 'block', onclick: () => openSheet('measure', { kind }, true) }),
  );
  return { title: 'Size guide', body };
};

/* ---------- View: my measurements ---------- */
VIEWS.measure = function (d) {
  const cur = Object.assign({ kind: d.kind && d.kind !== 'free' ? d.kind : 'women' }, S.body || {});
  if (d.kind && d.kind !== 'free') cur.kind = d.kind;
  const body = h('div', { class: 'stack' });
  body.append(
    h(
      'p',
      { class: 'lede' },
      'Add your height and chest so the mannequin and the size advice match your body. The numbers stay on this device.',
    ),
  );
  const kindChips = chipGroup(
    'ms-kind',
    'Body',
    [
      { id: 'women', n: 'Women' },
      { id: 'men', n: 'Men' },
      { id: 'kids', n: 'Kids' },
    ],
    cur.kind,
    (v) => {
      cur.kind = v;
    },
  );
  const field = (id, label, ph, min, max) => {
    const inp = h('input', {
      type: 'number',
      id: 'ms-' + id,
      inputmode: 'decimal',
      min,
      max,
      step: '0.5',
      placeholder: ph,
    });
    inp.value = cur[id] || '';
    inp.addEventListener('input', () => {
      cur[id] = inp.value;
      err.hidden = true;
    });
    return h('label', { class: 'field', for: 'ms-' + id }, h('span', null, label), inp);
  };
  const err = h('p', { class: 'field-error', role: 'alert', hidden: true });
  body.append(
    section('Body', kindChips),
    h(
      'div',
      { class: 'fields two' },
      field('height', 'Height (cm)', '162', 90, 220),
      field('chest', 'Chest (cm)', '88', 50, 160),
      field('waist', 'Waist (cm)', '72', 40, 160),
      field('hip', 'Hip (cm)', '96', 50, 180),
    ),
    err,
    h('p', { class: 'field-note' }, 'Height and chest are enough. Waist and hip refine the mannequin.'),
  );
  const save = btn('Save measurements', {
    primary: true,
    icon: 'check',
    onclick: () => {
      const hgt = parseFloat(cur.height),
        ch = parseFloat(cur.chest);
      if (!(hgt >= 90 && hgt <= 220) || !(ch >= 50 && ch <= 160)) {
        err.textContent = 'Enter a height from 90 to 220 cm and a chest from 50 to 160 cm.';
        err.hidden = false;
        return;
      }
      S.body = {
        kind: cur.kind,
        height: hgt,
        chest: ch,
        waist: parseFloat(cur.waist) || null,
        hip: parseFloat(cur.hip) || null,
      };
      store.set('taana-body', S.body);
      toast('Measurements saved on this device');
      backSheet();
    },
  });
  const clear = btn('Clear', {
    onclick: () => {
      S.body = null;
      store.set('taana-body', null);
      toast('Measurements cleared');
      backSheet();
    },
  });
  const foot = h('div', { class: 'foot-row' }, S.body ? clear : h('span'), save);
  return { title: 'My measurements', body, foot };
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
          h('b', null, walkHint().replace(' to walk', '')),
          h(
            'span',
            null,
            'Walk to that spot. The route goes around fixtures and never behind counters. Click or tap while walking to stop.',
          ),
        ),
        h(
          'li',
          null,
          h('b', null, 'Drag'),
          h('span', null, 'Look around. Pinch or scroll to zoom in on a rail. Look speed is set below.'),
        ),
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
      { id: 'high', n: 'High', d: 'Sharper with soft shadows. Uses more battery.' },
      { id: 'low', n: 'Battery saver', d: 'Lower resolution, no shadows, fewer live garments.' },
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
      'This is a prototype with sample stock and prices. Garments are cloth simulations built from their size charts; replace the catalogue and branding with the client’s own.',
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
  if (w.x < NY.L.x0 || w.x > NY.L.x1 || w.z < NY.L.z0 || w.z > NY.L.z1) return;
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
}, 25000);

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
    const st = $('#status');
    st.classList.remove('warn');
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
   CAMERA TRY-ON (loaded on demand, so the store opens fast)
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
        addToBag(pid, ci, si) {
          addToBag(NY.byId[pid], { ci, si });
        },
        openProduct(pid, ci) {
          openSheet('product', { pid, ci });
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
$('#bb-info').addEventListener('click', () => openSheet('info'));

$('#welcome-lede').textContent =
  'Eleven sections and ' +
  NY.PRODUCTS.length +
  ' styles. Every garment is a cloth simulation: watch it move on the mannequins, then try it on with your camera.';
setZoneName('welcome');
updateBadge();
drawMinimap();
requestAnimationFrame(drawMinimap);
