// Procedural textures for the boutique (nothing is downloaded): Statuario and Nero marble, the inlaid rotunda
// floor, carpets, signage lettering and the gold-rate board.
import * as THREE from 'three';
import { NY } from '../core/ny.js';

const mk = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function ctex(c, o, maxAniso) {
  o = o || {};
  const t = new THREE.CanvasTexture(c);
  if (o.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (o.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Math.min(8, maxAniso || 4);
  return t;
}

/* ---------- value noise for veins ---------- */
function noise2(seed) {
  const r = rng(seed);
  const N = 256,
    perm = new Uint8Array(512),
    val = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    perm[i] = i;
    val[i] = r();
  }
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 256; i++) perm[256 + i] = perm[i];
  const s = (t) => t * t * (3 - 2 * t);
  const at = (x, y) => val[perm[(perm[x & 255] + y) & 255]];
  return (x, y) => {
    const xi = Math.floor(x),
      yi = Math.floor(y),
      xf = x - xi,
      yf = y - yi;
    const a = at(xi, yi),
      b = at(xi + 1, yi),
      c = at(xi, yi + 1),
      d = at(xi + 1, yi + 1);
    const u = s(xf),
      v = s(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function fbm(n, x, y, oct) {
  let f = 0,
    amp = 0.5,
    fr = 1;
  for (let i = 0; i < (oct || 5); i++) {
    f += amp * n(x * fr, y * fr);
    fr *= 2.03;
    amp *= 0.5;
  }
  return f;
}
/** Marble as pixel data: base colour, vein colour, vein sharpness. Tiles seamlessly at size S. */
function marblePixels(S, o) {
  const n = noise2(o.seed || 7);
  const img = new ImageData(S, S);
  const d = img.data;
  const base = new THREE.Color(o.base),
    vein = new THREE.Color(o.vein),
    cloud = new THREE.Color(o.cloud || o.base);
  const k = o.scale || 4;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      // tileable: blend four samples
      const u = x / S,
        v = y / S;
      const smp = (ox, oy) => fbm(n, (u + ox) * k, (v + oy) * k, 5);
      const f =
        smp(0, 0) * (1 - u) * (1 - v) + smp(-1, 0) * u * (1 - v) + smp(0, -1) * (1 - u) * v + smp(-1, -1) * u * v;
      const w = Math.sin((u * o.dir[0] + v * o.dir[1]) * Math.PI * 2 * (o.bands || 2) + f * (o.turb || 9));
      const vv = Math.pow(1 - Math.abs(w), o.sharp || 18);
      const fine = Math.pow(1 - Math.abs(Math.sin((u * 3 + v * 5) * 13 + f * 21)), 60) * 0.35;
      const c2 = f * 0.5;
      const m = Math.min(1, vv * (o.veinAmt || 0.85) + fine * (o.fineAmt || 1));
      const r = base.r * (1 - c2 * 0.15) + (cloud.r - base.r) * c2,
        g = base.g * (1 - c2 * 0.15) + (cloud.g - base.g) * c2,
        b = base.b * (1 - c2 * 0.15) + (cloud.b - base.b) * c2;
      const i = (y * S + x) * 4;
      d[i] = 255 * (r + (vein.r - r) * m);
      d[i + 1] = 255 * (g + (vein.g - g) * m);
      d[i + 2] = 255 * (b + (vein.b - b) * m);
      d[i + 3] = 255;
    }
  return img;
}
export function texMarble(o, aniso) {
  const S = o.size || 512;
  const c = mk(S, S);
  c.getContext('2d').putImageData(marblePixels(S, o), 0, 0);
  return ctex(c, {}, aniso);
}
export const MARBLE = {
  statuario: {
    base: '#f3efe8',
    cloud: '#e9e4dc',
    vein: '#8e8a86',
    dir: [1, 0.6],
    bands: 1.5,
    turb: 10,
    sharp: 26,
    seed: 11,
  },
  nero: {
    base: '#141313',
    cloud: '#1d1b1b',
    vein: '#d8d2c8',
    dir: [0.7, 1],
    bands: 2,
    turb: 12,
    sharp: 40,
    veinAmt: 0.8,
    fineAmt: 0.6,
    seed: 23,
  },
  crema: {
    base: '#e8dcc8',
    cloud: '#e1d2ba',
    vein: '#b9a080',
    dir: [1, 0.3],
    bands: 1,
    turb: 8,
    sharp: 20,
    veinAmt: 0.45,
    seed: 5,
  },
  verde: {
    base: '#173a2e',
    cloud: '#1e4638',
    vein: '#d6e3d6',
    dir: [0.4, 1],
    bands: 2,
    turb: 13,
    sharp: 36,
    veinAmt: 0.7,
    seed: 41,
  },
};

/**
 * The rotunda floor: Statuario field with a Nero border, a compass star around the plinth and brass inlay lines.
 * Covers a square of side 2 * half metres centred on the origin.
 */
export function texRotundaFloor(half, aniso) {
  const S = 2048;
  const c = mk(S, S),
    g = c.getContext('2d');
  const W = MARBLE.statuario;
  // marble field, tiled
  const tile = mk(512, 512);
  tile.getContext('2d').putImageData(marblePixels(512, Object.assign({}, W, { scale: 3 })), 0, 0);
  const pat = g.createPattern(tile, 'repeat');
  g.fillStyle = pat;
  g.fillRect(0, 0, S, S);
  const nero = mk(256, 256);
  nero.getContext('2d').putImageData(marblePixels(256, Object.assign({}, MARBLE.nero, { scale: 3 })), 0, 0);
  const pn = g.createPattern(nero, 'repeat');
  const px = S / (2 * half); // pixels per metre
  const C = S / 2;
  const R = NY.L.R,
    A = NY.L.A;
  const oct = (r, keep) => {
    if (!keep) g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      const x = C + r * Math.sin(a) * px,
        y = C + r * Math.cos(a) * px;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.closePath();
  };
  const brass = '#c9a458';
  // border band of Nero along the walls with a brass line inside
  g.save();
  oct(R + 0.5);
  oct(R - 0.62, true);
  g.fillStyle = pn;
  g.fill('evenodd');
  g.restore();
  g.lineWidth = 0.025 * px;
  g.strokeStyle = brass;
  oct(R - 0.7);
  g.stroke();
  // concentric rings
  const ring = (r0, r1, fill) => {
    g.beginPath();
    g.arc(C, C, r1 * px, 0, Math.PI * 2);
    g.arc(C, C, r0 * px, 0, Math.PI * 2, true);
    g.fillStyle = fill;
    g.fill();
  };
  ring(3.0, 3.25, pn);
  g.lineWidth = 0.022 * px;
  g.strokeStyle = brass;
  for (const r of [2.92, 3.33, 1.05]) {
    g.beginPath();
    g.arc(C, C, r * px, 0, Math.PI * 2);
    g.stroke();
  }
  // compass star: sixteen points, alternating Nero and Crema, around the plinth
  const crema = mk(256, 256);
  crema.getContext('2d').putImageData(marblePixels(256, Object.assign({}, MARBLE.crema, { scale: 3 })), 0, 0);
  const pc = g.createPattern(crema, 'repeat');
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const long = i % 2 === 0;
    const r1 = long ? 2.75 : 1.95,
      w = long ? 0.26 : 0.2;
    const tip = [C + Math.sin(a) * r1 * px, C + Math.cos(a) * r1 * px];
    const l = [C + Math.sin(a - w) * 1.05 * px, C + Math.cos(a - w) * 1.05 * px];
    const r = [C + Math.sin(a + w) * 1.05 * px, C + Math.cos(a + w) * 1.05 * px];
    const m = [C + Math.sin(a) * 1.05 * px, C + Math.cos(a) * 1.05 * px];
    // two halves in light and dark, like a real inlaid star
    g.beginPath();
    g.moveTo(m[0], m[1]);
    g.lineTo(l[0], l[1]);
    g.lineTo(tip[0], tip[1]);
    g.closePath();
    g.fillStyle = long ? pn : pc;
    g.fill();
    g.beginPath();
    g.moveTo(m[0], m[1]);
    g.lineTo(r[0], r[1]);
    g.lineTo(tip[0], tip[1]);
    g.closePath();
    g.fillStyle = long ? pc : pn;
    g.fill();
    g.lineWidth = 0.012 * px;
    g.strokeStyle = brass;
    g.beginPath();
    g.moveTo(l[0], l[1]);
    g.lineTo(tip[0], tip[1]);
    g.lineTo(r[0], r[1]);
    g.stroke();
  }
  // radial brass rays from the star to the outer ring, between the salons
  g.lineWidth = 0.02 * px;
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    g.beginPath();
    g.moveTo(C + Math.sin(a) * 3.33 * px, C + Math.cos(a) * 3.33 * px);
    g.lineTo(C + Math.sin(a) * (A - 0.62) * px, C + Math.cos(a) * (A - 0.62) * px);
    g.stroke();
  }
  return ctex(c, { repeat: false }, aniso);
}

