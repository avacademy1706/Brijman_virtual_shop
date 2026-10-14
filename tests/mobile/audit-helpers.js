// In-page measurements for the mobile audit. Each function runs inside the page with page.evaluate.

/** Visible rectangles of the fixed chrome. */
export function chromeBoxes() {
  const pick = (sel, name) => {
    const el = document.querySelector(sel);
    if (!el || el.hidden) return null;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    return { name, x: r.left, y: r.top, w: r.width, h: r.height };
  };
  return [
    pick('.topbar', 'top bar'),
    pick('#minimap', 'floor plan'),
    pick('#minimap-toggle', 'floor plan button'),
    pick('#zonecard', 'section card'),
    pick('#tourcard', 'tour card'),
    pick('.bottombar', 'bottom bar'),
    pick('#sheet.open', 'sheet'),
    pick('#toast', 'toast'),
    pick('#hint', 'hint'),
    pick('#coach', 'coach mark'),
  ].filter(Boolean);
}

/** Pairs of fixed elements that overlap (the sheet may cover the dock cards and the hint). */
export function overlaps() {
  const boxes = window.__auditChromeBoxes();
  const allowed = new Set([
    'sheet|section card',
    'sheet|tour card',
    'sheet|hint',
    'sheet|floor plan',
    'sheet|floor plan button',
  ]);
  const out = [];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i],
        b = boxes[j];
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ix > 1 && iy > 1) {
        const key = [a.name, b.name].sort().join('|');
        const keyRev = a.name + '|' + b.name;
        if (allowed.has(keyRev) || allowed.has(b.name + '|' + a.name) || allowed.has(key)) continue;
        out.push(a.name + ' × ' + b.name + ' (' + Math.round(ix) + '×' + Math.round(iy) + ' px)');
      }
    }
  const W = innerWidth,
    H = innerHeight;
  for (const b of boxes)
    if (b.x < -1 || b.y < -1 || b.x + b.w > W + 1 || b.y + b.h > H + 1) out.push(b.name + ' is partly off screen');
  return out;
}

const describe = (el) => {
  let s = el.tagName.toLowerCase();
  if (el.id) s += '#' + el.id;
  else if (el.className && typeof el.className === 'string')
    s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
  const label = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  return label ? s + ' "' + label + '"' : s;
};

/** Visible interactive elements smaller than 44×44 CSS px. */
export function smallTargets() {
  const out = [];
  const els = document.querySelectorAll(
    'button, a[href], input:not([type=hidden]):not([type=radio]):not([type=checkbox]), select, textarea, [role=radio], label.opt',
  );
  for (const el of els) {
    if (el.closest('[hidden], [inert], .sr-only')) continue;
    if (el.classList.contains('sr-only')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue;
    // Hit area: the element box, or an enlarged hit area declared with data-hit (pseudo-element padding).
    const hit = +(el.dataset.hit || 0);
    const w = r.width + 2 * hit,
      h = r.height + 2 * hit;
    if (w < 43.5 || h < 43.5) out.push(describe(el) + ' ' + Math.round(w) + '×' + Math.round(h));
  }
  return out;
}

/** Visible text under 11 px, and (on touch) inputs under 16 px. */
export function smallText(touch) {
  const out = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('[hidden], [inert], .sr-only, svg, noscript, script, style')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const fs = parseFloat(cs.fontSize);
    if (fs < 10.95) out.add(describe(el) + ' ' + fs + 'px');
  }
  if (touch)
    for (const el of document.querySelectorAll(
      'input:not([type=radio]):not([type=checkbox]):not([type=file]), select, textarea',
    )) {
      if (el.closest('[hidden], [inert]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 16) out.add('input ' + describe(el) + ' ' + fs + 'px (iOS zooms below 16 px)');
    }
  return [...out];
}

/** Visible section labels that overlap each other or sit under the chrome. */
export function labelProblems() {
  const labels = [...document.querySelectorAll('.zlabel')]
    .filter((l) => !l.hidden && getComputedStyle(l).display !== 'none' && +getComputedStyle(l).opacity > 0.05)
    .map((l) => ({ t: l.textContent.trim(), r: l.getBoundingClientRect() }));
  const chrome = window.__auditChromeBoxes().filter((b) => b.name !== 'toast' && b.name !== 'hint');
  const out = [];
  const hit = (a, b) =>
    Math.min(a.right, b.x + b.w) - Math.max(a.left, b.x) > 1 &&
    Math.min(a.bottom, b.y + b.h) - Math.max(a.top, b.y) > 1;
  for (let i = 0; i < labels.length; i++)
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i].r,
        b = labels[j].r;
      if (
        Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
        Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
      )
        out.push(labels[i].t + ' × ' + labels[j].t);
    }
  for (const l of labels) for (const c of chrome) if (hit(l.r, c)) out.push(l.t + ' under ' + c.name);
  return { count: labels.length, problems: out };
}
