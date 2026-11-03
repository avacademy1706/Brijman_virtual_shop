// Procedural textures for the salon, drawn on canvases at start-up (no image downloads): herringbone oak,
// white marble, pale stone walls, travertine, linen, plaster, a boucle rug, pampas plumes, the backlit posters,
// the wordmark and the directory screen. `hi` doubles the resolution of the large surfaces on capable screens.
import * as THREE from 'three';

import { NY } from '../core/ny.js';
import '../data/frames.js';
import '../data/store-layout.js';
import '../lib/drawings.js';

const mk = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
export const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const hash2 = (a, b, s) => {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(s, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
/** Value noise that tiles with an integer period P (lattice cells). */
function noise2(x, y, P, s) {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const xf = x - xi,
    yf = y - yi;
  const x0 = ((xi % P) + P) % P,
    y0 = ((yi % P) + P) % P,
    x1 = (x0 + 1) % P,
    y1 = (y0 + 1) % P;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  const a = hash2(x0, y0, s),
    b = hash2(x1, y0, s),
    c = hash2(x0, y1, s),
    d = hash2(x1, y1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, P, s, oct) {
  let amp = 0.5,
    f = 1,
    sum = 0,
    norm = 0;
  for (let o = 0; o < oct; o++) {
    sum += amp * noise2(x * f, y * f, P * f, s + o * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

export function makeSalonTextures(o) {
  o = o || {};
  const aniso = o.aniso || 4;
  const hi = !!o.hi;
  function ctex(c, opt) {
    opt = opt || {};
    const t = new THREE.CanvasTexture(c);
    if (opt.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    if (opt.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Math.min(opt.aniso || 8, aniso);
    return t;
  }

  /* Herringbone oak: planks 6 widths long, laid in the classic interlocking pattern. The canvas holds two
     pattern periods (24 plank widths); planks are numbered modulo that, so the texture tiles seamlessly. */
  function herringbone(S) {
    const k = 6,
      N = 2 * k,
      T = 2 * N;
    const c = mk(S, S),
      g = c.getContext('2d'),
      img = g.createImageData(S, S),
      d = img.data;
    const cell = S / T;
    const tones = [
      [214, 199, 177],
      [206, 189, 165],
      [221, 207, 187],
      [199, 182, 158],
      [210, 194, 171],
      [218, 203, 182],
      [203, 186, 161],
    ];
    for (let py = 0; py < S; py++) {
      const y = (py + 0.5) / cell;
      const j = Math.floor(y);
      for (let px = 0; px < S; px++) {
        const x = (px + 0.5) / cell;
        let a = (x - j) % N;
        if (a < 0) a += N;
        let along, across, id;
        if (a < k) {
          along = a;
          across = y - j;
          const n = Math.floor((x - j) / N);
          id = (((j % T) + T) % T) * 2 + (((n % 2) + 2) % 2);
        } else {
          const i = Math.floor(x);
          let t = (i - y) % N;
          if (t < 0) t += N;
          along = t - (k - 1);
          across = x - i;
          const n = Math.floor((i - j) / N);
          id = 1000 + (((i % T) + T) % T) * 2 + (((n % 2) + 2) % 2);
        }
        const h = hash2(id, 7, 3);
        const tone = tones[Math.floor(h * tones.length)];
        const bright = 0.95 + hash2(id, 11, 5) * 0.09;
        // grain runs along the plank
        const gr =
          noise2(across * 9 + h * 50, along * 0.35, 4096, id) * 0.6 +
          noise2(across * 28, along * 1.4, 4096, id + 3) * 0.4;
        let k1 = bright * (0.93 + gr * 0.12);
        // soft cathedral figure on some planks
        if (h > 0.55) k1 *= 1 - 0.035 * Math.max(0, Math.sin(across * 9 + Math.sin(along * 1.3 + h * 9) * 2.2));
        // seams and a slight bevel
        const e = Math.min(across, 1 - across) / 0.03,
          ee = Math.min(along, k - along) / 0.02;
        const edge = Math.min(e, ee);
        if (edge < 1) k1 *= 0.8 + 0.2 * edge;
        const p = (py * S + px) * 4;
        d[p] = Math.min(255, tone[0] * k1);
        d[p + 1] = Math.min(255, tone[1] * k1);
        d[p + 2] = Math.min(255, tone[2] * k1);
        d[p + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return ctex(c, { aniso: 16 });
  }

  /* Marble: soft clouds with veins that wander (phase-warped sine bands), all periodic so it tiles. */
  function marble(S, seed, opt) {
    const c = mk(S, S),
      g = c.getContext('2d'),
      img = g.createImageData(S, S),
      d = img.data;
    const base = opt.base,
      vein = opt.vein,
      P = opt.P || 4;
    for (let py = 0; py < S; py++) {
      const v = py / S;
      for (let px = 0; px < S; px++) {
        const u = px / S;
        const n = fbm(u * P, v * P, P, seed, 5);
        const n2 = fbm(u * P * 2 + 5, v * P * 2, P * 2, seed + 9, 4);
        const n3 = fbm(u * P * 4, v * P * 4, P * 4, seed + 21, 3);
        // main veins: long, gently wandering lines that thin out and fade along their length
        const ph = 2 * Math.PI * (u * opt.cu + v * opt.cv) + n * opt.warp;
        const fade = 0.35 + 0.65 * Math.pow(n2, 1.4);
        const v1 = Math.pow(1 - Math.abs(Math.sin(ph)), opt.sharp) * fade;
        // fine hair veins branching across them
        const ph2 = 2 * Math.PI * (u * 2 - v * 1) + n2 * opt.warp * 1.6 + n3 * 2 + 1.3;
        const v2 = Math.pow(1 - Math.abs(Math.sin(ph2)), opt.sharp * 3) * 0.45 * (n3 > 0.48 ? 1 : 0.35);
        const halo = Math.pow(1 - Math.abs(Math.sin(ph)), opt.sharp * 0.12) * 0.1 * fade;
        const cloud = 0.985 + (n2 - 0.5) * opt.cloud;
        const t = Math.min(1, (v1 + v2 + halo) * opt.strength);
        const p = (py * S + px) * 4;
        for (let ch = 0; ch < 3; ch++) d[p + ch] = base[ch] * cloud * (1 - t) + vein[ch] * t;
        d[p + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return ctex(c);
  }

  /* Travertine: warm beige with horizontal banding and small pores. */
  function travertine(S) {
    const c = mk(S, S),
      g = c.getContext('2d'),
      img = g.createImageData(S, S),
      d = img.data;
    for (let py = 0; py < S; py++) {
      const v = py / S;
      for (let px = 0; px < S; px++) {
        const u = px / S;
        const band = fbm(u * 2, v * 16, 2, 41, 4);
        const fine = noise2(u * 64, v * 128, 64, 43);
        const k = 0.9 + band * 0.16 + (fine - 0.5) * 0.05;
        const p = (py * S + px) * 4;
        d[p] = 206 * k;
        d[p + 1] = 188 * k;
        d[p + 2] = 163 * k;
        d[p + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const R = rng(5);
    for (let i = 0; i < 260; i++) {
      const x = R() * S,
        y = R() * S,
        w = 1 + R() * 5,
        h = 0.6 + R() * 1.3;
      g.fillStyle = 'rgba(120,98,72,' + (0.25 + R() * 0.35) + ')';
      g.beginPath();
      g.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
      g.fill();
    }
    return ctex(c);
  }

  /* Plain warm surfaces with a little life: plaster, linen, the boucle rug. */
  function mottled(S, rgb, amt, seed, P) {
    const c = mk(S, S),
      g = c.getContext('2d'),
      img = g.createImageData(S, S),
      d = img.data;
    for (let py = 0; py < S; py++)
      for (let px = 0; px < S; px++) {
        const n = fbm((px / S) * P, (py / S) * P, P, seed, 4);
        const k = 1 + (n - 0.5) * amt;
        const p = (py * S + px) * 4;
        d[p] = rgb[0] * k;
        d[p + 1] = rgb[1] * k;
        d[p + 2] = rgb[2] * k;
        d[p + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    return c;
  }
  function linen() {
    const S = 256,
      c = mottled(S, [204, 190, 172], 0.08, 61, 4),
      g = c.getContext('2d');
    const R = rng(62);
    for (let i = 0; i < S; i += 2) {
      g.fillStyle = 'rgba(255,255,255,' + (0.03 + R() * 0.04) + ')';
      g.fillRect(0, i, S, 1);
      g.fillStyle = 'rgba(90,70,50,' + (0.02 + R() * 0.04) + ')';
      g.fillRect(i, 0, 1, S);
    }
    return ctex(c);
  }
  function boucle() {
    const S = 512,
      c = mottled(S, [232, 226, 214], 0.06, 71, 4),
      g = c.getContext('2d');
    const R = rng(72);
    for (let i = 0; i < 9000; i++) {
      const x = R() * S,
        y = R() * S,
        r = 1.5 + R() * 2.6;
      g.strokeStyle = R() < 0.5 ? 'rgba(255,252,246,.55)' : 'rgba(170,158,140,.35)';
      g.lineWidth = 0.9;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.stroke();
    }
    return ctex(c);
  }
  /** Vertical light falloff for the lit niches: bright under the light at the top, softer below. */
  function nicheGlow() {
    const c = mk(8, 256),
      g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#fff6e8');
    gr.addColorStop(0.18, '#f4e9d9');
    gr.addColorStop(0.6, '#cdbfae');
    gr.addColorStop(1, '#a99a87');
    g.fillStyle = gr;
    g.fillRect(0, 0, 8, 256);
    return ctex(c, { repeat: false });
  }
  /** A soft warm pool of light (additive), for lamp light on marble and spill under shelves. */
  function pool() {
    const c = mk(128, 128),
      g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,214,160,1)');
    gr.addColorStop(0.45, 'rgba(255,200,140,.42)');
    gr.addColorStop(1, 'rgba(255,190,130,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    return ctex(c, { repeat: false });
  }
  function softRect() {
    const S = 128,
      c = mk(S, S),
      g = c.getContext('2d'),
      img = g.createImageData(S, S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const dx = Math.min(1, Math.min(x, S - 1 - x) / (S * 0.3)),
          dy = Math.min(1, Math.min(y, S - 1 - y) / (S * 0.3));
        const dd = dx * dy,
          a = dd * dd * (3 - 2 * dd),
          i = (y * S + x) * 4;
        img.data[i + 3] = a * 255;
      }
    g.putImageData(img, 0, 0);
    return ctex(c, { repeat: false, srgb: false });
  }
  function softRound() {
    const c = mk(128, 128),
      g = c.getContext('2d'),
      gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(0.55, 'rgba(0,0,0,0.55)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    return ctex(c, { repeat: false, srgb: false });
  }
  function edge() {
    const c = mk(4, 64),
      g = c.getContext('2d'),
      gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 64);
    return ctex(c, { repeat: false, srgb: false });
  }
  /** A pampas plume: fine strands either side of a stem, as an alpha texture for crossed quads. */
  function plume() {
    const W = 128,
      Hh = 512,
      c = mk(W, Hh),
      g = c.getContext('2d');
    const R = rng(81);
    g.lineCap = 'round';
    for (let i = 0; i < 2600; i++) {
      const t = Math.pow(R(), 0.75); // along the stem, 0 = tip
      const y = 10 + t * (Hh - 30);
      const reach = (0.2 + 0.8 * Math.sin(Math.min(1, t * 1.2) * Math.PI * 0.62)) * (W * 0.48);
      const side = R() < 0.5 ? -1 : 1;
      const len = reach * (0.45 + R() * 0.55);
      const ang = -0.9 - R() * 0.5;
      g.strokeStyle = 'rgba(255,248,236,' + (0.16 + R() * 0.26) + ')';
      g.lineWidth = 0.5 + R() * 1.1;
      g.beginPath();
      g.moveTo(W / 2, y);
      g.quadraticCurveTo(
        W / 2 + side * len * 0.55,
        y + Math.sin(ang) * len * 0.35,
        W / 2 + side * len,
        y + Math.sin(ang) * len * 0.75,
      );
      g.stroke();
    }
    g.strokeStyle = 'rgba(214,196,168,.9)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(W / 2, 6);
    g.lineTo(W / 2, Hh);
    g.stroke();
    return ctex(c, { repeat: false });
  }

  /* ---------- Printed and backlit pieces ---------- */
  const DISPLAY = '"Bodoni Moda", "Didot", "Bodoni 72", Georgia, serif';
  const TEXT = '"Jost", "Futura", "Avenir Next", "Segoe UI", sans-serif';
  function spaced(g, text, x, y, track, align) {
    const chars = [...text];
    const ws = chars.map((ch) => g.measureText(ch).width);
    const tot = ws.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
    let cx = align === 'left' ? x : align === 'right' ? x - tot : x - tot / 2;
    const prev = g.textAlign;
    g.textAlign = 'left';
    chars.forEach((ch, i) => {
      g.fillText(ch, cx, y);
      cx += ws[i] + track;
    });
    g.textAlign = prev;
    return tot;
  }
  /** Draws a pair of glasses from a frame archetype, big, for the posters. */
  function drawGlasses(g, archId, cx, cy, width, o) {
    const a = NY.ARCH[archId];
    const pts = NY.outline(a.shape, a.A, a.B, 72);
    const total = 2 * a.A + a.dbl;
    const s = width / total;
    const lx = (a.dbl / 2 + a.A / 2) * s;
    const path = (sgn) => {
      g.beginPath();
      pts.forEach((p, i) => {
        const x = cx + sgn * (lx + p.x * s),
          y = cy - p.y * s;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      });
      g.closePath();
    };
    for (const sgn of [-1, 1]) {
      // lenses
      path(sgn);
      const lg = g.createLinearGradient(
        cx + sgn * lx - a.A * s * 0.5,
        cy - a.B * s * 0.5,
        cx + sgn * lx + a.A * s * 0.4,
        cy + a.B * s * 0.5,
      );
      lg.addColorStop(0, o.lens0);
      lg.addColorStop(1, o.lens1);
      g.fillStyle = lg;
      g.fill();
      // a reflection of the light
      g.save();
      path(sgn);
      g.clip();
      g.fillStyle = 'rgba(255,255,255,' + (o.glint || 0.22) + ')';
      g.beginPath();
      g.ellipse(
        cx + sgn * lx - a.A * s * 0.18,
        cy - a.B * s * 0.2,
        a.A * s * 0.32,
        a.B * s * 0.1,
        -0.5,
        0,
        Math.PI * 2,
      );
      g.fill();
      g.restore();
      path(sgn);
      g.lineWidth = o.rim;
      g.strokeStyle = o.frame;
      g.stroke();
    }
    // bridge and temples
    g.lineWidth = o.rim * 0.85;
    g.strokeStyle = o.frame;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - a.dbl * s * 0.5 - o.rim * 0.3, cy - a.B * s * 0.14);
    g.quadraticCurveTo(cx, cy - a.B * s * 0.36, cx + a.dbl * s * 0.5 + o.rim * 0.3, cy - a.B * s * 0.14);
    g.stroke();
    if (a.dbridge) {
      g.lineWidth = o.rim * 0.5;
      g.beginPath();
      g.moveTo(cx - lx * 0.8, cy - a.B * s * 0.38);
      g.lineTo(cx + lx * 0.8, cy - a.B * s * 0.38);
      g.stroke();
    }
  }
  function poster(id) {
    const W = 600,
      Hh = 980,
      c = mk(W, Hh),
      g = c.getContext('2d');
    g.textBaseline = 'alphabetic';
    if (id === 'solstice') {
      const bg = g.createLinearGradient(0, 0, 0, Hh);
      bg.addColorStop(0, '#e9c9a4');
      bg.addColorStop(0.55, '#d79c6c');
      bg.addColorStop(1, '#a8603f');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, Hh);
      // the sun
      const sun = g.createRadialGradient(W * 0.68, Hh * 0.3, 10, W * 0.68, Hh * 0.3, 260);
      sun.addColorStop(0, 'rgba(255,240,214,.95)');
      sun.addColorStop(0.35, 'rgba(255,226,186,.55)');
      sun.addColorStop(1, 'rgba(255,214,170,0)');
      g.fillStyle = sun;
      g.fillRect(0, 0, W, Hh);
      g.fillStyle = 'rgba(120,58,34,.18)';
      for (let i = 0; i < 6; i++) g.fillRect(0, Hh * 0.62 + i * 26, W, 9 - i);
      drawGlasses(g, 'cateyeA', W / 2, Hh * 0.47, 470, {
        frame: '#2a160c',
        rim: 16,
        lens0: 'rgba(40,24,18,.95)',
        lens1: 'rgba(120,64,40,.92)',
        glint: 0.28,
      });
      g.fillStyle = '#fff7ec';
      g.font = 'italic 500 104px ' + DISPLAY;
      g.textAlign = 'center';
      g.fillText('Solstice', W / 2, 170);
      g.font = '500 22px ' + TEXT;
      spaced(g, 'SUN EDITIONS  ·  UV400', W / 2, 214, 5);
      g.font = '500 30px ' + DISPLAY;
      spaced(g, 'BRIJMAN', W / 2, Hh - 70, 14);
    } else if (id === 'atelier') {
      g.fillStyle = '#5e6650';
      g.fillRect(0, 0, W, Hh);
      const v = g.createRadialGradient(W * 0.5, Hh * 0.45, 40, W * 0.5, Hh * 0.45, 560);
      v.addColorStop(0, 'rgba(160,168,138,.55)');
      v.addColorStop(1, 'rgba(40,44,34,.4)');
      g.fillStyle = v;
      g.fillRect(0, 0, W, Hh);
      // long soft shadow, then the frame
      g.save();
      g.translate(26, 34);
      g.filter = 'blur(10px)';
      drawGlasses(g, 'roundM', W / 2, Hh * 0.5, 430, {
        frame: 'rgba(20,22,16,.35)',
        rim: 7,
        lens0: 'rgba(0,0,0,0)',
        lens1: 'rgba(0,0,0,0)',
        glint: 0,
      });
      g.restore();
      drawGlasses(g, 'roundM', W / 2, Hh * 0.5, 430, {
        frame: '#e2c27e',
        rim: 6,
        lens0: 'rgba(255,255,255,.08)',
        lens1: 'rgba(255,255,255,.18)',
        glint: 0.18,
      });
      g.fillStyle = '#f4efe2';
      g.textAlign = 'center';
      g.font = '500 22px ' + TEXT;
      spaced(g, 'NEW COLLECTION', W / 2, 150, 7);
      g.font = 'italic 500 112px ' + DISPLAY;
      g.fillText('Atelier', W / 2, 262);
      g.font = '500 20px ' + TEXT;
      spaced(g, 'BETA TITANIUM  ·  18K PLATED', W / 2, Hh - 120, 4);
      g.font = '500 28px ' + DISPLAY;
      spaced(g, 'BRIJMAN', W / 2, Hh - 64, 14);
    } else {
      const bg = g.createLinearGradient(0, 0, W, Hh);
      bg.addColorStop(0, '#dfe5e6');
      bg.addColorStop(1, '#b9c6ca');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, Hh);
      g.strokeStyle = 'rgba(255,255,255,.5)';
      g.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        g.beginPath();
        g.arc(W / 2, Hh * 0.52, 90 + i * 34, 0, Math.PI * 2);
        g.stroke();
      }
      drawGlasses(g, 'oversizeA', W / 2, Hh * 0.52, 460, {
        frame: 'rgba(236,224,214,.95)',
        rim: 18,
        lens0: 'rgba(255,255,255,.35)',
        lens1: 'rgba(200,220,230,.4)',
        glint: 0.35,
      });
      g.fillStyle = '#28333a';
      g.textAlign = 'center';
      g.font = '500 22px ' + TEXT;
      spaced(g, 'NEW COLLECTION', W / 2, 150, 7);
      g.font = 'italic 500 108px ' + DISPLAY;
      g.fillText('Clarity', W / 2, 262);
      g.font = '500 24px ' + TEXT;
      g.fillText('A new way of seeing', W / 2, Hh - 132);
      g.font = '500 28px ' + DISPLAY;
      spaced(g, 'BRIJMAN', W / 2, Hh - 66, 14);
    }
    return ctex(c, { repeat: false });
  }
  function wordmark() {
    const W = 1400,
      Hh = 300,
      c = mk(W, Hh),
      g = c.getContext('2d');
    g.fillStyle = '#5b4a3a';
    g.textAlign = 'center';
    g.font = '500 170px ' + DISPLAY;
    spaced(g, 'BRIJMAN', W / 2, 190, 42);
    g.font = '500 34px ' + TEXT;
    g.fillStyle = '#7b6a57';
    spaced(g, 'OPTICALS', W / 2, 262, 22);
    return ctex(c, { repeat: false });
  }
  function directory() {
    const W = 512,
      Hh = 1024,
      c = mk(W, Hh),
      g = c.getContext('2d');
    g.fillStyle = '#f6f1ea';
    g.fillRect(0, 0, W, Hh);
    g.fillStyle = '#2a2622';
    g.textAlign = 'center';
    g.font = '500 58px ' + DISPLAY;
    spaced(g, 'BRIJMAN', W / 2, 104, 12);
    g.font = '500 17px ' + TEXT;
    g.fillStyle = '#8a7a66';
    spaced(g, 'SALON DIRECTORY', W / 2, 146, 6);
    const mw = W - 72,
      mh = (mw * (NY.L.z1 - NY.L.z0)) / (NY.L.x1 - NY.L.x0);
    g.save();
    g.translate(36, 182);
    const m = NY.drawPlan(g, mw, mh, {
      colors: {
        floor: '#ece4d8',
        zone: '#e6dccd',
        zoneOn: '#e6dccd',
        item: '#c9baa5',
        wall: '#5b4a3a',
        text: '#3a332c',
        you: '#1f2b45',
      },
      labels: true,
      labelSize: 14,
      pad: 4,
      entrance: true,
    });
    g.fillStyle = '#1f2b45';
    g.beginPath();
    g.arc(m.X(NY.L.totem.x), m.Z(NY.L.totem.z + 0.3), 7, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.textAlign = 'left';
    g.font = '500 15px ' + TEXT;
    g.fillStyle = '#1f2b45';
    g.fillText('●  YOU ARE HERE', 44, 182 + mh + 36);
    let y = 182 + mh + 84;
    NY.TOUR.forEach((id, i) => {
      const z = NY.zoneById(id);
      g.fillStyle = '#8a7a66';
      g.font = '500 16px ' + TEXT;
      g.fillText(String(i + 1).padStart(2, '0'), 44, y);
      g.fillStyle = '#2a2622';
      g.font = '500 26px ' + DISPLAY;
      g.fillText(z.name, 88, y + 1);
      y += 44;
    });
    return ctex(c, { repeat: false });
  }
  function boxArt() {
    const c = mk(128, 128),
      g = c.getContext('2d');
    g.fillStyle = '#c9c9c9';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 44, 128, 40);
    g.strokeStyle = '#9a9a9a';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(28, 64, 10, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#9a9a9a';
    g.fillRect(50, 58, 60, 5);
    g.fillRect(50, 68, 40, 4);
    return ctex(c, { repeat: false });
  }
  function wood(base, dark, light, seed) {
    const S = 512,
      c = mk(S, S),
      g = c.getContext('2d'),
      R = rng(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 170; i++) {
      const x0 = R() * S,
        amp = 1 + R() * 4,
        freq = ((1 + Math.floor(R() * 3)) * 2 * Math.PI) / S,
        ph = R() * 6.28;
      g.strokeStyle = R() < 0.7 ? dark : light;
      g.globalAlpha = 0.05 + R() * 0.12;
      g.lineWidth = 0.6 + R() * 2.2;
      for (const ox of [0, -S, S]) {
        g.beginPath();
        for (let y = 0; y <= S; y += 8) {
          const x = x0 + ox + Math.sin(y * freq + ph) * amp + Math.sin(y * freq * 3 + ph * 2) * amp * 0.25;
          if (y) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    return ctex(c);
  }

  const big = hi ? 2048 : 1024,
    mid = hi ? 1024 : 512;
  return {
    floor: herringbone(big),
    marble: marble(mid, 11, {
      base: [244, 242, 238],
      vein: [150, 147, 143],
      cu: 1,
      cv: 1,
      warp: 3.2,
      sharp: 34,
      strength: 0.95,
      cloud: 0.04,
      P: 3,
    }),
    stone: marble(mid, 23, {
      base: [230, 226, 219],
      vein: [178, 172, 164],
      cu: 1,
      cv: 1,
      warp: 2.6,
      sharp: 24,
      strength: 0.55,
      cloud: 0.06,
      P: 2,
    }),
    travertine: travertine(512),
    plaster: ctex(mottled(512, [234, 229, 221], 0.05, 51, 4)),
    linen: linen(),
    boucle: boucle(),
    greige: wood('#c4b7a5', '#9a8a74', '#d9cebf', 31),
    oak: wood('#cdb89b', '#9c8466', '#e2d2bb', 37),
    glow: nicheGlow(),
    pool: pool(),
    sRect: softRect(),
    sRound: softRound(),
    sEdge: edge(),
    plume: plume(),
    posters: { solstice: poster('solstice'), atelier: poster('atelier'), clarity: poster('clarity') },
    wordmark: wordmark(),
    directory: directory(),
    box: boxArt(),
  };
}
