// Small drawings: line-art thumbnails of each kind of jewellery (in the chosen metal and stone colours) and the
// canvas floor plan of the boutique (minimap, directory and the no-WebGL fallback).
import { NY } from '../core/ny.js';
import '../data/store-layout.js';

/* ---------- Jewellery thumbnails ---------- */
let uid = 0;
const STONE_HEX = (kind) =>
  NY.STONE && NY.STONE[kind] ? NY.STONE[kind].swatch : kind === 'white' ? '#f3eee4' : '#eef3f6';
/** SVG thumbnail of a product in a configuration. */
NY.pieceSVG = function (p, cfg, w, h) {
  cfg = cfg || NY.defaultCfg(p);
  const m = NY.METAL[cfg.metal] || NY.METAL[p.metal];
  const id = 'pg' + ++uid;
  const stones = NY.stonesFor(p, cfg);
  const main = STONE_HEX(stones.main || (p.stones[0] && p.stones[0].kind) || 'diamond');
  const acc = STONE_HEX(stones.accent || 'diamond');
  const pearl = STONE_HEX(stones.pearl === 'white' ? 'pearl' : stones.pearl || 'pearl');
  const metal = 'url(#' + id + 'm)';
  const defs =
    '<defs><linearGradient id="' +
    id +
    'm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff8e6" stop-opacity=".9"/><stop offset=".35" stop-color="' +
    m.swatch +
    '"/><stop offset="1" stop-color="' +
    shade(m.swatch, -0.35) +
    '"/></linearGradient><radialGradient id="' +
    id +
    's" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="' +
    main +
    '"/><stop offset="1" stop-color="' +
    shade(main, -0.45) +
    '"/></radialGradient></defs>';
  const gem = (cx, cy, r, fill) =>
    '<circle cx="' +
    cx +
    '" cy="' +
    cy +
    '" r="' +
    r +
    '" fill="' +
    (fill || 'url(#' + id + 's)') +
    '" stroke="' +
    shade(m.swatch, -0.4) +
    '" stroke-width=".8"/>';
  let body = '';
  switch (p.type) {
    case 'ring':
      body =
        '<ellipse cx="50" cy="66" rx="25" ry="25" fill="none" stroke="' +
        metal +
        '" stroke-width="5"/>' +
        (p.build.head === 'band' || p.build.head === 'eternity'
          ? [0, 1, 2, 3, 4, 5, 6].map((i) => gem(28 + i * 7.3, 44 + Math.abs(i - 3) * 2.5, 2.6, acc)).join('')
          : '<path d="M38 40 L50 28 L62 40" fill="none" stroke="' +
            metal +
            '" stroke-width="3"/>' +
            gem(50, 30, p.build.head === 'cocktail' ? 12 : 9));
      break;
    case 'earrings':
      for (const x of [30, 70]) {
        body += gem(x, 22, 5);
        if (p.build.style === 'jhumka')
          body +=
            '<path d="M' +
            (x - 13) +
            ' 66 Q' +
            x +
            ' 30 ' +
            (x + 13) +
            ' 66 Z" fill="' +
            metal +
            '"/>' +
            [0, 1, 2, 3, 4]
              .map((i) => '<circle cx="' + (x - 12 + i * 6) + '" cy="71" r="2.6" fill="' + pearl + '"/>')
              .join('');
        else if (p.build.style === 'chandbali')
          body +=
            '<path d="M' +
            (x - 15) +
            ' 40 A16 16 0 0 0 ' +
            (x + 15) +
            ' 40 A12 12 0 0 1 ' +
            (x - 15) +
            ' 40 Z" fill="' +
            metal +
            '"/>' +
            [0, 1, 2, 3, 4]
              .map(
                (i) =>
                  '<circle cx="' +
                  (x - 12 + i * 6) +
                  '" cy="' +
                  (60 - Math.abs(i - 2) * 3) +
                  '" r="2.4" fill="' +
                  pearl +
                  '"/>',
              )
              .join('');
        else if (p.build.style === 'drop')
          body +=
            '<path d="M' +
            x +
            ' 34 L' +
            (x + 8) +
            ' 52 A9 9 0 1 1 ' +
            (x - 8) +
            ' 52 Z" fill="url(#' +
            id +
            's)" stroke="' +
            metal +
            '" stroke-width="1.6"/>';
        else if (p.build.style === 'hoop')
          body += '<circle cx="' + x + '" cy="40" r="14" fill="none" stroke="' + metal + '" stroke-width="4"/>';
        else if (p.build.style === 'cluster')
          body += [0, 1, 2, 3, 4, 5].map((i) => gem(x + Math.cos(i) * 7, 22 + Math.sin(i) * 7, 3, acc)).join('');
      }
      break;
    case 'necklace':
    case 'pendant': {
      const deep = p.build.style === 'layered' ? 3 : 1;
      for (let k = 0; k < deep; k++)
        body +=
          '<path d="M14 18 Q50 ' +
          (74 + k * 9) +
          ' 86 18" fill="none" stroke="' +
          (p.build.style === 'strand' || p.build.style === 'layered' ? pearl : metal) +
          '" stroke-width="' +
          (p.build.style === 'chain' ? 1.6 : 4) +
          '" stroke-dasharray="' +
          (p.build.style === 'strand' || p.build.style === 'layered' ? '0.5 4' : 'none') +
          '" stroke-linecap="round"/>';
      if (p.build.style === 'motifs' || p.build.style === 'choker' || p.build.style === 'riviera')
        for (let i = 0; i < 9; i++) {
          const t = i / 8;
          const x = 22 + t * 56,
            y = 18 + Math.sin(t * Math.PI) * 30 + (p.build.style === 'choker' ? 0 : 6);
          body += gem(x, y, 3.6, i === 4 ? null : acc);
        }
      if (p.build.pendant || p.build.centre || p.build.style === 'layered') body += gem(50, deep > 1 ? 82 : 70, 7);
      break;
    }
    case 'bangle':
    case 'bracelet':
      body =
        '<ellipse cx="50" cy="50" rx="34" ry="30" fill="none" stroke="' +
        metal +
        '" stroke-width="' +
        (p.build.thick || 3) * 1.6 +
        '"/>' +
        (p.stones.length
          ? [0, 1, 2, 3, 4, 5, 6, 7]
              .map((i) =>
                gem(50 + Math.cos(i * 0.8 + 3.6) * 34, 50 + Math.sin(i * 0.8 + 3.6) * 30, 3, i % 2 ? acc : null),
              )
              .join('')
          : '');
      break;
    case 'tikka':
      body =
        '<path d="M50 6 L50 46" stroke="' +
        metal +
        '" stroke-width="1.4" stroke-dasharray="2 1.5"/>' +
        '<circle cx="50" cy="62" r="15" fill="' +
        metal +
        '"/>' +
        gem(50, 62, 8) +
        [0, 1, 2, 3, 4].map((i) => '<circle cx="' + (42 + i * 4) + '" cy="82" r="2.2" fill="' + pearl + '"/>').join('');
      break;
    case 'nath':
      body =
        '<circle cx="50" cy="48" r="28" fill="none" stroke="' +
        metal +
        '" stroke-width="2.2"/>' +
        [0, 1, 2, 3]
          .map((i) => '<circle cx="' + (30 + i * 5) + '" cy="' + (66 + i * 3) + '" r="3" fill="' + pearl + '"/>')
          .join('') +
        gem(26, 58, 5);
      break;
  }
  return (
    '<svg viewBox="0 0 100 100" width="' +
    w +
    '" height="' +
    h +
    '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    defs +
    body +
    '</svg>'
  );
};
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  return '#' + [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/* ---------- Floor plan drawing (minimap, directory, fallback) ---------- */
NY.drawPlan = function (g, w, hh, o) {
  const BD = NY.BOUNDS,
    col = o.colors,
    pad = o.pad == null ? 6 : o.pad;
  const s = Math.min((w - 2 * pad) / (BD.x1 - BD.x0), (hh - 2 * pad) / (BD.z1 - BD.z0));
  const ox = (w - s * (BD.x1 - BD.x0)) / 2,
    oz = (hh - s * (BD.z1 - BD.z0)) / 2;
  const X = (x) => ox + (x - BD.x0) * s,
    Z = (z) => oz + (z - BD.z0) * s;
  const poly = (pts) => {
    g.beginPath();
    pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
    g.closePath();
  };
  // walls: draw every room slightly larger in the wall colour, then the floors on top
  g.fillStyle = col.wall;
  for (const r of NY.ROOMS) {
    if (r.arch) continue;
    poly(grow(r.poly, NY.L.WT));
    g.fill();
  }
  g.fillStyle = col.floor;
  for (const r of NY.ROOMS) {
    poly(r.poly);
    g.fill();
  }
  for (const zn of NY.ZONES) {
    g.fillStyle = zn.id === o.current ? col.zoneOn : col.zone;
    if (zn.id === 'rotunda') poly(NY.ROOMS[0].poly);
    else {
      const room = NY.ROOMS.find((r) => r.id === zn.id);
      if (!room) continue;
      poly(room.poly);
    }
    g.fill();
  }
  g.fillStyle = col.item;
  for (const ob of NY.OBS) {
    if (ob.t === 'p') {
      poly(ob.pts);
      g.fill();
    } else {
      g.beginPath();
      g.arc(X(ob.x), Z(ob.z), Math.max(1, ob.r * s), 0, Math.PI * 2);
      g.fill();
    }
  }
  if (o.labels) {
    g.fillStyle = col.text;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const fs = o.labelSize || Math.max(9, Math.min(13, s * 0.5));
    g.font = '500 ' + fs + 'px "Jost", system-ui, sans-serif';
    for (const zn of NY.ZONES) {
      let lx, lz;
      if (zn.id === 'rotunda') {
        lx = 0;
        lz = 2.2;
      } else {
        const f = NY.sideFrame(zn.side);
        const v =
          zn.id === 'foyer'
            ? NY.L.WT + NY.L.foyer.D * 0.62
            : zn.id === 'lounge'
              ? NY.L.WT + NY.L.lounge.D * 0.55
              : NY.L.WT + 1.4;
        [lx, lz] = f.toWorld(0, v);
      }
      g.fillText(zn.short, X(lx), Z(lz));
    }
    if (o.entrance !== false) {
      g.font = '500 ' + Math.max(8, fs - 2) + 'px "Jost", system-ui, sans-serif';
      g.fillText('ENTRANCE', X(0), Math.min(hh - 4, Z(BD.z1) + fs * 0.4));
    }
  }
  return { X, Z, s, toWorld: (px, py) => ({ x: BD.x0 + (px - ox) / s, z: BD.z0 + (py - oz) / s }) };
};
function grow(pts, d) {
  let cx = 0,
    cz = 0;
  for (const [x, z] of pts) {
    cx += x / pts.length;
    cz += z / pts.length;
  }
  return pts.map(([x, z]) => {
    const l = Math.hypot(x - cx, z - cz) || 1;
    return [x + ((x - cx) / l) * d * 1.4, z + ((z - cz) / l) * d * 1.4];
  });
}

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
  g.globalAlpha = 0.24;
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
