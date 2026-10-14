// Showroom interface: welcome, section cards, guided tour, detail sheet, search, bag, checkout and floor plan.
import { NY } from '../core/ny.js';
import '../data/store-layout.js';
import '../data/frames.js';
import '../data/catalogue.js';
import { money, $, h, ic, store, esc } from '../lib/dom.js';
import { drawYou } from '../lib/drawings.js';

const RM = NY.reduceMotion;
void esc;

/* =====================================================================
   UI STATE
   ===================================================================== */
const S = {
  cart: (store.get('ny-bag-v1', []) || []).filter((l) => l && NY.byId[l.pid]),
  stack: [],
  zone: 'welcome',
  has3D: false,
  failed: false,
  tour: { on: false, i: 0, playing: !RM, timer: null, arrived: false },
  pendingTour: false,
  lastFocus: null,
  cardDismissed: null,
};
S.settings = Object.assign({ move: RM ? 'jump' : 'walk', quality: 'auto', labels: true }, store.get('ny-settings', {}));
NY.settings = S.settings;
const saveCart = () =>
  store.set(
    'ny-bag-v1',
    S.cart.map((l) => ({ key: l.key, pid: l.pid, ci: l.ci, cfg: l.cfg, qty: l.qty, unit: l.unit })),
  );
const saveSettings = () => store.set('ny-settings', S.settings);

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
function hideWelcome(showHint) {
  const w = $('#welcome');
  if (w.hidden) return;
  w.hidden = true;
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
  const z = NY.zoneById(id);
  $('#zone-name').textContent = z ? z.name : 'Showroom floor';
}
NY.onZoneChange = (id) => {
  S.zone = id;
  setZoneName(id);
  drawMinimap();
};

/* ---------- Zone card ---------- */
function zoneCount(id) {
  return NY.PRODUCTS.filter((p) => p.zone === id).length;
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
  const z = NY.zoneById(id),
    card = $('#zonecard');
  if (!z) {
    card.hidden = true;
    return;
  }
  const idx = NY.TOUR.indexOf(z.id) + 1;
  let eb = 'Section ' + idx + ' of ' + NY.TOUR.length;
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
NY.onProductTap = (pid, ci) => {
  hideWelcome(false);
  pauseTour();
  openSheet('product', { pid, ci });
};
NY.onFeatureTap = (action) => {
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
  } else teardown();
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
  return p.type === 'frame' ? money(p.price) : 'from ' + money(Math.min(...p.packs.map((x) => x.p)));
}
function metaLine(p) {
  if (p.type !== 'frame') return p.type === 'care' ? 'Lens care' : 'Contact lenses';
  return NY.SHAPE_LABEL[NY.ARCH[p.arch].shape] + ' · ' + p.mat;
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
    h('span', { class: 'thumb', html: NY.frameSVG(p, 0, 96, 40) }),
    h(
      'span',
      { class: 'row-main' },
      h('span', { class: 'row-name' }, p.name),
      h('span', { class: 'row-meta' }, metaLine(p)),
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
      onclick: () => locate(p.id, 0),
    });
    lb.append(ic('locate'));
    row.append(lb);
  } else row.classList.add('no-locate');
  return row;
}

