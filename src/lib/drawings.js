// SVG drawings of frames and the canvas floor plan (used by the minimap, directory and in-store screen).
import { NY } from '../core/ny.js';

import '../data/store-layout.js';
import '../data/frames.js';

/* ---------- SVG drawings of frames and packs ---------- */
function pathFrom(pts, X, Y) {
  let d = '';
  pts.forEach((p, i) => {
    d += (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1);
  });
  return d + 'Z';
}
NY.frameSVG = function (p, ci, w, hh) {
  w = w || 160;
  hh = hh || 64;
  if (p.type !== 'frame') return NY.boxSVG(p, w, hh);
  const a = NY.ARCH[p.arch],
    col = NY.colorOf(p, ci);
  const pts = NY.outline(a.shape, a.A, a.B, 56);
  const total = 2 * a.A + a.dbl + 0.016,
    s = (w - 10) / total,
    cx = w / 2,
    cy = hh / 2 + 1;
  const lx = a.dbl / 2 + a.A / 2;
  const X1 = (x) => cx + (lx + x) * s,
    X2 = (x) => cx - (lx + x) * s,
    Y = (y) => cy - y * s;
  const style = a.style;
  const frameCol = style === 'metal' ? col.m || col.sw : col.sw || '#333333';
  const metalCol = col.m || '#b9bcbf';
  const lensFill = p.sun ? col.l : '#ffffff',
    lensOp = p.sun ? 0.88 : 0.55;
  const sw = style === 'acetate' ? 3.2 * (a.thick || 1) : 1.6;
  let o = '<svg viewBox="0 0 ' + w + ' ' + hh + '" aria-hidden="true">';
  o +=
    '<path d="' +
    pathFrom(pts, X1, Y) +
    pathFrom(pts, X2, Y) +
    '" fill="' +
    lensFill +
    '" fill-opacity="' +
    lensOp +
    '" stroke="' +
    (style === 'combo' ? metalCol : frameCol) +
    '" stroke-width="' +
    (style === 'combo' ? 1.4 : sw) +
    '" stroke-linejoin="round"/>';
  if (style === 'combo') {
    const idx = NY.topArc(pts, a.B * 0.06);
    const arc = (X) =>
      idx.map((i, k) => (k ? 'L' : 'M') + X(pts[i].x).toFixed(1) + ' ' + Y(pts[i].y).toFixed(1)).join('');
    o +=
      '<path d="' +
      arc(X1) +
      arc(X2) +
      '" fill="none" stroke="' +
      frameCol +
      '" stroke-width="4.4" stroke-linecap="round"/>';
  }
  const by = Y(a.B * 0.16),
    bx = (a.dbl / 2) * s;
  o +=
    '<path d="M' +
    (cx - bx - 1).toFixed(1) +
    ' ' +
    by.toFixed(1) +
    'Q' +
    cx +
    ' ' +
    (by - a.B * 0.14 * s).toFixed(1) +
    ' ' +
    (cx + bx + 1).toFixed(1) +
    ' ' +
    by.toFixed(1) +
    '" fill="none" stroke="' +
    (style === 'acetate' ? frameCol : metalCol) +
    '" stroke-width="' +
    (style === 'acetate' ? sw * 0.9 : 1.6) +
    '" stroke-linecap="round"/>';
  if (a.dbridge) {
    const ty = Y(a.B * 0.34).toFixed(1);
    o +=
      '<path d="M' +
      X2(-a.A * 0.18).toFixed(1) +
      ' ' +
      ty +
      'L' +
      X1(-a.A * 0.18).toFixed(1) +
      ' ' +
      ty +
      '" stroke="' +
      metalCol +
      '" stroke-width="1.5"/>';
  }
  let maxX = -1;
  for (const q of pts) if (q.x > maxX) maxX = q.x;
  const ty2 = Y(a.B * 0.22).toFixed(1);
  o +=
    '<path d="M' +
    X1(maxX).toFixed(1) +
    ' ' +
    ty2 +
    'l5 1.6M' +
    X2(maxX).toFixed(1) +
    ' ' +
    ty2 +
    'l-5 1.6" stroke="' +
    (style === 'metal' ? metalCol : frameCol) +
    '" stroke-width="' +
    (style === 'acetate' ? 2.6 : 1.5) +
    '" stroke-linecap="round"/>';
  return o + '</svg>';
};
NY.boxSVG = function (p, w, hh) {
  w = w || 160;
  hh = hh || 64;
  const c = p.color;
  const sx = w / 160,
    sy = hh / 64;
  if (p.id === 'c07')
    return (
      '<svg viewBox="0 0 160 64" aria-hidden="true"><rect x="46" y="18" width="68" height="30" rx="10" fill="' +
      c +
      '"/><circle cx="66" cy="33" r="9" fill="#ffffff" fill-opacity=".85"/><circle cx="94" cy="33" r="9" fill="#ffffff" fill-opacity=".85"/></svg>'
    );
  if (p.type === 'care')
    return (
      '<svg viewBox="0 0 160 64" aria-hidden="true"><rect x="68" y="14" width="26" height="44" rx="8" fill="' +
      c +
      '"/><rect x="73" y="6" width="16" height="10" rx="2" fill="#f4f3ef" stroke="#b5b5b0" stroke-width=".8"/><rect x="68" y="28" width="26" height="12" fill="#ffffff" fill-opacity=".85"/></svg>'
    );
  void sx;
  void sy;
  return (
    '<svg viewBox="0 0 160 64" aria-hidden="true"><rect x="38" y="15" width="84" height="36" rx="4" fill="' +
    c +
    '"/><rect x="38" y="27" width="84" height="12" fill="#ffffff" fill-opacity=".9"/><circle cx="54" cy="33" r="4.5" fill="none" stroke="' +
    c +
    '" stroke-width="2"/></svg>'
  );
};
NY.sizeSVG = function (p) {
  const a = NY.ARCH[p.arch],
    lw = p.size[0],
    br = p.size[1],
    tl = p.size[2];
  const k = lw / 1000 / a.A,
    A = a.A * k,
    Bh = a.B * k,
    D = br / 1000;
  const pts = NY.outline(a.shape, A, Bh, 64);
  const W = 320,
    Hh = 158,
    s = (W - 64) / (2 * A + D),
    cx = W / 2,
    cy = 76;
  const lx = D / 2 + A / 2;
  const X1 = (x) => cx + (lx + x) * s,
    X2 = (x) => cx - (lx + x) * s,
    Y = (y) => cy - y * s;
  let minX = 1,
    maxX = -1,
    minY = 1,
    maxY = -1;
  for (const q of pts) {
    minX = Math.min(minX, q.x);
    maxX = Math.max(maxX, q.x);
    minY = Math.min(minY, q.y);
    maxY = Math.max(maxY, q.y);
  }
  const dim = (x1, x2, y, label, up) =>
    '<g class="sg-dim"><path d="M' +
    x1.toFixed(1) +
    ' ' +
    (y - 5) +
    'v10M' +
    x2.toFixed(1) +
    ' ' +
    (y - 5) +
    'v10M' +
    x1.toFixed(1) +
    ' ' +
    y +
    'H' +
    x2.toFixed(1) +
    '"/><text x="' +
    ((x1 + x2) / 2).toFixed(1) +
    '" y="' +
    (up ? y - 8 : y + 16) +
    '" text-anchor="middle">' +
    label +
    '</text></g>';
  let o =
    '<svg viewBox="0 0 ' +
    W +
    ' ' +
    Hh +
    '" role="img" aria-label="Frame size: ' +
    lw +
    ' mm lens, ' +
    br +
    ' mm bridge, ' +
    tl +
    ' mm temple">';
  o +=
    '<path d="' +
    pathFrom(pts, X1, Y) +
    pathFrom(pts, X2, Y) +
    '" fill="none" stroke="currentColor" stroke-width="2"/>';
  o += dim(X1(minX), X1(maxX), Math.round(Y(minY) + 14), lw + ' mm', false);
  o += dim(X2(minX), X1(minX), Math.round(Y(maxY) - 12), br + ' mm', true);
  o +=
    '<text class="sg-cap" x="' +
    W / 2 +
    '" y="' +
    (Hh - 4) +
    '" text-anchor="middle">Lens ' +
    lw +
    ' · Bridge ' +
    br +
    ' · Temple ' +
    tl +
    '</text>';
  return o + '</svg>';
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
  const e = L.eye;
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
      if (zn.id === 'men') lx = -8.6;
      if (zn.id === 'women') lx = 8.6;
      if (zn.id === 'premium') lz = -4.1;
      if (zn.id === 'welcome') lz = 7.3;
      if (zn.id === 'sun') lz = 2.1;
      if (zn.id === 'lensbar') lz = 1.9;
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
