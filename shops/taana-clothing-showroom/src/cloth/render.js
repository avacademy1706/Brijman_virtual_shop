// three.js side of the cloth system: fabric textures and materials, the cloth mesh, and the mannequin.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { computeNormals, copyPositions, computeTargets } from './garments.js';
import { SEG, frames, torsoProfile, shoulderLine } from './body.js';
import { FABRICS } from './sim.js';

// ------------------------------------------------------------------ fabric textures
const texCache = new Map();
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function canvas(n) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  return c;
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return 'rgb(' + ch((n >> 16) & 255) + ',' + ch((n >> 8) & 255) + ',' + ch(n & 255) + ')';
}

/** Draw one 0.25 m tile of a fabric pattern. */
function drawPattern(g, S, pattern, base, accent, seed) {
  const R = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  if (pattern === 'stripe') {
    g.fillStyle = accent;
    for (let x = 0; x < S; x += S / 8) g.fillRect(x, 0, S / 40, S);
    g.globalAlpha = 0.5;
    for (let x = S / 16; x < S; x += S / 8) g.fillRect(x, 0, S / 90, S);
    g.globalAlpha = 1;
  } else if (pattern === 'check') {
    g.globalAlpha = 0.45;
    g.fillStyle = accent;
    for (let x = 0; x < S; x += S / 6) g.fillRect(x, 0, S / 12, S);
    for (let y = 0; y < S; y += S / 6) g.fillRect(0, y, S, S / 12);
    g.globalAlpha = 1;
  } else if (pattern === 'block') {
    const n = 4;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const cx = (i + (j % 2) * 0.5 + 0.25) * (S / n),
          cy = (j + 0.5) * (S / n);
        motif(g, cx, cy, S / 15, accent);
        if (cx > S - S / 8) motif(g, cx - S, cy, S / 15, accent);
      }
  } else if (pattern === 'chikan') {
    g.strokeStyle = accent;
    g.lineWidth = S / 300;
    g.fillStyle = accent;
    const n = 3;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const cx = (i + (j % 2) * 0.5 + 0.25) * (S / n),
          cy = (j + 0.5) * (S / n);
        for (const ox of [0, -S]) {
          if (ox && cx < S - S / 6) continue;
          g.strokeStyle = shade(base, -0.22);
          g.lineWidth = S / 170;
          flower(g, cx + ox, cy, S / 16);
          g.strokeStyle = accent;
          g.lineWidth = S / 300;
          flower(g, cx + ox, cy, S / 16);
          g.fillStyle = shade(base, -0.18);
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2;
            dot(g, cx + ox + (Math.cos(a) * S) / 9, cy + (Math.sin(a) * S) / 9, S / 200);
          }
          g.fillStyle = accent;
        }
      }
    // jaali vine
    g.globalAlpha = 0.7;
    g.fillStyle = shade(base, -0.14);
    for (let y = 0; y < S; y += 2) {
      const x = S * 0.5 + Math.sin((y / S) * Math.PI * 4) * S * 0.06;
      dot(g, x, y, S / 420);
    }
    g.globalAlpha = 1;
  } else if (pattern === 'denim') {
    g.strokeStyle = shade(base, 0.12);
    g.lineWidth = 1.2;
    for (let k = -S; k < S; k += 4) {
      g.beginPath();
      g.moveTo(k, S);
      g.lineTo(k + S, 0);
      g.stroke();
    }
    g.globalAlpha = 0.18;
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 2600; i++) g.fillRect(R() * S, R() * S, 1 + R() * 2, 1);
    g.globalAlpha = 1;
  } else if (pattern === 'ikat') {
    g.fillStyle = accent;
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 4; i++) {
        const cx = ((i + 0.5) * S) / 4,
          cy = ((j + 0.5) * S) / 4,
          r = S / 11;
        g.beginPath();
        g.moveTo(cx, cy - r);
        g.lineTo(cx + r * 0.6, cy);
        g.lineTo(cx, cy + r);
        g.lineTo(cx - r * 0.6, cy);
        g.closePath();
        g.fill();
        for (let k = 0; k < 6; k++)
          g.fillRect(cx - r * 0.8 + R() * r * 1.6, cy + (R() - 0.5) * r * 2, R() * r * 0.5, 1.5);
      }
  } else if (pattern === 'paisley') {
    g.fillStyle = accent;
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 4; i++) {
        const cx = (i + (j % 2) * 0.5 + 0.25) * (S / 4),
          cy = (j + 0.5) * (S / 4);
        for (const ox of [0, -S]) {
          if (ox && cx < S - S / 8) continue;
          paisley(g, cx + ox, cy, S / 15, (i + j) % 2 ? 0.6 : -0.6, accent, base);
        }
      }
  } else if (pattern === 'floral') {
    for (let k = 0; k < 26; k++) {
      const x = R() * S,
        y = R() * S,
        r = S / 40 + (R() * S) / 30;
      for (const [ox, oy] of [
        [0, 0],
        [S, 0],
        [-S, 0],
        [0, S],
        [0, -S],
      ]) {
        if (Math.abs(x + ox - S / 2) > S / 2 + r || Math.abs(y + oy - S / 2) > S / 2 + r) continue;
        g.fillStyle = shade(accent, -0.15 + R() * 0.2);
        for (let q = 0; q < 5; q++) {
          const a = (q / 5) * Math.PI * 2 + k;
          g.beginPath();
          g.ellipse(
            x + ox + Math.cos(a) * r * 0.55,
            y + oy + Math.sin(a) * r * 0.55,
            r * 0.5,
            r * 0.3,
            a,
            0,
            Math.PI * 2,
          );
          g.fill();
        }
        g.fillStyle = shade(base, 0.5);
        dot(g, x + ox, y + oy, r * 0.22);
        g.fillStyle = shade(base, -0.25);
        g.beginPath();
        g.ellipse(x + ox + r * 1.1, y + oy + r * 0.6, r * 0.45, r * 0.16, 0.7, 0, Math.PI * 2);
        g.fill();
      }
    }
  } else if (pattern === 'brocade') {
    // woven buttis on a fine diagonal ground
    g.strokeStyle = shade(base, 0.08);
    g.lineWidth = 1;
    for (let k = -S; k < S; k += 6) {
      g.beginPath();
      g.moveTo(k, S);
      g.lineTo(k + S, 0);
      g.stroke();
    }
    g.fillStyle = accent;
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 4; i++) {
        const cx = (i + (j % 2) * 0.5 + 0.25) * (S / 4),
          cy = (j + 0.5) * (S / 4);
        for (const ox of [0, -S]) {
          if (ox && cx < S - S / 8) continue;
          butti(g, cx + ox, cy, S / 18, accent);
        }
      }
  } else if (pattern === 'phulkari') {
    // geometric satin-stitch flowers in diamonds
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 4; i++) {
        const cx = (i + 0.5) * (S / 4),
          cy = (j + 0.5) * (S / 4),
          r = S / 9;
        g.fillStyle = (i + j) % 2 ? accent : shade(accent, 0.35);
        for (let q = 0; q < 8; q++) {
          const a = (q / 8) * Math.PI * 2;
          g.beginPath();
          g.moveTo(cx, cy);
          g.lineTo(cx + Math.cos(a - 0.18) * r, cy + Math.sin(a - 0.18) * r);
          g.lineTo(cx + Math.cos(a + 0.18) * r, cy + Math.sin(a + 0.18) * r);
          g.closePath();
          g.fill();
        }
        g.fillStyle = shade(base, -0.3);
        dot(g, cx, cy, r * 0.18);
      }
  } else if (pattern === 'dots') {
    g.fillStyle = accent;
    for (let j = 0; j < 8; j++)
      for (let i = 0; i < 8; i++) dot(g, ((i + (j % 2) * 0.5) * S) / 8, ((j + 0.5) * S) / 8, S / 110);
  }
  // fine weave noise on every fabric
  const img = g.getImageData(0, 0, S, S),
    d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const px = (i / 4) % S,
      py = Math.floor(i / 4 / S);
    const n = ((px % 2) ^ (py % 2) ? 5 : -5) + (R() - 0.5) * 10;
    d[i] = clamp8(d[i] + n);
    d[i + 1] = clamp8(d[i + 1] + n);
    d[i + 2] = clamp8(d[i + 2] + n);
  }
  g.putImageData(img, 0, 0);
}
const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
function dot(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}
function motif(g, cx, cy, r, col) {
  g.fillStyle = col;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    g.beginPath();
    g.ellipse(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6, r * 0.42, r * 0.22, a, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
  g.fill();
}
function paisley(g, cx, cy, r, rot, col, base) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  g.beginPath();
  g.moveTo(0, -r * 1.3);
  g.bezierCurveTo(r * 1.1, -r * 0.6, r * 0.9, r * 0.9, 0, r);
  g.bezierCurveTo(-r * 0.9, r * 0.9, -r * 0.8, -r * 0.1, -r * 0.1, -r * 0.2);
  g.bezierCurveTo(r * 0.3, -r * 0.4, r * 0.1, -r * 0.9, 0, -r * 1.3);
  g.fillStyle = col;
  g.fill();
  g.fillStyle = shade(base, 0.1);
  dot(g, r * 0.05, r * 0.35, r * 0.32);
  g.fillStyle = col;
  dot(g, r * 0.05, r * 0.35, r * 0.14);
  g.restore();
}
function butti(g, cx, cy, r, col) {
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(cx, cy - r * 0.35, r * 0.32, r * 0.62, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(cx - r * 0.55, cy + r * 0.15, r * 0.42, r * 0.2, -0.6, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(cx + r * 0.55, cy + r * 0.15, r * 0.42, r * 0.2, 0.6, 0, Math.PI * 2);
  g.fill();
  g.fillRect(cx - r * 0.06, cy, r * 0.12, r * 0.8);
}
function flower(g, cx, cy, r) {
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    g.beginPath();
    g.ellipse(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.45, r * 0.22, a, 0, Math.PI * 2);
    g.stroke();
  }
  dot(g, cx, cy, r * 0.16);
  g.beginPath();
  g.moveTo(cx, cy + r);
  g.quadraticCurveTo(cx + r * 0.6, cy + r * 1.6, cx + r * 0.2, cy + r * 2.1);
  g.stroke();
}

function weaveNormal(kind) {
  const key = 'n:' + kind;
  if (texCache.has(key)) return texCache.get(key);
  const S = 128,
    c = canvas(S),
    g = c.getContext('2d'),
    img = g.createImageData(S, S),
    d = img.data;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let nx = 0,
        ny = 0;
      if (kind === 'twill') {
        const p = ((x + y) % 6) / 6;
        nx = Math.sin(p * Math.PI * 2) * 0.35;
        ny = -nx;
      } else {
        nx = Math.sin((x / 2) * Math.PI) * 0.22;
        ny = Math.sin((y / 2) * Math.PI) * 0.22;
      }
      const i = (y * S + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = 255;
      d[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(24, 24);
  texCache.set(key, t);
  return t;
}

export function fabricTexture(pattern, base, accent, size = 512) {
  const key = [pattern, base, accent, size].join('|');
  if (texCache.has(key)) return texCache.get(key);
  const c = canvas(size),
    g = c.getContext('2d');
  drawPattern(g, size, pattern || 'solid', base, accent || shade(base, 0.6), size + base.length);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

/**
 * Outer and inner materials for a garment.
 * opts.border: { color, width (m), shine } draws a band along the decorated edges (hem, cuffs, dupatta border),
 * using the per-vertex `edge` distance from the garment builder.
 */
export function fabricMaterials(fabricId, pattern, base, accent, opts = {}) {
  const f = FABRICS[fabricId] || FABRICS.cotton;
  const map = fabricTexture(pattern, base, accent, opts.texSize || 512);
  const outer = new THREE.MeshPhysicalMaterial({
    map,
    normalMap: weaveNormal(pattern === 'denim' ? 'twill' : 'plain'),
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: f.roughness,
    metalness: 0,
    sheen: f.sheen,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(base).lerp(new THREE.Color('#ffffff'), 0.35),
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
  const inner = new THREE.MeshStandardMaterial({
    map,
    normalMap: outer.normalMap,
    color: new THREE.Color('#9a928a'),
    roughness: 0.95,
    side: THREE.BackSide,
  });
  patchFabric(outer, opts.border, opts.wrinkles !== false);
  patchFabric(inner, opts.border, false);
  return { outer, inner };
}

/** Tileable height field of soft, mostly horizontal folds, converted to a normal map. */
function wrinkleNormal() {
  if (texCache.has('wrinkle')) return texCache.get('wrinkle');
  const S = 256,
    R = rng(7),
    h = new Float32Array(S * S);
  const waves = [];
  for (let k = 0; k < 5; k++)
    waves.push({
      f: 2 + Math.floor(R() * 3),
      p: R() * 6.28,
      warpF: 1 + Math.floor(R() * 2),
      warpA: 0.06 + R() * 0.1,
      a: 0.6 + R() * 0.6,
    });
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = x / S,
        v = y / S;
      let s = 0;
      for (const w of waves) {
        const warp = Math.sin(u * Math.PI * 2 * w.warpF + w.p) * w.warpA;
        const t = Math.sin((v + warp) * Math.PI * 2 * w.f + w.p);
        s +=
          w.a *
          Math.sign(t) *
          Math.pow(Math.abs(t), 1.6) *
          (0.5 + 0.5 * Math.sin(u * Math.PI * 2 * (w.warpF + 1) + w.p * 2));
      }
      h[y * S + x] = s;
    }
  const c = canvas(S),
    g = c.getContext('2d'),
    img = g.createImageData(S, S),
    d = img.data;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const hx = h[y * S + ((x + 1) % S)] - h[y * S + ((x + S - 1) % S)];
      const hy = h[((y + 1) % S) * S + x] - h[((y + S - 1) % S) * S + x];
      let nx = -hx * 0.35,
        ny = -hy * 0.35,
        nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const i = (y * S + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set('wrinkle', t);
  return t;
}

/**
 * Patch a fabric material:
 * - border: fragments within `width` of a decorated edge take the border colour (with a thin zari line),
 *   using the per-vertex `edge` distance from the garment builder;
 * - wrinkles: where the cloth is compressed (per-vertex `wrinkle`, 0..1, updated every frame) a fold
 *   normal map is blended in, so sleeves bunch at the elbow and fabric creases where it gathers.
 */
function patchFabric(mat, border, wrinkles) {
  if (!border && !wrinkles) return;
  const col = new THREE.Color((border && border.color) || '#c9a14a');
  const w = border ? border.width || 0.05 : 0;
  const wmap = wrinkles ? wrinkleNormal() : null;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uBorderColor = { value: col };
    sh.uniforms.uBorderW = { value: w };
    sh.uniforms.uWrinkleMap = { value: wmap };
    let vh =
      '#include <common>\nattribute float edge;\nattribute float wrinkle;\nvarying float vEdge;\nvarying float vWrinkle;';
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', vh)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEdge = edge;\nvWrinkle = wrinkle;');
    let fh =
      '#include <common>\nuniform vec3 uBorderColor;\nuniform float uBorderW;\nvarying float vEdge;\nvarying float vWrinkle;';
    if (wmap) fh += '\nuniform sampler2D uWrinkleMap;';
    let fs = sh.fragmentShader.replace('#include <common>', fh);
    if (border)
      fs = fs.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float bandA = 1.0 - smoothstep(uBorderW - 0.002, uBorderW, vEdge);
        float line = smoothstep(0.004, 0.0, abs(vEdge - uBorderW * 0.62)) * bandA;
        vec3 bc = mix(uBorderColor, uBorderColor * 1.35 + 0.08, line);
        diffuseColor.rgb = mix(diffuseColor.rgb, bc, bandA);`,
      );
    if (wmap)
      fs = fs.replace(
        '#include <normal_fragment_maps>',
        `
      #ifdef USE_NORMALMAP_TANGENTSPACE
        vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
        mapN.xy *= normalScale;
        vec3 mapW = texture2D( uWrinkleMap, vNormalMapUv * (0.9 / 24.0) ).xyz * 2.0 - 1.0;
        mapN.xy += mapW.xy * clamp(vWrinkle, 0.0, 1.0) * 1.1;
        diffuseColor.rgb *= 1.0 - 0.18 * clamp(vWrinkle, 0.0, 1.0) * (0.5 - 0.5 * mapW.y);
        normal = normalize( tbn * mapN );
      #else
        #include <normal_fragment_maps>
      #endif`,
      );
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => 'fab' + w.toFixed(3) + (wmap ? 'w' : '');
}

// ------------------------------------------------------------------ cloth mesh
export class ClothMesh {
  constructor(garment, mats) {
    this.g = garment;
    const r = garment.render;
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(new Float32Array(r.position), 3).setUsage(THREE.DynamicDrawUsage);
    this.nrmAttr = new THREE.BufferAttribute(new Float32Array(r.position.length), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('normal', this.nrmAttr);
    geo.setAttribute('uv', new THREE.BufferAttribute(r.uv, 2));
    geo.setAttribute('edge', new THREE.BufferAttribute(r.edge || new Float32Array(r.map.length).fill(1), 1));
    this.wrinkleAttr = new THREE.BufferAttribute(new Float32Array(r.map.length), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('wrinkle', this.wrinkleAttr);
    this.squash = new Float32Array(garment.rest.length / 3);
    this.squashN = new Float32Array(garment.rest.length / 3);
    geo.setIndex(new THREE.BufferAttribute(r.index, 1));
    this.geo = geo;
    this.group = new THREE.Group();
    this.outer = new THREE.Mesh(geo, mats.outer);
    this.group.add(this.outer);
    if (!garment.strip && mats.inner) {
      this.inner = new THREE.Mesh(geo, mats.inner);
      this.group.add(this.inner);
    }
    this.outer.castShadow = true;
    this.outer.frustumCulled = false;
    if (this.inner) this.inner.frustumCulled = false;
  }
  /** Buttons (or other small trims) that ride on the cloth. */
  addTrims(color) {
    color = color || '#d9cbb0';
    if (!this.g.trims.length) return;
    const geo = new THREE.CylinderGeometry(0.0065, 0.0065, 0.003, 14);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.2 });
    this.trimMesh = new THREE.InstancedMesh(geo, mat, this.g.trims.length);
    this.trimMesh.frustumCulled = false;
    this.group.add(this.trimMesh);
  }
  update(pos) {
    if (this.trimMesh) {
      const M = new THREE.Matrix4(),
        A = new THREE.Vector3(),
        Bv = new THREE.Vector3(),
        N = new THREE.Vector3(),
        X = new THREE.Vector3(),
        Y = new THREE.Vector3(),
        Z = new THREE.Vector3();
      this.g.trims.forEach((t, i) => {
        A.fromArray(pos, t.a * 3);
        Bv.fromArray(pos, t.b * 3);
        N.fromArray(pos, t.n * 3);
        X.subVectors(A, Bv).normalize();
        Y.subVectors(A, N).normalize();
        Z.crossVectors(X, Y).normalize();
        Y.crossVectors(Z, X);
        A.lerp(Bv, 0.5).addScaledVector(Z, 0.0035);
        M.makeBasis(X, Y, Z).setPosition(A);
        this.trimMesh.setMatrixAt(i, M);
      });
      this.trimMesh.instanceMatrix.needsUpdate = true;
    }
    copyPositions(this.g, pos, this.posAttr.array);
    computeNormals(this.g, pos, this.nrmAttr.array);
    this.updateWrinkles(pos);
    this.posAttr.needsUpdate = true;
    this.nrmAttr.needsUpdate = true;
  }
  /** Per-vertex compression (how much shorter the cloth is than at rest), smoothed over time. */
  updateWrinkles(pos) {
    const { cons, consRest, consType } = this.g,
      sq = this.squash,
      cnt = this.squashN;
    sq.fill(0);
    cnt.fill(0);
    for (let c = 0; c < consRest.length; c++) {
      if (consType[c] === 1) continue;
      const a = cons[c * 2],
        b = cons[c * 2 + 1];
      const dx = pos[b * 3] - pos[a * 3],
        dy = pos[b * 3 + 1] - pos[a * 3 + 1],
        dz = pos[b * 3 + 2] - pos[a * 3 + 2];
      const k = 1 - Math.sqrt(dx * dx + dy * dy + dz * dz) / consRest[c];
      const v = k > 0 ? k * (consType[c] === 2 ? 1.6 : 1) : 0;
      sq[a] += v;
      sq[b] += v;
      cnt[a]++;
      cnt[b]++;
    }
    const map = this.g.render.map,
      out = this.wrinkleAttr.array;
    for (let i = 0; i < map.length; i++) {
      const p = map[i];
      const target = Math.min(0.7, Math.max(0, (cnt[p] ? sq[p] / cnt[p] : 0) - 0.003) * 28);
      out[i] += (target - out[i]) * 0.2; // quick enough that wrinkles follow the fabric instead of breathing
    }
    this.wrinkleAttr.needsUpdate = true;
  }
  dispose() {
    this.geo.dispose();
  }
}

// ------------------------------------------------------------------ mannequin
const manMat = () => new THREE.MeshStandardMaterial({ color: '#ece6dd', roughness: 0.55, metalness: 0 });

function torsoGeometry(m) {
  const prof = torsoProfile(m);
  const rows = [];
  for (let i = 0; i < prof.length; i += 3) rows.push([prof[i], prof[i + 1], prof[i + 2]]);
  // close the top under the shoulders and the bottom at the crotch
  const seg = 28,
    pos = [],
    idx = [];
  const ring = (v, a, b, y) => {
    for (let s = 0; s <= seg; s++) {
      const t = (s / seg) * Math.PI * 2;
      pos.push(a * Math.sin(t), y ?? -v, b * Math.cos(t));
    }
  };
  ring(0, 0.001, 0.001, -rows[0][0] + 0.004);
  for (const r of rows) ring(r[0], r[1], r[2]);
  ring(0, 0.001, 0.001, -rows[rows.length - 1][0] - 0.02);
  const R = rows.length + 2;
  for (let r = 0; r < R - 1; r++)
    for (let s = 0; s < seg; s++) {
      const a = r * (seg + 1) + s,
        b = a + seg + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Cylinder from a to b with radii ra, rb and rounded ends (local coordinates). */
function taperedCapsule(a, b, ra, rb) {
  const A = new THREE.Vector3(...a),
    Bv = new THREE.Vector3(...b);
  const L = A.distanceTo(Bv);
  const parts = [
    new THREE.CylinderGeometry(rb, ra, L, 20, 1, true),
    new THREE.SphereGeometry(ra, 20, 14),
    new THREE.SphereGeometry(rb, 20, 14),
  ];
  parts[1].translate(0, -L / 2, 0);
  parts[2].translate(0, L / 2, 0);
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()));
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), Bv.clone().sub(A).normalize());
  g.applyQuaternion(q);
  g.translate((A.x + Bv.x) / 2, (A.y + Bv.y) / 2, (A.z + Bv.z) / 2);
  return g;
}

/** A matte display mannequin whose segments follow body frames (one mesh per body segment). */
export class Mannequin {
  constructor(m, opts = {}) {
    this.m = m;
    const mat = opts.material || manMat();
    this.material = mat;
    this.group = new THREE.Group();
    const bySeg = new Map();
    const add = (geo, seg, local) => {
      if (local) geo.applyMatrix4(local);
      const g = geo.index ? geo.toNonIndexed() : geo;
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      if (!bySeg.has(seg)) bySeg.set(seg, []);
      bySeg.get(seg).push(g);
    };
    add(torsoGeometry(m), SEG.TORSO);
    // sloped shoulders (same capsules as the colliders), neck and head
    for (const c of shoulderLine(m)) add(taperedCapsule(c.a, c.b, c.ra * 0.86, c.rb * 0.86), SEG.TORSO);
    add(
      new THREE.CylinderGeometry(m.neckR, m.neckR * 1.15, m.shoulderW * 0.36, 18),
      SEG.TORSO,
      new THREE.Matrix4().makeTranslation(0, m.shoulderW * 0.16, -0.005),
    );
    if (opts.head !== false) {
      const head = new THREE.SphereGeometry(m.headR, 28, 20);
      head.scale(0.82, 1.08, 0.92);
      add(head, SEG.TORSO, new THREE.Matrix4().makeTranslation(0, m.shoulderW * 0.62, -0.01));
    }
    const limb = (r1, r2, length, seg) => {
      const geo = new THREE.CylinderGeometry(r2, r1, length, 16, 1);
      geo.translate(0, -length / 2, 0);
      add(geo, seg);
      add(new THREE.SphereGeometry(r1, 16, 12), seg);
    };
    limb(m.upperArmR, m.upperArmR * 0.82, m.upperArm, SEG.UARM_L);
    limb(m.upperArmR, m.upperArmR * 0.82, m.upperArm, SEG.UARM_R);
    limb(m.foreArmR, m.foreArmR * 0.72, m.foreArm, SEG.FARM_L);
    limb(m.foreArmR, m.foreArmR * 0.72, m.foreArm, SEG.FARM_R);
    for (const s of [SEG.FARM_L, SEG.FARM_R]) {
      const hand = new THREE.SphereGeometry(m.foreArmR * 0.95, 14, 10);
      hand.scale(0.7, 1.5, 0.45);
      add(hand, s, new THREE.Matrix4().makeTranslation(0, -m.foreArm - 0.05, 0));
    }
    if (opts.legs !== false) {
      limb(m.thighR * 1.08, m.thighR * 0.6, m.thigh, SEG.THIGH_L);
      limb(m.thighR * 1.08, m.thighR * 0.6, m.thigh, SEG.THIGH_R);
      limb(m.shinR, m.shinR * 0.7, m.shin, SEG.SHIN_L);
      limb(m.shinR, m.shinR * 0.7, m.shin, SEG.SHIN_R);
    }
    this.parts = [];
    for (const [seg, list] of bySeg) {
      const geo = mergeGeometries(list, false);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      this.parts.push({ mesh, seg });
      this.group.add(mesh);
    }
    if (opts.stand !== false) {
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.22, 0.03, 40),
        opts.standMaterial || new THREE.MeshStandardMaterial({ color: '#2a2724', roughness: 0.4, metalness: 0.6 }),
      );
      base.receiveShadow = true;
      base.castShadow = true;
      this.base = base;
      this.group.add(base);
    }
  }
  /** Pose the segments from joints (world space). */
  pose(J, F = frames(J)) {
    const M = new THREE.Matrix4();
    for (const p of this.parts) {
      const f = F[p.seg];
      M.set(f.x[0], f.y[0], f.z[0], f.o[0], f.x[1], f.y[1], f.z[1], f.o[1], f.x[2], f.y[2], f.z[2], f.o[2], 0, 0, 0, 1);
      p.mesh.matrix.copy(M);
      p.mesh.matrixWorldNeedsUpdate = true;
    }
    if (this.base) {
      const hip = F[SEG.PELVIS].o;
      const floor = Math.min(J.lAnkle[1], J.rAnkle[1]) - 0.07;
      this.base.position.set(hip[0], floor + 0.015, hip[2]);
    }
    return F;
  }
  /** One static geometry of the posed mannequin (with an optional extra transform), for merging into the store. */
  bake(J, matrix) {
    this.pose(J);
    const list = [];
    for (const p of this.parts) {
      const g = p.mesh.geometry.clone();
      g.applyMatrix4(p.mesh.matrix);
      if (matrix) g.applyMatrix4(matrix);
      list.push(g);
    }
    return mergeGeometries(list, false);
  }
}
/** Convenience: a garment simulated on a moving body. */
export class DressedBody {
  /**
   * @param {object} garment buildGarment() result
   * @param {ClothSim} sim
   */
  constructor(garment, sim, mesh) {
    this.g = garment;
    this.sim = sim;
    this.mesh = mesh;
    this.targets = new Float32Array(garment.rest.length);
  }
  setFrames(F) {
    computeTargets(this.g, F, this.targets);
    this.sim.setTargets(this.targets);
  }
}