/** A carpet with a quiet damask pattern in two tones. */
export function texCarpet(base, motif, aniso) {
  const S = 512;
  const c = mk(S, S),
    g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  // pile: fine noise
  const r = rng(3);
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 14;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = motif;
  g.fillStyle = motif;
  g.globalAlpha = 0.55;
  g.lineWidth = 3;
  // damask: a lozenge lattice with a flower in each cell
  const cell = S / 2;
  for (let cy = 0; cy <= 2; cy++)
    for (let cx = 0; cx <= 2; cx++) {
      const x = cx * cell,
        y = cy * cell;
      g.beginPath();
      g.moveTo(x, y - cell * 0.42);
      g.quadraticCurveTo(x + cell * 0.2, y, x, y + cell * 0.42);
      g.quadraticCurveTo(x - cell * 0.2, y, x, y - cell * 0.42);
      g.stroke();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        g.beginPath();
        g.ellipse(x + cell / 2 + Math.cos(a) * 22, y + cell / 2 + Math.sin(a) * 22, 14, 6, a, 0, Math.PI * 2);
        g.fill();
      }
    }
  g.globalAlpha = 1;
  return ctex(c, {}, aniso);
}

/** Text drawn as an image: gold capitals with generous tracking (signs over the arches). */
export function textCanvas(text, o) {
  const w = o.w || 1024,
    h = o.h || 160;
  const c = mk(w, h),
    g = c.getContext('2d');
  const track = o.track == null ? 0.22 : o.track;
  let fs = o.size || Math.round(h * 0.62);
  const font = (s) =>
    (o.weight || 600) +
    ' ' +
    (o.italic ? 'italic ' : '') +
    s +
    'px ' +
    (o.font || '"Cormorant Garamond", Garamond, "Times New Roman", serif');
  const measure = (s) => {
    g.font = font(s);
    const chars = [...text],
      ws = chars.map((x) => g.measureText(x).width);
    return { chars, ws, tot: ws.reduce((a, b) => a + b, 0) + track * s * (chars.length - 1) };
  };
  let m = measure(fs);
  if (m.tot > w * 0.94) {
    fs = Math.floor((fs * w * 0.94) / m.tot);
    m = measure(fs);
  }
  if (o.bg) {
    g.fillStyle = o.bg;
    g.fillRect(0, 0, w, h);
  }
  const grad = g.createLinearGradient(0, h * 0.2, 0, h * 0.85);
  grad.addColorStop(0, o.c1 || '#f6dfa0');
  grad.addColorStop(0.5, o.c2 || '#c9a24f');
  grad.addColorStop(1, o.c3 || '#8a6526');
  g.fillStyle = o.color || grad;
  g.textBaseline = 'middle';
  let x = (w - m.tot) / 2;
  const y = h * (o.y || 0.54);
  if (o.shadow) {
    g.shadowColor = o.shadow;
    g.shadowBlur = fs * 0.12;
    g.shadowOffsetY = fs * 0.04;
  }
  m.chars.forEach((ch, i) => {
    g.fillText(ch, x, y);
    x += m.ws[i] + track * fs;
  });
  return c;
}

