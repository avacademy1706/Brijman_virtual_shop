// Flat SVG sketches of garments and the canvas floor plan (used by the minimap, directory and in-store screen).
import { NY } from '../core/ny.js';

import '../data/store-layout.js';

/* ---------- Garment flat sketches ---------- */
let uid = 0;
const SLEEVE_OF = { tee: 'short', shirt: 'long', kurta: 'three-quarter', anarkali: 'long', dress: 'cap', vest: null };
function patternDef(id, pattern, base, accent) {
  const a = accent || '#ffffff';
  switch (pattern) {
    case 'stripe':
      return (
        '<pattern id="' +
        id +
        '" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="' +
        base +
        '"/><rect width="1.4" height="6" fill="' +
        a +
        '"/></pattern>'
      );
    case 'check':
      return (
        '<pattern id="' +
        id +
        '" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="' +
        base +
        '"/><rect width="4" height="8" fill="' +
        a +
        '" opacity=".38"/><rect width="8" height="4" fill="' +
        a +
        '" opacity=".38"/></pattern>'
      );
    case 'dots':
      return (
        '<pattern id="' +
        id +
        '" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="' +
        base +
        '"/><circle cx="3.5" cy="3.5" r="1" fill="' +
        a +
        '"/></pattern>'
      );
    case 'denim':
      return (
        '<pattern id="' +
        id +
        '" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="' +
        base +
        '"/><path d="M0 4L4 0" stroke="#ffffff" stroke-opacity=".18" stroke-width=".8"/></pattern>'
      );
    case 'solid':
      return '';
    default:
      // motif prints: block, paisley, floral, brocade, chikan, ikat, phulkari
      return (
        '<pattern id="' +
        id +
        '" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="' +
        base +
        '"/><circle cx="3" cy="3" r="1.6" fill="' +
        a +
        '" opacity=".85"/><circle cx="9" cy="9" r="1.6" fill="' +
        a +
        '" opacity=".85"/></pattern>'
      );
  }
}
/** Flat front sketch of a product (or a base garment) in a colour. */
NY.garmentSVG = function (p, ci, w, hh, opts) {
  opts = opts || {};
  const col = NY.colorOf(p, ci);
  const id = 'gp' + ++uid;
  const def = patternDef(id, p.pattern, col.base, col.accent);
  const fill = def ? 'url(#' + id + ')' : col.base;
  const line = 'rgba(30,26,22,.45)';
  const T = p.template;
  let body = '';
  if (T === 'dupatta') {
    const b = col.border || '#c9a24c';
    body =
      '<path d="M22 8 C30 30, 18 60, 26 112 L50 112 C44 70, 54 30, 46 8 Z" fill="' +
      fill +
      '" stroke="' +
      line +
      '"/>' +
      '<path d="M54 8 C62 40, 54 70, 60 112 L82 112 C78 66, 84 34, 76 8 Z" fill="' +
      fill +
      '" stroke="' +
      line +
      '"/>' +
      '<path d="M26 108 L50 108 M60 108 L82 108" stroke="' +
      b +
      '" stroke-width="4"/>' +
      '<path d="M22 8 Q50 -2 76 8" fill="none" stroke="' +
      line +
      '" stroke-width="1.2"/>';
  } else {
    const sleeve = (p.over && 'sleeve' in p.over ? p.over.sleeve : SLEEVE_OF[T]) || null;
    const len = Math.min(1.35, p.len || 0.7);
    const bottom = 16 + len * 74; // shoulders at y = 16
    const flare = T === 'anarkali' || T === 'dress';
    const sw = 22,
      cx = 50;
    // sleeves
    const sl = { short: 18, cap: 9, 'three-quarter': 40, long: 54 }[sleeve] || 0;
    let sleeves = '';
    if (sl) {
      for (const sd of [-1, 1]) {
        const x0 = cx + sd * sw,
          x1 = cx + sd * (sw + 8 + sl * 0.32),
          y1 = 16 + sl,
          w2 = sl > 30 ? 6 : 9;
        sleeves +=
          '<path d="M' +
          x0 +
          ' 16 L' +
          x1 +
          ' ' +
          (y1 - 2) +
          ' L' +
          (x1 - sd * w2) +
          ' ' +
          (y1 + 3) +
          ' L' +
          (cx + sd * (sw - 2)) +
          ' ' +
          30 +
          ' Z" fill="' +
          fill +
          '" stroke="' +
          line +
          '"/>';
      }
    }
    const waistY = 16 + 26,
      hipW = flare ? 18 : sw + 2;
    const hemW = flare ? 30 + len * 22 : sw + 4;
    let bodyPath =
      'M' +
      (cx - 8) +
      ' 14 L' +
      (cx - sw) +
      ' 16 L' +
      (cx - sw + 2) +
      ' ' +
      waistY +
      ' ' +
      (flare ? 'L' + (cx - hipW) + ' ' + (waistY + 4) + ' ' : '') +
      'L' +
      (cx - hemW) +
      ' ' +
      bottom +
      ' L' +
      (cx + hemW) +
      ' ' +
      bottom +
      ' ' +
      (flare ? 'L' + (cx + hipW) + ' ' + (waistY + 4) + ' ' : '') +
      'L' +
      (cx + sw - 2) +
      ' ' +
      waistY +
      ' L' +
      (cx + sw) +
      ' 16 L' +
      (cx + 8) +
      ' 14 Q' +
      cx +
      ' 24 ' +
      (cx - 8) +
      ' 14 Z';
    body = sleeves + '<path d="' + bodyPath + '" fill="' + fill + '" stroke="' + line + '" stroke-linejoin="round"/>';
    if (T === 'vest')
      body +=
        '<path d="M' +
        cx +
        ' 22 L' +
        cx +
        ' ' +
        bottom +
        '" stroke="' +
        line +
        '"/><path d="M' +
        (cx - 6) +
        ' 13 L' +
        (cx - 6) +
        ' 9 L' +
        (cx + 6) +
        ' 9 L' +
        (cx + 6) +
        ' 13" fill="none" stroke="' +
        line +
        '"/>';
    const nBtn = (p.over && p.over.buttons) || (T === 'shirt' ? 6 : T === 'vest' ? 5 : T === 'kurta' ? 3 : 0);
    for (let i = 0; i < nBtn; i++) {
      const y = 24 + i * ((T === 'kurta' ? 18 : bottom - 30) / Math.max(1, nBtn));
      body +=
        '<circle cx="' +
        (cx + (T === 'vest' ? 2.5 : 0)) +
        '" cy="' +
        y.toFixed(1) +
        '" r="1.2" fill="' +
        (col.trim || '#e8dcc2') +
        '" stroke="' +
        line +
        '" stroke-width=".4"/>';
    }
    if (col.border)
      body +=
        '<path d="M' +
        (cx - hemW + 1) +
        ' ' +
        (bottom - 3) +
        ' L' +
        (cx + hemW - 1) +
        ' ' +
        (bottom - 3) +
        '" stroke="' +
        col.border +
        '" stroke-width="4"/>';
    if (T === 'kurta' && p.over && p.over.slit !== undefined ? p.over.slit > 0.1 : T === 'kurta')
      body +=
        '<path d="M' +
        (cx - hemW + 0.5) +
        ' ' +
        (bottom - 14) +
        ' L' +
        (cx - hemW + 0.5) +
        ' ' +
        bottom +
        ' M' +
        (cx + hemW - 0.5) +
        ' ' +
        (bottom - 14) +
        ' L' +
        (cx + hemW - 0.5) +
        ' ' +
        bottom +
        '" stroke="#ffffff" stroke-width="1.2" opacity=".8"/>';
  }
  return (
    '<svg viewBox="0 0 100 120" width="' +
    w +
    '" height="' +
    hh +
    '" role="img" aria-label="' +
    (p.name || '').replace(/"/g, '') +
    '"' +
    (opts.cls ? ' class="' + opts.cls + '"' : '') +
    '><defs>' +
    def +
    '</defs>' +
    body +
    '</svg>'
  );
};

/* ---------- Floor plan drawing (minimap, directory, fallback) ---------- */
NY.drawPlan = function (g, w, hh, o) {
  const L = NY.L,
    col = o.colors,
    pad = o.pad == null ? 6 : o.pad;
  const s = Math.min((w - 2 * pad) / (L.x1 - L.x0), (hh - 2 * pad) / (L.z1 - L.z0));
  const ox = (w - s * (L.x1 - L.x0)) / 2,
    oz = (hh - s * (L.z1 - L.z0)) / 2;
  const X = (x) => ox + (x - L.x0) * s,
    Z = (z) => oz + (z - L.z0) * s;
  g.fillStyle = col.floor;
  g.fillRect(X(L.x0), Z(L.z0), (L.x1 - L.x0) * s, (L.z1 - L.z0) * s);
  for (const zn of NY.ZONES) {
    const r = zn.rect;
    g.fillStyle = zn.id === o.current ? col.zoneOn : col.zone;
    g.fillRect(X(r[0]) + 1, Z(r[1]) + 1, (r[2] - r[0]) * s - 2, (r[3] - r[1]) * s - 2);
  }
  g.fillStyle = col.item;
  for (const ob of NY.OBS) {
    if (ob.k === 'wall') continue;
    if (ob.t === 'r')
      g.fillRect(X(ob.x0), Z(ob.z0), Math.max(1, (ob.x1 - ob.x0) * s), Math.max(1, (ob.z1 - ob.z0) * s));
    else {
      g.beginPath();
      g.arc(X(ob.x), Z(ob.z), Math.max(1, ob.r * s), 0, Math.PI * 2);
      g.fill();
    }
  }
  g.strokeStyle = col.wall;
  g.lineCap = 'square';
  g.lineWidth = Math.max(1.5, s * 0.14);
  g.beginPath();
  g.moveTo(X(-L.door), Z(L.z1));
  g.lineTo(X(L.x0), Z(L.z1));
  g.lineTo(X(L.x0), Z(L.z0));
  g.lineTo(X(L.x1), Z(L.z0));
  g.lineTo(X(L.x1), Z(L.z1));
  g.lineTo(X(L.door), Z(L.z1));
  g.stroke();
  g.lineWidth = Math.max(1, s * 0.09);
  const e = L.fit;
  g.beginPath();
  g.moveTo(X(e.x0), Z(L.z0));
  g.lineTo(X(e.x0), Z(e.z1));
  g.lineTo(X(e.door[0]), Z(e.z1));
  g.moveTo(X(e.door[1]), Z(e.z1));
  g.lineTo(X(L.x1), Z(e.z1));
  g.stroke();
  if (o.labels) {
    g.fillStyle = col.text;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const fs = o.labelSize || Math.max(9, Math.min(13, s * 0.42));
    g.font = '600 ' + fs + 'px "Hanken Grotesk", system-ui, sans-serif';
    for (const zn of NY.ZONES) {
      const r = zn.rect;
      let lx = (r[0] + r[2]) / 2,
        lz = (r[1] + r[3]) / 2;
      if (zn.id === 'ethnic') lx = -8.7;
      if (zn.id === 'mens') lx = 8.7;
      if (zn.id === 'chikan') lz = -4.0;
      if (zn.id === 'welcome') lz = 7.3;
      if (zn.id === 'basics') lz = 2.1;
      if (zn.id === 'dupatta') lz = 1.9;
      if (zn.id === 'festive') lz = 2.5;
      if (zn.id === 'fitting') lz = -5.2;
      g.fillText(zn.short, X(lx), Z(lz));
    }
    if (o.entrance !== false) {
      g.font = '500 ' + Math.max(8, fs - 2) + 'px "Martian Mono", ui-monospace, monospace';
      g.fillText('ENTRANCE', X(0), Math.min(hh - 4, Z(L.z1) + fs * 0.9));
    }
  }
  return { X, Z, s, toWorld: (px, py) => ({ x: L.x0 + (px - ox) / s, z: L.z0 + (py - oz) / s }) };
};
function drawYou(g, m, pose, opts) {
  if (!pose) return;
  const x = m.X(pose.x),
    y = m.Z(pose.z),
    col = opts.colors;
  if (pose.path && pose.path.length > 1) {
    g.strokeStyle = col.you;
    g.lineWidth = 2;
    g.setLineDash([3, 3]);
    g.beginPath();
    pose.path.forEach((p, i) => {
      const px = m.X(p.x),
        py = m.Z(p.z);
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    });
    g.stroke();
    g.setLineDash([]);
    const d = pose.path[pose.path.length - 1];
    g.fillStyle = col.you;
    g.beginPath();
    g.arc(m.X(d.x), m.Z(d.z), 3, 0, Math.PI * 2);
    g.fill();
  }
  const R = opts.cone || 26,
    half = (pose.hfov || 1.2) / 2;
  const dx = -Math.sin(pose.yaw),
    dz = -Math.cos(pose.yaw);
  const ang = Math.atan2(dz, dx);
  g.save();
  g.globalAlpha = 0.22;
  g.fillStyle = col.you;
  g.beginPath();
  g.moveTo(x, y);
  g.arc(x, y, R, ang - half, ang + half);
  g.closePath();
  g.fill();
  g.restore();
  g.fillStyle = col.you;
  g.strokeStyle = col.floor;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(x, y, opts.dot || 4.5, 0, Math.PI * 2);
  g.fill();
  g.stroke();
}

export { drawYou };
