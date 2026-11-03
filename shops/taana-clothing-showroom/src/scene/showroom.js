// The walkable 3D showroom: procedural store, garments with baked and live cloth, walk planner, labels and the
// mannequin viewer used in the product sheet.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { NY } from '../core/ny.js';
import { loadDrapes } from './drapes.js';
import { copyPositions, computeNormals, buildCurtain } from '../cloth/garments.js';
import { Mannequin } from '../cloth/render.js';
import { Outfit, materialsFor } from '../cloth/outfit.js';
import { animatedPose } from '../cloth/poses.js';
import {
  bodyFor,
  chestGirth,
  displayGarment,
  settleOnHanger,
  lookGarments,
  staticLooks,
  RES,
  CURTAIN,
} from '../cloth/display.js';

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

  // Signage is drawn with the page fonts; wait briefly for them. The drapes download in parallel.
  const drapesP = loadDrapes().catch((e) => {
    console.warn('Baked drapes unavailable, settling garments in the browser instead.', e);
    return null;
  });
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
  scene.background = new THREE.Color('#e6e1d8');
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
    g.fillStyle = '#ebe5da';
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
      ['#cdbfae', 30],
      ['#b9876a', 14],
      ['#9c5a3c', 8],
      ['#d9b77a', 10],
      ['#4a5070', 6],
      ['#f6f1e8', 22],
      ['#a9aeb8', 8],
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
  function texDirectory() {
    const W = 512,
      Hh = 1024,
      c = mk(W, Hh),
      g = c.getContext('2d');
    g.fillStyle = '#232b4d';
    g.fillRect(0, 0, W, Hh);
    g.fillStyle = '#f2ede3';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '600 52px "Unbounded", "Avenir Next", sans-serif';
    g.fillText('TAANA', W / 2, 92);
    g.font = '500 18px "Martian Mono", ui-monospace, monospace';
    g.fillStyle = '#e3b765';
    g.fillText('STORE DIRECTORY', W / 2, 146);
    const mw = W - 56,
      mh = (mw * 16) / 22;
    g.save();
    g.translate(28, 186);
    const m = NY.drawPlan(g, mw, mh, {
      colors: {
        floor: '#2d3760',
        zone: '#34406e',
        zoneOn: '#34406e',
        item: '#55639a',
        wall: '#ebe6da',
        text: '#ebe6da',
        you: '#e3b765',
      },
      labels: true,
      labelSize: 12,
      pad: 4,
      entrance: true,
    });
    g.fillStyle = '#e3b765';
    g.beginPath();
    g.arc(m.X(L.totem.x), m.Z(L.totem.z + 0.25), 6, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.textAlign = 'left';
    g.font = '500 15px "Martian Mono", ui-monospace, monospace';
    g.fillStyle = '#e3b765';
    g.fillText('●  YOU ARE HERE', 40, 186 + mh + 30);
    let y = 186 + mh + 72;
    NY.TOUR.forEach((id, i) => {
      const z = NY.zoneById(id);
      g.fillStyle = '#b9c2e6';
      g.font = '500 15px "Martian Mono", ui-monospace, monospace';
      g.fillText(String(i + 1).padStart(2, '0'), 40, y);
      g.fillStyle = '#f2ede3';
      g.font = '600 21px "Hanken Grotesk", system-ui, sans-serif';
      g.fillText(z.name, 82, y);
      y += 34;
    });
    return ctex(c, { repeat: false });
  }
  // Try-on mirror screen: line drawing of a figure with a draped garment and the call to action.
  function texTryon() {
    const W = 512,
      Hh = 1024,
      c = mk(W, Hh),
      g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, Hh);
    gr.addColorStop(0, '#1c2342');
    gr.addColorStop(1, '#2c3563');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, Hh);
    g.strokeStyle = 'rgba(227,183,101,0.9)';
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const cx = W / 2;
    g.beginPath();
    g.arc(cx, 250, 44, 0, Math.PI * 2);
    g.stroke();
    // body outline
    g.beginPath();
    g.moveTo(cx - 26, 300);
    g.lineTo(cx - 92, 330);
    g.lineTo(cx - 124, 520);
    g.moveTo(cx + 26, 300);
    g.lineTo(cx + 92, 330);
    g.lineTo(cx + 124, 520);
    g.stroke();
    // garment with flare
    g.fillStyle = 'rgba(227,183,101,0.22)';
    g.beginPath();
    g.moveTo(cx - 88, 330);
    g.quadraticCurveTo(cx - 70, 470, cx - 64, 500);
    g.quadraticCurveTo(cx - 150, 700, cx - 170, 760);
    g.quadraticCurveTo(cx, 790, cx + 170, 760);
    g.quadraticCurveTo(cx + 150, 700, cx + 64, 500);
    g.quadraticCurveTo(cx + 70, 470, cx + 88, 330);
    g.quadraticCurveTo(cx, 360, cx - 88, 330);
    g.fill();
    g.stroke();
    // tracking dots
    g.fillStyle = '#e3b765';
    for (const [x, y] of [
      [cx - 92, 330],
      [cx + 92, 330],
      [cx - 124, 520],
      [cx + 124, 520],
      [cx - 64, 500],
      [cx + 64, 500],
      [cx, 250],
    ]) {
      g.beginPath();
      g.arc(x, y, 9, 0, Math.PI * 2);
      g.fill();
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#f4efe4';
    g.font = '600 40px "Unbounded", "Avenir Next", sans-serif';
    g.fillText('TRY ON', cx, 86);
    g.font = '500 17px "Martian Mono", ui-monospace, monospace';
    g.fillStyle = '#e3b765';
    g.fillText('LIVE FABRIC SIMULATION', cx, 134);
    g.fillStyle = '#f4efe4';
    g.font = '600 30px "Hanken Grotesk", system-ui, sans-serif';
    g.fillText('Tap to start your camera', cx, 860);
    g.font = '500 20px "Hanken Grotesk", system-ui, sans-serif';
    g.fillStyle = '#b9c2e6';
    g.fillText('Video stays on your device', cx, 910);
    return ctex(c, { repeat: false });
  }
  // Jaali lattice for the Chikankari feature wall
  function texJaali() {
    const S = 256,
      c = mk(S, S),
      g = c.getContext('2d');
    g.fillStyle = '#efe7d8';
    g.fillRect(0, 0, S, S);
    g.strokeStyle = '#d9cdb6';
    g.lineWidth = 7;
    for (let i = -1; i <= 2; i++) {
      for (let j = -1; j <= 2; j++) {
        const x = i * (S / 2) + S / 4,
          y = j * (S / 2) + S / 4;
        g.beginPath();
        g.ellipse(x, y, S / 4.4, S / 4.4, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
    g.strokeStyle = '#e6dcc8';
    g.lineWidth = 3;
    for (let i = 0; i <= 2; i++)
      for (let j = 0; j <= 2; j++) {
        g.beginPath();
        g.arc(i * (S / 2), j * (S / 2), S / 9, 0, Math.PI * 2);
        g.stroke();
      }
    return ctex(c);
  }
  const tex = {
    terrazzo: texTerrazzo(),
    walnut: texWood('#6b4428', '#2f1a0c', '#97653d', 3),
    oak: texWood('#c9a57a', '#80603a', '#e2c39a', 5),
    flute: texFlute(),
    sRect: texSoftRect(),
    sRound: texSoftRound(),
    sEdge: texEdge(),
    dir: texDirectory(),
    tryon: texTryon(),
    jaali: texJaali(),
  };
  tex.jaali.repeat.set(1, 1);

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
    wall: std({ color: '#efe9df', roughness: 0.95, emissive: '#efe9df', emissiveIntensity: 0.16 }),
    ceil: std({ color: '#f3efe8', roughness: 1, emissive: '#efe9e0', emissiveIntensity: 0.62 }),
    walnut: std({ map: tex.walnut, roughness: 0.48 }),
    oak: std({ map: tex.oak, roughness: 0.6 }),
    indigo: std({ color: '#2b3560', roughness: 0.7, normalMap: tex.flute, normalScale: new V2(1, 1) }),
    indigoFlat: std({ color: '#2b3560', roughness: 0.8 }),
    terracotta: std({ color: '#b5583a', roughness: 0.85 }),
    jaali: std({ map: tex.jaali, roughness: 0.9 }),
    stone: std({ color: '#ece7de', roughness: 0.24 }),
    white: std({ color: '#f5f2ec', roughness: 0.5 }),
    black: std({ color: '#1f1d1b', roughness: 0.42, metalness: 0.35 }),
    brass: std({ color: '#c49b58', roughness: 0.3, metalness: 1 }),
    glow: basic({ color: '#fff3df', toneMapped: false }),
    panel: basic({ color: '#f4ebdc' }),
    fabric: std({ color: '#b5583a', roughness: 0.95 }),
    cushion: std({ color: '#2b3560', roughness: 0.95 }),
    rug: std({ color: '#8c4a35', roughness: 1 }),
    pot: std({ color: '#cfc4b5', roughness: 0.85 }),
    leaf: std({ color: '#3f6e48', roughness: 0.75 }),
    kidsY: std({ color: '#f4dc98', roughness: 0.7 }),
    kidsC: std({ color: '#e47a5c', roughness: 0.7 }),
    kidsB: std({ color: '#62aee0', roughness: 0.6 }),
    screen: basic({ color: '#0f1a17' }),
    mirror: std({ color: '#e4e9e8', metalness: 1, roughness: 0.04 }),
    mannequin: std({ color: '#ece6dd', roughness: 0.55 }),
    mannequinDark: std({ color: '#3a3532', roughness: 0.45 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.13,
      roughness: 0.03,
      metalness: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    outside: basic({ color: '#dcd7cd' }),
    pavement: std({ color: '#cfccc4', roughness: 0.92 }),
    shRect: shadowMat(tex.sRect, 0.42),
    shRound: shadowMat(tex.sRound, 0.4),
    shEdge: shadowMat(tex.sEdge, 0.2),
  };
  const BATCH = {
    glass: { solid: false, cast: false, receive: false },
    glow: { cast: false, receive: false },
    panel: { cast: false },
    ceil: { cast: false, receive: false },
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
    box('indigoFlat', w, hh, 0.04, x, y, z);
    box('brass', w + 0.02, 0.012, 0.05, x, y + hh / 2 + 0.006, z);
    for (const dx of [-w * 0.38, w * 0.38])
      cyl('black', 0.005, 0.005, H - (y + hh / 2), x + dx, (H + y + hh / 2) / 2, z, 6);
    const o = { w: w * 0.92, h: hh * 0.86, color: '#efe2c4', sub, subColor: '#e3b765' };
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
  sign('TAANA STUDIO', { w: 3.4, h: 0.3, color: '#efe6d2', track: 0.22 }, 0, H - 0.2, L.z1 - 0.055, Math.PI);

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
  // signature ring light over the Festive Edit podium
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
  }

  /* ------------------------------------------------------------------
     Garment batching: baked cloth merged by material, folded stacks, trims
     ------------------------------------------------------------------ */
  const drapes = await drapesP;
  const records = [];
  const productMeshes = [];
  const clothBatches = new Map();
  const trimItems = [];
  const STORE_TEX = 256;
  function clothAcc(spec) {
    const mats = materialsFor(spec, STORE_TEX);
    let a = clothBatches.get(mats.outer.uuid);
    if (!a) {
      a = {
        mats,
        strip: spec.template === 'dupatta',
        pos: [],
        nrm: [],
        uv: [],
        edge: [],
        idx: [],
        ranges: [],
        tris: 0,
        verts: 0,
      };
      clothBatches.set(mats.outer.uuid, a);
    }
    return a;
  }
  const nMat = new THREE.Matrix3();
  const tv = new V3();
  /** Add a settled garment (positions in its own frame) to the store, transformed by `mx`. */
  function addCloth(g, pos, spec, mx, rec) {
    const a = clothAcc(spec);
    const r = g.render,
      nv = r.map.length;
    const P = copyPositions(g, pos, new Float32Array(nv * 3));
    const N = computeNormals(g, pos, new Float32Array(nv * 3));
    nMat.getNormalMatrix(mx);
    for (let i = 0; i < nv; i++) {
      tv.fromArray(P, i * 3).applyMatrix4(mx);
      a.pos.push(tv.x, tv.y, tv.z);
      tv.fromArray(N, i * 3)
        .applyMatrix3(nMat)
        .normalize();
      a.nrm.push(tv.x, tv.y, tv.z);
      a.uv.push(r.uv[i * 2], r.uv[i * 2 + 1]);
      a.edge.push(r.edge[i]);
    }
    for (let i = 0; i < r.index.length; i++) a.idx.push(a.verts + r.index[i]);
    if (rec) a.ranges.push({ start: a.tris, end: a.tris + r.index.length / 3, rec });
    a.tris += r.index.length / 3;
    a.verts += nv;
    if (g.trims.length) {
      const A = new V3(),
        Bv = new V3(),
        Nn = new V3(),
        X = new V3(),
        Y = new V3(),
        Z = new V3();
      for (const t of g.trims) {
        A.fromArray(pos, t.a * 3).applyMatrix4(mx);
        Bv.fromArray(pos, t.b * 3).applyMatrix4(mx);
        Nn.fromArray(pos, t.n * 3).applyMatrix4(mx);
        X.subVectors(A, Bv).normalize();
        Y.subVectors(A, Nn).normalize();
        Z.crossVectors(X, Y).normalize();
        Y.crossVectors(Z, X);
        A.lerp(Bv, 0.5).addScaledVector(Z, 0.0035);
        trimItems.push({ m: new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(A), color: spec.trim || '#d9cbb0' });
      }
    }
  }
  /** A folded piece (box) in a product's fabric. */
  function addFold(spec, w, hgt, d, mx, rec) {
    const a = clothAcc(spec);
    const geo = new THREE.BoxGeometry(w, hgt, d, 1, 1, 1);
    boxUV(geo, w, hgt, d, 0.25);
    geo.applyMatrix4(mx);
    const ng = geo.toNonIndexed();
    const p = ng.attributes.position,
      n = ng.attributes.normal,
      uv = ng.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      a.pos.push(p.getX(i), p.getY(i), p.getZ(i));
      a.nrm.push(n.getX(i), n.getY(i), n.getZ(i));
      a.uv.push(uv.getX(i), uv.getY(i));
      a.edge.push(1);
      a.idx.push(a.verts + i);
    }
    if (rec) a.ranges.push({ start: a.tris, end: a.tris + p.count / 3, rec });
    a.tris += p.count / 3;
    a.verts += p.count;
  }
  function flushCloth() {
    for (const a of clothBatches.values()) {
      if (!a.verts) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(a.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(a.nrm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(a.uv, 2));
      geo.setAttribute('edge', new THREE.Float32BufferAttribute(a.edge, 1));
      geo.setAttribute('wrinkle', new THREE.Float32BufferAttribute(new Float32Array(a.verts), 1));
      geo.setIndex(
        a.verts > 65535 ? new THREE.Uint32BufferAttribute(a.idx, 1) : new THREE.Uint16BufferAttribute(a.idx, 1),
      );
      geo.computeBoundingSphere();
      const outer = new THREE.Mesh(geo, a.mats.outer);
      outer.castShadow = true;
      outer.receiveShadow = true;
      outer.matrixAutoUpdate = false;
      outer.userData.ranges = a.ranges;
      scene.add(outer);
      productMeshes.push(outer);
      if (!a.strip) {
        const inner = new THREE.Mesh(geo, a.mats.inner);
        inner.matrixAutoUpdate = false;
        inner.receiveShadow = true;
        scene.add(inner);
      }
      a.pos = a.nrm = a.uv = a.edge = a.idx = null;
    }
    if (trimItems.length) {
      const geo = new THREE.CylinderGeometry(0.0065, 0.0065, 0.003, 12);
      geo.rotateX(Math.PI / 2);
      const im = new THREE.InstancedMesh(
        geo,
        std({ color: 0xffffff, roughness: 0.35, metalness: 0.2 }),
        trimItems.length,
      );
      const col = new THREE.Color();
      trimItems.forEach((t, i) => {
        im.setMatrixAt(i, t.m);
        im.setColorAt(i, col.set(t.color));
      });
      im.computeBoundingSphere();
      scene.add(im);
    }
  }
  const rangeRec = (mesh, face) => {
    const rs = mesh.userData.ranges;
    if (!rs) return null;
    let lo = 0,
      hi = rs.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1,
        r = rs[mid];
      if (face < r.start) hi = mid - 1;
      else if (face >= r.end) lo = mid + 1;
      else return r.rec;
    }
    return null;
  };
  function makeRec(pid, ci, center, ry, zone, kind, dist) {
    const rec = { pid, ci, center, ry, zone, kind, dist: dist || 1.25 };
    records.push(rec);
    return rec;
  }

  /* ---------- Hanger drapes (baked, or settled here if the bake is missing) ---------- */
  const hangerCache = new Map();
  function hangerDrape(p) {
    let d = hangerCache.get(p.id);
    if (d) return d;
    const { g } = displayGarment(NY, p, 0, RES.hanger);
    let pos = drapes && drapes.get('hanger:' + p.id);
    if (!pos || pos.length !== g.rest.length) pos = settleOnHanger(g, p.fabric, bodyFor(p.kind), 0.9);
    d = { g, pos };
    hangerCache.set(p.id, d);
    return d;
  }
  const lookSpec = (p, ci) => NY.specFor(p, NY.recommendSize(p, chestGirth(bodyFor(p.kind))), ci);
  // wooden hanger: two sloped arms and a hook, in the garment's frame (shoulder centre at the origin)
  function hanger(sw) {
    const s = sw / 2 + 0.03;
    for (const sd of [1, -1]) box('walnut', s, 0.014, 0.012, (sd * s) / 2, 0.025 - 0.02, 0, { rz: -sd * 0.26 });
    cyl('brass', 0.003, 0.003, 0.09, 0, 0.075, 0, 6);
    const hook = new THREE.TorusGeometry(0.018, 0.003, 6, 14, Math.PI * 1.2);
    hook.rotateZ(-0.2);
    hook.translate(-0.012, 0.13, 0);
    addG('brass', hook);
  }
  /** Garment on a hanger. Local frame: shoulder line at (0, y, 0), facing +z (or turned for a side-hung rail). */
  function hangGarment(pid, ci, x, y, z, ry, zone, dist, faceRy) {
    const p = NY.byId[pid];
    if (!p) return null;
    const d = hangerDrape(p);
    pushF(x, z, ry, y);
    hanger(bodyFor(p.kind).shoulderW);
    // garments squeezed together on a rail: compress their depth so flares don't pass through each other
    const mx = faceRy != null ? F.clone().multiply(new THREE.Matrix4().makeScale(1, 1, 0.42)) : F.clone();
    popF();
    const c = new V3(0, -0.3, 0.06).applyMatrix4(mx);
    const rec = makeRec(pid, ci, c, 0, zone, 'garment', dist);
    const fwd = new V3(0, 0, 1).transformDirection(mx);
    rec.ry = faceRy != null ? faceRy : Math.atan2(fwd.x, fwd.z);
    addCloth(d.g, d.pos, lookSpec(p, ci), mx, rec);
    return rec;
  }
  /** A stack of folded pieces. */
  function foldedStack(pid, ci, x, y, z, ry, zone, n, size) {
    const p = NY.byId[pid];
    if (!p) return null;
    const spec = lookSpec(p, ci);
    const w = size ? size[0] : 0.3,
      t = size ? size[1] : 0.04,
      d = size ? size[2] : 0.24;
    pushF(x, z, ry, y);
    const base = F.clone();
    popF();
    const c = new V3(0, (n * t) / 2, 0).applyMatrix4(base);
    const rec = makeRec(
      pid,
      ci,
      c,
      Math.atan2(new V3(0, 0, 1).transformDirection(base).x, new V3(0, 0, 1).transformDirection(base).z),
      zone,
      'stack',
      1.05,
    );
    const R = rng(pid.charCodeAt(1) * 7 + ci * 13 + Math.round(x * 10));
    for (let i = 0; i < (n || 3); i++) {
      const m = base
        .clone()
        .multiply(
          new THREE.Matrix4()
            .makeRotationY((R() - 0.5) * 0.06)
            .setPosition((R() - 0.5) * 0.012, t * (i + 0.5), (R() - 0.5) * 0.012),
        );
      addFold(spec, w - 0.004, t * 0.92, d, m, rec);
    }
    return rec;
  }

  /* ---------- Static mannequin looks (baked drapes) ---------- */
  const manMatStatic = M.mannequin;
  const staticLookByKey = Object.fromEntries(staticLooks(NY).map((lk) => [lk.key, lk]));
  function staticLook(key, x, z, ry, zone, lift, dark) {
    const look = staticLookByKey[key];
    if (!look) return null;
    const m = bodyFor(look.kind);
    const pieces = lookGarments(NY, look, RES.look);
    let pos = drapes && drapes.get('look:' + key);
    const J = animatedPose(m, 0, { mode: 'still' });
    if (!pos || pos.length !== pieces.length || pos.some((q, i) => q.length !== pieces[i].g.rest.length)) {
      // fallback: rest shapes moved onto the pose (no settling)
      pos = pieces.map((pc) => {
        const o = new Float32Array(pc.g.rest.length);
        return (o.set(pc.g.rest), o);
      });
    }
    const mx = new THREE.Matrix4().makeRotationY(ry || 0).setPosition(x, lift || 0, z);
    const head = new V3(0, J.nose[1] - 0.3, 0).applyMatrix4(mx);
    const main = pieces[0].p;
    const rec = makeRec(main.id, pieces[0].ci, head, ry || 0, zone, 'look', 1.6);
    rec.look = look.pieces;
    pieces.forEach((pc, i) => addCloth(pc.g, pos[i], pc.spec, mx, rec));
    const man = new Mannequin(m, { stand: false, material: manMatStatic });
    const geo = man.bake(J, mx);
    addG(dark ? 'mannequinDark' : 'mannequin', geo);
    hitMesh(geo, rec);
    const foot = new V3(0, 0, 0).applyMatrix4(mx);
    cyl('black', 0.2, 0.22, 0.03, foot.x, (lift || 0) + 0.015, foot.z, 32);
    shadowRound(foot.x, foot.z, 0.9);
    return rec;
  }
  // invisible pick proxies for mannequins (picking uses the merged batch otherwise)
  const pickProxies = [];
  function hitMesh(geo, rec) {
    const mesh = new THREE.Mesh(geo, hitMat);
    mesh.userData.rec = rec;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrixWorld(true);
    pickProxies.push(mesh);
  }

  /* ------------------------------------------------------------------
     Fixtures
     ------------------------------------------------------------------ */
  // Wall bay: back panel, plinth, face-out arm, side-hung rail and a top shelf with folded stacks.
  function wallBay(cx, cz, ry, Wd, merch, zone, o) {
    o = o || {};
    pushF(cx, cz, ry);
    const top = o.top || 2.5,
      railY = o.railY || 1.86,
      depth = 0.6;
    box('walnut', 0.04, top, 0.5, -Wd / 2 + 0.02, top / 2, 0.25);
    box('walnut', 0.04, top, 0.5, Wd / 2 - 0.02, top / 2, 0.25);
    box(o.panel || 'panel', Wd - 0.1, top - 0.14, 0.02, 0, (top + 0.14) / 2, 0.02, { uv: false });
    box('walnut', Wd, 0.12, 0.5, 0, 0.06, 0.25);
    box('black', Wd - 0.04, 0.05, 0.01, 0, 0.025, 0.505);
    box('walnut', Wd, 0.16, 0.54, 0, top + 0.08, 0.27);
    box('glow', Wd - 0.14, 0.006, 0.012, 0, top - 0.012, depth - 0.03);
    // top shelf with folded stacks
    if (merch.shelf) {
      const sy = railY + 0.38;
      box('walnut', Wd - 0.1, 0.03, 0.38, 0, sy, 0.2);
      box('brass', Wd - 0.1, 0.032, 0.006, 0, sy, 0.392);
      merch.shelf.forEach((pid, i) => {
        const n = merch.shelf.length;
        const lx = -Wd / 2 + 0.2 + ((i + 0.5) * (Wd - 0.4)) / n;
        foldedStack(pid, i % 2, lx, sy + 0.015, 0.2, 0, zone, 3);
      });
    }
    // face-out arm on the left of the bay
    const fx = -Wd / 2 + (o.faceX || 0.42);
    const faces = merch.face ? (Array.isArray(merch.face[0]) ? merch.face : [merch.face]) : [];
    faces.forEach((fc, i) => {
      const x = i === 0 ? fx : Wd / 2 - (o.faceX || 0.42);
      box('brass', 0.012, 0.012, 0.34, x, railY + 0.12, 0.17);
      hangGarment(fc[0], fc[1], x, railY, 0.36, 0, zone, 1.3);
    });
    // side-hung rail on the remaining width
    const out = new V3(0, 0, 1).transformDirection(F);
    const bayRy = Math.atan2(out.x, out.z);
    if (merch.rail && merch.rail.length) {
      const r0 = faces.length > 1 ? -Wd / 2 + 0.75 : fx + 0.36,
        r1 = faces.length > 1 ? Wd / 2 - 0.75 : Wd / 2 - 0.1;
      const g = new THREE.CylinderGeometry(0.011, 0.011, r1 - r0, 10);
      g.rotateZ(Math.PI / 2);
      g.translate((r0 + r1) / 2, railY + 0.02, 0.31);
      addG('brass', g);
      for (const xb of [r0, r1]) box('brass', 0.012, 0.012, 0.31, xb, railY + 0.02, 0.155);
      const n = merch.rail.length,
        step = Math.min(0.15, (r1 - r0 - 0.08) / Math.max(1, n - 1));
      merch.rail.forEach((rc, i) => {
        const x = r0 + 0.06 + i * step;
        hangGarment(rc[0], rc[1], x, railY - 0.02, 0.31, -Math.PI / 2 + (rng(i + 3)() - 0.5) * 0.12, zone, 1.15, bayRy);
      });
    }
    shadowRect(0, depth / 2 + 0.05, Wd + 0.1, depth + 0.35);
    popF();
  }
  L.ethnic.centers.forEach((cz, i) => wallBay(L.x0, cz, Math.PI / 2, L.ethnic.width, NY.MERCH.ethnic[i], 'ethnic'));
  L.mens.centers.forEach((cz, i) => wallBay(L.x1, cz, -Math.PI / 2, L.mens.width, NY.MERCH.mens[i], 'mens'));
  wallBay(L.x0, L.kids.center, Math.PI / 2, L.kids.width, NY.MERCH.kids, 'kids', {
    railY: 1.32,
    top: 1.95,
    panel: 'kidsY',
  });
  wallBay(L.western.center, L.z0, 0, L.western.width, NY.MERCH.western, 'western', { faceX: 0.38 });

  // Two-tier island with folded stacks (Denim & Basics) and a mannequin at the end
  function tieredTable(I, items, zone, sign, sub) {
    pushF(I.x, I.z, 0);
    const w = I.w,
      d = I.d,
      hh = 0.82;
    box('black', w - 0.2, 0.08, d - 0.2, 0, 0.04, 0);
    box('oak', w - 0.08, hh - 0.08, d - 0.08, 0, 0.08 + (hh - 0.08) / 2, 0);
    box('walnut', w, 0.05, d, 0, hh + 0.025, 0);
    box('walnut', w - 0.4, 0.2, 0.42, 0, hh + 0.15, 0);
    box('brass', w + 0.004, 0.012, d + 0.004, 0, hh + 0.002, 0);
    shadowRect(0, 0, w + 0.35, d + 0.35);
    popF();
    const per = Math.ceil(items.length / 4);
    let k = 0;
    for (const side of [1, -1])
      for (const tier of [0, 1]) {
        for (let s = 0; s < per && k < items.length; s++, k++) {
          const span = tier ? w - 0.5 : w - 0.2;
          const lx = -span / 2 + ((s + 0.5) * span) / per;
          const y = tier ? hh + 0.25 : hh + 0.05;
          const zz = tier ? side * 0.1 : side * 0.34;
          foldedStack(items[k][0], items[k][1], I.x + lx, y, I.z + zz, side > 0 ? 0 : Math.PI, zone, tier ? 3 : 4);
        }
      }
    if (sign) hangingSign(sign, sub, I.x, 2.52, I.z, 2.3);
  }
  tieredTable(L.basics, NY.MERCH.basics, 'basics', 'DENIM & BASICS', 'TEES · SHIRTS · DENIM');
  staticLook('basicsForm', L.basics.x - L.basics.w / 2 - 0.45, L.basics.z, 0.5, 'basics');

  // Dupatta bar: low table of folded dupattas, stools, a draped form
  function stool(x, z) {
    cyl('black', 0.02, 0.02, 0.66, x, 0.34, z, 8);
    cyl('black', 0.17, 0.19, 0.02, x, 0.01, z, 24);
    cyl('brass', 0.15, 0.15, 0.012, x, 0.26, z, 24);
    cyl('cushion', 0.19, 0.19, 0.07, x, 0.7, z, 24);
    shadowRound(x, z, 0.55);
  }
  function dupattaBar() {
    const I = L.dupatta;
    pushF(I.x, I.z, 0);
    const w = I.w,
      d = I.d,
      hh = 0.92;
    box('black', w - 0.2, 0.08, d - 0.2, 0, 0.04, 0);
    box('indigo', w - 0.06, hh - 0.08, d - 0.06, 0, 0.08 + (hh - 0.08) / 2, 0);
    box('stone', w + 0.04, 0.05, d + 0.04, 0, hh + 0.025, 0);
    shadowRect(0, 0, w + 0.35, d + 0.35);
    popF();
    const items = NY.MERCH.dupattaTable;
    items.forEach((it, i) => {
      const row = i < 6 ? 0 : 1;
      const n = row ? items.length - 6 : 6;
      const s = row ? i - 6 : i;
      const lx = -w / 2 + 0.2 + ((s + 0.5) * (w - 0.4)) / n;
      foldedStack(
        it[0],
        it[1],
        I.x + lx,
        hh + 0.05,
        I.z + (row ? -0.2 : 0.2),
        row ? Math.PI : 0,
        'dupatta',
        3,
        [0.34, 0.025, 0.22],
      );
    });
    for (const s of L.stools) stool(s[0], s[1]);
    hangingSign('DUPATTA BAR', 'SILK · CHIFFON · COTTON', I.x, 2.52, I.z, 2.1);
    staticLook('dupattaForm', I.x + I.w / 2 + 0.45, I.z, -0.5, 'dupatta');
  }
  dupattaBar();

  // Chikankari studio: jaali feature wall, niche shelf of folded pieces, four mannequins on plinths
  function chikanStudio() {
    const P = L.chikan;
    pushF(P.x, L.z0, 0);
    const wallG = new THREE.BoxGeometry(P.w, H, 0.06);
    {
      const uv = wallG.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * P.w) / 0.62, (uv.getY(i) * H) / 0.62);
    }
    wallG.translate(0, H / 2, 0.03);
    addG('jaali', wallG);
    box('brass', 0.03, H, 0.07, -P.w / 2, H / 2, 0.04);
    box('brass', 0.03, H, 0.07, P.w / 2, H / 2, 0.04);
    const nw = 3.2,
      nh = 0.5,
      nd = 0.3,
      ny = 1.05;
    box('walnut', nw, 0.04, nd, 0, ny, nd / 2 + 0.06);
    box('walnut', nw, 0.04, nd, 0, ny + nh, nd / 2 + 0.06);
    box('walnut', 0.04, nh, nd, -nw / 2, ny + nh / 2, nd / 2 + 0.06);
    box('walnut', 0.04, nh, nd, nw / 2, ny + nh / 2, nd / 2 + 0.06);
    box('panel', nw - 0.06, nh - 0.06, 0.01, 0, ny + nh / 2, 0.07, { uv: false });
    box('glow', nw - 0.1, 0.006, 0.01, 0, ny + nh - 0.03, nd + 0.03);
    shadowRect(0, 0.2, P.w, 0.5);
    popF();
    NY.MERCH.chikanShelf.forEach((it, s) => {
      const lx = -nw / 2 + 0.22 + ((s + 0.5) * (nw - 0.44)) / NY.MERCH.chikanShelf.length;
      foldedStack(it[0], it[1], P.x + lx, ny + 0.02, L.z0 + 0.22, 0, 'chikan', 2, [0.36, 0.035, 0.24]);
    });
    sign(
      'CHIKANKARI',
      { w: 3.2, h: 0.56, color: '#2b3560', sub: 'HAND EMBROIDERED IN LUCKNOW', subColor: '#8c6a3a', track: 0.26 },
      P.x,
      2.5,
      L.z0 + 0.07,
      0,
    );
    P.forms.forEach((fx, i) => {
      cyl('stone', 0.36, 0.38, 0.12, fx, 0.06, P.formZ, 36);
      cyl('brass', 0.365, 0.365, 0.01, fx, 0.12, P.formZ, 36);
      staticLook('chikan' + i, fx, P.formZ, 0, 'chikan', 0.12, true);
    });
  }
  chikanStudio();

  // Western: table of folded tees and a mannequin
  {
    const T = L.westernTable;
    box('oak', T.w, 0.8, T.d, T.x, 0.4, T.z);
    box('walnut', T.w + 0.04, 0.04, T.d + 0.04, T.x, 0.82, T.z);
    shadowRect(T.x, T.z, T.w + 0.3, T.d + 0.3);
    NY.MERCH.westernTable.forEach((it, i) =>
      foldedStack(it[0], it[1], T.x + (i - 1.5) * 0.33, 0.84, T.z, 0, 'western', 3, [0.28, 0.035, 0.22]),
    );
    cyl('stone', 0.32, 0.34, 0.1, L.westernForm[0], 0.05, L.westernForm[1], 32);
    staticLook('westernForm', L.westernForm[0], L.westernForm[1], 0.5, 'western', 0.1);
  }

  // Fitting rooms: enclosure, three curtained cubicles, the try-on mirror and a live mannequin
  const curtainG = buildCurtain(CURTAIN.w, CURTAIN.h, RES.curtain);
  const curtainPos = (drapes && drapes.get('curtain')) || curtainG.rest;
  function fittingRooms() {
    const f = L.fit;
    box('wall', f.door[0] - f.x0, H, 0.12, (f.x0 + f.door[0]) / 2, H / 2, f.z1);
    box('wall', L.x1 - f.door[1], H, 0.12, (f.door[1] + L.x1) / 2, H / 2, f.z1);
    box('wall', f.door[1] - f.door[0], H - 2.3, 0.12, (f.door[0] + f.door[1]) / 2, 2.3 + (H - 2.3) / 2, f.z1);
    box('wall', 0.12, H, f.z1 - L.z0, f.x0, H / 2, (f.z1 + L.z0) / 2);
    box('walnut', 0.05, 2.3, 0.16, f.door[0], 1.15, f.z1);
    box('walnut', 0.05, 2.3, 0.16, f.door[1], 1.15, f.z1);
    box('walnut', f.door[1] - f.door[0] + 0.05, 0.05, 0.16, (f.door[0] + f.door[1]) / 2, 2.3, f.z1);
    const fg = new THREE.PlaneGeometry(L.x1 - f.x0 - 0.06, f.z1 - L.z0 - 0.06);
    {
      const uv = fg.attributes.uv;
      for (let i = 0; i < uv.count; i++)
        uv.setXY(i, (uv.getX(i) * (L.x1 - f.x0)) / 1.2, (uv.getY(i) * (f.z1 - L.z0)) / 1.2);
    }
    fg.rotateX(-Math.PI / 2);
    fg.translate((f.x0 + L.x1) / 2 + 0.03, 0.002, (f.z1 + L.z0) / 2 - 0.03);
    addG('oak', fg);
    plane('shEdge', f.z1 - L.z0, 0.3, f.x0 + 0.21, 0.005, (f.z1 + L.z0) / 2, -Math.PI / 2, -Math.PI / 2);
    // cubicles
    const cz1 = L.z0 + f.cubD,
      x0 = f.cubicles[0] - f.cubW / 2,
      x1 = f.cubicles[f.cubicles.length - 1] + f.cubW / 2;
    for (let i = 0; i <= f.cubicles.length; i++) {
      const x = x0 + i * f.cubW;
      box('walnut', 0.05, 2.3, f.cubD, x, 1.15, L.z0 + f.cubD / 2);
    }
    const rail = new THREE.CylinderGeometry(0.012, 0.012, x1 - x0, 10);
    rail.rotateZ(Math.PI / 2);
    rail.translate((x0 + x1) / 2, 2.3, cz1);
    addG('brass', rail);
    const cspec = { template: 'dupatta', fabric: 'linen', pattern: 'stripe', base: '#2b3560', accent: '#36427a' };
    f.cubicles.forEach((cx, i) => {
      box('mirror', 0.5, 1.5, 0.01, cx, 1.2, L.z0 + 0.012);
      box('brass', 0.54, 1.54, 0.008, cx, 1.2, L.z0 + 0.006);
      cyl('cushion', 0.17, 0.17, 0.42, cx + 0.38, 0.21, L.z0 + 0.45, 20);
      const open = i === 1;
      const mx = new THREE.Matrix4().makeTranslation(cx + (open ? f.cubW * 0.36 : 0), 2.28, cz1);
      if (open) mx.multiply(new THREE.Matrix4().makeScale(0.32, 1, 1.4));
      addCloth(curtainG, curtainPos, cspec, mx, null);
    });
    // try-on mirror on the right wall
    const [mx_, mz] = f.mirror;
    box('walnut', 0.1, 2.0, 1.04, mx_, 1.1, mz);
    box('brass', 0.02, 2.04, 1.08, mx_ - 0.05, 1.1, mz);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.76), basic({ map: tex.tryon, toneMapped: false }));
    scr.position.set(mx_ - 0.062, 1.12, mz);
    scr.rotation.y = -Math.PI / 2;
    scene.add(scr);
    hitbox('tryon', mx_ - 0.1, 1.1, mz, 0.3, 2.0, 1.1);
    shadowRect(mx_ - 0.2, mz, 0.6, 1.3);
    // ottoman
    cyl('cushion', 0.38, 0.38, 0.4, f.ottoman[0], 0.2, f.ottoman[1], 32);
    cyl('brass', 0.385, 0.385, 0.012, f.ottoman[0], 0.4, f.ottoman[1], 32);
    shadowRound(f.ottoman[0], f.ottoman[1], 1.1);
    // plinth for the live mannequin
    cyl('stone', 0.34, 0.36, 0.1, f.mannequin[0], 0.05, f.mannequin[1], 32);
    sign(
      'FITTING ROOMS',
      { w: 1.9, h: 0.4, color: '#2b3560', sub: 'TRY-ON MIRROR INSIDE', subColor: '#8c6a3a' },
      (f.door[0] + f.door[1]) / 2,
      2.8,
      f.z1 + 0.065,
      0,
    );
  }
  fittingRooms();

  // Tailoring and checkout: counter, round mirror, stool
  function checkout() {
    const c = L.counter;
    pushF(c.x, c.z, 0);
    box('walnut', c.w, 0.95, c.d, 0, 0.475, 0);
    box('indigo', c.w - 0.04, 0.84, 0.02, 0, 0.5, -c.d / 2 - 0.01);
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
    hitbox('tailor', L.mirror.x - 0.2, 1.3, L.mirror.z, 0.5, 1.4, 1.1);
    const s = makeSign('TAILORING & CHECKOUT', { w: 2.2, h: 0.34, color: '#efe2c4' });
    box('indigoFlat', 2.3, 0.4, 0.04, c.x, 2.55, c.z);
    for (const dx of [-0.85, 0.85]) cyl('black', 0.005, 0.005, H - 2.75, c.x + dx, (H + 2.75) / 2, c.z, 6);
    s.position.set(c.x, 2.55, c.z - 0.022);
    s.rotation.y = Math.PI;
    scene.add(s);
  }
  checkout();

  // Welcome: stylist desk, directory totem
  function welcome() {
    const d = L.desk;
    pushF(d.x, d.z, 0);
    box('walnut', d.w, 1.0, d.d, 0, 0.5, 0);
    box('indigo', d.w - 0.04, 0.9, 0.02, 0, 0.5, -d.d / 2 - 0.01);
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

  // Kids corner: round table of folded tees, bean bags, sign
  function kidsCorner() {
    const T = L.kidsTable;
    cyl('kidsB', T.r, T.r, 0.04, T.x, 0.52, T.z, 48);
    cyl('white', 0.12, 0.2, 0.5, T.x, 0.25, T.z, 20);
    shadowRound(T.x, T.z, T.r * 2.6);
    const items = [
      ['c03', 0],
      ['c03', 1],
      ['c01', 0],
      ['c01', 1],
      ['c02', 0],
    ];
    items.forEach((it, i) => {
      const a = (i / items.length) * Math.PI * 2 + 0.3;
      foldedStack(
        it[0],
        it[1],
        T.x + Math.sin(a) * 0.42,
        0.54,
        T.z + Math.cos(a) * 0.42,
        a,
        'kids',
        3,
        [0.22, 0.03, 0.18],
      );
    });
    L.beanbags.forEach((b, i) => {
      sph(i ? 'kidsC' : 'kidsY', 0.42, b[0], 0.2, b[1], 1, 0.55, 1, 20);
      shadowRound(b[0], b[1], 1.0);
    });
    sign(
      'KIDS',
      { w: 1.3, h: 0.42, color: '#c4532f', sub: 'AGES 4 TO 13', subColor: '#7a5a40' },
      L.x0 + 0.03,
      2.25,
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
    'WOMEN · ETHNIC',
    { w: 3.0, h: 0.52, color: '#2b3560', sub: 'KURTAS · ANARKALIS · LONG KURTAS', subColor: '#8c6a3a', track: 0.2 },
    L.x0 + 0.03,
    2.98,
    0,
    Math.PI / 2,
  );
  sign(
    'MEN',
    { w: 2.4, h: 0.52, color: '#2b3560', sub: 'SHIRTS · KURTAS · JACKETS', subColor: '#8c6a3a', track: 0.3 },
    L.x1 - 0.03,
    2.98,
    1.0,
    -Math.PI / 2,
  );
  sign(
    'WESTERN',
    { w: 2.6, h: 0.5, color: '#2b3560', sub: 'DRESSES · SHIRTS · TEES', subColor: '#8c6a3a', track: 0.24 },
    L.western.center,
    2.98,
    L.z0 + 0.03,
    0,
  );

  /* ---------- Festive Edit podium: turntable with three live-simulated looks ---------- */
  const live = [];
  const P0 = L.podium;
  cyl('stone', P0.r, P0.r + 0.03, 0.14, P0.x, 0.07, P0.z, 64);
  cyl('brass', P0.r + 0.035, P0.r + 0.035, 0.012, P0.x, 0.142, P0.z, 64);
  shadowRound(P0.x, P0.z, P0.r * 2.8);
  const turntable = new THREE.Mesh(new THREE.CylinderGeometry(P0.r - 0.06, P0.r - 0.06, 0.04, 64), M.walnut);
  turntable.position.set(P0.x, 0.165, P0.z);
  turntable.receiveShadow = true;
  scene.add(turntable);
  hangingSign('FESTIVE EDIT', 'LIVE FABRIC · TAP A LOOK', P0.x, 2.78, P0.z, 2.1);
  const liveRes = coarse ? 0.55 : 0.75;
  function liveLook(look, place) {
    const m = bodyFor(look.kind);
    const pieces = look.pieces.map(([pid, ci], i) => {
      const p = NY.byId[pid];
      const spec = NY.specFor(p, NY.recommendSize(p, chestGirth(m)), ci);
      if (p.type === 'dupatta' && look.drape) spec.drape = look.drape;
      if (i > 0 && !spec.layer) spec.layer = 1;
      return { spec };
    });
    const outfit = new Outfit({ m, pieces, res: liveRes, substeps: coarse ? 2 : 3, texSize: STORE_TEX });
    const man = new Mannequin(m, { stand: false, material: M.mannequin });
    scene.add(outfit.group, man.group);
    const main = NY.byId[look.pieces[0][0]];
    const rec = makeRec(main.id, look.pieces[0][1], new V3(), 0, place.zone, 'look', 1.7);
    rec.look = look.pieces;
    rec.live = true;
    const L_ = { look, m, outfit, man, rec, place, t: Math.random() * 3, near: false };
    for (const pc of outfit.pieces) {
      pc.mesh.outer.userData.rec = rec;
      pc.mesh.outer.castShadow = false;
    }
    for (const p of man.parts) {
      p.mesh.userData.rec = rec;
      p.mesh.castShadow = false;
    }
    live.push(L_);
    return L_;
  }
  NY.MERCH.festive.forEach((look, i) =>
    liveLook(look, {
      zone: 'festive',
      podium: true,
      angle: (i / NY.MERCH.festive.length) * Math.PI * 2 + 0.25,
      radius: 0.55,
    }),
  );
  liveLook(NY.MERCH.fitting, {
    zone: 'fitting',
    x: L.fit.mannequin[0],
    z: L.fit.mannequin[1],
    yaw: -0.6,
    floorY: 0.1,
    mode: 'showcase',
  });
  let spin = 0;
  function livePose(l, t) {
    const pl = l.place;
    if (pl.podium) {
      const a = pl.angle + spin;
      return animatedPose(l.m, t, {
        mode: 'idle',
        x: P0.x + Math.sin(a) * pl.radius,
        z: P0.z + Math.cos(a) * pl.radius,
        yaw: a,
        floorY: 0.185,
      });
    }
    return animatedPose(l.m, t, {
      mode: pl.mode || 'idle',
      x: pl.x,
      z: pl.z,
      yaw: pl.yaw || 0,
      floorY: pl.floorY || 0,
    });
  }
  const liveTmp = new V3();
  // Simulate only the looks you can see from nearby; others keep their last drape.
  const frustum = new THREE.Frustum(),
    pv = new THREE.Matrix4();
  function updateLive(dt) {
    if (!live.length) return false;
    pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pv);
    let any = false;
    for (const l of live) {
      const J0 = l.J || livePose(l, l.t);
      liveTmp.set(J0.lHip[0], 1.2, J0.lHip[2]);
      const d = Math.hypot(liveTmp.x - nav.x, liveTmp.z - nav.z);
      const vis = d < (coarse ? 7.5 : 10) && frustum.containsPoint(liveTmp);
      if (!vis && l.J) {
        l.skipped = true;
        continue;
      }
      any = true;
      // phones simulate at 30 Hz; the cloth engine takes the larger step in its substeps
      l.acc = (l.acc || 0) + dt;
      if (coarse && l.acc < 1 / 32) continue;
      const step = Math.min(1 / 20, l.acc);
      l.acc = 0;
      l.t += step;
      const J = livePose(l, l.t);
      l.J = J;
      if (l.skipped) {
        // the turntable kept turning while this look was out of view: start its cloth fresh on the new pose
        l.outfit.reset();
        l.skipped = false;
      }
      l.outfit.step(J, step);
      l.outfit.sync();
      l.man.pose(J);
      l.rec.center.set(
        (J.lShoulder[0] + J.rShoulder[0]) / 2,
        J.lShoulder[1] - 0.25,
        (J.lShoulder[2] + J.rShoulder[2]) / 2,
      );
      l.rec.ry = Math.atan2(-(J.lShoulder[2] - J.rShoulder[2]), J.lShoulder[0] - J.rShoulder[0]) || 0;
    }
    return any;
  }
  // settle every live look once so it never shows its rest shape
  for (const l of live) {
    l.J = livePose(l, l.t);
    l.outfit.step(l.J, 1 / 60);
    for (let k = 0; k < 40; k++) l.outfit.step(l.J, 1 / 60);
    l.outfit.sync();
    l.man.pose(l.J);
  }

  flushCloth();
  flush();

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
  // Where the visitor may stand. Three sources: the fixture footprints in NY.OBS (also drawn on the floor plan),
  // everything actually built in the store between ankle and head height (rail ends, face-out arms, garments
  // hanging past a shelf, mannequins, signs, walls), and the keep-out areas in NY.NO_GO (behind counters,
  // forms and tables, the gaps between wall bays). The visitor keeps BODY_R from fixtures and geometry, so
  // walking, or backing up with the keys, never puts the camera inside a fixture, a garment or behind a counter.
  const BODY_R = 0.32;
  const NAV = (() => {
    const t0 = performance.now();
    const cell = 0.1,
      R = BODY_R,
      cols = Math.round(W / cell),
      rows = Math.round(D / cell),
      blocked = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = L.x0 + (c + 0.5) * cell,
          z = L.z0 + (r + 0.5) * cell;
        let b = x < L.x0 + R || x > L.x1 - R || z < L.z0 + R || z > L.z1 - R;
        if (!b)
          for (const o of NY.NO_GO || [])
            if (x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1) {
              b = true;
              break;
            }
        if (!b)
          for (const o of NY.OBS) {
            if (o.t === 'r') {
              if (x > o.x0 - R && x < o.x1 + R && z > o.z0 - R && z < o.z1 + R) {
                b = true;
                break;
              }
            } else if ((x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + R) ** 2) {
              b = true;
              break;
            }
          }
        blocked[r * cols + c] = b ? 1 : 0;
      }
    // real geometry: sample every solid triangle and keep the samples between ankle and head height, on a 5 cm
    // grid. Baked garments are dense (a few centimetres per triangle), so their vertices are enough.
    const fc = 0.05,
      fcols = Math.ceil(W / fc),
      frows = Math.ceil(D / fc),
      occ = new Uint8Array(fcols * frows);
    const yLo = 0.12,
      yHi = EYE + 0.15;
    const mark = (x, y, z) => {
      if (y < yLo || y > yHi) return;
      const fx = Math.floor((x - L.x0) / fc),
        fz = Math.floor((z - L.z0) / fc);
      if (fx >= 0 && fz >= 0 && fx < fcols && fz < frows) occ[fz * fcols + fx] = 1;
    };
    for (const mesh of productMeshes) {
      const a = mesh.geometry.attributes.position.array; // already in store coordinates
      for (let i = 0; i < a.length; i += 3) mark(a[i], a[i + 1], a[i + 2]);
    }
    // Each solid triangle is cut to the ankle-to-head slab, then its outline is traced on the grid and, if it
    // lies flat enough to cover floor area (a table top, a plinth), its inside is filled.
    const clip = (poly, yc, above) => {
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i],
          q = poly[(i + 1) % poly.length];
        const pin = above ? p[1] >= yc : p[1] <= yc,
          qin = above ? q[1] >= yc : q[1] <= yc;
        if (pin) out.push(p);
        if (pin !== qin) {
          const t = (yc - p[1]) / (q[1] - p[1]);
          out.push([p[0] + (q[0] - p[0]) * t, yc, p[2] + (q[2] - p[2]) * t]);
        }
      }
      return out;
    };
    const markXZ = (x, z) => {
      const fx = Math.floor((x - L.x0) / fc),
        fz = Math.floor((z - L.z0) / fc);
      if (fx >= 0 && fz >= 0 && fx < fcols && fz < frows) occ[fz * fcols + fx] = 1;
    };
    const A = new V3();
    for (const mesh of solids) {
      const pos = mesh.geometry.attributes.position,
        idx = mesh.geometry.index;
      mesh.updateMatrixWorld(true);
      const mw = mesh.matrixWorld;
      const n = idx ? idx.count : pos.count;
      for (let t = 0; t + 2 < n; t += 3) {
        let poly = [];
        for (let k = 0; k < 3; k++) {
          A.fromBufferAttribute(pos, idx ? idx.getX(t + k) : t + k).applyMatrix4(mw);
          poly.push([A.x, A.y, A.z]);
        }
        if (Math.max(poly[0][1], poly[1][1], poly[2][1]) < yLo || Math.min(poly[0][1], poly[1][1], poly[2][1]) > yHi)
          continue;
        poly = clip(clip(poly, yLo, true), yHi, false);
        if (poly.length < 3) continue;
        // outline
        for (let i = 0; i < poly.length; i++) {
          const p = poly[i],
            q = poly[(i + 1) % poly.length];
          const m = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[2] - p[2]) / (fc * 0.7)));
          for (let j = 0; j <= m; j++) markXZ(p[0] + ((q[0] - p[0]) * j) / m, p[2] + ((q[2] - p[2]) * j) / m);
        }
        // inside (the cut triangle is convex)
        let area = 0,
          x0 = Infinity,
          x1 = -Infinity,
          z0 = Infinity,
          z1 = -Infinity;
        for (let i = 0; i < poly.length; i++) {
          const p = poly[i],
            q = poly[(i + 1) % poly.length];
          area += p[0] * q[2] - q[0] * p[2];
          x0 = Math.min(x0, p[0]);
          x1 = Math.max(x1, p[0]);
          z0 = Math.min(z0, p[2]);
          z1 = Math.max(z1, p[2]);
        }
        if (Math.abs(area) / 2 < fc * fc) continue;
        const sg = Math.sign(area);
        for (let fz = Math.floor((z0 - L.z0) / fc); fz <= Math.floor((z1 - L.z0) / fc); fz++)
          for (let fx = Math.floor((x0 - L.x0) / fc); fx <= Math.floor((x1 - L.x0) / fc); fx++) {
            const x = L.x0 + (fx + 0.5) * fc,
              z = L.z0 + (fz + 0.5) * fc;
            let inside = true;
            for (let i = 0; i < poly.length && inside; i++) {
              const p = poly[i],
                q = poly[(i + 1) % poly.length];
              if (((q[0] - p[0]) * (z - p[2]) - (q[2] - p[2]) * (x - p[0])) * sg < 0) inside = false;
            }
            if (inside) markXZ(x, z);
          }
      }
    }
    // distance from every fine cell to the nearest occupied one (two-pass chamfer transform), then block the
    // walk cells closer than R
    const dist = new Float32Array(fcols * frows);
    for (let i = 0; i < dist.length; i++) dist[i] = occ[i] ? 0 : 1e6;
    const S2 = Math.SQRT2;
    for (let fz = 0; fz < frows; fz++)
      for (let fx = 0; fx < fcols; fx++) {
        const i = fz * fcols + fx;
        let d = dist[i];
        if (fx > 0) d = Math.min(d, dist[i - 1] + 1);
        if (fz > 0) {
          d = Math.min(d, dist[i - fcols] + 1);
          if (fx > 0) d = Math.min(d, dist[i - fcols - 1] + S2);
          if (fx < fcols - 1) d = Math.min(d, dist[i - fcols + 1] + S2);
        }
        dist[i] = d;
      }
    for (let fz = frows - 1; fz >= 0; fz--)
      for (let fx = fcols - 1; fx >= 0; fx--) {
        const i = fz * fcols + fx;
        let d = dist[i];
        if (fx < fcols - 1) d = Math.min(d, dist[i + 1] + 1);
        if (fz < frows - 1) {
          d = Math.min(d, dist[i + fcols] + 1);
          if (fx < fcols - 1) d = Math.min(d, dist[i + fcols + 1] + S2);
          if (fx > 0) d = Math.min(d, dist[i + fcols - 1] + S2);
        }
        dist[i] = d;
      }
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const fx = Math.min(fcols - 1, Math.floor(((c + 0.5) * cell) / fc)),
          fz = Math.min(frows - 1, Math.floor(((r + 0.5) * cell) / fc));
        if (dist[fz * fcols + fx] * fc < R) blocked[r * cols + c] = 1;
      }
    // Pockets of free floor that cannot be reached from the entrance (a gap closed off on all sides) are
    // blocked too, so a click or a "Show in store" never picks a spot the visitor cannot walk to.
    {
      const seen = new Uint8Array(cols * rows);
      const isFree = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && !blocked[r * cols + c];
      let c0 = Math.floor((0 - L.x0) / cell),
        r0 = Math.floor((L.z1 - 0.75 - L.z0) / cell);
      for (let k = 0; k < 40 && !isFree(c0, r0); k++) r0--;
      const queue = [r0 * cols + c0];
      seen[queue[0]] = 1;
      while (queue.length) {
        const i = queue.pop(),
          r = (i / cols) | 0,
          c = i - r * cols;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const nc = c + dc,
              nr = r + dr;
            if (!isFree(nc, nr) || seen[nr * cols + nc]) continue;
            if (dc && dr && (!isFree(c + dc, r) || !isFree(c, r + dr))) continue;
            seen[nr * cols + nc] = 1;
            queue.push(nr * cols + nc);
          }
      }
      for (let i = 0; i < blocked.length; i++) if (!seen[i]) blocked[i] = 1;
    }
    return { cell, cols, rows, blocked, ms: performance.now() - t0 };
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
    for (let rad = 1; rad < 10 / NAV.cell; rad++) {
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
  // Look speed (setting): how far a drag or the turn keys turn the view.
  const LOOK_SPEED = { slow: 0.45, normal: 0.7, fast: 1 };
  const lookSpeed = () => LOOK_SPEED[(NY.settings && NY.settings.look) || 'normal'] || LOOK_SPEED.normal;
  // A press that moves less than this is a click, not a drag (fingers wobble more than a mouse).
  const DRAG_PX = { mouse: 8, pen: 10, touch: 14 };
  // Click-to-walk asks for a second click on the same spot (setting "Walking by click: Double-click"), so a
  // stray click never sends the visitor across the store. The first click marks the spot with a pulsing ring;
  // a second click on it within PEND_MS walks there. Garments and fixtures still open with one click.
  const PEND_MS = 2600;
  let pend = null,
    pendHints = 0;
  function clearPend() {
    if (!pend) return;
    pend = null;
    if (!nav.moving) dest.visible = false;
    dest.scale.setScalar(1);
    kick();
  }
  function stopWalk() {
    nav.moving = false;
    nav.info = null;
    dest.visible = false;
    updateZone(false);
    kick();
  }
  function goTo(x, z, look, info) {
    clearPend();
    let end = nearestFree(x, z);
    if (!end) return false;
    let pts = findPath(new V2(nav.x, nav.z), end);
    if (!pts) {
      if (NY.toast) NY.toast('That spot can’t be reached from here.');
      return false;
    }
    if (info && info.clear && !look) {
      pts = keepClear(pts);
      end = pts[pts.length - 1];
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
      T: Math.min(5.2, Math.max(0.8, len / 1.9)),
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
     Where to stand: square in front of a tapped wall, poster or fixture, a little way back, and never with the
     face against a wall after a floor tap
     ------------------------------------------------------------------ */
  const CLEAR = 0.95; // metres kept between the eye and a wall straight ahead after a floor tap
  const NEAR = 1.45; // stand-off in front of a tapped surface
  /* The top bar and the section card cover the top and bottom of the view, so a tapped spot is shown a little
     above the middle (42% from the top), in the open band between them. */
  const BAND_MID = 0.42;
  function bandLook(at, look) {
    const k = ((0.5 - BAND_MID) / 0.5) * Math.tan((baseFov * Math.PI) / 360);
    const out = look.clone();
    out.y -= Math.hypot(look.x - at.x, look.z - at.y) * k;
    return out;
  }
  /** The spot to look at and the direction to stand in, for a tap on any surface. */
  function focusFor(hit) {
    const p = hit.point;
    const toCam = new V2(nav.x - p.x, nav.z - p.z);
    let n = null;
    if (hit.face) {
      const wn = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      n = new V2(wn.x, wn.z);
    }
    if (!n || n.length() < 0.35) n = toCam.clone(); // a top surface: come at it from this side
    if (n.lengthSq() < 1e-6) n.set(0, 1);
    n.normalize();
    if (n.dot(toCam) < 0) n.negate();
    return { c: p.clone(), n, d: NEAR, look: p.clone() };
  }
  /** A free, reachable spot on the line out from c along n, as close to distance d as the room allows. */
  function standIn(c, n, d) {
    const from = new V2(nav.x, nav.z);
    const toCam = new V2(nav.x - c.x, nav.z - c.z);
    const dirs = [n];
    if (toCam.lengthSq() > 1e-6) {
      toCam.normalize();
      if (toCam.dot(n) < 0.97) dirs.push(toCam); // a recess or a side face: also try from where the visitor is
    }
    const ts = [];
    for (let t = d; t <= d + 1.8 + 1e-6; t += 0.1) ts.push(t);
    for (let t = d - 0.1; t >= 0.95 - 1e-6; t -= 0.1) ts.push(t);
    /* Room ahead: the visitor could still step 0.3 and 0.6 m towards the spot, so nothing solid is within about
       0.9 m of the eye in the middle of the view (the walk grid keeps BODY_R from every solid). */
    const roomAhead = (at) => {
      const dx = c.x - at.x,
        dz = c.z - at.y,
        L = Math.hypot(dx, dz);
      for (const s of [0.3, 0.6]) if (s < L - 0.3 && !freeAt(at.x + (dx / L) * s, at.y + (dz / L) * s)) return false;
      return true;
    };
    for (const strict of [true, false])
      for (const dir of dirs) {
        const side = new V2(-dir.y, dir.x);
        for (const t of ts)
          for (const s of [0, 0.15, -0.15, 0.3, -0.3]) {
            const x = c.x + dir.x * t + side.x * s,
              z = c.z + dir.y * t + side.y * s;
            if (!freeAt(x, z)) continue;
            const at = new V2(x, z);
            if (strict && !roomAhead(at)) continue;
            if (at.distanceTo(from) < 0.08 || findPath(from, at)) return at;
          }
      }
    return null;
  }
  const fwd = new THREE.Raycaster();
  /** Shortens a floor-tap walk so the visitor stops CLEAR metres short of a wall or fixture straight ahead. */
  function keepClear(pts) {
    const n = pts.length;
    if (n < 2) return pts;
    const a = pts[n - 2],
      b = pts[n - 1];
    const dir = new V2(b.x - a.x, b.y - a.y),
      seg = dir.length();
    if (seg < 0.05) return pts;
    dir.divideScalar(seg);
    fwd.set(new V3(b.x, EYE, b.y), new V3(dir.x, 0, dir.y));
    fwd.far = CLEAR;
    const h = fwd.intersectObjects(solids, false)[0];
    if (!h) return pts;
    let total = 0;
    for (let i = 1; i < n; i++) total += pts[i].distanceTo(pts[i - 1]);
    let back = Math.min(CLEAR - h.distance, total * 0.85);
    if (back < 0.03) return pts;
    const out = pts.slice();
    while (back > 1e-4 && out.length > 1) {
      const q = out[out.length - 1],
        p = out[out.length - 2],
        l = q.distanceTo(p);
      if (l > back) {
        out[out.length - 1] = new V2(q.x + ((p.x - q.x) * back) / l, q.y + ((p.y - q.y) * back) / l);
        back = 0;
      } else {
        out.pop();
        back -= l;
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------
     Input: drag to look, tap to walk or open, pinch and wheel to zoom, keys
     ------------------------------------------------------------------ */
  const ray = new THREE.Raycaster(),
    ndc = new V2();
  const liveMeshes = [];
  for (const l of live) {
    for (const pc of l.outfit.pieces) liveMeshes.push(pc.mesh.outer);
    for (const p of l.man.parts) liveMeshes.push(p.mesh);
  }
  const pickables = productMeshes.concat(pickProxies, liveMeshes, hitboxes);
  const allHits = pickables.concat(solids, [floor]);
  // live cloth moves, so its bounds are refreshed before picking
  function refreshLiveBounds() {
    for (const l of live) for (const pc of l.outfit.pieces) pc.mesh.geo.computeBoundingSphere();
  }
  const recOf = (hit) => {
    if (!hit) return null;
    const o = hit.object;
    return o.userData.ranges ? rangeRec(o, hit.faceIndex) : o.userData.rec || null;
  };
  function setRay(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  const ptrs = new Map();
  const drag = { active: false, id: null, x: 0, y: 0, sx: 0, sy: 0, t: 0, moved: false, type: 'mouse' };
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
    // pressing anywhere while walking stops the walk, so a walk started by mistake can be cancelled
    if (nav.moving && ptrs.size === 1) stopWalk();
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
        type: e.pointerType || 'mouse',
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
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > (DRAG_PX[drag.type] || 8)) {
        drag.moved = true;
        canvas.classList.add('grabbing');
        nav.turn = null;
        hideTip();
      }
      if (drag.moved) {
        const k = ((camera.fov * Math.PI) / 180 / Math.max(200, canvas.clientHeight)) * lookSpeed();
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
        tap(e.clientX, e.clientY, drag.type);
      drag.active = false;
      canvas.classList.remove('grabbing');
    }
    kick();
  }
  canvas.addEventListener('pointerup', endPtr);
  canvas.addEventListener('pointercancel', endPtr);
  canvas.addEventListener('pointerleave', () => {
    hoverPt = null;
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

  function tap(cx, cy, type) {
    setRay(cx, cy);
    refreshLiveBounds();
    const hit = ray.intersectObjects(allHits, false)[0];
    if (!hit) return;
    const o = hit.object;
    const rec = recOf(hit);
    if (rec) {
      if (NY.onProductTap) {
        nav.turn = yawPitch(nav.x, nav.z, rec.center);
        kick();
        NY.onProductTap(rec.pid, rec.ci, {
          look: rec.look || null,
          at: { x: rec.center.x, z: rec.center.z, zone: rec.zone || null },
        });
      }
      return;
    }
    if (o.userData.action) {
      if (NY.onFeatureTap) {
        const wp = o.getWorldPosition(new V3());
        NY.onFeatureTap(o.userData.action, { x: wp.x, z: wp.z, zone: (NY.zoneAt(wp.x, wp.z) || {}).id || null });
      }
      return;
    }
    const hx = hit.point.x,
      hz = hit.point.z;
    let x = hx,
      z = hz,
      look = null;
    if (o !== floor && hit.point.y > 0.05) {
      // a wall, poster or fixture: walk to a spot square in front of it and look at it
      const f = focusFor(hit);
      let at = standIn(f.c, f.n, f.d);
      if (!at) {
        const dx = nav.x - hx,
          dz = nav.z - hz,
          d = Math.hypot(dx, dz) || 1;
        at = new V2(hx + (dx / d) * NEAR, hz + (dz / d) * NEAR);
      }
      x = at.x;
      z = at.y;
      look = bandLook(at, f.look);
    }
    if (NY.onUserNav) NY.onUserNav('walk');
    clearPin();
    if (!(NY.settings && NY.settings.walkClick === 'single')) {
      const now = performance.now();
      const same =
        pend &&
        now < pend.until &&
        (Math.hypot(cx - pend.cx, cy - pend.cy) < (type === 'touch' ? 40 : 24) ||
          Math.hypot(hx - pend.x, hz - pend.z) < 0.5);
      if (!same) {
        const end = nearestFree(x, z);
        if (!end) return;
        pend = { x: hx, z: hz, cx, cy, until: now + PEND_MS };
        dest.position.set(end.x, 0.012, end.y);
        dest.visible = true;
        ring.visible = false;
        if (NY.toast && pendHints < 3) {
          pendHints++;
          NY.toast(type === 'touch' ? 'Tap again to walk here' : 'Click again to walk here');
        }
        kick(PEND_MS);
        return;
      }
    }
    goTo(x, z, look, { reason: 'point', clear: true });
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
    tryon: '<b>Try-on mirror</b>Click to try clothes on with your camera',
    tailor: '<b>Tailor’s mirror</b>Click to book an alteration',
    bag: '<b>Checkout counter</b>Click to open your bag',
  };
  function tipFor(rec) {
    const p = NY.byId[rec.pid];
    if (rec.look && rec.look.length > 1)
      return '<b>' + esc(p.name) + '</b>Look of ' + rec.look.length + ' pieces · from ' + NY.money(p.price);
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
  function setHover(rec) {
    if (rec === hovered) return;
    hovered = rec;
    needs = true;
  }
  function doHover() {
    hoverReq = null;
    if (!hoverPt || drag.active) return;
    const [cx, cy] = hoverPt;
    setRay(cx, cy);
    refreshLiveBounds();
    let hit = ray.intersectObjects(pickables, false)[0];
    if (hit) {
      const occ = ray.intersectObjects(solids, false)[0];
      if (occ && occ.distance < hit.distance - 0.03) hit = null;
    }
    const rec = recOf(hit);
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

  // A tooltip describes what is under the pointer right now. While the view moves (walking, turning,
  // keys, the tour) it is hidden; once the view settles the pointer is checked again. So a tooltip
  // never stays on screen for a counter the visitor has walked away from.
  const lastView = { x: NaN, z: 0, yaw: 0, pitch: 0, zoom: 0 };
  const lastMove = { x: NaN, z: NaN };
  let hoverStale = false;
  function refreshHoverOnMove() {
    const moved =
      Math.abs(nav.x - lastView.x) > 1e-3 ||
      Math.abs(nav.z - lastView.z) > 1e-3 ||
      Math.abs(nav.yaw - lastView.yaw) > 1e-3 ||
      Math.abs(nav.pitch - lastView.pitch) > 1e-3 ||
      Math.abs(zoom - lastView.zoom) > 1e-3;
    if (moved) {
      lastView.x = nav.x;
      lastView.z = nav.z;
      lastView.yaw = nav.yaw;
      lastView.pitch = nav.pitch;
      lastView.zoom = zoom;
      if (!tipEl.hidden || hovered || ring.visible) {
        hideTip();
        setHover(null);
        canvas.classList.remove('over-item');
        ring.visible = false;
      }
      hoverStale = true;
    } else if (hoverStale) {
      hoverStale = false;
      if (hoverPt && !drag.active && !hoverReq) hoverReq = requestAnimationFrame(doHover);
    }
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
    clearPend();
    nav.moving = false;
    nav.turn = null;
    dest.visible = false;
    clearPin();
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
  function clearPin() {
    pulse = null;
    pinEl.hidden = true;
  }
  function highlight(rec) {
    pulse = { rec, until: performance.now() + 6500 };
    const p = NY.byId[rec.pid];
    pinLabel.textContent = p.name + ' · ' + NY.colorOf(p, rec.ci).n;
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
    const hideAll = !labelsOn || paused || curZone === 'fitting';
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
     Mannequin viewer (second renderer inside the product sheet): the garment is simulated live on a
     mannequin you can turn, with motion presets, sizes and colours.
     ------------------------------------------------------------------ */
  let VW = null;
  // Mannequin spin in the product viewer: top speed (rad/s, about 2 turns a second on desktop) and how
  // quickly a free spin slows down (per second). A hard flick keeps turning for a few seconds.
  const SPIN_MAX = coarse ? 10 : 13;
  const SPIN_FRICTION = 0.75;
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
    sc.environmentIntensity = 0.62;
    sc.add(new THREE.HemisphereLight(0xffffff, 0x8f8a80, 0.55));
    const d2 = new THREE.DirectionalLight(0xfff4e6, 1.5);
    d2.position.set(1.2, 3, 2.2);
    sc.add(d2);
    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.4),
      basic({ map: tex.sRound, color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }),
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(0, 0.002, 0);
    sc.add(sh);
    const cam = new THREE.PerspectiveCamera(26, 1.2, 0.05, 30);
    const ctr = new OrbitControls(cam, r2.domElement);
    ctr.enablePan = false;
    ctr.enableDamping = true;
    ctr.dampingFactor = 0.08;
    ctr.minDistance = 1.2;
    ctr.maxDistance = 6;
    ctr.minPolarAngle = 0.5;
    ctr.maxPolarAngle = 1.75;
    ctr.addEventListener('start', () => {
      VW.userTurned = true;
    });
    // Sideways drag spins the mannequin itself, like a turntable with momentum, so the fabric swings
    // and flares with the turn. Up/down drag tilts the camera and the wheel or pinch zooms (OrbitControls,
    // with its sideways orbit locked in buildViewerOutfit).
    const spin = { yaw: 0, vel: 0, target: 0, drag: null, hist: [], ptrs: new Set() };
    const el = r2.domElement;
    el.addEventListener('pointerdown', (e) => {
      spin.ptrs.add(e.pointerId);
      if (spin.ptrs.size > 1) {
        // a second finger means pinch-zoom, not a spin
        spin.drag = null;
        spin.vel = 0;
        spin.target = spin.yaw;
        return;
      }
      if (e.button > 0) return;
      spin.drag = { id: e.pointerId, x: e.clientX };
      spin.vel = 0; // grabbing a spinning mannequin stops it
      spin.target = spin.yaw;
      spin.hist = [[performance.now(), spin.target]];
    });
    el.addEventListener('pointermove', (e) => {
      const d = spin.drag;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x;
      d.x = e.clientX;
      spin.target += (dx * Math.PI * 2.2) / Math.max(240, el.clientWidth);
      const now = performance.now();
      spin.hist.push([now, spin.target]);
      while (spin.hist.length > 2 && now - spin.hist[0][0] > 120) spin.hist.shift();
    });
    const endSpin = (e) => {
      spin.ptrs.delete(e.pointerId);
      const d = spin.drag;
      if (!d || e.pointerId !== d.id) return;
      spin.drag = null;
      const hs = spin.hist,
        a = hs[0],
        b = hs[hs.length - 1],
        span = (b[0] - a[0]) / 1000;
      // let go while still moving: it keeps spinning (unless the visitor prefers reduced motion)
      if (!RM && span > 0.01 && performance.now() - b[0] < 90)
        spin.vel = Math.max(-SPIN_MAX, Math.min(SPIN_MAX, (b[1] - a[1]) / span));
    };
    el.addEventListener('pointerup', endSpin);
    el.addEventListener('pointercancel', endSpin);
    VW = {
      spin,
      r: r2,
      sc,
      cam,
      ctr,
      el: null,
      active: false,
      outfit: null,
      man: null,
      m: null,
      t: 0,
      mode: 'turn',
      key: '',
    };
    return VW;
  }
  function viewerBody(kind) {
    const u = NY.userBody && NY.userBody(kind);
    return u || bodyFor(kind);
  }
  /** Build (or rebuild) the outfit in the viewer. layers: [[pid, ci, si], ...] outermost last. */
  function buildViewerOutfit(layers, kind) {
    const m = viewerBody(kind);
    const key = JSON.stringify([layers.map((l) => [l[0], l[2], l[3] && l[3].drape]), kind, m.shoulderW, m.chestA]);
    const pieces = layers.map(([pid, ci, si, ex], i) => {
      const p = NY.byId[pid] || NY.BASES[String(pid).startsWith('base:') ? pid.slice(5) : kind];
      const spec = NY.specFor(p, si, ci);
      if (ex && ex.drape) spec.drape = ex.drape;
      if (i > 0 && !spec.layer) spec.layer = 1;
      return { spec };
    });
    if (VW.outfit && VW.key === key) {
      pieces.forEach((pc, i) => VW.outfit.setLook(i, pc.spec));
      return;
    }
    if (VW.outfit) {
      VW.sc.remove(VW.outfit.group);
      VW.outfit.dispose();
    }
    if (!VW.man || VW.m !== m) {
      if (VW.man) VW.sc.remove(VW.man.group);
      VW.man = new Mannequin(m, { material: M.mannequin });
      VW.sc.add(VW.man.group);
    }
    VW.m = m;
    VW.key = key;
    VW.outfit = new Outfit({ m, pieces, res: coarse ? 0.72 : 0.9, substeps: 3, texSize: 512, maxSpeed: 12 });
    VW.sc.add(VW.outfit.group);
    // settle before the first frame
    const J = animatedPose(m, VW.t, { mode: VW.mode, yaw: VW.spin.yaw });
    for (let k = 0; k < 30; k++) VW.outfit.step(J, 1 / 60);
    VW.outfit.sync();
    VW.man.pose(J);
    const top = J.nose[1] + 0.14,
      mid = top * 0.5;
    if (!VW.userTurned) {
      // fit the whole mannequin, seen slightly from the side and above
      const dist = (0.56 * top) / Math.tan((VW.cam.fov * Math.PI) / 360) / Math.min(1, VW.cam.aspect || 1);
      VW.cam.position.set(dist * 0.32, mid + 0.25, dist * 0.95);
      VW.ctr.target.set(0, mid, 0);
      // the mannequin turns, not the camera: lock the sideways orbit at this angle
      VW.ctr.minAzimuthAngle = VW.ctr.maxAzimuthAngle = Math.atan2(0.32, 0.95);
    }
    VW.ctr.update();
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
  function mountViewer(el, o) {
    try {
      ensureViewer();
    } catch (e) {
      console.warn(e);
      return false;
    }
    VW.el = el;
    VW.userTurned = false;
    // each product opens facing the front, standing still
    Object.assign(VW.spin, { yaw: 0, vel: 0, target: 0, drag: null });
    VW.mode = o.mode || (RM ? 'still' : 'turn');
    VW.r.domElement.className = 'viewer-canvas';
    VW.r.domElement.setAttribute(
      'aria-label',
      'Garment on a mannequin with live fabric simulation. Drag sideways to spin the mannequin; the fabric moves with it.',
    );
    el.prepend(VW.r.domElement);
    buildViewerOutfit(o.layers, o.kind);
    sizeViewer();
    VW.active = true;
    return true;
  }
  function updateViewer(o) {
    if (!VW || !VW.active) return;
    if (o.mode) VW.mode = o.mode;
    if (o.layers) buildViewerOutfit(o.layers, o.kind);
  }
  function unmountViewer() {
    if (!VW) return;
    VW.active = false;
    if (VW.r.domElement.parentNode) VW.r.domElement.parentNode.removeChild(VW.r.domElement);
    VW.el = null;
  }
  const VIEW_STEP = 1 / 60; // the viewer's cloth runs fixed steps: an uneven step length makes cloth shake
  function stepViewer(dt) {
    if (!VW || !VW.active || !VW.outfit) return;
    VW.acc = (VW.acc || 0) + dt;
    let steps = Math.floor(VW.acc / VIEW_STEP + 1e-6);
    if (steps > 3) {
      steps = 3; // the tab was busy: catch up a little, then drop the rest
      VW.acc = 0;
    } else VW.acc -= steps * VIEW_STEP;
    let J = null;
    for (let k = 0; k < steps; k++) J = stepViewerOnce(VIEW_STEP);
    if (J) {
      VW.outfit.sync();
      VW.man.pose(J);
    }
    VW.ctr.update();
    VW.r.render(VW.sc, VW.cam);
  }
  function stepViewerOnce(dt) {
    const sp = VW.spin;
    let turn = 0;
    if (sp.drag) {
      // follow the finger, but no faster than a real turntable could be spun
      turn = Math.max(-SPIN_MAX * dt, Math.min(SPIN_MAX * dt, sp.target - sp.yaw));
    } else if (sp.vel) {
      turn = sp.vel * dt;
      sp.vel *= Math.exp(-dt * SPIN_FRICTION);
      if (Math.abs(sp.vel) < 0.05) sp.vel = 0;
    }
    // A fast spin moves the body a long way in one step. Split it so the colliders and the pinned seams
    // follow the arc instead of jumping, and the cloth keeps simulating through the whole turn.
    const n = Math.min(coarse ? 3 : 5, Math.max(1, Math.ceil(Math.abs(turn) / 0.07)));
    const y0 = sp.yaw,
      t0 = VW.t;
    let J = null;
    for (let i = 1; i <= n; i++) {
      sp.yaw = y0 + (turn * i) / n;
      J = animatedPose(VW.m, t0 + (dt * i) / n, { mode: VW.mode, yaw: sp.yaw });
      VW.outfit.step(J, dt / n);
    }
    VW.t = t0 + dt;
    if (!sp.drag) sp.target = sp.yaw;
    return J;
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
    if (pend) {
      const now = performance.now();
      if (now > pend.until) clearPend();
      else {
        act = true;
        dest.scale.setScalar(1 + 0.14 * Math.sin(now / 130));
      }
    }
    if (!paused) {
      spin += dt * 0.12;
      turntable.rotation.y = spin;
      if (updateLive(dt)) act = true;
    }
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
      nav.yaw += tr * 1.7 * lookSpeed() * dt;
      if (f || st) {
        const sp = 1.8 * dt,
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
    refreshHoverOnMove();
    // tell the interface every time the visitor's position changes (walking, keys, jumps), not only on
    // rendered frames, so panels tied to a counter close the moment the visitor walks away
    if (nav.x !== lastMove.x || nav.z !== lastMove.z) {
      lastMove.x = nav.x;
      lastMove.z = nav.z;
      if (NY.onMove) NY.onMove(nav.x, nav.z);
    }
    if (pulse) {
      act = true;
      const now = performance.now();
      if (now > pulse.until) {
        pulse = null;
        pinEl.hidden = true;
      } else pinEl.style.setProperty('--bob', (Math.sin(now / 170) * 4).toFixed(1) + 'px');
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
    if (VW && VW.active) stepViewer(dt);
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
      const rank = (r) => (r.kind === 'garment' ? 0 : r.kind === 'look' ? 1 : 2);
      const cands = records
        .filter((r) => r.pid === pid)
        .sort((a, b) => (a.ci === (ci || 0) ? 0 : 3) + rank(a) - ((b.ci === (ci || 0) ? 0 : 3) + rank(b)));
      const rec = cands[0];
      if (!rec) return;
      const dist = rec.dist || 1.25;
      const at = new V3(rec.center.x + Math.sin(rec.ry) * dist, 0, rec.center.z + Math.cos(rec.ry) * dist);
      goTo(at.x, at.z, rec.center, { reason: 'product', rec });
    },
    goPoint(x, z) {
      goTo(x, z, null, { reason: 'point', clear: true });
    },
    where() {
      return { x: nav.x, z: nav.z, zone: curZone, yaw: nav.yaw, moving: nav.moving };
    },
    /** Places the camera directly (tests and screenshots). */
    debugPose(x, z, yaw, pitch) {
      nav.moving = false;
      nav.turn = null;
      Object.assign(nav, { x, z, yaw, pitch });
      needs = true;
      kick(600);
      updateZone(true);
    },
    /** What a tap at screen point (cx, cy) would hit (tests): kind, point, distance and the surface's facing. */
    pick(cx, cy) {
      setRay(cx, cy);
      refreshLiveBounds();
      const hit = ray.intersectObjects(allHits, false)[0];
      if (!hit) return null;
      const o = hit.object;
      let n = { x: 0, z: 0 };
      if (hit.face) {
        const wn = hit.face.normal.clone().transformDirection(o.matrixWorld);
        n = { x: wn.x, z: wn.z };
      }
      const kind = recOf(hit)
        ? 'product'
        : o.userData.action
          ? 'feature'
          : o === floor || hit.point.y <= 0.05
            ? 'floor'
            : 'surface';
      return { kind, x: hit.point.x, y: hit.point.y, z: hit.point.z, dist: hit.distance, nx: n.x, nz: n.z };
    },
    clearPin,
    mountViewer,
    updateViewer,
    unmountViewer,
    viewerSpin() {
      return VW && VW.active ? { yaw: VW.spin.yaw, vel: VW.spin.vel, dragging: !!VW.spin.drag } : null;
    },
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
    /** Walk grid, for tests: cell size, origin and the blocked cells (1 = the visitor cannot stand there). */
    navGrid() {
      const { cell, cols, rows, ms } = NAV;
      return { cell, x0: L.x0, z0: L.z0, cols, rows, ms, blocked: Array.from(NAV.blocked) };
    },
    stats() {
      return {
        draws: renderer.info.render.calls,
        tris: renderer.info.render.triangles,
        records: records.length,
        meshes: productMeshes.length,
        live: live.map((l) => l.outfit.particles),
      };
    },
  });
  requestAnimationFrame(loop);
}