/** The gold-rate board in the foyer: today's rates per gram. */
export function rateBoard(aniso) {
  const W = 768,
    H = 1024;
  const c = mk(W, H),
    g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#16110c');
  grd.addColorStop(1, '#0b0806');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#b8924a';
  g.lineWidth = 6;
  g.strokeRect(22, 22, W - 44, H - 44);
  g.lineWidth = 1.5;
  g.strokeRect(36, 36, W - 72, H - 72);
  const serif = '"Cormorant Garamond", Garamond, serif',
    sans = '"Jost", "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.fillStyle = '#d9b874';
  g.font = '600 64px ' + serif;
  g.fillText('TODAY’S RATES', W / 2, 130);
  g.font = '400 26px ' + sans;
  g.fillStyle = '#a8977d';
  g.fillText('per gram, before making charges and GST', W / 2, 178);
  const R = NY.RATES;
  const rows = [
    ['24K Gold', R.gold24],
    ['22K Gold (916)', R.gold24 * 0.916],
    ['18K Gold (750)', R.gold24 * 0.75],
    ['Platinum 950', R.platinum],
    ['Silver 925', R.silver],
  ];
  const money = (n) => '₹ ' + Math.round(n).toLocaleString('en-IN');
  rows.forEach(([n, v], i) => {
    const y = 300 + i * 128;
    g.textAlign = 'left';
    g.fillStyle = '#efe4cf';
    g.font = '500 38px ' + sans;
    g.fillText(n, 80, y);
    g.textAlign = 'right';
    g.fillStyle = '#f3d68d';
    g.font = '600 54px ' + serif;
    g.fillText(money(v), W - 80, y + 4);
    g.strokeStyle = 'rgba(184,146,74,.35)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(80, y + 46);
    g.lineTo(W - 80, y + 46);
    g.stroke();
  });
  g.textAlign = 'center';
  g.fillStyle = '#8f806a';
  g.font = '400 24px ' + sans;
  g.fillText(NY.RATES.label + ' · tap for details', W / 2, H - 70);
  return ctex(c, { repeat: false }, aniso);
}

