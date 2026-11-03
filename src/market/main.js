// The marketplace front page: one card per shop, a category filter, how many items wait in each shop's bag, and a
// "continue" link to the last shop visited. No 3D here, so the page is ready at once; each shop loads its own.
import '../styles/fonts.css';
import './market.css';

import { SHOPS, shopUrl, bagCount } from '../../shared/marketplace.js';
import { ICONS, ART } from './art.js';

const LAST_KEY = 'plexus-last-shop'; // id of the last shop opened from here; nothing personal
const FILTER_KEY = 'plexus-filter';

const $ = (s) => document.querySelector(s);
const storage = (() => {
  try {
    const k = '__plexus';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch (e) {
    return { getItem: () => null, setItem() {}, removeItem() {} };
  }
})();

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids) if (k != null && k !== false) e.append(k);
  return e;
}
const icon = (name, cls) =>
  el('span', { class: 'mk-i' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true', html: ICONS[name] });

/* ---------- Static icons and hero art ---------- */
document.querySelectorAll('[data-icon]').forEach((n) => {
  n.innerHTML = ICONS[n.dataset.icon];
  n.setAttribute('aria-hidden', 'true');
});
document.querySelectorAll('[data-art]').forEach((n) => (n.innerHTML = ART[n.dataset.art]));

/* ---------- Prefetch a shop's page when the visitor shows interest ---------- */
const prefetched = new Set();
function prefetch(shop) {
  if (prefetched.has(shop.id)) return;
  prefetched.add(shop.id);
  document.head.append(el('link', { rel: 'prefetch', href: shopUrl(shop) }));
}
function remember(shop) {
  try {
    storage.setItem(LAST_KEY, shop.id);
  } catch (e) {
    /* storage unavailable */
  }
}

/* ---------- Cards ---------- */
function card(shop) {
  const n = bagCount(storage, shop);
  const link = el(
    'a',
    {
      class: 'mk-card-link',
      href: shopUrl(shop),
      'aria-describedby': 'blurb-' + shop.id,
      onclick: () => remember(shop),
      onpointerenter: () => prefetch(shop),
      onfocus: () => prefetch(shop),
      ontouchstart: () => prefetch(shop),
    },
    shop.name,
  );
  return el(
    'li',
    {
      class: 'mk-card',
      'data-category': shop.category,
      style: '--a:' + shop.theme.a + ';--b:' + shop.theme.b + ';--k:' + shop.theme.ink,
    },
    el(
      'div',
      { class: 'mk-card-art', 'aria-hidden': 'true' },
      el('span', { class: 'mk-card-art-svg', html: ART[shop.id] }),
      n ? el('span', { class: 'mk-bag-badge' }, icon('bag'), n + (n === 1 ? ' item' : ' items')) : null,
    ),
    el(
      'div',
      { class: 'mk-card-body' },
      el('p', { class: 'mk-card-cat' }, shop.category),
      el('h3', { class: 'mk-card-title' }, link),
      el('p', { class: 'mk-card-tag' }, shop.tagline),
      el('p', { class: 'mk-card-blurb', id: 'blurb-' + shop.id }, shop.blurb),
      el('ul', { class: 'mk-stats', 'aria-label': 'At a glance' }, ...shop.stats.map((s) => el('li', null, s))),
      el(
        'p',
        { class: 'mk-tryon' },
        icon(shop.tryOnIcon),
        el('span', null, el('b', null, 'Camera try-on: '), shop.tryOn),
      ),
      n
        ? el(
            'p',
            { class: 'mk-bag-note' },
            icon('bag'),
            el('span', null, n + (n === 1 ? ' item is' : ' items are') + ' waiting in your bag here.'),
          )
        : null,
      el('span', { class: 'mk-enter', 'aria-hidden': 'true' }, 'Enter the shop', icon('arrow')),
    ),
  );
}

const categories = ['All', ...new Set(SHOPS.map((s) => s.category))];
let filter = storage.getItem(FILTER_KEY);
if (!categories.includes(filter)) filter = 'All';

function renderFilters() {
  const box = $('#filters');
  box.replaceChildren(
    ...categories.map((c) =>
      el(
        'button',
        {
          class: 'mk-chip',
          type: 'button',
          role: 'radio',
          'aria-checked': c === filter ? 'true' : 'false',
          tabindex: c === filter ? '0' : '-1',
          onclick: () => setFilter(c),
        },
        c === 'All' ? 'All shops' : c,
      ),
    ),
  );
}
// Arrow keys move between the chips, as in any radio group.
$('#filters').addEventListener('keydown', (e) => {
  const i = categories.indexOf(filter);
  const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!d) return;
  e.preventDefault();
  setFilter(categories[(i + d + categories.length) % categories.length]);
  $('#filters [aria-checked="true"]').focus();
});
function setFilter(c) {
  filter = c;
  try {
    storage.setItem(FILTER_KEY, c);
  } catch (e) {
    /* storage unavailable */
  }
  renderFilters();
  renderGrid();
}
function renderGrid() {
  const shops = SHOPS.filter((s) => filter === 'All' || s.category === filter);
  $('#grid').replaceChildren(...shops.map(card));
}

/* ---------- Continue where you left off ---------- */
function renderResume() {
  const box = $('#resume');
  const shop = SHOPS.find((s) => s.id === storage.getItem(LAST_KEY));
  if (!shop) {
    box.hidden = true;
    return;
  }
  const n = bagCount(storage, shop);
  box.style.cssText = '--a:' + shop.theme.a + ';--b:' + shop.theme.b;
  box.replaceChildren(
    el('span', { class: 'mk-resume-art', 'aria-hidden': 'true', html: ART[shop.id] }),
    el(
      'p',
      null,
      el('span', { class: 'mk-eyebrow' }, 'Continue where you left off'),
      el('b', null, shop.name),
      n ? el('span', null, n + (n === 1 ? ' item' : ' items') + ' in your bag') : el('span', null, shop.tagline),
    ),
    el(
      'a',
      {
        class: 'mk-btn primary',
        href: shopUrl(shop),
        onpointerenter: () => prefetch(shop),
        onclick: () => remember(shop),
      },
      'Back to ' + shop.name.split(' ')[0],
    ),
    el(
      'button',
      {
        class: 'mk-resume-close',
        type: 'button',
        'aria-label': 'Hide this',
        onclick: () => {
          storage.removeItem(LAST_KEY);
          box.hidden = true;
        },
      },
      icon('close'),
    ),
  );
  box.hidden = false;
}

function render() {
  renderFilters();
  renderGrid();
  renderResume();
}
render();
// Coming back from a shop (Back button, often from the page cache) or a change in another tab: refresh the counts.
addEventListener('pageshow', (e) => e.persisted && render());
addEventListener('storage', render);
