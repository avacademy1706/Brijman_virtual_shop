// Frame shapes and the lens outline generator. Sizes are in metres; 0.053 = 53 mm lens width.
import { BM } from '../core/bm.js';
import { ARCH } from '../../shared/frame-archetypes.js';

/* ---------- Frame archetypes (canonical sizes in metres) ---------- */
BM.ARCH = ARCH;
BM.SHAPES = {
  rect: { pTop: 5, pBot: 5, taper: 0.04 },
  square: { pTop: 4.2, pBot: 4.2, taper: 0.06 },
  round: { pTop: 2, pBot: 2 },
  oval: { pTop: 2.4, pBot: 2.4 },
  cateye: { pTop: 3.0, pBot: 2.6, lift: 0.34, taper: 0.05 },
  oversize: { pTop: 3.6, pBot: 3.6, taper: 0.08, lift: 0.08 },
  aviator: { pTop: 3.0, pBot: 2.2, top: 0.42, drop: 0.3 },
  brow: { pTop: 3.6, pBot: 3.0, taper: 0.05 },
  geo: { poly: 6 },
};
BM.SHAPE_LABEL = {
  rect: 'Rectangle',
  square: 'Square',
  round: 'Round',
  oval: 'Oval',
  cateye: 'Cat-eye',
  oversize: 'Oversized square',
  aviator: 'Aviator',
  brow: 'Browline',
  geo: 'Geometric',
};
BM.FACES = {
  rect: ['Round', 'Oval'],
  square: ['Round', 'Oval'],
  round: ['Square', 'Heart', 'Oval'],
  oval: ['Square', 'Heart', 'Oval'],
  cateye: ['Round', 'Heart', 'Oval'],
  oversize: ['Heart', 'Oval', 'Round'],
  aviator: ['Square', 'Heart', 'Oval'],
  brow: ['Round', 'Oval', 'Heart'],
  geo: ['Round', 'Oval'],
};

/* Lens outline for the lens on the wearer's left (viewer's right). Nose side is -x. Counter-clockwise. */
BM.outline = function (shape, A, B, n) {
  n = n || 64;
  const s = BM.SHAPES[shape],
    a = A / 2;
  let pts = [];
  if (s.poly) {
    const k = s.poly,
      b = B / 2 / Math.sin(Math.PI / 3);
    const v = [];
    for (let i = 0; i < k; i++) {
      const t = (i / k) * Math.PI * 2;
      v.push([Math.cos(t) * a, Math.sin(t) * b]);
    }
    const per = Math.ceil(n / k);
    for (let i = 0; i < k; i++) {
      const p = v[i],
        q = v[(i + 1) % k];
      for (let j = 0; j < per; j++) {
        const t = j / per;
        pts.push({ x: p[0] + (q[0] - p[0]) * t, y: p[1] + (q[1] - p[1]) * t });
      }
    }
    for (let it = 0; it < 2; it++) {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i],
          q = pts[(i + 1) % pts.length];
        out.push(
          { x: p.x * 0.75 + q.x * 0.25, y: p.y * 0.75 + q.y * 0.25 },
          { x: p.x * 0.25 + q.x * 0.75, y: p.y * 0.25 + q.y * 0.75 },
        );
      }
      pts = out;
    }
    const step = pts.length / n,
      r = [];
    for (let i = 0; i < n; i++) r.push(pts[Math.floor(i * step)]);
    pts = r;
  } else {
    const bt = s.top ? B * s.top : B / 2,
      bb = s.top ? B * (1 - s.top) : B / 2;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2,
        c = Math.cos(t),
        sn = Math.sin(t);
      const e = 2 / (sn >= 0 ? s.pTop : s.pBot);
      let x = a * Math.sign(c) * Math.pow(Math.abs(c), e);
      let y = (sn >= 0 ? bt : bb) * Math.sign(sn) * Math.pow(Math.abs(sn), e);
      if (s.taper) x *= 1 + s.taper * (y / (B / 2));
      const outer = Math.max(0, x / a),
        inner = Math.max(0, -x / a);
      if (s.lift && y > 0) {
        const kk = outer * outer * (y / bt);
        y += s.lift * bt * kk;
        x += s.lift * 0.3 * a * kk;
      }
      if (s.drop && y < 0) y *= 1 + s.drop * (0.2 + 0.8 * inner);
      pts.push({ x, y });
    }
  }
  let minY = Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const cy = (minY + maxY) / 2;
  for (const p of pts) p.y -= cy;
  return pts;
};
/* Indices of the contiguous upper arc (y > yCut), in outline order. */
BM.topArc = function (pts, yCut) {
  const n = pts.length,
    inn = (i) => pts[(i + n) % n].y > yCut;
  let s = -1;
  for (let i = 0; i < n; i++)
    if (inn(i) && !inn(i - 1)) {
      s = i;
      break;
    }
  if (s < 0) return [];
  const out = [];
  for (let k = 0; k < n; k++) {
    const i = (s + k) % n;
    if (!inn(i)) break;
    out.push(i);
  }
  return out;
};
