// Layout modes for JavaScript, matching the media queries in src/styles/main.css. Also measures the chrome and the
// visible viewport (keyboard) into CSS variables, so CSS never has to guess heights.
//
//   phone            ≤ 600 px wide (bottom bar, bottom sheet)
//   phone-landscape  ≤ 500 px tall in landscape (no bottom bar, side-panel sheet, top-bar menu)
//   tablet           601–1024 px (desktop arrangement, touch-sized targets)
//   desktop          1025 px and wider

export const MQ = Object.freeze({
  phoneLandscape: '(orientation: landscape) and (max-height: 500px)',
  phone: '(max-width: 600px)',
  tablet: '(min-width: 601px) and (max-width: 1024px)',
  coarse: '(pointer: coarse)',
  hover: '(hover: hover) and (pointer: fine)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
});

const mm = (q) => !!(window.matchMedia && window.matchMedia(q).matches);

/** @returns {'phone'|'phone-landscape'|'tablet'|'desktop'} */
export function layoutMode() {
  if (mm(MQ.phoneLandscape)) return 'phone-landscape';
  if (mm(MQ.phone)) return 'phone';
  if (mm(MQ.tablet)) return 'tablet';
  return 'desktop';
}
/** True when the sheet is a bottom sheet over the store (phone portrait). */
export const isBottomSheet = () => layoutMode() === 'phone';
/** True on phones in either orientation. */
export const isPhone = () => layoutMode().startsWith('phone');
export const isCoarse = () => mm(MQ.coarse);

const root = document.documentElement;
const listeners = new Set();
let mode = null;

/** Calls `fn(mode)` whenever the layout mode changes. */
export function onLayoutChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setVar(name, px) {
  root.style.setProperty(name, Math.max(0, Math.round(px)) + 'px');
}

function visible(el) {
  return el && !el.hidden && getComputedStyle(el).display !== 'none';
}

/** Measures the bottom bar and floor plan into --bb-h and --mm-h. */
export function measureChrome() {
  const bb = document.querySelector('.bottombar');
  setVar('--bb-h', visible(bb) ? bb.getBoundingClientRect().height : 0);
  const map = document.querySelector('#minimap');
  const tog = document.querySelector('#minimap-toggle');
  const shown = visible(map) ? map : visible(tog) ? tog : null;
  setVar('--mm-h', shown && isPhone() ? shown.getBoundingClientRect().height : 0);
}

/**
 * Keeps --vvh (visible height) and --kb (how much the keyboard covers the layout viewport) up to date, and marks
 * the sheet while the keyboard is open, so the sheet and its primary button stay above the keyboard.
 */
function trackViewport() {
  const vv = window.visualViewport;
  const sheet = document.querySelector('#sheet');
  const update = () => {
    const h = vv ? vv.height : innerHeight;
    const covered = vv ? Math.max(0, innerHeight - (vv.offsetTop + vv.height)) : 0;
    setVar('--vvh', h);
    setVar('--kb', covered > 60 ? covered : 0);
    if (sheet) sheet.classList.toggle('kb-open', covered > 60);
  };
  update();
  if (vv) {
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
  }
  window.addEventListener('resize', update);
}

/**
 * Chromium resizes the layout when the on-screen keyboard opens if the viewport asks for it. Safari does not know the
 * key and logs it as an error, so it is added only where it is understood (Chromium exposes navigator.userAgentData).
 */
function keyboardResizesContent() {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta || !('userAgentData' in navigator) || /interactive-widget/.test(meta.content)) return;
  meta.content += ', interactive-widget=resizes-content';
}

/** Starts measuring. Call once after the page shell is in the DOM. */
export function initLayout() {
  keyboardResizesContent();
  const check = () => {
    const m = layoutMode();
    root.dataset.layout = m;
    measureChrome();
    if (m !== mode) {
      mode = m;
      listeners.forEach((fn) => fn(m));
    }
  };
  check();
  window.addEventListener('resize', check);
  window.addEventListener('orientationchange', () => setTimeout(check, 250));
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => measureChrome());
    for (const sel of ['.bottombar', '#minimap', '#minimap-toggle']) {
      const el = document.querySelector(sel);
      if (el) ro.observe(el);
    }
  }
  trackViewport();
}
