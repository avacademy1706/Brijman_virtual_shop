// Small DOM, formatting and storage helpers.
import { NY } from '../core/ny.js';

/* ---------- Small helpers ---------- */
const money = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
NY.money = money;
const $ = (s, r) => (r || document).querySelector(s);
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs)
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
  for (const kid of kids.flat())
    if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return e;
}
const ICONS = {
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5.5 3.5-5.5 3.5z"/>',
  pause: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7M14 8.5v7"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>',
  bag: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  locate:
    '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  minus: '<path d="M6 12h12"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  camera: '<path d="M4 8h3l1.6-2.2h6.8L17 8h3v11H4z"/><circle cx="12" cy="13.2" r="3.6"/>',
  tape: '<path d="M4 15.5V8.5a4.5 4.5 0 0 1 9 0v7"/><path d="M4 15.5h16v3H4z"/><path d="M8 15.5v-2M12 15.5v-2M16 15.5v-2"/><circle cx="8.5" cy="8.5" r="1.6"/>',
  hanger:
    '<path d="M12 7.5a2 2 0 1 1 2-2"/><path d="M12 7.5v1.5L3.5 15.5a1 1 0 0 0 .6 1.8h15.8a1 1 0 0 0 .6-1.8L12 9"/>',
  scissors:
    '<circle cx="6.5" cy="17" r="2.5"/><circle cx="6.5" cy="7" r="2.5"/><path d="M8.6 8.4 20 17M8.6 15.6 20 7"/>',
  swap: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19h14"/>',
  sparkle: '<path d="M12 3.5l1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8z"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  layers: '<path d="m12 4 8 4.5-8 4.5-8-4.5z"/><path d="m4 13 8 4.5 8-4.5"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  diamond: '<path d="M7 4h10l3.5 5L12 20 3.5 9z"/><path d="M3.5 9h17M9 4l-1.5 5L12 20l4.5-11L15 4"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  ring: '<circle cx="12" cy="14.5" r="6"/><path d="M9.5 8.8 12 5l2.5 3.8"/><path d="M10 5h4"/>',
  coins:
    '<ellipse cx="12" cy="7" rx="7" ry="2.8"/><path d="M5 7v5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V7"/><path d="M5 12v5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-5"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11"/><path d="M12 9c-2.5 0-5-1-5-3a2 2 0 0 1 4-.5L12 9l1-3.5a2 2 0 0 1 4 .5c0 2-2.5 3-5 3z"/>',
  shield: '<path d="M12 3.5 19 6v5.5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  video: '<rect x="3.5" y="6.5" width="12" height="11" rx="2"/><path d="m15.5 10.5 5-3v9l-5-3"/>',
  store:
    '<path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5h16v.5a3 3 0 0 1-5.3 1.9A3 3 0 0 1 12 13a3 3 0 0 1-2.7-1.1A3 3 0 0 1 4 10z"/><path d="M5.5 12.5V20h13v-7.5"/>',
  sparkles:
    '<path d="M10 3.5l1.6 4.4 4.4 1.6-4.4 1.6L10 15.5l-1.6-4.4-4.4-1.6 4.4-1.6z"/><path d="M17.5 13.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  ruler:
    '<path d="M3.5 15.5 15.5 3.5l5 5-12 12z"/><path d="m7 12 1.6 1.6M9.5 9.5l2.4 2.4M12 7l1.6 1.6M14.5 4.5l2.4 2.4"/>',
};
function ic(name) {
  const t = document.createElement('template');
  t.innerHTML =
    '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    ICONS[name] +
    '</svg>';
  return t.content.firstChild;
}
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : d;
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      /* storage unavailable */
    }
  },
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export { money, $, h, ic, store, esc };