/** Soft round and soft rectangle gradients for contact shadows and light pools. */
export function texSoftRound() {
  const S = 128,
    c = mk(S, S),
    g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.45, 'rgba(255,255,255,.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  return ctex(c, { repeat: false, srgb: false });
}
export function texSoftRect() {
  const S = 128,
    c = mk(S, S),
    g = c.getContext('2d');
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = Math.max(0, Math.abs(x - S / 2 + 0.5) / (S / 2) - 0.55) / 0.45,
        dy = Math.max(0, Math.abs(y - S / 2 + 0.5) / (S / 2) - 0.55) / 0.45;
      const a = Math.max(0, 1 - Math.hypot(dx, dy));
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = 255 * a * a;
    }
  g.putImageData(img, 0, 0);
  return ctex(c, { repeat: false, srgb: false });
}
/** Vertical light falloff for the volumetric cones. */
export function texCone() {
  const c = mk(4, 256),
    g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(255,255,255,0.0)');
  gr.addColorStop(0.15, 'rgba(255,255,255,0.9)');
  gr.addColorStop(1, 'rgba(255,255,255,0.0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 256);
  return ctex(c, { repeat: false, srgb: false });
}
/** Evening street seen through the doors: dusk sky and soft lights. */
export function texDusk() {
  const W = 1024,
    H = 512;
  const c = mk(W, H),
    g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#1b2236');
  gr.addColorStop(0.55, '#3b3446');
  gr.addColorStop(0.7, '#6a4a45');
  gr.addColorStop(1, '#2a221f');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  const r = rng(9);
  for (let i = 0; i < 70; i++) {
    const x = r() * W,
      y = H * (0.55 + r() * 0.35),
      s = 6 + r() * 26;
    const b = g.createRadialGradient(x, y, 0, x, y, s);
    b.addColorStop(0, 'rgba(255,214,150,.55)');
    b.addColorStop(1, 'rgba(255,214,150,0)');
    g.fillStyle = b;
    g.fillRect(x - s, y - s, 2 * s, 2 * s);
  }
  return ctex(c, { repeat: false });
}