/* ---------- View: product ---------- */
VIEWS.product = function (d) {
  const p = NY.byId[d.pid];
  if (d.ci == null) d.ci = 0;
  d.ci =
    ((d.ci % (p.colors ? p.colors.length : 1)) + (p.colors ? p.colors.length : 1)) % (p.colors ? p.colors.length : 1);
  d.cfg = d.cfg || NY.defaultCfg(p);
  d.qty = d.qty || 1;
  d.rx = d.rx || { r: {}, l: {}, pd: '' };
  const frame = p.type === 'frame';
  const body = h('div', { class: 'pd' });

  const viewer = h('div', { class: 'viewer' });
  const art = h('div', { class: 'viewer-art', html: NY.frameSVG(p, d.ci, 320, 130) });
  viewer.append(art);
  if (frame)
    viewer.append(h('span', { class: 'viewer-hint', id: 'viewer-hint' }, S.has3D ? 'Drag to turn' : 'Front view'));
  body.append(viewer);

  const zone = NY.zoneById(p.zone);
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
    const name = h('span', { class: 'swatch-name', id: 'swatch-name' }, NY.colorOf(p, d.ci).n);
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
        art.innerHTML = NY.frameSVG(p, i, 320, 130);
        if (api()) api().setViewerColor(i);
      });
      group.append(b);
    });
    body.append(section('Colour', group, name));
  }

  // Configurator
  const cfgBox = h('div', { class: 'cfg' });
  body.append(cfgBox);

  // Details
  if (frame) {
    const a = NY.ARCH[p.arch];
    const hash = [...p.id].reduce((x, ch) => x + ch.charCodeAt(0), 0);
    const specs = h(
      'dl',
      { class: 'specs' },
      h('dt', null, 'Shape'),
      h('dd', null, NY.SHAPE_LABEL[a.shape]),
      h('dt', null, 'Material'),
      h('dd', null, p.mat),
      h('dt', null, 'Size'),
      h('dd', null, h('span', { class: 'mono' }, p.size[0] + '□' + p.size[1] + '-' + p.size[2])),
      h('dt', null, 'Weight'),
      h('dd', null, p.weight + ' g'),
      h('dt', null, 'Suits faces'),
      h('dd', null, NY.FACES[a.shape].join(', ')),
      h('dt', null, 'Rim'),
      h('dd', null, a.style === 'combo' ? 'Browline, full rim' : 'Full rim'),
      h('dt', null, 'Stock'),
      h('dd', null, hash % 4 === 0 ? 'Only 2 left in this colour' : 'In stock at this showroom'),
      h('dt', null, 'Code'),
      h('dd', null, h('span', { class: 'mono' }, 'NY-' + p.id.toUpperCase() + '-' + p.size[0])),
    );
    body.append(section('Details', h('p', { class: 'pd-desc' }, p.desc), specs));
    body.append(
      section(
        'Size guide',
        h('div', { class: 'sizeguide', html: NY.sizeSVG(p) }),
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
  if (S.has3D) acts.append(btn('Show in store', { icon: 'locate', onclick: () => locate(p.id, d.ci) }));
  if (frame) acts.append(btn('Book a free eye test', { icon: 'eye', onclick: () => openSheet('eyetest', {}, true) }));
  body.append(acts);

  // Footer
  const totalEl = h('span', { class: 'price' });
  const noteEl = h('small', null);
  const addBtn = btn('Add to bag', { primary: true, icon: 'bag', id: 'add-to-bag' });
  const foot = h('div', { class: 'foot-row' }, h('div', { class: 'foot-total' }, totalEl, noteEl), addBtn);

  function refreshTotal() {
    const unit = NY.priceOf(p, d.cfg);
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
    const rules = NY.lensRules(p);
    if (rules.mode === 'sun') {
      cfgBox.append(
        radioGroup(
          'sl',
          'Lenses',
          NY.LENS.sun.map((o) => ({
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
          NY.LENS.types
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
          NY.LENS.index
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
          NY.LENS.coats.map((t) => ({
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
    if (NY.needsRx(p, d.cfg)) {
      cfgBox.append(
        radioGroup(
          'rx',
          'Prescription',
          NY.LENS.rx.map((o) => ({ id: o.id, n: o.n, d: o.d })),
          d.cfg.rx,
          (v) => {
            d.cfg.rx = v;
            renderCfg();
          },
        ),
      );
      if (d.cfg.rx === 'now') cfgBox.append(rxForm(d, NY.needsAdd(p, d.cfg)));
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

  addBtn.addEventListener('click', () => {
    if (frame && NY.needsRx(p, d.cfg) && d.cfg.rx === 'now') {
      const errs = validateRx(d.rx, NY.needsAdd(p, d.cfg));
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
    addToBag(p, d);
    addBtn.replaceChildren(ic('check'), h('span', null, 'Added'));
    setTimeout(() => {
      if (document.contains(addBtn)) addBtn.replaceChildren(ic('bag'), h('span', null, 'Add to bag'));
    }, 1600);
    if (frame && NY.needsRx(p, d.cfg) && d.cfg.rx === 'test') openSheet('eyetest', {}, true);
  });

  return {
    title: p.name,
    body,
    foot,
    mount() {
      if (frame && api()) {
        const ok = api().mountViewer(viewer, p.id, d.ci);
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
  for (const eye of ['r', 'l']) {
    grid.append(h('span', { class: 'rx-eye' }, eye === 'r' ? 'Right' : 'Left'));
    for (const f of fields) {
      const id = 'rx-' + eye + '-' + f[0];
      const inp = h('input', {
        type: 'number',
        id,
        inputmode: 'decimal',
        step: f[4],
        min: f[2],
        max: f[3],
        placeholder: f[1],
        'aria-label': (eye === 'r' ? 'Right' : 'Left') + ' eye ' + f[0].toUpperCase(),
      });
      inp.value = d.rx[eye][f[0]] != null ? d.rx[eye][f[0]] : '';
      inp.addEventListener('input', () => {
        d.rx[eye][f[0]] = inp.value;
        const e = $('#rx-err');
        if (e) e.hidden = true;
      });
      grid.append(inp);
    }
  }
  const pd = h('input', {
    type: 'number',
    id: 'rx-pd',
    inputmode: 'decimal',
    step: '0.5',
    min: '50',
    max: '76',
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
    h('label', { class: 'rx-pd', for: 'rx-pd' }, h('span', null, 'Pupillary distance (PD), mm'), pd),
    h('p', { class: 'field-error', id: 'rx-err', role: 'alert', hidden: true }),
    h(
      'p',
      { class: 'field-note' },
      'Values stay on this device for this order only. Leave CYL empty if your prescription has none.',
    ),
  );
  return wrap;
}
function validateRx(rx, needAdd) {
  const errs = [];
  const q = (v) => Math.abs(v * 4 - Math.round(v * 4)) < 1e-6;
  for (const eye of ['r', 'l']) {
    const E = eye === 'r' ? 'Right' : 'Left',
      v = rx[eye] || {};
    if (v.sph === undefined || v.sph === '') {
      errs.push(E + ' eye: enter SPH (use 0.00 if blank on your prescription).');
      continue;
    }
    const sph = parseFloat(v.sph);
    if (isNaN(sph) || sph < -20 || sph > 12 || !q(sph))
      errs.push(E + ' eye: SPH runs from -20.00 to +12.00 in 0.25 steps.');
    const cyl = v.cyl === '' || v.cyl == null ? 0 : parseFloat(v.cyl);
    if (isNaN(cyl) || cyl < -6 || cyl > 0 || !q(cyl)) errs.push(E + ' eye: CYL runs from -6.00 to 0.00 in 0.25 steps.');
    else if (cyl !== 0) {
      const ax = parseFloat(v.axis);
      if (isNaN(ax) || ax < 1 || ax > 180 || Math.round(ax) !== ax)
        errs.push(E + ' eye: AXIS is a whole number from 1 to 180 when CYL is set.');
    }
    if (needAdd) {
      const ad = parseFloat(v.add);
      if (isNaN(ad) || ad < 0.75 || ad > 3.5 || !q(ad))
        errs.push(E + ' eye: ADD runs from +0.75 to +3.50 for bifocal and progressive lenses.');
    }
  }
  const pd = parseFloat(rx.pd);
  if (isNaN(pd) || pd < 50 || pd > 76) errs.push('PD: enter a value from 50 to 76 mm.');
  return errs;
}
NY.validateRx = validateRx;
function addToBag(p, d) {
  const cfg = JSON.parse(JSON.stringify(d.cfg));
  if (p.type === 'frame' && !NY.needsRx(p, cfg)) delete cfg.rx;
  const unit = NY.priceOf(p, cfg),
    qty = p.type === 'frame' ? 1 : d.qty;
  const key = p.id + '|' + d.ci + '|' + JSON.stringify(cfg);
  const ex = S.cart.find((l) => l.key === key);
  if (ex) ex.qty = Math.min(12, ex.qty + qty);
  else S.cart.push({ key, pid: p.id, ci: d.ci, cfg, qty, unit });
  saveCart();
  updateBadge();
  toast('Added ' + p.name + ' to your bag');
}

/* ---------- View: browse a section ---------- */
VIEWS.browse = function (d) {
  const z = NY.zoneById(d.zone);
  const items = NY.PRODUCTS.filter((p) => p.zone === d.zone);
  const body = h('div', { class: 'stack' });
  body.append(h('p', { class: 'lede' }, z.blurb));
  const shapes = [...new Set(items.filter((p) => p.type === 'frame').map((p) => NY.ARCH[p.arch].shape))];
  const list = h('div', { class: 'list' });
  let filter = d.filter || 'all';
  function draw() {
    list.replaceChildren(
      ...items
        .filter((p) => filter === 'all' || (p.type === 'frame' && NY.ARCH[p.arch].shape === filter))
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
    chips.append(mk('all', 'All'), ...shapes.map((s) => mk(s, NY.SHAPE_LABEL[s])));
    body.append(chips);
  }
  draw();
  body.append(list);
  return { title: z.name, body };
};

/* ---------- View: search ---------- */
const QUICK = [
  ['round', 'Round', (p) => p.type === 'frame' && NY.ARCH[p.arch].shape === 'round'],
  ['cateye', 'Cat-eye', (p) => p.type === 'frame' && NY.ARCH[p.arch].shape === 'cateye'],
  ['titanium', 'Titanium', (p) => p.type === 'frame' && /titanium/i.test(p.mat)],
  ['polar', 'Polarised', (p) => !!p.polar],
  ['under', 'Under ₹2,500', (p) => p.type === 'frame' && p.price < 2500],
  ['kids', 'Kids', (p) => p.zone === 'kids'],
  ['contacts', 'Contact lenses', (p) => p.type === 'contacts'],
];
function haystack(p) {
  const parts = [p.name, p.desc, NY.zoneById(p.zone).name, (p.tags || []).join(' ')];
  if (p.type === 'frame')
    parts.push(
      NY.SHAPE_LABEL[NY.ARCH[p.arch].shape],
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
    const res = NY.PRODUCTS.filter((p) => (!qf || qf[2](p)) && words.every((w) => haystack(p).includes(w)));
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
  const list = h('div', { class: 'list' });
  const totals = h('div', { class: 'totals' });
  function draw() {
    list.replaceChildren(
      ...S.cart.map((l, idx) => {
        const p = NY.byId[l.pid];
        const col = p.type === 'frame' ? NY.colorOf(p, l.ci).n : '';
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
          h('span', { class: 'thumb', html: NY.frameSVG(p, l.ci, 96, 40) }),
          h(
            'div',
            { class: 'line-main' },
            h(
              'div',
              { class: 'line-top' },
              h('b', null, p.name),
              h('span', { class: 'price sm' }, money(l.unit * l.qty)),
            ),
            h('p', { class: 'line-cfg' }, [col, NY.cfgSummary(p, l.cfg)].filter(Boolean).join(' · ')),
            h('div', { class: 'line-acts' }, q, rm),
          ),
        );
      }),
    );
    const sub = S.cart.reduce((a, l) => a + l.unit * l.qty, 0);
    totals.replaceChildren(
      h('div', null, h('span', null, 'Subtotal'), h('span', null, money(sub))),
      h('div', null, h('span', null, 'Delivery'), h('span', null, 'Free')),
      h('div', { class: 'grand' }, h('span', null, 'Total'), h('span', null, money(sub))),
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
      'Prices include GST. Every order comes with a free fitting and a 7-day exchange on frames.',
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

/* ---------- View: checkout (demo) ---------- */
VIEWS.checkout = function (d) {
  d.delivery = d.delivery || 'home';
  const body = h('div', { class: 'stack' });
  const sub = S.cart.reduce((a, l) => a + l.unit * l.qty, 0);
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
        const ref = 'NY-DEMO-' + String(Math.floor(1000 + Math.random() * 9000));
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

/* ---------- View: eye test booking (demo) ---------- */
VIEWS.eyetest = function (d) {
  const body = h('div', { class: 'stack' });
  body.append(
    h(
      'p',
      { class: 'lede' },
      'A 20-minute test with an optometrist: vision on the Snellen chart, refraction, and a check of your current glasses. Free, with no obligation to buy.',
    ),
  );
  const days = [];
  const now = new Date();
  for (let i = 1; i <= 6; i++) {
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    days.push(t);
  }
  d.day = d.day == null ? 0 : d.day;
  d.slot = d.slot || '12:00';
  const dayChips = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Day' });
  days.forEach((t, i) => {
    const label = t.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    const c = h(
      'button',
      {
        class: 'chip',
        type: 'button',
        role: 'radio',
        id: 'et-day-' + i,
        'aria-checked': i === d.day ? 'true' : 'false',
      },
      label,
    );
    c.addEventListener('click', () => {
      d.day = i;
      dayChips.querySelectorAll('.chip').forEach((x, k) => x.setAttribute('aria-checked', k === i ? 'true' : 'false'));
      msg.hidden = true;
    });
    dayChips.append(c);
  });
  const slots = ['10:30', '12:00', '14:30', '16:00', '18:30'];
  const slotChips = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Time' });
  slots.forEach((s) => {
    const c = h(
      'button',
      {
        class: 'chip',
        type: 'button',
        role: 'radio',
        id: 'et-slot-' + s.replace(':', ''),
        'aria-checked': s === d.slot ? 'true' : 'false',
      },
      s,
    );
    c.addEventListener('click', () => {
      d.slot = s;
      slotChips.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-checked', x === c ? 'true' : 'false'));
      msg.hidden = true;
    });
    slotChips.append(c);
  });
  const name = h('input', { type: 'text', id: 'et-name', autocomplete: 'name', placeholder: 'Your name' });
  const phone = h('input', {
    type: 'tel',
    id: 'et-phone',
    autocomplete: 'tel',
    inputmode: 'tel',
    placeholder: 'Mobile number',
  });
  name.value = d.name || '';
  phone.value = d.phone || '';
  name.addEventListener('input', () => {
    d.name = name.value;
  });
  phone.addEventListener('input', () => {
    d.phone = phone.value;
  });
  const msg = h('p', { class: 'notice ok', role: 'status', hidden: true });
  const form = h(
    'form',
    { class: 'stack', novalidate: true },
    section('Day', dayChips),
    section('Time', slotChips),
    h(
      'div',
      { class: 'fields' },
      h('label', { class: 'field', for: 'et-name' }, h('span', null, 'Name'), name),
      h('label', { class: 'field', for: 'et-phone' }, h('span', null, 'Mobile'), phone),
    ),
    btn('Request this slot', { primary: true, cls: 'block', id: 'et-submit' }),
    msg,
  );
  form.querySelector('#et-submit').type = 'submit';
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = days[d.day];
    msg.textContent =
      'Slot noted for ' +
      t.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) +
      ' at ' +
      d.slot +
      '. This is a demo, so no booking was made.';
    msg.hidden = false;
  });
  body.append(form);
  return { title: 'Book a free eye test', body };
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
    NY.LENS.types.map((t) =>
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
    NY.LENS.coats.map((t) =>
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
  NY.LENS.index.forEach((t) => {
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
  const st = NY.STORE;
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
      { id: 'auto', n: 'Automatic', d: 'Adjusts to keep movement smooth.' },
      { id: 'high', n: 'High', d: 'Sharper with soft shadows. Uses more battery.' },
      { id: 'low', n: 'Battery saver', d: 'Lower resolution, no shadows.' },
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
  mm.m = NY.drawPlan(g, r.width, r.height, { colors: MC, current: S.zone, pad: 3 });
  drawYou(g, mm.m, mm.pose, { colors: MC, cone: r.width < 150 ? 16 : 24, dot: r.width < 150 ? 3.5 : 4.5 });
}
let mmQueued = false;
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

const nStyles = NY.PRODUCTS.filter((p) => p.type === 'frame').length;
$('#welcome-lede').textContent =
  'Ten sections, ' + nStyles + ' frame styles and a working bag. Every frame is drawn from its real millimetre size.';
setZoneName('welcome');
updateBadge();
drawMinimap();
requestAnimationFrame(drawMinimap);
