// The walkable 3D showroom: procedural store, frames at true size, walk planner, labels and the product viewer.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { NY } from '../core/ny.js';
start().catch((err) => {
  console.error(err);
  if (NY && NY.fail3D) NY.fail3D(err);
});

async function start() {
  if (!NY || !NY.L) throw new Error('Showroom data missing');
  const L = NY.L,
    H = L.H,
    EYE = 1.62;
  const V2 = THREE.Vector2,
    V3 = THREE.Vector3;
  const RM = !!NY.reduceMotion;
  const canvas = document.getElementById('scene');
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    NY.fail3D(e);
    return;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // Signage is drawn with the page fonts; wait briefly for them.
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('600 64px "Unbounded"'),
        document.fonts.load('500 24px "Martian Mono"'),
        document.fonts.load('600 24px "Hanken Grotesk"'),
      ]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch (e) {
    /* fonts optional */
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dde4e0');
  const camera = new THREE.PerspectiveCamera(60, 1, 0.03, 60);
  camera.rotation.order = 'YXZ';

  /* ------------------------------------------------------------------
     Textures (all procedural, no downloads)
     ------------------------------------------------------------------ */
  const mk = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  const rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };
  function ctex(c, o) {
    o = o || {};
    const t = new THREE.CanvasTexture(c);
    if (o.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    if (o.repeat !== false) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
    }
    t.anisotropy = Math.min(8, maxAniso);
    return t;
  }
  function wrapDraw(S, x, y, r, fn) {
    fn(0, 0);
    const ox = x < r ? S : x > S - r ? -S : 0,
      oy = y < r ? S : y > S - r ? -S : 0;
    if (ox) fn(ox, 0);
    if (oy) fn(0, oy);
    if (ox && oy) fn(ox, oy);
  }
  function texTerrazzo() {
    const S = 1024,
      c = mk(S, S),
      g = c.getContext('2d'),
      R = rng(7);
    g.fillStyle = '#e6e2da';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 160; i++) {
      const x = R() * S,
        y = R() * S,
        r = 30 + R() * 90,
        a = 0.03 * R();
      wrapDraw(S, x, y, r, (ox, oy) => {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        gr.addColorStop(0, 'rgba(120,108,92,' + a + ')');
        gr.addColorStop(1, 'rgba(120,108,92,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x + ox, y + oy, r, 0, Math.PI * 2);
        g.fill();
      });
    }
    const pal = [
      ['#c9c0b3', 30],
      ['#a7b4ad', 15],
      ['#7c8e85', 9],
      ['#b98b60', 10],
      ['#4d5954', 8],
      ['#f5f2ec', 20],
      ['#d8c6a6', 8],
    ];
    const pick = () => {
      let t = R() * 100,
        acc = 0;
      for (const [col, w] of pal) {
        acc += w;
        if (t < acc) return col;
      }
      return pal[0][0];
    };
    for (let i = 0; i < 2600; i++) {
      const x = R() * S,
        y = R() * S,
        big = R() < 0.06,
        r = big ? 7 + R() * 9 : 1.2 + R() * 4.5;
      const n = 4 + Math.floor(R() * 4),
        rot = R() * 6.283,
        col = pick(),
        pts = [];
      for (let k = 0; k < n; k++) {
        const a = rot + (k / n) * 6.283 + (R() - 0.5) * 0.6,
          rr = r * (0.6 + R() * 0.5);
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
      g.fillStyle = col;
      wrapDraw(S, x, y, r, (ox, oy) => {
        g.beginPath();
        pts.forEach((p, k) => {
          if (k) g.lineTo(x + ox + p[0], y + oy + p[1]);
          else g.moveTo(x + ox + p[0], y + oy + p[1]);
        });
        g.closePath();
        g.fill();
      });
    }
    return ctex(c);
  }
  function texWood(base, dark, light, seed) {
    const S = 512,
      c = mk(S, S),
      g = c.getContext('2d'),
      R = rng(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 170; i++) {
      const y0 = R() * S,
        amp = 1 + R() * 5,
        freq = ((1 + Math.floor(R() * 3)) * 2 * Math.PI) / S,
        ph = R() * 6.28;
      g.strokeStyle = R() < 0.7 ? dark : light;
      g.globalAlpha = 0.06 + R() * 0.16;
      g.lineWidth = 0.6 + R() * 2.2;
      for (const oy of [0, -S, S]) {
        g.beginPath();
        for (let x = 0; x <= S; x += 8) {
          const y = y0 + oy + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3 + ph * 2) * amp * 0.25;
          if (x) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    return ctex(c);
  }
  function texFlute() {
    const W = 256,
      Hh = 4,
      c = mk(W, Hh),
      g = c.getContext('2d'),
      img = g.createImageData(W, Hh),
      n = 8;
    for (let x = 0; x < W; x++) {
      const u = ((((x + 0.5) / W) * n) % 1) * 2 - 1;
      const s = -u / Math.sqrt(Math.max(0.08, 1 - u * u));
      let nx = -s * 0.45,
        nz = 1;
      const l = Math.hypot(nx, nz);
      nx /= l;
      nz /= l;
      for (let y = 0; y < Hh; y++) {
        const i = (y * W + x) * 4;
        img.data[i] = (nx * 0.5 + 0.5) * 255;
        img.data[i + 1] = 128;
        img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return ctex(c, { srgb: false });
  }
  function texTort(light) {
    const S = 512,
      c = mk(S, S),
      g = c.getContext('2d'),
      R = rng(light ? 21 : 11);
    g.fillStyle = light ? '#d2a05c' : '#86501f';
    g.fillRect(0, 0, S, S);
    const blob = (x, y, r, col, a) =>
      wrapDraw(S, x, y, r, (ox, oy) => {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        gr.addColorStop(0, rgba(col, a));
        gr.addColorStop(0.6, rgba(col, a * 0.6));
        gr.addColorStop(1, rgba(col, 0));
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x + ox, y + oy, r, 0, 6.283);
        g.fill();
      });
    for (let i = 0; i < 70; i++) blob(R() * S, R() * S, 30 + R() * 70, light ? '#e6be7e' : '#a8682c', 0.5);
    for (let i = 0; i < 150; i++)
      blob(R() * S, R() * S, 8 + R() * 38, light ? '#7a4a1e' : '#2a1408', 0.55 + R() * 0.35);
    for (let i = 0; i < 240; i++) blob(R() * S, R() * S, 2 + R() * 6, light ? '#5a3410' : '#1a0c04', 0.6);
    const t = ctex(c);
    t.repeat.set(30, 30);
    return t;
  }
  function texSoftRect() {
    const S = 128,
      c = mk(S, S),
      g = c.getContext('2d'),
      img = g.createImageData(S, S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const dx = Math.min(1, Math.min(x, S - 1 - x) / (S * 0.3)),
          dy = Math.min(1, Math.min(y, S - 1 - y) / (S * 0.3));
        const d = dx * dy,
          a = d * d * (3 - 2 * d),
          i = (y * S + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 0;
        img.data[i + 3] = a * 255;
      }
    g.putImageData(img, 0, 0);
    return ctex(c, { repeat: false, srgb: false });
  }
  function texSoftRound() {
    const S = 128,
      c = mk(S, S),
      g = c.getContext('2d'),
      gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(0.55, 'rgba(0,0,0,0.55)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    return ctex(c, { repeat: false, srgb: false });
  }
  function texEdge() {
    const c = mk(4, 64),
      g = c.getContext('2d'),
      gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 64);
    return ctex(c, { repeat: false, srgb: false });
  }
  function texSnellen() {
    const W = 512,
      Hh = 768,
      c = mk(W, Hh),
      g = c.getContext('2d');
    g.fillStyle = '#fbfbf8';
    g.fillRect(0, 0, W, Hh);
    const rows = [
      ['E', 120, '6/60'],
      ['F P', 80, '6/36'],
      ['T O Z', 60, '6/24'],
      ['L P E D', 46, '6/18'],
      ['P E C F D', 36, '6/12'],
      ['E D F C Z P', 28, '6/9'],
      ['F E L O P Z D', 22, '6/6'],
      ['D E F P O T E C', 17, '6/5'],
    ];
    let y = 34;
    g.textBaseline = 'top';
    for (const [t, s, l] of rows) {
      g.fillStyle = '#121212';
      g.font = '700 ' + s + 'px Arial, Helvetica, sans-serif';
      g.textAlign = 'center';
      g.fillText(t, W / 2, y);
      g.fillStyle = '#8a8a86';
      g.font = '500 15px Arial, sans-serif';
      g.textAlign = 'left';
      g.fillText(l, 16, y + s * 0.3);
      y += s * 1.18 + 10;
    }
    const by = Hh - 110;
    g.fillStyle = '#c8372d';
    g.fillRect(0, by, W / 2, 110);
    g.fillStyle = '#2f8a46';
    g.fillRect(W / 2, by, W / 2, 110);
    g.fillStyle = '#111111';
    g.font = '700 40px Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText('O Z', W / 4, by + 34);
    g.fillText('C E', (3 * W) / 4, by + 34);
    return ctex(c, { repeat: false });
  }
  function texDirectory() {
    const W = 512,
      Hh = 1024,
      c = mk(W, Hh),
      g = c.getContext('2d');
    g.fillStyle = '#163a32';
    g.fillRect(0, 0, W, Hh);
    g.fillStyle = '#f2ede3';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '600 50px "Unbounded", "Avenir Next", sans-serif';
    g.fillText('NAYAN', W / 2, 96);
    g.font = '500 18px "Martian Mono", ui-monospace, monospace';
    g.fillStyle = '#9fcbbc';
    g.fillText('STORE DIRECTORY', W / 2, 148);
    const mw = W - 56,
      mh = (mw * 16) / 22;
    g.save();
    g.translate(28, 190);
    const m = NY.drawPlan(g, mw, mh, {
      colors: {
        floor: '#1f4c42',
        zone: '#25594c',
        zoneOn: '#25594c',
        item: '#3d7565',
        wall: '#ebe6da',
        text: '#ebe6da',
        you: '#f2b46a',
      },
      labels: true,
      labelSize: 13,
      pad: 4,
      entrance: true,
    });
    g.fillStyle = '#f2b46a';
    g.beginPath();
    g.arc(m.X(L.totem.x), m.Z(L.totem.z + 0.25), 6, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.textAlign = 'left';
    g.font = '500 15px "Martian Mono", ui-monospace, monospace';
    g.fillStyle = '#f2b46a';
    g.fillText('●  YOU ARE HERE', 40, 190 + mh + 34);
    let y = 190 + mh + 84;
    g.font = '600 24px "Hanken Grotesk", system-ui, sans-serif';
    NY.TOUR.forEach((id, i) => {
      const z = NY.zoneById(id);
      g.fillStyle = '#9fcbbc';
      g.font = '500 16px "Martian Mono", ui-monospace, monospace';
      g.fillText(String(i + 1).padStart(2, '0'), 40, y);
      g.fillStyle = '#f2ede3';
      g.font = '600 24px "Hanken Grotesk", system-ui, sans-serif';
      g.fillText(z.name, 86, y);
      y += 40;
    });
    return ctex(c, { repeat: false });
  }
  function texLensScreen() {
    const W = 512,
      Hh = 320,
      c = mk(W, Hh),
      g = c.getContext('2d');
    g.fillStyle = '#10241f';
    g.fillRect(0, 0, W, Hh);
    g.fillStyle = '#9fcbbc';
    g.font = '500 18px "Martian Mono", ui-monospace, monospace';
    g.textBaseline = 'middle';
    g.fillText('LENS INDEX', 30, 38);
    g.fillStyle = '#f2ede3';
    g.font = '600 26px "Hanken Grotesk", system-ui, sans-serif';
    g.fillText('Same power, thinner lens', 30, 76);
    [
      [1.56, 1],
      [1.6, 0.933],
      [1.67, 0.836],
      [1.74, 0.757],
    ].forEach(([n, r], i) => {
      const y = 128 + i * 46;
      g.fillStyle = '#f2ede3';
      g.font = '500 20px "Martian Mono", ui-monospace, monospace';
      g.fillText(n.toFixed(2), 30, y);
      g.fillStyle = '#25594c';
      g.fillRect(120, y - 12, 330, 24);
      g.fillStyle = '#63cfae';
      g.fillRect(120, y - 12, 330 * r, 24);
      g.fillStyle = '#f2ede3';
      g.font = '600 18px "Hanken Grotesk", system-ui, sans-serif';
      g.fillText(Math.round(r * 100) + '%', 460, y);
    });
    return ctex(c, { repeat: false });
  }
  function texBox() {
    const c = mk(128, 128),
      g = c.getContext('2d');
    g.fillStyle = '#c4c4c4';
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
  const tex = {
    terrazzo: texTerrazzo(),
    walnut: texWood('#5b3a25', '#2a160b', '#8a5a37', 3),
    oak: texWood('#c19a70', '#7a5533', '#dcb791', 5),
    flute: texFlute(),
    tort: texTort(false),
    tortL: texTort(true),
    sRect: texSoftRect(),
    sRound: texSoftRound(),
    sEdge: texEdge(),
    snellen: texSnellen(),
    dir: texDirectory(),
    lens: texLensScreen(),
    box: texBox(),
  };

  /* ------------------------------------------------------------------
     Materials
     ------------------------------------------------------------------ */
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const basic = (o) => new THREE.MeshBasicMaterial(o);
  const shadowMat = (map, opacity) =>
    basic({
      map,
      color: 0x000000,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
  const M = {
    wall: std({ color: '#ebe8e2', roughness: 0.95, emissive: '#ebe8e2', emissiveIntensity: 0.16 }),
    ceil: std({ color: '#f1efea', roughness: 1, emissive: '#efebe4', emissiveIntensity: 0.62 }),
    walnut: std({ map: tex.walnut, roughness: 0.48 }),
    oak: std({ map: tex.oak, roughness: 0.6 }),
    green: std({ color: '#21483e', roughness: 0.7, normalMap: tex.flute, normalScale: new V2(1, 1) }),
    greenFlat: std({ color: '#21483e', roughness: 0.8 }),
    stone: std({ color: '#ece9e3', roughness: 0.24 }),
    white: std({ color: '#f5f3ef', roughness: 0.5 }),
    black: std({ color: '#1c1e1d', roughness: 0.42, metalness: 0.35 }),
    brass: std({ color: '#c49b58', roughness: 0.3, metalness: 1 }),
    glow: basic({ color: '#fff3df', toneMapped: false }),
    panel: basic({ color: '#f1e8d8' }),
    fabric: std({ color: '#365f54', roughness: 0.95 }),
    rug: std({ color: '#5a7c71', roughness: 1 }),
    pot: std({ color: '#cfc7bb', roughness: 0.85 }),
    leaf: std({ color: '#3f6e48', roughness: 0.75 }),
    kidsY: std({ color: '#f2c14e', roughness: 0.6 }),
    kidsC: std({ color: '#e47a5c', roughness: 0.7 }),
    kidsB: std({ color: '#62aee0', roughness: 0.6 }),
    screen: basic({ color: '#0f1a17' }),
    mirror: std({ color: '#e4e9e8', metalness: 1, roughness: 0.04 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.13,
      roughness: 0.03,
      metalness: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    lensDisc: new THREE.MeshPhysicalMaterial({
      color: '#e9f3f2',
      transparent: true,
      opacity: 0.5,
      roughness: 0.05,
      depthWrite: false,
    }),
    uv: basic({ color: '#7d61ff', toneMapped: false }),
    blue: basic({ color: '#5fb2ff', toneMapped: false }),
    outside: basic({ color: '#d4dcd7' }),
    pavement: std({ color: '#cfd2cc', roughness: 0.92 }),
    shRect: shadowMat(tex.sRect, 0.42),
    shRound: shadowMat(tex.sRound, 0.4),
    shEdge: shadowMat(tex.sEdge, 0.2),
  };
  const BATCH = {
    glass: { solid: false, cast: false, receive: false },
    lensDisc: { solid: false, cast: false, receive: false },
    glow: { cast: false, receive: false },
    panel: { cast: false },
    ceil: { cast: false, receive: false },
    uv: { cast: false },
    blue: { cast: false },
    screen: { cast: false },
    outside: { solid: false, cast: false, receive: false },
    pavement: { solid: false, cast: false },
    shRect: { solid: false, cast: false, receive: false },
    shRound: { solid: false, cast: false, receive: false },
    shEdge: { solid: false, cast: false, receive: false },
    rug: { cast: false },
    mirror: { cast: false },
  };

  /* ------------------------------------------------------------------
     Batched static geometry
     ------------------------------------------------------------------ */
  const batches = new Map();
  const solids = [];
  let F = new THREE.Matrix4();
  const fstack = [];
  const pushF = (x, z, ry, y) => {
    fstack.push(F);
    const m = new THREE.Matrix4().makeRotationY(ry || 0);
    m.setPosition(x, y || 0, z);
    F = F.clone().multiply(m);
  };
  const popF = () => {
    F = fstack.pop();
  };
  const local = (x, y, z) => new V3(x, y, z).applyMatrix4(F);
  function addG(key, g) {
    g.applyMatrix4(F);
    let b = batches.get(key);
    if (!b) {
      b = { key, geos: [] };
      batches.set(key, b);
    }
    b.geos.push(g);
    return g;
  }
  function boxUV(g, w, h, d, s) {
    const uv = g.attributes.uv,
      dims = [
        [d, h],
        [d, h],
        [w, d],
        [w, d],
        [w, h],
        [w, h],
      ];
    for (let f = 0; f < 6; f++) {
      const du = dims[f][0],
        dv = dims[f][1];
      for (let i = 0; i < 4; i++) {
        const k = f * 4 + i;
        uv.setXY(k, (uv.getX(k) * du) / s, (uv.getY(k) * dv) / s);
      }
    }
  }
  function box(key, w, h, d, x, y, z, o) {
    o = o || {};
    const g = new THREE.BoxGeometry(w, h, d);
    if (o.uv !== false) boxUV(g, w, h, d, o.uvs || (key === 'green' ? 0.4 : 1));
    if (o.rx) g.rotateX(o.rx);
    if (o.rz) g.rotateZ(o.rz);
    if (o.ry) g.rotateY(o.ry);
    g.translate(x, y, z);
    return addG(key, g);
  }
  function cyl(key, rt, rb, h, x, y, z, seg, o) {
    o = o || {};
    const g = new THREE.CylinderGeometry(rt, rb, h, seg || 24, 1, false);
    if (o.rx) g.rotateX(o.rx);
    if (o.rz) g.rotateZ(o.rz);
    g.translate(x, y, z);
    return addG(key, g);
  }
  function sph(key, r, x, y, z, sx, sy, sz, seg) {
    const g = new THREE.SphereGeometry(r, seg || 16, Math.max(8, Math.round((seg || 16) * 0.6)));
    g.scale(sx || 1, sy || 1, sz || 1);
    g.translate(x, y, z);
    return addG(key, g);
  }
  function plane(key, w, h, x, y, z, rx, ry) {
    const g = new THREE.PlaneGeometry(w, h);
    if (rx) g.rotateX(rx);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    return addG(key, g);
  }
  const shadowRect = (x, z, w, d) => plane('shRect', w, d, x, 0.006, z, -Math.PI / 2);
  const shadowRound = (x, z, s) => plane('shRound', s, s, x, 0.006, z, -Math.PI / 2);
  function flush() {
    for (const b of batches.values()) {
      if (!b.geos.length) continue;
      const geos = b.geos.map((g) => {
        const n = g.index ? g.toNonIndexed() : g;
        for (const k of Object.keys(n.attributes))
          if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k);
        if (!n.attributes.uv)
          n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
        return n;
      });
      const merged = mergeGeometries(geos, false);
      if (!merged) {
        console.warn('merge failed', b.key);
        continue;
      }
      merged.computeBoundingSphere();
      const opt = BATCH[b.key] || {};
      const mesh = new THREE.Mesh(merged, M[b.key]);
      mesh.castShadow = opt.cast !== false;
      mesh.receiveShadow = opt.receive !== false;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      if (b.key === 'glass') mesh.renderOrder = 3;
      scene.add(mesh);
      if (opt.solid !== false) solids.push(mesh);
    }
    batches.clear();
  }
  const hitboxes = [];
  const hitMat = basic({ visible: false });
  function hitbox(action, x, y, z, w, h, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hitMat);
    m.applyMatrix4(F.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z)));
    m.updateMatrixWorld(true);
    m.userData.action = action;
    hitboxes.push(m);
  }
  function addMesh(mesh, x, y, z, rx) {
    const m = F.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z));
    if (rx) m.multiply(new THREE.Matrix4().makeRotationX(rx));
    mesh.applyMatrix4(m);
    scene.add(mesh);
    return mesh;
  }

  /* ------------------------------------------------------------------
     Signage
     ------------------------------------------------------------------ */
  function makeSign(text, o) {
    const cw = 1024,
      ch = Math.max(96, Math.round((cw * o.h) / o.w));
    const c = mk(cw, ch),
      g = c.getContext('2d');
    let fs = Math.round(ch * (o.sub ? 0.44 : 0.6));
    const font = (s) => (o.weight || 500) + ' ' + s + 'px "Unbounded", "Avenir Next", "Segoe UI", sans-serif';
    const track = o.track == null ? 0.14 : o.track;
    const measure = (s) => {
      g.font = font(s);
      const chars = [...text],
        ws = chars.map((x) => g.measureText(x).width);
      return { chars, ws, tot: ws.reduce((a, b) => a + b, 0) + track * s * (chars.length - 1) };
    };
    let m = measure(fs);
    if (m.tot > cw * 0.92) {
      fs = Math.floor((fs * cw * 0.92) / m.tot);
      m = measure(fs);
    }
    g.fillStyle = o.color;
    g.textBaseline = 'middle';
    let x = (cw - m.tot) / 2;
    const y = o.sub ? ch * 0.38 : ch * 0.53;
    m.chars.forEach((chr, i) => {
      g.fillText(chr, x, y);
      x += m.ws[i] + track * fs;
    });
    if (o.sub) {
      g.font = '500 ' + Math.round(ch * 0.15) + 'px "Martian Mono", ui-monospace, monospace';
      g.fillStyle = o.subColor || o.color;
      g.textAlign = 'center';
      g.fillText(o.sub, cw / 2, ch * 0.8);
    }
    const t = ctex(c, { repeat: false });
    return new THREE.Mesh(
      new THREE.PlaneGeometry(o.w, o.h),
      basic({ map: t, transparent: true, toneMapped: false, depthWrite: false }),
    );
  }
  function sign(text, o, x, y, z, ry) {
    const s = makeSign(text, o);
    s.position.set(x, y, z);
    s.rotation.y = ry || 0;
    s.renderOrder = 1;
    scene.add(s);
    return s;
  }
  function hangingSign(text, sub, x, y, z, w) {
    const hh = 0.44;
    box('greenFlat', w, hh, 0.04, x, y, z);
    box('brass', w + 0.02, 0.012, 0.05, x, y + hh / 2 + 0.006, z);
    for (const dx of [-w * 0.38, w * 0.38])
      cyl('black', 0.005, 0.005, H - (y + hh / 2), x + dx, (H + y + hh / 2) / 2, z, 6);
    const o = { w: w * 0.92, h: hh * 0.86, color: '#efe2c4', sub, subColor: '#9fcbbc' };
    sign(text, o, x, y, z + 0.022, 0);
    sign(text, o, x, y, z - 0.022, Math.PI);
  }

  /* ------------------------------------------------------------------
     Shell: floor, walls, ceiling, storefront
     ------------------------------------------------------------------ */
  const W = L.x1 - L.x0,
    D = L.z1 - L.z0;
  const floorGeo = new THREE.PlaneGeometry(W, D);
  floorGeo.rotateX(-Math.PI / 2);
  floorGeo.translate((L.x0 + L.x1) / 2, 0, (L.z0 + L.z1) / 2);
  {
    const uv = floorGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * W) / 1.7, (uv.getY(i) * D) / 1.7);
  }
  const floor = new THREE.Mesh(floorGeo, std({ map: tex.terrazzo, roughness: 0.36 }));
  floor.receiveShadow = true;
  scene.add(floor);

  box('wall', W, H, 0.1, 0, H / 2, L.z0 - 0.05);
  box('wall', 0.1, H, D, L.x0 - 0.05, H / 2, 0);
  box('wall', 0.1, H, D, L.x1 + 0.05, H / 2, 0);
  box('walnut', W, 0.09, 0.02, 0, 0.045, L.z0 + 0.01);
  box('walnut', 0.02, 0.09, D, L.x0 + 0.01, 0.045, 0);
  box('walnut', 0.02, 0.09, D, L.x1 - 0.01, 0.045, 0);
  plane('shEdge', W, 0.35, 0, 0.004, L.z0 + 0.175, -Math.PI / 2);
  plane('shEdge', D, 0.35, L.x0 + 0.175, 0.004, 0, -Math.PI / 2, -Math.PI / 2);
  plane('shEdge', D, 0.35, L.x1 - 0.175, 0.004, 0, -Math.PI / 2, Math.PI / 2);
  plane('ceil', W, D, 0, H, 0, Math.PI / 2);
  // cove light along the walls
  box('glow', W - 0.3, 0.02, 0.02, 0, H - 0.05, L.z0 + 0.16);
  box('glow', 0.02, 0.02, D - 0.3, L.x0 + 0.16, H - 0.05, 0);
  box('glow', 0.02, 0.02, D - 0.3, L.x1 - 0.16, H - 0.05, 0);
  box('wall', W, 0.12, 0.24, 0, H - 0.06, L.z0 + 0.12);
  box('wall', 0.24, 0.12, D, L.x0 + 0.12, H - 0.06, 0);
  box('wall', 0.24, 0.12, D, L.x1 - 0.12, H - 0.06, 0);

  // storefront: glazing with mullions and a door opening
  const gH = H - 0.4;
  box('black', W, 0.4, 0.14, 0, H - 0.2, L.z1 + 0.02);
  box('black', W, 0.06, 0.12, 0, 0.03, L.z1 + 0.02);
  for (const seg of [
    [L.x0, -L.door],
    [L.door, L.x1],
  ]) {
    const w = seg[1] - seg[0];
    plane('glass', w, gH - 0.06, (seg[0] + seg[1]) / 2, 0.06 + (gH - 0.06) / 2, L.z1 + 0.02);
    const n = Math.round(w / 2.3);
    for (let i = 0; i <= n; i++) box('black', 0.06, gH, 0.12, seg[0] + (w * i) / n, gH / 2, L.z1 + 0.02);
  }
  // exterior
  plane('pavement', 60, 24, 0, -0.02, L.z1 + 12, -Math.PI / 2);
  plane('outside', 70, 24, 0, 8, L.z1 + 20, 0, Math.PI);
  sign('NAYAN EYEWEAR', { w: 3.4, h: 0.3, color: '#efe6d2', track: 0.22 }, 0, H - 0.2, L.z1 - 0.055, Math.PI);

  // ceiling lights
  {
    const pos = [];
    for (let x = -9.9; x <= 9.95; x += 2.2)
      for (let z = -6.6; z <= 6.65; z += 2.2) {
        if (Math.hypot(x - L.ring.x, z - L.ring.z) < L.ring.r + 0.6) continue;
        pos.push([x, z]);
      }
    const g = new THREE.CircleGeometry(0.075, 20);
    g.rotateX(Math.PI / 2);
    const im = new THREE.InstancedMesh(g, M.glow, pos.length);
    const g2 = new THREE.CircleGeometry(0.11, 24);
    g2.rotateX(Math.PI / 2);
    const im2 = new THREE.InstancedMesh(g2, M.black, pos.length);
    const m = new THREE.Matrix4();
    pos.forEach((p, i) => {
      im.setMatrixAt(i, m.makeTranslation(p[0], H - 0.004, p[1]));
      im2.setMatrixAt(i, m.makeTranslation(p[0], H - 0.002, p[1]));
    });
    scene.add(im2, im);
  }
  // signature ring light over the centre aisle
  {
    const r = L.ring;
    const t1 = new THREE.TorusGeometry(r.r, 0.035, 10, 140);
    t1.rotateX(Math.PI / 2);
    t1.translate(r.x, 3.0, r.z);
    addG('glow', t1);
    const t2 = new THREE.TorusGeometry(r.r, 0.06, 10, 140);
    t2.rotateX(Math.PI / 2);
    t2.translate(r.x, 3.04, r.z);
    addG('black', t2);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      cyl('black', 0.004, 0.004, H - 3.04, r.x + Math.cos(a) * r.r, (H + 3.04) / 2, r.z + Math.sin(a) * r.r, 6);
    }
    const rug = new THREE.CircleGeometry(L.rug.r, 72);
    rug.rotateX(-Math.PI / 2);
    rug.translate(L.rug.x, 0.004, L.rug.z);
    addG('rug', rug);
    const rim = new THREE.RingGeometry(L.rug.r - 0.06, L.rug.r - 0.035, 72);
    rim.rotateX(-Math.PI / 2);
    rim.translate(L.rug.x, 0.005, L.rug.z);
    addG('brass', rim);
  }

  /* ------------------------------------------------------------------
     Fixtures
     ------------------------------------------------------------------ */
  // Wall bay: base cabinet, backlit panel, shelves with LED strips. Returns shelf rows of slots.
  function wallBay(cx, cz, ry, Wd, o) {
    pushF(cx, cz, ry);
    const baseH = o.base == null ? 0.86 : o.base,
      depth = 0.45,
      top = o.top || 2.12,
      sd = 0.3;
    box('walnut', Wd, baseH, depth, 0, baseH / 2, depth / 2);
    box('black', Wd - 0.02, 0.07, 0.02, 0, 0.035, depth + 0.001);
    box('stone', Wd + 0.02, 0.03, depth + 0.03, 0, baseH + 0.015, depth / 2 + 0.005);
    box('black', Wd - 0.06, 0.005, 0.004, 0, baseH * 0.55, depth + 0.002);
    box(o.panel || 'panel', Wd - 0.08, top - baseH - 0.03, 0.02, 0, (top + baseH) / 2, 0.03, { uv: false });
    box('walnut', 0.045, top, sd + 0.04, -Wd / 2 + 0.0225, top / 2, (sd + 0.04) / 2);
    box('walnut', 0.045, top, sd + 0.04, Wd / 2 - 0.0225, top / 2, (sd + 0.04) / 2);
    box('walnut', Wd, 0.34, sd + 0.06, 0, top + 0.17, (sd + 0.06) / 2);
    box('glow', Wd - 0.12, 0.006, 0.012, 0, top - 0.012, sd + 0.02);
    const rows = [];
    for (const y of o.shelves) {
      box('walnut', Wd - 0.09, 0.022, sd, 0, y, sd / 2 + 0.02);
      box('brass', Wd - 0.09, 0.024, 0.006, 0, y, sd + 0.023);
      box('glow', Wd - 0.14, 0.005, 0.01, 0, y - 0.015, sd - 0.02);
      const row = [],
        n = o.slots || 0;
      for (let s = 0; s < n; s++) {
        const lx = -Wd / 2 + 0.14 + ((s + 0.5) * (Wd - 0.28)) / n;
        row.push({ pos: local(lx, y + 0.011, 0.235), ry, zone: o.zone });
      }
      rows.push(row);
    }
    shadowRect(0, depth / 2 + 0.05, Wd + 0.1, depth + 0.3);
    popF();
    return rows;
  }
  const SHELVES = [1.02, 1.3, 1.58, 1.86];
  const rowsMen = L.men.centers.map((cz) =>
    wallBay(L.x0, cz, Math.PI / 2, L.men.width, { shelves: SHELVES, slots: 5, zone: 'men' }),
  );
  const rowsWomen = L.women.centers.map((cz) =>
    wallBay(L.x1, cz, -Math.PI / 2, L.women.width, { shelves: SHELVES, slots: 5, zone: 'women' }),
  );
  const rowsKids = wallBay(L.x0, L.kids.center, Math.PI / 2, L.kids.width, {
    base: 0.42,
    shelves: [0.6, 0.86, 1.12],
    top: 1.38,
    slots: 5,
    panel: 'kidsY',
    zone: 'kids',
  });
  wallBay(L.contacts.center, L.z0, 0, L.contacts.width, {
    shelves: [1.05, 1.35, 1.65],
    slots: 0,
    zone: 'contacts',
  });

  // Sunglasses island: stone slab, two tiers, mirror column, hanging sign
  function sunIsland() {
    const I = L.sun;
    pushF(I.x, I.z, 0);
    const w = I.w,
      d = I.d,
      hh = 0.9;
    box('black', w - 0.2, 0.08, d - 0.2, 0, 0.04, 0);
    box('walnut', w - 0.08, hh - 0.08, d - 0.08, 0, 0.08 + (hh - 0.08) / 2, 0);
    box('stone', w, 0.05, d, 0, hh + 0.025, 0);
    box('stone', w - 0.3, 0.11, 0.5, 0, hh + 0.105, 0);
    box('brass', w - 0.6, 0.06, 0.07, 0, hh + 0.19, 0);
    box('brass', w + 0.004, 0.012, d + 0.004, 0, hh + 0.002, 0);
    const rows = [];
    for (const side of [1, -1]) {
      const r0 = [],
        r1 = [];
      for (let s = 0; s < 6; s++) {
        const lx = -w / 2 + 0.2 + ((s + 0.5) * (w - 0.4)) / 6;
        r0.push({ pos: local(lx, hh + 0.05, side * 0.42), ry: side > 0 ? 0 : Math.PI, zone: 'sun' });
        r1.push({ pos: local(lx, hh + 0.16, side * 0.205), ry: side > 0 ? 0 : Math.PI, zone: 'sun' });
      }
      rows.push(r0, r1);
    }
    shadowRect(0, 0, w + 0.35, d + 0.35);
    box('walnut', 0.42, 1.9, 0.2, -w / 2 - 0.32, 0.95, 0);
    box('mirror', 0.34, 1.2, 0.01, -w / 2 - 0.32, 1.22, 0.105);
    box('mirror', 0.34, 1.2, 0.01, -w / 2 - 0.32, 1.22, -0.105);
    shadowRect(-w / 2 - 0.32, 0, 0.7, 0.5);
    popF();
    hangingSign('SUNGLASSES', 'UV400 · POLARISED', I.x, 2.52, I.z, 2.3);
    return rows;
  }
  const rowsSun = sunIsland();

  // Lens bar: fluted counter, lens trays, demo units, tablet, stools
  function stool(x, z) {
    cyl('black', 0.02, 0.02, 0.66, x, 0.34, z, 8);
    cyl('black', 0.17, 0.19, 0.02, x, 0.01, z, 24);
    cyl('brass', 0.15, 0.15, 0.012, x, 0.26, z, 24);
    cyl('fabric', 0.19, 0.19, 0.07, x, 0.7, z, 24);
    shadowRound(x, z, 0.55);
  }
  function lensBar() {
    const I = L.lens;
    pushF(I.x, I.z, 0);
    const w = I.w,
      d = I.d,
      hh = 1.0;
    box('black', w - 0.2, 0.08, d - 0.2, 0, 0.04, 0);
    box('green', w - 0.06, hh - 0.08, d - 0.06, 0, 0.08 + (hh - 0.08) / 2, 0);
    box('stone', w + 0.04, 0.05, d + 0.04, 0, hh + 0.025, 0);
    for (const tx of [-0.9, 0, 0.9]) {
      box('black', 0.64, 0.02, 0.36, tx, hh + 0.06, 0.12);
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 2; j++)
          cyl('lensDisc', 0.034, 0.034, 0.005, tx - 0.225 + i * 0.15, hh + 0.073, 0.045 + j * 0.15, 28);
    }
    box('black', 0.34, 0.2, 0.22, -1.1, hh + 0.15, -0.26);
    box('uv', 0.26, 0.08, 0.005, -1.1, hh + 0.17, -0.147);
    box('white', 0.3, 0.26, 0.05, 1.15, hh + 0.18, -0.3);
    box('blue', 0.24, 0.02, 0.01, 1.15, hh + 0.27, -0.27);
    const tab = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), basic({ map: tex.lens, toneMapped: false }));
    addMesh(tab, 0, hh + 0.2, -0.3, -0.35);
    box('black', 0.46, 0.3, 0.012, 0, hh + 0.2 - 0.003, -0.307, { rx: -0.35 });
    box('black', 0.05, 0.16, 0.05, 0, hh + 0.08, -0.36);
    shadowRect(0, 0, w + 0.35, d + 0.35);
    hitbox('lensguide', 0, hh + 0.2, -0.1, w, 0.5, d);
    popF();
    for (const s of L.stools) stool(s[0], s[1]);
    hangingSign('LENS BAR', 'TYPES · COATINGS · INDEX', I.x, 2.52, I.z, 2.1);
  }
  lensBar();

  // Atelier: fluted green feature wall, lit niche, four vitrines
  const premiumNiche = [];
  const premiumCases = [];
  function premium() {
    const P = L.premium;
    pushF(P.x, L.z0, 0);
    box('green', P.w, H, 0.06, 0, H / 2, 0.03);
    box('brass', 0.03, H, 0.07, -P.w / 2, H / 2, 0.04);
    box('brass', 0.03, H, 0.07, P.w / 2, H / 2, 0.04);
    const nw = 2.8,
      nh = 0.72,
      nd = 0.26,
      ny = 1.1;
    box('walnut', nw, 0.04, nd, 0, ny, nd / 2 + 0.06);
    box('walnut', nw, 0.04, nd, 0, ny + nh, nd / 2 + 0.06);
    box('walnut', 0.04, nh, nd, -nw / 2, ny + nh / 2, nd / 2 + 0.06);
    box('walnut', 0.04, nh, nd, nw / 2, ny + nh / 2, nd / 2 + 0.06);
    box('panel', nw - 0.06, nh - 0.06, 0.01, 0, ny + nh / 2, 0.07, { uv: false });
    box('glow', nw - 0.1, 0.006, 0.01, 0, ny + nh - 0.03, nd + 0.03);
    for (let s = 0; s < 6; s++) {
      const lx = -nw / 2 + 0.2 + ((s + 0.5) * (nw - 0.4)) / 6;
      premiumNiche.push({ pos: local(lx, ny + 0.02, 0.23), ry: 0, zone: 'premium' });
    }
    shadowRect(0, 0.2, P.w, 0.5);
    popF();
    sign(
      'ATELIER',
      { w: 2.6, h: 0.56, color: '#efe2c4', sub: 'PREMIUM COLLECTION', subColor: '#b8d6ca', track: 0.3 },
      P.x,
      2.42,
      L.z0 + 0.07,
      0,
    );
    for (const vx of L.vitrines) {
      pushF(vx, L.vitrineZ, 0);
      box('greenFlat', 0.6, 0.92, 0.6, 0, 0.46, 0);
      box('brass', 0.62, 0.02, 0.62, 0, 0.93, 0);
      box('brass', 0.61, 0.04, 0.61, 0, 0.02, 0);
      box('glass', 0.56, 0.62, 0.56, 0, 0.94 + 0.31, 0, { uv: false });
      box('walnut', 0.6, 0.06, 0.6, 0, 1.59, 0);
      box('glow', 0.4, 0.004, 0.4, 0, 1.557, 0);
      box('brass', 0.03, 0.12, 0.03, 0, 1.0, -0.02);
      box('brass', 0.14, 0.006, 0.06, 0, 0.945, -0.02);
      premiumCases.push({ pos: local(0, 1.06, 0.07), ry: 0, zone: 'premium' });
      shadowRect(0, 0, 0.95, 0.95);
      popF();
    }
  }
  premium();

  // Eye test room with chair, phoropter, slit lamp, desk and a Snellen chart
  function eyeRoom() {
    const e = L.eye;
    box('wall', e.door[0] - e.x0, H, 0.12, (e.x0 + e.door[0]) / 2, H / 2, e.z1);
    box('wall', L.x1 - e.door[1], H, 0.12, (e.door[1] + L.x1) / 2, H / 2, e.z1);
    box('wall', e.door[1] - e.door[0], H - 2.3, 0.12, (e.door[0] + e.door[1]) / 2, 2.3 + (H - 2.3) / 2, e.z1);
    box('wall', 0.12, H, e.z1 - L.z0, e.x0, H / 2, (e.z1 + L.z0) / 2);
    box('walnut', 0.05, 2.3, 0.16, e.door[0], 1.15, e.z1);
    box('walnut', 0.05, 2.3, 0.16, e.door[1], 1.15, e.z1);
    box('walnut', e.door[1] - e.door[0] + 0.05, 0.05, 0.16, (e.door[0] + e.door[1]) / 2, 2.3, e.z1);
    const fg = new THREE.PlaneGeometry(L.x1 - e.x0 - 0.06, e.z1 - L.z0 - 0.06);
    {
      const uv = fg.attributes.uv;
      for (let i = 0; i < uv.count; i++)
        uv.setXY(i, (uv.getX(i) * (L.x1 - e.x0)) / 1.2, (uv.getY(i) * (e.z1 - L.z0)) / 1.2);
    }
    fg.rotateX(-Math.PI / 2);
    fg.translate((e.x0 + L.x1) / 2 + 0.03, 0.002, (e.z1 + L.z0) / 2 - 0.03);
    addG('oak', fg);
    plane('shEdge', e.z1 - L.z0, 0.3, e.x0 + 0.21, 0.005, (e.z1 + L.z0) / 2, -Math.PI / 2, -Math.PI / 2);
    // exam chair facing the chart (towards -z)
    const [cx, cz] = e.chair;
    cyl('black', 0.22, 0.28, 0.08, cx, 0.04, cz, 24);
    cyl('black', 0.06, 0.06, 0.42, cx, 0.29, cz, 12);
    box('fabric', 0.56, 0.12, 0.55, cx, 0.56, cz);
    box('fabric', 0.56, 0.72, 0.12, cx, 0.96, cz + 0.3);
    box('fabric', 0.3, 0.16, 0.1, cx, 1.38, cz + 0.31);
    box('black', 0.07, 0.06, 0.48, cx - 0.31, 0.75, cz);
    box('black', 0.07, 0.06, 0.48, cx + 0.31, 0.75, cz);
    box('black', 0.5, 0.04, 0.24, cx, 0.22, cz - 0.38, { rx: -0.5 });
    shadowRound(cx, cz, 1.2);
    // phoropter on an arm
    const [px, pz] = e.column;
    cyl('white', 0.06, 0.08, 1.9, px, 0.95, pz, 16);
    cyl('white', 0.16, 0.18, 0.04, px, 0.02, pz, 24);
    const ax = (px + cx) / 2,
      az = (pz + cz - 0.42) / 2,
      alen = Math.hypot(px - cx, pz - (cz - 0.42));
    box('white', alen, 0.05, 0.07, ax, 1.82, az, { ry: -Math.atan2(cz - 0.42 - pz, cx - px) });
    cyl('black', 0.012, 0.012, 0.5, cx, 1.55, cz - 0.42, 8);
    box('black', 0.34, 0.2, 0.09, cx, 1.24, cz - 0.42);
    for (const dx of [-0.085, 0.085]) cyl('white', 0.06, 0.06, 0.03, cx + dx, 1.24, cz - 0.47, 24, { rx: Math.PI / 2 });
    // slit lamp table
    const [sx, sz] = e.slit;
    box('white', 0.72, 0.04, 0.54, sx, 0.78, sz);
    box('walnut', 0.5, 0.74, 0.4, sx, 0.38, sz);
    box('black', 0.12, 0.22, 0.12, sx, 0.92, sz);
    cyl('black', 0.03, 0.03, 0.3, sx, 1.12, sz - 0.02, 12, { rz: Math.PI / 2 });
    shadowRect(sx, sz, 0.9, 0.7);
    // optometrist desk
    const [dx, dz] = e.desk;
    box('white', 1.0, 0.04, 0.72, dx, 0.75, dz);
    box('walnut', 0.36, 0.73, 0.66, dx + 0.3, 0.365, dz);
    box('black', 0.04, 0.73, 0.04, dx - 0.46, 0.365, dz - 0.32);
    box('black', 0.04, 0.73, 0.04, dx - 0.46, 0.365, dz + 0.32);
    box('black', 0.52, 0.32, 0.03, dx, 1.03, dz + 0.22);
    box('screen', 0.48, 0.28, 0.005, dx, 1.03, dz + 0.203);
    box('black', 0.05, 0.12, 0.05, dx, 0.83, dz + 0.24);
    shadowRect(dx, dz, 1.2, 0.95);
    // chart, lit
    box('black', 0.68, 0.99, 0.02, cx, 1.45, L.z0 + 0.01);
    const chart = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.93), basic({ map: tex.snellen, toneMapped: false }));
    chart.position.set(cx, 1.45, L.z0 + 0.022);
    scene.add(chart);
    hitbox('eyetest', cx, 1.0, cz - 0.2, 1.4, 2.0, 1.4);
    hitbox('eyetest', cx, 1.45, L.z0 + 0.05, 0.8, 1.1, 0.1);
    sign(
      'EYE TEST',
      { w: 1.5, h: 0.4, color: '#1f3d36', sub: 'FREE · ABOUT 20 MIN', subColor: '#4a6b62' },
      (e.door[0] + e.door[1]) / 2,
      2.8,
      e.z1 + 0.065,
      0,
    );
  }
  eyeRoom();

  // Fitting and checkout counter, round mirror
  function checkout() {
    const c = L.counter;
    pushF(c.x, c.z, 0);
    box('walnut', c.w, 0.95, c.d, 0, 0.475, 0);
    box('green', c.w - 0.04, 0.84, 0.02, 0, 0.5, -c.d / 2 - 0.01);
    box('stone', c.w + 0.06, 0.05, c.d + 0.06, 0, 0.975, 0);
    box('black', 0.26, 0.18, 0.02, 0.62, 1.1, 0.05, { rx: -0.45 });
    box('black', 0.6, 0.02, 0.3, -0.55, 1.01, 0);
    shadowRect(0, 0, c.w + 0.35, c.d + 0.35);
    hitbox('bag', 0, 0.55, 0, c.w, 1.1, c.d + 0.1);
    popF();
    const mg = new THREE.CircleGeometry(0.46, 56);
    mg.rotateY(-Math.PI / 2);
    mg.translate(L.mirror.x, 1.5, L.mirror.z);
    addG('mirror', mg);
    const tg = new THREE.TorusGeometry(0.47, 0.02, 8, 64);
    tg.rotateY(Math.PI / 2);
    tg.translate(L.mirror.x - 0.005, 1.5, L.mirror.z);
    addG('brass', tg);
    stool(L.mirrorStool[0], L.mirrorStool[1]);
    const s = makeSign('FITTING & CHECKOUT', { w: 2.2, h: 0.34, color: '#efe2c4' });
    box('greenFlat', 2.3, 0.4, 0.04, c.x, 2.55, c.z);
    for (const dx of [-0.85, 0.85]) cyl('black', 0.005, 0.005, H - 2.75, c.x + dx, (H + 2.75) / 2, c.z, 6);
    s.position.set(c.x, 2.55, c.z - 0.022);
    s.rotation.y = Math.PI;
    scene.add(s);
  }
  checkout();

  // Welcome: concierge desk, directory totem
  function welcome() {
    const d = L.desk;
    pushF(d.x, d.z, 0);
    box('walnut', d.w, 1.0, d.d, 0, 0.5, 0);
    box('green', d.w - 0.04, 0.9, 0.02, 0, 0.5, -d.d / 2 - 0.01);
    box('stone', d.w + 0.06, 0.05, d.d + 0.06, 0, 1.025, 0);
    cyl('white', 0.06, 0.045, 0.22, -0.6, 1.16, 0.05, 20);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      sph('leaf', 0.05, -0.6 + Math.cos(a) * 0.05, 1.33 + (i % 2) * 0.04, 0.05 + Math.sin(a) * 0.05, 1, 1.2, 1, 10);
    }
    shadowRect(0, 0, d.w + 0.35, d.d + 0.35);
    popF();
    const t = L.totem;
    pushF(t.x, t.z, 0);
    box('black', 0.64, 1.9, 0.1, 0, 0.99, 0);
    box('brass', 0.5, 0.04, 0.3, 0, 0.02, 0);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.12), basic({ map: tex.dir, toneMapped: false }));
    addMesh(front, 0, 1.2, 0.052);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.12), basic({ map: tex.dir, toneMapped: false }));
    back.rotation.y = Math.PI;
    addMesh(back, 0, 1.2, -0.052);
    shadowRect(0, 0, 0.9, 0.5);
    hitbox('directory', 0, 1.0, 0, 0.7, 2.0, 0.3);
    popF();
  }
  welcome();

  // Kids corner: round table, bean bags, sign
  const kidsTableSlots = [];
  function kidsCorner() {
    const T = L.kidsTable;
    cyl('kidsB', T.r, T.r, 0.04, T.x, 0.52, T.z, 48);
    cyl('white', 0.12, 0.2, 0.5, T.x, 0.25, T.z, 20);
    shadowRound(T.x, T.z, T.r * 2.6);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      kidsTableSlots.push({ pos: new V3(T.x + Math.sin(a) * 0.5, 0.54, T.z + Math.cos(a) * 0.5), ry: a, zone: 'kids' });
    }
    L.beanbags.forEach((b, i) => {
      sph(i ? 'kidsC' : 'kidsY', 0.42, b[0], 0.2, b[1], 1, 0.55, 1, 20);
      shadowRound(b[0], b[1], 1.0);
    });
    sign(
      'KIDS',
      { w: 1.3, h: 0.42, color: '#d0623f', sub: 'AGES 3 TO 12', subColor: '#7a5a40' },
      L.x0 + 0.03,
      2.05,
      L.kids.center,
      Math.PI / 2,
    );
  }
  kidsCorner();

  // Plants
  function plant(x, z, seed) {
    const R = rng(seed);
    cyl('pot', 0.2, 0.15, 0.42, x, 0.21, z, 20);
    for (let i = 0; i < 9; i++) {
      const a = R() * 6.28,
        r = R() * 0.17;
      sph('leaf', 0.12 + R() * 0.09, x + Math.cos(a) * r, 0.58 + R() * 0.68, z + Math.sin(a) * r, 1, 1.3, 1, 10);
    }
    shadowRound(x, z, 0.65);
  }
  L.plants.forEach((p, i) => plant(p[0], p[1], 40 + i));

  // Wall signs
  sign(
    'MEN',
    { w: 2.4, h: 0.52, color: '#1f3d36', sub: 'TITANIUM · ACETATE · BROWLINE', subColor: '#4a6b62', track: 0.3 },
    L.x0 + 0.03,
    2.9,
    0,
    Math.PI / 2,
  );
  sign(
    'WOMEN',
    { w: 2.6, h: 0.52, color: '#1f3d36', sub: 'CAT-EYE · ROUND · OVERSIZED', subColor: '#4a6b62', track: 0.3 },
    L.x1 - 0.03,
    2.9,
    1.0,
    -Math.PI / 2,
  );
  sign(
    'CONTACT LENSES',
    { w: 3.0, h: 0.5, color: '#1f3d36', sub: 'DAILY · MONTHLY · TORIC · CARE', subColor: '#4a6b62', track: 0.16 },
    L.contacts.center,
    2.88,
    L.z0 + 0.03,
    0,
  );

  flush();

  /* ------------------------------------------------------------------
     Frames: procedural geometry from each archetype, drawn as instances
     ------------------------------------------------------------------ */
  function offsetPts(pts, d) {
    const n = pts.length,
      out = new Array(n);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n],
        p1 = pts[i],
        p2 = pts[(i + 1) % n];
      let tx = p2.x - p0.x,
        ty = p2.y - p0.y;
      const l = Math.hypot(tx, ty) || 1;
      tx /= l;
      ty /= l;
      out[i] = new V2(p1.x + ty * d, p1.y - tx * d);
    }
    return out;
  }
  function mergeList(list) {
    if (!list.length) return null;
    const gs = list.map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      for (const k of Object.keys(n.attributes))
        if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k);
      return n;
    });
    const out = mergeGeometries(gs, false);
    out.computeBoundingBox();
    out.computeBoundingSphere();
    return out;
  }
  function buildArch(a) {
    const base = NY.outline(a.shape, a.A, a.B, 56).map((p) => new V2(p.x, p.y));
    const style = a.style,
      th = a.thick || 1;
    const rimT = style === 'acetate' ? 0.0042 * th : 0.0012;
    const depth = style === 'acetate' ? 0.0042 * th : 0.002;
    const cxR = a.dbl / 2 + a.A / 2;
    const ace = [],
      met = [],
      lens = [];
    let maxX = -1,
      maxY = -1;
    for (const p of base) {
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const sides = {};
    for (const side of [1, -1]) {
      const pts = side === 1 ? base : base.map((p) => new V2(-p.x, p.y)).reverse();
      const m = new THREE.Matrix4()
        .makeTranslation(side * cxR, 0, 0)
        .multiply(new THREE.Matrix4().makeRotationY(side * 0.06));
      sides[side] = m;
      const lg = new THREE.ShapeGeometry(new THREE.Shape(offsetPts(pts, -0.0003)), 1);
      lg.applyMatrix4(m);
      lens.push(lg);
      if (style === 'acetate') {
        const sh = new THREE.Shape(offsetPts(pts, rimT));
        sh.holes.push(new THREE.Path(pts));
        const g = new THREE.ExtrudeGeometry(sh, {
          depth,
          bevelEnabled: true,
          bevelThickness: 0.0007,
          bevelSize: 0.0005,
          bevelSegments: 1,
          steps: 1,
        });
        g.translate(0, 0, -depth / 2);
        g.applyMatrix4(m);
        ace.push(g);
      } else {
        const curve = new THREE.CatmullRomCurve3(
          pts.map((p) => new V3(p.x, p.y, 0)),
          true,
          'centripetal',
        );
        const g = new THREE.TubeGeometry(curve, 72, style === 'combo' ? 0.0007 : 0.00085, 6, true);
        g.applyMatrix4(m);
        met.push(g);
        if (style === 'combo') {
          const idx = NY.topArc(pts, a.B * 0.06);
          if (idx.length > 2) {
            const outer = offsetPts(pts, 0.0058);
            const shape = new THREE.Shape(idx.map((i) => outer[i]).concat(idx.map((i) => pts[i]).reverse()));
            const bd = 0.0048;
            const g2 = new THREE.ExtrudeGeometry(shape, {
              depth: bd,
              bevelEnabled: true,
              bevelThickness: 0.0006,
              bevelSize: 0.0004,
              bevelSegments: 1,
              steps: 1,
            });
            g2.translate(0, 0, -bd / 2 + 0.0008);
            g2.applyMatrix4(m);
            ace.push(g2);
          }
        }
      }
    }
    const yB = a.B * 0.12;
    if (style === 'acetate') {
      const span = a.dbl / 2 + rimT * 1.2,
        hb = 0.0052 * th,
        N = 12;
      const shp = new THREE.Shape();
      shp.moveTo(-span, yB + hb);
      for (let i = 1; i <= N; i++) {
        const x = -span + (2 * span * i) / N;
        shp.lineTo(x, yB + hb + 0.0006 * Math.cos((Math.PI * x) / (2 * span)));
      }
      for (let i = N; i >= 0; i--) {
        const x = -span + (2 * span * i) / N;
        shp.lineTo(x, yB + 0.0028 * Math.cos((Math.PI * x) / (2 * span)));
      }
      const g = new THREE.ExtrudeGeometry(shp, {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.0006,
        bevelSize: 0.0004,
        bevelSegments: 1,
        steps: 1,
      });
      g.translate(0, 0, -depth / 2 + 0.0012);
      ace.push(g);
    } else {
      const c = new THREE.CatmullRomCurve3([
        new V3(-a.dbl / 2 - 0.001, yB, 0.0005),
        new V3(-a.dbl / 4, yB + 0.0028, 0.0018),
        new V3(0, yB + 0.0035, 0.0022),
        new V3(a.dbl / 4, yB + 0.0028, 0.0018),
        new V3(a.dbl / 2 + 0.001, yB, 0.0005),
      ]);
      met.push(new THREE.TubeGeometry(c, 20, 0.0009, 6, false));
      if (a.dbridge) {
        const ty = maxY * 0.8;
        const c2 = new THREE.CatmullRomCurve3([
          new V3(-(cxR - a.A * 0.1), ty, 0.0004),
          new V3(0, ty + 0.0012, 0.0016),
          new V3(cxR - a.A * 0.1, ty, 0.0004),
        ]);
        met.push(new THREE.TubeGeometry(c2, 20, 0.00085, 6, false));
      }
      for (const sd of [1, -1]) {
        const arm = new THREE.CatmullRomCurve3([
          new V3(sd * (a.dbl / 2 + 0.0008), yB - 0.001, -0.0005),
          new V3(sd * (a.dbl / 2 - 0.0005), yB - 0.006, -0.004),
          new V3(sd * (a.dbl / 2 - 0.0018), -a.B * 0.02, -0.0065),
        ]);
        met.push(new THREE.TubeGeometry(arm, 8, 0.0005, 5, false));
        const pad = new THREE.SphereGeometry(0.0045, 10, 8);
        pad.scale(0.42, 1, 0.22);
        pad.rotateZ(sd * 0.25);
        pad.translate(sd * (a.dbl / 2 - 0.0022), -a.B * 0.05, -0.0075);
        met.push(pad);
      }
    }
    const hingeY = Math.min(maxY * 0.55, a.B * 0.24);
    const hingeOff = style === 'acetate' ? rimT * 0.55 : style === 'combo' ? 0.0035 : 0.0007;
    for (const sd of [1, -1]) {
      const hp = new V3(sd * (maxX + hingeOff), hingeY, -depth * 0.3).applyMatrix4(sides[sd]);
      const pts3 = [
        hp,
        new V3(hp.x + sd * 0.003, hp.y, hp.z - 0.02),
        new V3(hp.x + sd * 0.0055, hp.y - 0.0008, hp.z - 0.075),
        new V3(hp.x + sd * 0.006, hp.y - 0.0035, hp.z - 0.112),
        new V3(hp.x + sd * 0.0052, hp.y - 0.015, hp.z - 0.131),
        new V3(hp.x + sd * 0.0042, hp.y - 0.031, hp.z - 0.142),
      ];
      const curve = new THREE.CatmullRomCurve3(pts3, false, 'centripetal');
      const tg = new THREE.TubeGeometry(
        curve,
        28,
        style === 'acetate' ? 0.0015 * th : style === 'combo' ? 0.0013 : 0.0008,
        style === 'metal' ? 6 : 8,
        false,
      );
      if (style === 'metal') met.push(tg);
      else ace.push(tg);
      if (style === 'acetate') {
        const end = new THREE.BoxGeometry(0.0045, 0.0062, 0.007);
        end.translate(hp.x - sd * 0.0006, hp.y, hp.z - 0.002);
        ace.push(end);
      } else {
        const hinge = new THREE.BoxGeometry(0.003, 0.004, 0.005);
        hinge.translate(hp.x, hp.y, hp.z - 0.0015);
        met.push(hinge);
      }
    }
    const res = { acetate: mergeList(ace), metal: mergeList(met), lens: mergeList(lens) };
    let my = 1;
    for (const k of ['acetate', 'metal', 'lens']) if (res[k]) my = Math.min(my, res[k].boundingBox.min.y);
    res.minY = my;
    return res;
  }
  const ARCHGEO = {};
  const archGeo = (id) => ARCHGEO[id] || (ARCHGEO[id] = buildArch(NY.ARCH[id]));

  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const FM = {
    solid: phys({ color: 0xffffff, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
    matte: std({ color: 0xffffff, roughness: 0.72 }),
    tort: phys({ color: 0xffffff, map: tex.tort, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
    tortL: phys({ color: 0xffffff, map: tex.tortL, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
    clear: phys({ color: 0xffffff, roughness: 0.12, clearcoat: 0.6, transparent: true, opacity: 0.62 }),
    metal: std({ color: 0xffffff, roughness: 0.24, metalness: 1 }),
    lensClear: phys({
      color: 0xffffff,
      transparent: true,
      opacity: 0.16,
      roughness: 0.02,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    lensTint: phys({
      color: 0xffffff,
      transparent: true,
      opacity: 0.84,
      roughness: 0.06,
      metalness: 0.15,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    lensMirror: std({
      color: 0xffffff,
      roughness: 0.08,
      metalness: 0.95,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    }),
  };
  function partsFor(p, col) {
    const G = archGeo(p.arch),
      out = [];
    if (G.acetate)
      out.push({
        part: 'acetate',
        kind:
          col.k === 'tort' ? (col.tl ? 'tortL' : 'tort') : col.k === 'clear' ? 'clear' : col.matte ? 'matte' : 'solid',
        color: new THREE.Color(col.a || '#222222'),
      });
    if (G.metal) out.push({ part: 'metal', kind: 'metal', color: new THREE.Color(col.m || '#c8c8c8') });
    out.push({
      part: 'lens',
      kind: p.sun ? (col.lk === 'mirror' ? 'lensMirror' : 'lensTint') : 'lensClear',
      color: new THREE.Color(p.sun ? col.l : '#ffffff'),
    });
    return out;
  }

  const groups = new Map();
  const records = [];
  const jit = rng(99);
  function addDisplay(pid, ci, slot) {
    const p = NY.byId[pid];
    if (!p) return null;
    const a = NY.ARCH[p.arch],
      G = archGeo(p.arch),
      col = NY.colorOf(p, ci);
    const scale = p.size[0] / 1000 / a.A;
    const yLift = -G.minY * scale + 0.0015;
    const ry = slot.ry + (jit() - 0.5) * 0.08;
    const center = new V3(slot.pos.x, slot.pos.y + yLift, slot.pos.z);
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.05, ry, 0, 'YXZ'));
    const base = new THREE.Matrix4().compose(center, quat, new V3(scale, scale, scale));
    const rec = { pid, ci: ci % p.colors.length, center, ry, refs: [], zone: slot.zone, kind: 'frame' };
    for (const pt of partsFor(p, col)) {
      const key = p.arch + '|' + pt.part + '|' + pt.kind;
      let g = groups.get(key);
      if (!g) {
        g = { geo: G[pt.part], mat: FM[pt.kind], items: [] };
        groups.set(key, g);
      }
      g.items.push({ rec, color: pt.color, base });
    }
    records.push(rec);
    return rec;
  }
  function placeRow(row, pids) {
    const per = Math.ceil(row.length / pids.length);
    row.forEach((s, i) => {
      const pi = Math.min(pids.length - 1, Math.floor(i / per));
      const p = NY.byId[pids[pi]];
      if (p) addDisplay(p.id, (i - pi * per) % p.colors.length, s);
    });
  }
  const MR = NY.MERCH;
  rowsMen.forEach((rows, b) => rows.forEach((row, s) => placeRow(row, [MR.men[b][s]])));
  rowsWomen.forEach((rows, b) => rows.forEach((row, s) => placeRow(row, [MR.women[b][s]])));
  rowsSun.forEach((row, i) => placeRow(row, MR.sun[i]));
  rowsKids.forEach((row, i) => placeRow(row, [MR.kidsWall[i]]));
  placeRow(kidsTableSlots, MR.kidsTable);
  premiumCases.forEach((s, i) => addDisplay(MR.premiumCases[i][0], MR.premiumCases[i][1], s));
  premiumNiche.forEach((s, i) => addDisplay(MR.premiumNiche[i][0], MR.premiumNiche[i][1], s));

  const productMeshes = [];
  for (const g of groups.values()) {
    const im = new THREE.InstancedMesh(g.geo, g.mat, g.items.length);
    im.userData.recs = [];
    g.items.forEach((it, i) => {
      im.setMatrixAt(i, it.base);
      im.setColorAt(i, it.color);
      im.userData.recs[i] = it.rec;
      it.rec.refs.push({ im, i, base: it.base });
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    if (g.mat.transparent) im.renderOrder = 2;
    scene.add(im);
    productMeshes.push(im);
  }

  // Contact lenses and care: boxes, bottles and cases
  {
    const boxGeo = new THREE.BoxGeometry(0.1, 0.062, 0.034);
    boxGeo.translate(0, 0.031, 0);
    const bottleProfile = [
      [0, 0],
      [0.032, 0],
      [0.034, 0.006],
      [0.034, 0.13],
      [0.026, 0.15],
      [0.012, 0.158],
      [0.012, 0.178],
      [0, 0.178],
    ].map((q) => new V2(q[0], q[1]));
    const bottleGeo = new THREE.LatheGeometry(bottleProfile, 18);
    const smallGeo = bottleGeo.clone();
    smallGeo.scale(0.62, 0.62, 0.62);
    const caseGeo = new THREE.BoxGeometry(0.08, 0.03, 0.05);
    caseGeo.translate(0, 0.015, 0);
    const kinds = {
      box: { geo: boxGeo, mat: std({ map: tex.box, roughness: 0.55 }), items: [] },
      bottle: { geo: bottleGeo, mat: std({ color: 0xffffff, roughness: 0.3 }), items: [] },
      small: { geo: smallGeo, mat: std({ color: 0xffffff, roughness: 0.3 }), items: [] },
      case: { geo: caseGeo, mat: std({ color: 0xffffff, roughness: 0.5 }), items: [] },
    };
    function cluster(pid, base, ry) {
      const p = NY.byId[pid];
      if (!p) return;
      const kind = p.type === 'contacts' ? 'box' : pid === 'c05' ? 'bottle' : pid === 'c06' ? 'small' : 'case';
      const rx = new V3(Math.cos(ry), 0, -Math.sin(ry)),
        fz = new V3(Math.sin(ry), 0, Math.cos(ry));
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
      const rec = {
        pid,
        ci: 0,
        center: base.clone().add(new V3(0, 0.06, 0)),
        ry,
        refs: [],
        zone: 'contacts',
        kind: 'contacts',
      };
      const color = new THREE.Color(p.color);
      const spots = [];
      if (kind === 'box') {
        for (let j = 0; j < 2; j++) for (let i = -1; i <= 1; i++) spots.push([i * 0.112, j * 0.064, 0]);
      } else if (kind === 'bottle') {
        for (let i = 0; i < 4; i++) spots.push([(i - 1.5) * 0.08, 0, 0]);
      } else if (kind === 'small') {
        for (let i = 0; i < 5; i++) spots.push([(i - 2) * 0.055, 0, 0]);
      } else {
        for (let j = 0; j < 2; j++) for (let i = -1; i <= 1; i++) spots.push([i * 0.09, j * 0.032, 0]);
      }
      for (const sp of spots) {
        const pos = base
          .clone()
          .addScaledVector(rx, sp[0])
          .add(new V3(0, sp[1], 0))
          .addScaledVector(fz, sp[2]);
        const m = new THREE.Matrix4().compose(pos, quat, new V3(1, 1, 1));
        kinds[kind].items.push({ rec, color, base: m });
      }
      records.push(rec);
    }
    const cx = L.contacts.center;
    MR.contacts.forEach((row, s) => {
      const y = [1.05, 1.35, 1.65][s] + 0.011;
      row.forEach((pid, i) => cluster(pid, new V3(cx + (i - 1) * 1.05, y, L.z0 + 0.2), 0));
    });
    const T = L.contactsTable;
    box('walnut', T.w, 0.86, T.d, T.x, 0.43, T.z);
    box('stone', T.w + 0.04, 0.03, T.d + 0.04, T.x, 0.875, T.z);
    shadowRect(T.x, T.z, T.w + 0.3, T.d + 0.3);
    MR.contactsTable.forEach((pid, i) => cluster(pid, new V3(T.x + (i - 0.5) * 0.5, 0.89, T.z + 0.05), 0));
    flush();
    for (const k of Object.values(kinds)) {
      if (!k.items.length) continue;
      const im = new THREE.InstancedMesh(k.geo, k.mat, k.items.length);
      im.userData.recs = [];
      k.items.forEach((it, i) => {
        im.setMatrixAt(i, it.base);
        im.setColorAt(i, it.color);
        im.userData.recs[i] = it.rec;
        it.rec.refs.push({ im, i, base: it.base });
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = true;
      scene.add(im);
      productMeshes.push(im);
    }
  }

  /* ------------------------------------------------------------------
     Lighting
     ------------------------------------------------------------------ */
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0x8f8576, 0.7));
  const key = new THREE.DirectionalLight(0xfff1de, 1.25);
  key.position.set(3, 12, 4.5);
  key.target.position.set(0, 0, 0);
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, near: 1, far: 30 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);

  /* ------------------------------------------------------------------
     Walk planner: grid, A*, smoothing
     ------------------------------------------------------------------ */
  const NAV = (() => {
    const cell = 0.2,
      R = 0.3,
      cols = Math.round(W / cell),
      rows = Math.round(D / cell),
      blocked = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = L.x0 + (c + 0.5) * cell,
          z = L.z0 + (r + 0.5) * cell;
        let b = x < L.x0 + R || x > L.x1 - R || z < L.z0 + R || z > L.z1 - R;
        if (!b)
          for (const o of NY.OBS) {
            if (o.t === 'r') {
              if (x > o.x0 - R && x < o.x1 + R && z > o.z0 - R && z < o.z1 + R) {
                b = true;
                break;
              }
            } else if (Math.hypot(x - o.x, z - o.z) < o.r + R) {
              b = true;
              break;
            }
          }
        blocked[r * cols + c] = b ? 1 : 0;
      }
    return { cell, cols, rows, blocked };
  })();
  const cellOf = (x, z) => [Math.floor((x - L.x0) / NAV.cell), Math.floor((z - L.z0) / NAV.cell)];
  const free = (c, r) => c >= 0 && r >= 0 && c < NAV.cols && r < NAV.rows && !NAV.blocked[r * NAV.cols + c];
  const freeAt = (x, z) => {
    const q = cellOf(x, z);
    return free(q[0], q[1]);
  };
  const centerOf = (c, r) => new V2(L.x0 + (c + 0.5) * NAV.cell, L.z0 + (r + 0.5) * NAV.cell);
  function nearestFree(x, z) {
    if (freeAt(x, z)) return new V2(x, z);
    const [c0, r0] = cellOf(x, z);
    for (let rad = 1; rad < 50; rad++) {
      let best = null,
        bd = 1e9;
      for (let dr = -rad; dr <= rad; dr++)
        for (let dc = -rad; dc <= rad; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
          if (free(c0 + dc, r0 + dr)) {
            const p = centerOf(c0 + dc, r0 + dr),
              d = (p.x - x) ** 2 + (p.y - z) ** 2;
            if (d < bd) {
              bd = d;
              best = p;
            }
          }
        }
      if (best) return best;
    }
    return null;
  }
  function los(a, b) {
    const d = a.distanceTo(b),
      n = Math.ceil(d / 0.07);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (!freeAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
    }
    return true;
  }
  function findPath(a, b) {
    const { cols, rows } = NAV;
    let s = cellOf(a.x, a.y);
    if (!free(s[0], s[1])) {
      const n = nearestFree(a.x, a.y);
      if (!n) return null;
      s = cellOf(n.x, n.y);
    }
    const e = cellOf(b.x, b.y);
    if (!free(e[0], e[1])) return null;
    const N = cols * rows,
      g = new Float32Array(N).fill(Infinity),
      came = new Int32Array(N).fill(-1),
      closed = new Uint8Array(N);
    const start = s[1] * cols + s[0],
      goal = e[1] * cols + e[0];
    const hf = [],
      hi = [];
    const push = (f, i) => {
      hf.push(f);
      hi.push(i);
      let k = hf.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (hf[p] <= hf[k]) break;
        [hf[p], hf[k]] = [hf[k], hf[p]];
        [hi[p], hi[k]] = [hi[k], hi[p]];
        k = p;
      }
    };
    const pop = () => {
      const top = hi[0],
        lf = hf.pop(),
        li = hi.pop();
      if (hf.length) {
        hf[0] = lf;
        hi[0] = li;
        let k = 0;
        for (;;) {
          const l = 2 * k + 1,
            r = l + 1;
          let m = k;
          if (l < hf.length && hf[l] < hf[m]) m = l;
          if (r < hf.length && hf[r] < hf[m]) m = r;
          if (m === k) break;
          [hf[m], hf[k]] = [hf[k], hf[m]];
          [hi[m], hi[k]] = [hi[k], hi[m]];
          k = m;
        }
      }
      return top;
    };
    const heur = (c, r) => {
      const dx = Math.abs(c - e[0]),
        dy = Math.abs(r - e[1]);
      return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
    };
    const DIRS = [
      [1, 0, 1],
      [-1, 0, 1],
      [0, 1, 1],
      [0, -1, 1],
      [1, 1, Math.SQRT2],
      [1, -1, Math.SQRT2],
      [-1, 1, Math.SQRT2],
      [-1, -1, Math.SQRT2],
    ];
    g[start] = 0;
    push(heur(s[0], s[1]), start);
    while (hf.length) {
      const cur = pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cr = (cur / cols) | 0,
        cc = cur - cr * cols;
      for (const [dc, dr, w] of DIRS) {
        const nc = cc + dc,
          nr = cr + dr;
        if (!free(nc, nr)) continue;
        if (dc && dr && (!free(cc + dc, cr) || !free(cc, cr + dr))) continue;
        const ni = nr * cols + nc,
          ng = g[cur] + w;
        if (ng < g[ni]) {
          g[ni] = ng;
          came[ni] = cur;
          push(ng + heur(nc, nr), ni);
        }
      }
    }
    if (g[goal] === Infinity) return null;
    const cells = [];
    for (let i = goal; i !== -1; i = came[i]) cells.push(i);
    cells.reverse();
    const pts = cells.map((i) => centerOf(i % cols, (i / cols) | 0));
    pts[0] = new V2(a.x, a.y);
    pts[pts.length - 1] = new V2(b.x, b.y);
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !los(pts[i], pts[j])) j--;
      out.push(pts[j]);
      i = j;
    }
    return out;
  }

  /* ------------------------------------------------------------------
     Camera movement
     ------------------------------------------------------------------ */
  const nav = {
    x: 0,
    z: 7.25,
    yaw: 0,
    pitch: -0.06,
    moving: false,
    pts: null,
    cum: null,
    len: 0,
    t: 0,
    T: 1,
    s: 0,
    look: null,
    info: null,
    turn: null,
  };
  let zoom = 1,
    baseFov = 60,
    needs = true,
    keepAlive = 0,
    paused = false,
    labelsOn = true;
  let curZone = (NY.zoneAt(nav.x, nav.z) || {}).id || null;
  const kick = (ms) => {
    keepAlive = Math.max(keepAlive, performance.now() + (ms || 400));
  };
  const angDiff = (a, b) => {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth01 = (t) => {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  };
  function yawPitch(fx, fz, t) {
    const dx = t.x - fx,
      dz = t.z - fz,
      dy = t.y - EYE;
    return { yaw: Math.atan2(-dx, -dz), pitch: Math.max(-0.9, Math.min(0.6, Math.atan2(dy, Math.hypot(dx, dz)))) };
  }

  const ringMat = basic({ color: '#1e6a57', transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.215, 48).rotateX(-Math.PI / 2), ringMat);
  ring.visible = false;
  ring.renderOrder = 4;
  scene.add(ring);
  const dest = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.24, 48).rotateX(-Math.PI / 2),
    basic({ color: '#1e6a57', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }),
  );
  dest.visible = false;
  dest.renderOrder = 4;
  scene.add(dest);
  const fadeEl = document.getElementById('fade');

  function updateZone(force) {
    const z = NY.zoneAt(nav.x, nav.z),
      id = z ? z.id : null;
    if (id !== curZone) {
      curZone = id;
      if (NY.onZoneChange) NY.onZoneChange(id);
    } else if (force && NY.onZoneChange) NY.onZoneChange(id);
  }
  function arrive() {
    nav.moving = false;
    dest.visible = false;
    const info = nav.info || {};
    nav.info = null;
    updateZone(false);
    if (info.reason === 'product' && info.rec) highlight(info.rec);
    if (NY.onArrive) NY.onArrive({ zone: curZone, reason: info.reason, id: info.id, tag: info.tag });
    kick(700);
  }
  function teleport(end, look) {
    nav.moving = false;
    fadeEl.classList.add('on');
    setTimeout(
      () => {
        nav.x = end.x;
        nav.z = end.y;
        if (look) {
          nav.yaw = look.yaw;
          nav.pitch = look.pitch;
        }
        nav.turn = null;
        needs = true;
        kick();
        requestAnimationFrame(() => {
          fadeEl.classList.remove('on');
          arrive();
        });
      },
      RM ? 60 : 220,
    );
    return true;
  }
  function goTo(x, z, look, info) {
    const end = nearestFree(x, z);
    if (!end) return false;
    const pts = findPath(new V2(nav.x, nav.z), end);
    if (!pts) {
      if (NY.toast) NY.toast('That spot can’t be reached from here.');
      return false;
    }
    nav.info = info || { reason: 'point' };
    const endLook = look ? yawPitch(end.x, end.y, look) : null;
    if (NY.settings && NY.settings.move === 'jump') return teleport(end, endLook);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const len = cum[cum.length - 1];
    if (len < 0.08) {
      nav.turn = endLook;
      arrive();
      return true;
    }
    Object.assign(nav, {
      moving: true,
      pts,
      cum,
      len,
      t: 0,
      s: 0,
      T: Math.min(4.6, Math.max(0.7, len / 2.3)),
      look: endLook,
      turn: null,
    });
    dest.position.set(end.x, 0.012, end.y);
    dest.visible = true;
    ring.visible = false;
    kick();
    return true;
  }
  function pointAt(s) {
    const { pts, cum } = nav;
    for (let i = 1; i < pts.length; i++)
      if (s <= cum[i]) {
        const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
        return new V2(lerp(pts[i - 1].x, pts[i].x, t), lerp(pts[i - 1].y, pts[i].y, t));
      }
    return pts[pts.length - 1].clone();
  }

  /* ------------------------------------------------------------------
     Input: drag to look, tap to walk or open, pinch and wheel to zoom, keys
     ------------------------------------------------------------------ */
  const ray = new THREE.Raycaster(),
    ndc = new V2();
  const pickables = productMeshes.concat(hitboxes);
  const allHits = pickables.concat(solids, [floor]);
  function setRay(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  const ptrs = new Map();
  const drag = { active: false, id: null, x: 0, y: 0, sx: 0, sy: 0, t: 0, moved: false };
  let pinch = null;
  const pdist = () => {
    const v = [...ptrs.values()];
    return Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y);
  };
  canvas.addEventListener('pointerdown', (e) => {
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1)
      Object.assign(drag, {
        active: true,
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        sx: e.clientX,
        sy: e.clientY,
        t: performance.now(),
        moved: false,
      });
    else if (ptrs.size === 2) {
      drag.active = false;
      pinch = { d: pdist(), z: zoom };
    }
    if (NY.onUserNav) NY.onUserNav('down');
    kick();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size === 2) {
      zoom = Math.max(0.45, Math.min(1.15, (pinch.z * pinch.d) / Math.max(10, pdist())));
      kick();
      return;
    }
    if (drag.active && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
        drag.moved = true;
        canvas.classList.add('grabbing');
        nav.turn = null;
        hideTip();
      }
      if (drag.moved) {
        const k = (camera.fov * Math.PI) / 180 / Math.max(200, canvas.clientHeight);
        nav.yaw += dx * k;
        nav.pitch = Math.max(-0.95, Math.min(0.7, nav.pitch + dy * k));
        kick();
      }
      return;
    }
    if (e.pointerType === 'mouse' && !drag.active) {
      hoverPt = [e.clientX, e.clientY];
      if (!hoverReq) hoverReq = requestAnimationFrame(doHover);
    }
  });
  function endPtr(e) {
    const wasPinch = !!pinch;
    ptrs.delete(e.pointerId);
    if (pinch && ptrs.size < 2) {
      pinch = null;
      drag.active = false;
    }
    if (drag.active && e.pointerId === drag.id) {
      if (!drag.moved && !wasPinch && e.type === 'pointerup' && performance.now() - drag.t < 650)
        tap(e.clientX, e.clientY);
      drag.active = false;
      canvas.classList.remove('grabbing');
    }
    kick();
  }
  canvas.addEventListener('pointerup', endPtr);
  canvas.addEventListener('pointercancel', endPtr);
  canvas.addEventListener('pointerleave', () => {
    if (!drag.active) {
      setHover(null);
      hideTip();
      ring.visible = false;
      kick();
    }
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoom = Math.max(0.45, Math.min(1.15, zoom * Math.exp(e.deltaY * 0.0012)));
      kick();
    },
    { passive: false },
  );
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function tap(cx, cy) {
    setRay(cx, cy);
    const hit = ray.intersectObjects(allHits, false)[0];
    if (!hit) return;
    const o = hit.object;
    if (o.userData.recs) {
      const rec = o.userData.recs[hit.instanceId];
      if (rec && NY.onProductTap) {
        nav.turn = yawPitch(nav.x, nav.z, rec.center);
        kick();
        NY.onProductTap(rec.pid, rec.ci);
      }
      return;
    }
    if (o.userData.action) {
      if (NY.onFeatureTap) NY.onFeatureTap(o.userData.action);
      return;
    }
    let x = hit.point.x,
      z = hit.point.z,
      look = null;
    if (o !== floor && hit.point.y > 0.05) {
      const dx = nav.x - x,
        dz = nav.z - z,
        d = Math.hypot(dx, dz) || 1;
      look = hit.point.clone();
      x += (dx / d) * 0.95;
      z += (dz / d) * 0.95;
    }
    if (NY.onUserNav) NY.onUserNav('walk');
    goTo(x, z, look, { reason: 'point' });
  }

  let hoverReq = null,
    hoverPt = null,
    hovered = null;
  const tipEl = document.getElementById('tooltip');
  const appEl = document.getElementById('app');
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const FEATURE_TIPS = {
    directory: '<b>Store directory</b>Click to open the map',
    lensguide: '<b>Lens bar</b>Click for the lens guide',
    eyetest: '<b>Eye test room</b>Click to book a free test',
    bag: '<b>Checkout counter</b>Click to open your bag',
  };
  function tipFor(rec) {
    const p = NY.byId[rec.pid];
    if (p.type !== 'frame') return '<b>' + esc(p.name) + '</b>from ' + NY.money(Math.min(...p.packs.map((x) => x.p)));
    return '<b>' + esc(p.name) + '</b>' + esc(NY.colorOf(p, rec.ci).n) + ' · ' + NY.money(p.price);
  }
  function showTip(cx, cy, html) {
    const r = appEl.getBoundingClientRect();
    tipEl.innerHTML = html;
    tipEl.hidden = false;
    const x = Math.min(cx - r.left, r.width - 240),
      y = Math.min(cy - r.top, r.height - 70);
    tipEl.style.transform = 'translate(' + (x + 14) + 'px,' + (y + 14) + 'px)';
  }
  function hideTip() {
    tipEl.hidden = true;
  }
  function setPose(rec, k) {
    const s = 1 + 0.14 * k;
    const ox = Math.sin(rec.ry) * 0.025 * k,
      oz = Math.cos(rec.ry) * 0.025 * k,
      oy = 0.012 * k;
    for (const r of rec.refs) {
      const m = r.base.clone();
      if (k) {
        m.scale(new V3(s, s, s));
        m.elements[12] += ox;
        m.elements[13] += oy;
        m.elements[14] += oz;
      }
      r.im.setMatrixAt(r.i, m);
      r.im.instanceMatrix.needsUpdate = true;
    }
  }
  function setHover(rec) {
    if (rec === hovered) return;
    if (hovered && !(pulse && pulse.rec === hovered)) setPose(hovered, 0);
    hovered = rec;
    if (rec) setPose(rec, 1);
    needs = true;
  }
  function doHover() {
    hoverReq = null;
    if (!hoverPt || drag.active) return;
    const [cx, cy] = hoverPt;
    setRay(cx, cy);
    let hit = ray.intersectObjects(pickables, false)[0];
    if (hit) {
      const occ = ray.intersectObjects(solids, false)[0];
      if (occ && occ.distance < hit.distance - 0.03) hit = null;
    }
    const rec = hit && hit.object.userData.recs ? hit.object.userData.recs[hit.instanceId] : null;
    const feat = hit && hit.object.userData.action ? hit.object.userData.action : null;
    setHover(rec);
    if (rec || feat) {
      showTip(cx, cy, rec ? tipFor(rec) : FEATURE_TIPS[feat]);
      canvas.classList.add('over-item');
      ring.visible = false;
    } else {
      hideTip();
      canvas.classList.remove('over-item');
      const o = ray.ray.origin,
        d = ray.ray.direction;
      ring.visible = false;
      if (d.y < -0.01 && !nav.moving) {
        const t = -o.y / d.y,
          x = o.x + d.x * t,
          z = o.z + d.z * t;
        if (t < 30 && freeAt(x, z)) {
          ring.position.set(x, 0.012, z);
          ring.visible = true;
        }
      }
    }
    kick(150);
  }

  const keys = new Set();
  const MOVE_KEYS = ['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
  const typing = (e) => {
    const t = e.target;
    return (
      t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || (t.closest && t.closest('#sheet')))
    );
  };
  window.addEventListener('keydown', (e) => {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (!MOVE_KEYS.includes(k)) return;
    e.preventDefault();
    keys.add(k);
    nav.moving = false;
    nav.turn = null;
    dest.visible = false;
    if (NY.onUserNav) NY.onUserNav('keys');
    kick();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.key.toLowerCase());
  });
  window.addEventListener('blur', () => keys.clear());
  let walked = false,
    walkedAt = 0;

  /* ------------------------------------------------------------------
     Highlight for "Show in store"
     ------------------------------------------------------------------ */
  let pulse = null;
  const pinEl = document.getElementById('pin'),
    pinLabel = document.getElementById('pin-label');
  function highlight(rec) {
    if (pulse) setPose(pulse.rec, 0);
    pulse = { rec, until: performance.now() + 6500 };
    const p = NY.byId[rec.pid];
    pinLabel.textContent = p.name + (p.type === 'frame' ? ' · ' + NY.colorOf(p, rec.ci).n : '');
    pinEl.hidden = false;
    kick(6600);
  }
  const tmpV = new V3();
  function updatePin() {
    if (!pulse) {
      pinEl.hidden = true;
      return;
    }
    tmpV.copy(pulse.rec.center);
    tmpV.y += 0.07;
    const v = tmpV.project(camera);
    if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) {
      pinEl.style.opacity = '0';
      return;
    }
    const r = canvas.getBoundingClientRect();
    pinEl.style.opacity = '1';
    pinEl.style.transform =
      'translate3d(' +
      (((v.x + 1) / 2) * r.width).toFixed(1) +
      'px,' +
      (((1 - v.y) / 2) * r.height).toFixed(1) +
      'px,0) translate(-50%,-100%)';
  }

  /* ------------------------------------------------------------------
     Floating section labels
     ------------------------------------------------------------------ */
  const labelsEl = document.getElementById('labels');
  const labels = NY.ZONES.map((z) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'zlabel';
    b.hidden = true;
    b.innerHTML = '<i aria-hidden="true"></i><span>' + esc(z.short) + '</span>';
    b.setAttribute('aria-label', 'Walk to ' + z.name);
    b.addEventListener('click', () => {
      if (NY.onUserNav) NY.onUserNav('label');
      goTo(z.view.p[0], z.view.p[1], new V3(z.view.t[0], z.view.t[1], z.view.t[2]), { reason: 'zone', id: z.id });
    });
    labelsEl.appendChild(b);
    return { z, el: b, p: new V3(z.anchor[0], z.anchor[1], z.anchor[2]) };
  });
  function updateLabels() {
    const r = canvas.getBoundingClientRect();
    const hideAll = !labelsOn || paused || curZone === 'eyetest';
    for (const lb of labels) {
      if (hideAll || lb.z.id === curZone) {
        lb.el.hidden = true;
        continue;
      }
      const d = Math.hypot(lb.p.x - nav.x, lb.p.z - nav.z);
      tmpV.copy(lb.p).project(camera);
      if (tmpV.z > 1 || tmpV.z < -1 || Math.abs(tmpV.x) > 1.02 || Math.abs(tmpV.y) > 1.02 || d > 17 || d < 1.6) {
        lb.el.hidden = true;
        continue;
      }
      lb.el.hidden = false;
      lb.el.style.transform =
        'translate3d(' +
        (((tmpV.x + 1) / 2) * r.width).toFixed(1) +
        'px,' +
        (((1 - tmpV.y) / 2) * r.height).toFixed(1) +
        'px,0) translate(-50%,-100%)';
      lb.el.style.opacity = d > 13 ? String(Math.max(0.35, (17 - d) / 4)) : '1';
    }
  }

  /* ------------------------------------------------------------------
     Product viewer (second renderer inside the detail sheet)
     ------------------------------------------------------------------ */
  let VW = null;
  function ensureViewer() {
    if (VW) return VW;
    const r2 = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r2.outputColorSpace = THREE.SRGBColorSpace;
    r2.toneMapping = THREE.NeutralToneMapping;
    r2.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r2.setClearColor(0x000000, 0);
    const sc = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r2);
    sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    sc.environmentIntensity = 0.7;
    sc.add(new THREE.HemisphereLight(0xffffff, 0x8f8a80, 0.6));
    const d2 = new THREE.DirectionalLight(0xffffff, 1.0);
    d2.position.set(0.3, 0.6, 0.5);
    sc.add(d2);
    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.2),
      basic({ map: tex.sRound, color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }),
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(0, -0.034, -0.05);
    sc.add(sh);
    const cam = new THREE.PerspectiveCamera(28, 1.6, 0.01, 5);
    cam.position.set(0.15, 0.05, 0.28);
    const ctr = new OrbitControls(cam, r2.domElement);
    ctr.target.set(0, -0.004, -0.04);
    ctr.enablePan = false;
    ctr.enableDamping = true;
    ctr.dampingFactor = 0.08;
    ctr.minDistance = 0.16;
    ctr.maxDistance = 0.55;
    ctr.minPolarAngle = 0.45;
    ctr.maxPolarAngle = 2.1;
    ctr.autoRotate = !RM;
    ctr.autoRotateSpeed = 1.6;
    ctr.addEventListener('start', () => {
      ctr.autoRotate = false;
    });
    ctr.update();
    const group = new THREE.Group();
    sc.add(group);
    VW = { r: r2, sc, cam, ctr, group, el: null, active: false, pid: null, mats: [] };
    return VW;
  }
  function buildViewerModel(pid, ci) {
    const p = NY.byId[pid],
      G = archGeo(p.arch),
      col = NY.colorOf(p, ci);
    for (const m of VW.mats) m.dispose();
    VW.mats = [];
    VW.group.clear();
    for (const pt of partsFor(p, col)) {
      const mat = FM[pt.kind].clone();
      mat.color.copy(pt.color);
      VW.mats.push(mat);
      VW.group.add(new THREE.Mesh(G[pt.part], mat));
    }
    VW.group.scale.setScalar(p.size[0] / 1000 / NY.ARCH[p.arch].A);
  }
  function sizeViewer() {
    if (!VW || !VW.el) return;
    const r = VW.el.getBoundingClientRect(),
      w = Math.max(1, Math.round(r.width)),
      h = Math.max(1, Math.round(r.height));
    VW.r.setSize(w, h, false);
    VW.cam.aspect = w / h;
    VW.cam.updateProjectionMatrix();
  }
  function mountViewer(el, pid, ci) {
    try {
      ensureViewer();
    } catch (e) {
      console.warn(e);
      return false;
    }
    VW.el = el;
    VW.pid = pid;
    VW.r.domElement.className = 'viewer-canvas';
    VW.r.domElement.setAttribute('aria-label', '3D view of the frame. Drag to turn it.');
    el.prepend(VW.r.domElement);
    buildViewerModel(pid, ci);
    VW.cam.position.set(0.15, 0.05, 0.28);
    VW.ctr.target.set(0, -0.004, -0.04);
    VW.ctr.autoRotate = !RM;
    VW.ctr.update();
    sizeViewer();
    VW.active = true;
    return true;
  }
  function unmountViewer() {
    if (!VW) return;
    VW.active = false;
    if (VW.r.domElement.parentNode) VW.r.domElement.parentNode.removeChild(VW.r.domElement);
    VW.el = null;
  }

  /* ------------------------------------------------------------------
     Quality, sizing and the frame loop
     ------------------------------------------------------------------ */
  const QUAL = { dpr: 1 };
  function resize() {
    const r = canvas.getBoundingClientRect(),
      w = Math.max(1, Math.round(r.width)),
      h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    baseFov = camera.aspect < 0.75 ? 70 : camera.aspect < 1.15 ? 64 : 58;
    needs = true;
    sizeViewer();
  }
  function applyQuality(mode) {
    const dpr = window.devicePixelRatio || 1;
    let max, sh;
    if (mode === 'high') {
      max = 2;
      sh = true;
    } else if (mode === 'low') {
      max = 1;
      sh = false;
    } else {
      max = coarse ? 1.5 : 1.75;
      sh = !coarse;
    }
    QUAL.dpr = Math.min(dpr, max);
    renderer.setPixelRatio(QUAL.dpr);
    if (renderer.shadowMap.enabled !== sh) {
      renderer.shadowMap.enabled = sh;
      key.castShadow = sh;
      scene.traverse((o) => {
        if (o.material)
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
            m.needsUpdate = true;
          });
      });
    }
    renderer.shadowMap.needsUpdate = true;
    resize();
  }
  let slow = 0;
  function adapt(dt) {
    if (!NY.settings || NY.settings.quality !== 'auto') return;
    if (dt > 1 / 36) slow++;
    else slow = Math.max(0, slow - 1);
    if (slow > 40 && QUAL.dpr > 1) {
      QUAL.dpr = Math.max(1, QUAL.dpr - 0.25);
      renderer.setPixelRatio(QUAL.dpr);
      resize();
      slow = 0;
    }
  }
  function pose() {
    let path = null;
    if (nav.moving && nav.pts) {
      path = [{ x: nav.x, z: nav.z }];
      for (let i = 1; i < nav.pts.length; i++) if (nav.cum[i] > nav.s) path.push({ x: nav.pts[i].x, z: nav.pts[i].y });
    }
    return {
      x: nav.x,
      z: nav.z,
      yaw: nav.yaw,
      hfov: 2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect),
      path,
    };
  }
  function update(dt) {
    let act = false;
    if (nav.moving) {
      act = true;
      nav.t += dt;
      const u = Math.min(1, nav.t / nav.T);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      nav.s = e * nav.len;
      const p = pointAt(nav.s);
      nav.x = p.x;
      nav.z = p.y;
      if (!drag.moved || !drag.active) {
        const q = pointAt(Math.min(nav.len, nav.s + 0.9));
        let hy = nav.yaw;
        if (q.distanceTo(p) > 0.05) hy = Math.atan2(-(q.x - p.x), -(q.y - p.y));
        const w = nav.look ? smooth01((u - 0.5) / 0.5) : 0;
        const ty = nav.look ? hy + angDiff(nav.look.yaw, hy) * w : hy;
        const tp = nav.look ? lerp(-0.05, nav.look.pitch, w) : -0.05;
        const k = 1 - Math.exp(-dt * 5.5);
        nav.yaw += angDiff(ty, nav.yaw) * k;
        nav.pitch += (tp - nav.pitch) * k;
      }
      updateZone(false);
      if (u >= 1) {
        if (nav.look) nav.turn = nav.look;
        arrive();
      }
    }
    if (nav.turn && !(drag.active && drag.moved)) {
      act = true;
      const k = 1 - Math.exp(-dt * 6);
      const dy = angDiff(nav.turn.yaw, nav.yaw),
        dp = nav.turn.pitch - nav.pitch;
      nav.yaw += dy * k;
      nav.pitch += dp * k;
      if (Math.abs(dy) < 0.002 && Math.abs(dp) < 0.002) nav.turn = null;
    }
    if (keys.size) {
      act = true;
      const f = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      const st = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
      const tr = (keys.has('arrowleft') || keys.has('q') ? 1 : 0) - (keys.has('arrowright') || keys.has('e') ? 1 : 0);
      nav.yaw += tr * 1.7 * dt;
      if (f || st) {
        const sp = 2.1 * dt,
          fx = -Math.sin(nav.yaw),
          fz = -Math.cos(nav.yaw),
          rx = Math.cos(nav.yaw),
          rz = -Math.sin(nav.yaw);
        const nx = nav.x + (fx * f + rx * st) * sp,
          nz = nav.z + (fz * f + rz * st) * sp;
        if (freeAt(nx, nz)) {
          nav.x = nx;
          nav.z = nz;
        } else if (freeAt(nx, nav.z)) nav.x = nx;
        else if (freeAt(nav.x, nz)) nav.z = nz;
        walked = true;
        walkedAt = performance.now();
        updateZone(false);
      }
    } else if (walked && performance.now() - walkedAt > 500) {
      walked = false;
      if (NY.onArrive) NY.onArrive({ zone: curZone, reason: 'walk' });
    }
    if (pulse) {
      act = true;
      const now = performance.now();
      if (now > pulse.until) {
        setPose(pulse.rec, hovered === pulse.rec ? 1 : 0);
        pulse = null;
        pinEl.hidden = true;
      } else setPose(pulse.rec, 0.35 + (0.65 * (Math.sin(now / 170) + 1)) / 2);
    }
    return act;
  }
  let frameN = 0;
  function render() {
    camera.position.set(nav.x, EYE, nav.z);
    camera.rotation.set(nav.pitch, nav.yaw, 0, 'YXZ');
    camera.fov = baseFov * zoom;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    needs = false;
    updateLabels();
    updatePin();
    if ((frameN++ & 1) === 0 && NY.onPose) NY.onPose(pose());
  }
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const act = update(dt) || (drag.active && drag.moved) || !!pinch;
    if (!paused && (act || needs || now < keepAlive)) {
      render();
      if (act) adapt(dt);
    }
    if (VW && VW.active) {
      VW.ctr.update();
      VW.r.render(VW.sc, VW.cam);
    }
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    if (NY.toast) NY.toast('The 3D view paused. It resumes when the browser restores it.');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    renderer.shadowMap.needsUpdate = true;
    needs = true;
    kick();
  });
  window.addEventListener('resize', () => {
    resize();
    kick();
  });
  if (window.ResizeObserver)
    new ResizeObserver(() => {
      resize();
      kick();
    }).observe(canvas);

  applyQuality((NY.settings && NY.settings.quality) || 'auto');
  if (camera.aspect < 0.75) nav.pitch = -0.13;
  render();

  NY.attach3D({
    goZone(id, tag) {
      const z = NY.zoneById(id);
      if (!z) return;
      goTo(z.view.p[0], z.view.p[1], new V3(z.view.t[0], z.view.t[1], z.view.t[2]), { reason: 'zone', id, tag });
    },
    goProduct(pid, ci) {
      const rec = records.find((r) => r.pid === pid && r.ci === (ci || 0)) || records.find((r) => r.pid === pid);
      if (!rec) return;
      const dist = rec.kind === 'contacts' ? 1.3 : rec.zone === 'kids' ? 1.05 : 1.25;
      const at = new V3(rec.center.x + Math.sin(rec.ry) * dist, 0, rec.center.z + Math.cos(rec.ry) * dist);
      goTo(at.x, at.z, rec.center, { reason: 'product', rec });
    },
    goPoint(x, z) {
      goTo(x, z, null, { reason: 'point' });
    },
    mountViewer,
    setViewerColor(ci) {
      if (VW && VW.active && VW.pid) buildViewerModel(VW.pid, ci);
    },
    unmountViewer,
    setQuality(m) {
      applyQuality(m);
      kick();
    },
    setLabels(on) {
      labelsOn = !!on;
      updateLabels();
    },
    setPaused(b) {
      paused = !!b;
      if (!paused) {
        needs = true;
        kick();
      } else updateLabels();
    },
    stats() {
      return {
        draws: renderer.info.render.calls,
        tris: renderer.info.render.triangles,
        records: records.length,
        meshes: productMeshes.length,
      };
    },
  });
  requestAnimationFrame(loop);
}
