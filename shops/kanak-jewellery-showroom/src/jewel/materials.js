// Materials for jewellery: polished and antique metals, a gem shader with refraction, dispersion ("fire") and
// facet scintillation, pearls, enamel, and velvet for display forms. Metals and gems reflect a jeweller's photo
// studio (neutral three-point lighting, white soft boxes), built procedurally so nothing is downloaded.
import * as THREE from 'three';

/* ---------------------------------------------------------------- the studio the jewellery reflects */
// Colour-true lighting for jewellery, the way a jeweller's photo studio lights a piece: every light is neutral white
// (about 5500 K), so the only colour in a reflection is the metal's own. A classic three-point set-up (key, fill,
// rim) plus a white bounce card in front and an overhead box, inside a neutral grey tent. Gold then reads as gold,
// rose gold as rose and white metals as white, under any tone mapping.
export const STUDIO = {
  // neutral white with the faintest warmth of studio strobes
  white: 0xfffcf7,
  key: { pos: [-6.5, 7.5, 6.5], size: [7, 5.5], power: 5.2 }, // large soft box, front left, above
  fill: { pos: [7.5, 2.5, 5.5], size: [6, 6], power: 2.0 }, // softer, front right, lower: opens the shadows
  rim: { pos: [0, 6, -8.5], size: [11, 2], power: 4.6 }, // strip box behind: bright edges that separate the piece
  rimSides: { pos: [9, 3.5, -5], size: [1.6, 8], power: 3.0 }, // two tall strips behind left and right
  top: { pos: [0, 11, 0], size: [7, 7], power: 3.2 }, // overhead box: the bright top line on rings and bangles
  card: { pos: [0, -0.5, 9.5], size: [14, 4.5], power: 1.25 }, // white bounce card in front: flat gold shows its colour
};
/** A neutral, softly lit studio tent (three-point lighting) that metals and pearls reflect. */
export function studioScene() {
  const s = new THREE.Scene();
  const L = STUDIO;
  // the tent: neutral grey, lighter above than below, so reflections are never black and never tinted
  const tent = new THREE.SphereGeometry(20, 48, 24);
  const col = [];
  const p = tent.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 20;
    const v = y > 0 ? 0.3 + 0.22 * y : 0.3 + 0.16 * y; // 0.52 at the top, 0.30 at the horizon, 0.14 below
    col.push(v, v, v);
  }
  tent.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(tent, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const box = (b, x, y, z) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(b.size[0], b.size[1]),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(L.white).multiplyScalar(b.power), side: THREE.DoubleSide }),
    );
    m.position.set(x == null ? b.pos[0] : x, y == null ? b.pos[1] : y, z == null ? b.pos[2] : z);
    m.lookAt(0, 0, 0);
    s.add(m);
    return m;
  };
  box(L.key);
  box(L.fill);
  box(L.rim);
  box(L.rimSides);
  box(L.rimSides, -L.rimSides.pos[0]);
  box(L.top);
  box(L.card);
  // two black flags low at the sides: the dark lines that give polished metal its shape
  const flag = new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(3, 7), flag);
    f.position.set(sx * 10, 0, 1.5);
    f.lookAt(0, 0, 0);
    s.add(f);
  }
  // small hard lamps: the pin-point flashes a diamond picks up in a store
  const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(L.white).multiplyScalar(40) });
  const lg = new THREE.SphereGeometry(0.22, 10, 6);
  for (const q of [
    [4, 9, 2],
    [-3, 9.5, 4],
    [0, 10, -4],
    [-7, 6, -3],
    [7, 7, 5],
    [-2, 8, 8],
    [9, 4, -6],
    [-9, 5, 6],
  ]) {
    const m = new THREE.Mesh(lg, lamp);
    m.position.set(q[0], q[1], q[2]);
    s.add(m);
  }
  return s;
}
/** The same three lights as punctual lights (directions towards the light), for crisp highlights in a scene. */
export function addStudioLights(scene, scale = 1) {
  const L = STUDIO;
  const out = [];
  for (const [b, k] of [
    [L.key, 2.2],
    [L.fill, 0.8],
    [L.rim, 1.6],
  ]) {
    const d = new THREE.DirectionalLight(L.white, k * scale);
    d.position.set(b.pos[0], b.pos[1], b.pos[2]).multiplyScalar(60);
    scene.add(d);
    out.push(d);
  }
  const hemi = new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 0.45 * scale);
  scene.add(hemi);
  out.push(hemi);
  return out;
}

/** What a diamond "sees": a bright sky and soft boxes above, a dark band low down (the viewer, the counter),
 *  which gives the black-and-white contrast pattern of a well-cut stone. */
export function gemScene() {
  const s = new THREE.Scene();
  const sky = new THREE.SphereGeometry(20, 48, 24);
  const col = [];
  const p = sky.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 20;
    const x = p.getX(i) / 20,
      z = p.getZ(i) / 20;
    const a = Math.atan2(z, x);
    let v;
    if (y > 0.3) v = 0.8 + 0.8 * Math.pow((y - 0.3) / 0.7, 0.8);
    else if (y > -0.1) v = 0.12 + 0.68 * ((y + 0.1) / 0.4);
    else v = 0.04;
    // dark panels between the lights break the light into the contrast pattern of a cut stone
    v *= Math.max(0.12, 0.55 + 0.45 * Math.cos(a * 7 + y * 4));
    c.setRGB(v, v * 0.98, v * 0.94);
    col.push(c.r, c.g, c.b);
  }
  sky.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const box = (w, h, x, y, z, int, colr) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(colr || 0xffffff).multiplyScalar(int),
        side: THREE.DoubleSide,
      }),
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  box(5, 2.5, 0, 12, 6, 9);
  box(1.6, 7, -9, 6, 2, 8);
  box(1.6, 7, 9, 5, -3, 8);
  box(6, 1.6, 3, 8, -8, 6, 0xfff1dc);
  box(2.5, 2.5, -5, 9, -6, 10);
  box(1.2, 1.2, 6, 10, 5, 14);
  box(1.2, 1.2, -7, 11, 4, 14);
  box(1.5, 4, 12, 3, 6, 5, 0xffe9cc);
  box(1.5, 4, -12, 2, -5, 5, 0xe8efff);
  return s;
}

/** Environment maps for jewellery: a PMREM (for metals and pearls) and a sharp cube map (for gems). */
export function makeJewelEnv(renderer, size) {
  const sc = studioScene();
  const pm = new THREE.PMREMGenerator(renderer);
  const pmrem = pm.fromScene(sc, 0.0).texture;
  pm.dispose();
  const rt = new THREE.WebGLCubeRenderTarget(size || 256, {
    type: THREE.HalfFloatType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
  });
  const cc = new THREE.CubeCamera(0.1, 100, rt);
  const prevTarget = renderer.getRenderTarget();
  const gs = gemScene();
  cc.update(renderer, gs);
  gs.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  renderer.setRenderTarget(prevTarget);
  sc.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  return { pmrem, cube: rt.texture, rt };
}

/* ---------------------------------------------------------------- metals */
// Base colours are the metals' reflectance (sRGB), roughness is the finish.
export const METALS = {
  y22: { n: '22K yellow gold', color: '#f3c873', rough: 0.15, purity: 0.916, rate: 'gold' },
  y18: { n: '18K yellow gold', color: '#f1d698', rough: 0.15, purity: 0.75, rate: 'gold' },
  r18: { n: '18K rose gold', color: '#f0c2ad', rough: 0.15, purity: 0.75, rate: 'gold' },
  w18: { n: '18K white gold', color: '#e8e6e0', rough: 0.12, purity: 0.75, rate: 'gold' },
  pt: { n: 'Platinum 950', color: '#dddcd9', rough: 0.13, purity: 0.95, rate: 'platinum' },
  ant: { n: '22K antique gold', color: '#e3b86c', rough: 0.32, purity: 0.916, rate: 'gold', antique: true },
  ag: { n: 'Sterling silver 925', color: '#f3f2ef', rough: 0.14, purity: 0.925, rate: 'silver' },
  // oxidised recesses behind antique and temple work (not sold as a metal option)
  ox: { n: 'Oxidised gold', color: '#6e5030', rough: 0.55, purity: 0.916, rate: 'gold', antique: true },
};
const metalCache = new Map();
export function metalMaterial(key, env, o) {
  o = o || {};
  const k = key + '|' + (o.rough || '') + '|' + (env ? env.uuid : '');
  if (metalCache.has(k)) return metalCache.get(k);
  const m = METALS[key] || METALS.y22;
  const mat = new THREE.MeshPhysicalMaterial({
    color: m.color,
    metalness: 1,
    roughness: o.rough != null ? o.rough : m.rough,
    envMap: env || null,
    envMapIntensity: m.antique ? 1.0 : 1.1,
    // antique finish: dark recesses read through a faint, rough clear layer
    clearcoat: m.antique ? 0.0 : 0.25,
    clearcoatRoughness: 0.08,
  });
  mat.name = 'metal-' + key;
  metalCache.set(k, mat);
  return mat;
}

/* ---------------------------------------------------------------- gems */
// Optical presets. tint: body colour (linear), absorb: how quickly colour deepens, ior, disp: fire.
export const GEMS = {
  diamond: { n: 'Diamond', tint: [1, 1, 1], absorb: 0.0, ior: 2.42, disp: 0.045, bril: 1.55 },
  polki: {
    n: 'Polki (uncut diamond)',
    tint: [1, 0.98, 0.95],
    absorb: 0.0,
    ior: 2.42,
    disp: 0.02,
    bril: 1.35,
    foil: 1.0,
  },
  kundan: { n: 'Kundan', tint: [1, 0.95, 0.85], absorb: 0.0, ior: 1.55, disp: 0.008, bril: 1.2, foil: 1.2 },
  ruby: { n: 'Ruby', tint: [0.86, 0.015, 0.11], absorb: 1.9, ior: 1.77, disp: 0.018, bril: 1.5 },
  emerald: { n: 'Emerald', tint: [0.02, 0.55, 0.26], absorb: 1.5, ior: 1.58, disp: 0.014, bril: 1.45 },
  sapphire: { n: 'Blue sapphire', tint: [0.05, 0.14, 0.92], absorb: 1.5, ior: 1.77, disp: 0.018, bril: 1.7 },
  pink: { n: 'Pink sapphire', tint: [1, 0.36, 0.6], absorb: 0.9, ior: 1.77, disp: 0.018, bril: 1.2 },
  yellow: { n: 'Yellow sapphire', tint: [1, 0.78, 0.12], absorb: 0.9, ior: 1.77, disp: 0.018, bril: 1.2 },
  onyx: { n: 'Black onyx', tint: [0.02, 0.02, 0.025], absorb: 4, ior: 1.54, disp: 0.0, bril: 0.25 },
  amethyst: { n: 'Amethyst', tint: [0.55, 0.18, 0.85], absorb: 1.0, ior: 1.55, disp: 0.013, bril: 1.1 },
  crystal: { n: 'Crystal', tint: [1, 1, 1], absorb: 0.0, ior: 1.6, disp: 0.03, bril: 1.05 },
  coral: { n: 'Red coral', tint: [0.9, 0.24, 0.16], absorb: 3, ior: 1.49, disp: 0.0, bril: 0.35, opaque: 0.85 },
  cat: { n: "Cat's eye", tint: [0.8, 0.66, 0.25], absorb: 1.4, ior: 1.75, disp: 0.0, bril: 0.7, opaque: 0.5 },
  hessonite: { n: 'Hessonite', tint: [0.9, 0.42, 0.08], absorb: 1.2, ior: 1.74, disp: 0.02, bril: 1.1 },
};

const GEM_VERT = /* glsl */ `
attribute float facet;
#ifdef STONE_FRAME
attribute vec3 sUp;
attribute vec3 sX;
#endif
varying vec3 vPw;
varying vec3 vNw;
varying vec3 vUpW;
varying vec3 vXw;
varying vec3 vLocal;
flat varying float vFacet;
void main() {
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = modelMatrix * instanceMatrix;
  #endif
  vec4 wp = m * vec4(position, 1.0);
  vPw = wp.xyz;
  mat3 nm = mat3(m);
  vNw = normalize(nm * normal);
  #ifdef STONE_FRAME
    // stones from a 3D model: each stone carries its own frame (table direction and an axis across it)
    vUpW = normalize(nm * sUp);
    vXw = normalize(nm * sX);
  #else
    vUpW = normalize(nm * vec3(0.0, 1.0, 0.0));
    vXw = normalize(nm * vec3(1.0, 0.0, 0.0));
  #endif
  vLocal = position;
  vFacet = facet;
  #ifdef USE_INSTANCING
    vFacet += floor(fract(instanceMatrix[3][0] * 1.31 + instanceMatrix[3][2] * 0.77 + instanceMatrix[3][1] * 0.53) * 97.0) * 211.0;
  #endif
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;

const GEM_FRAG = /* glsl */ `
uniform samplerCube envCube;
uniform vec3 tint;
uniform float absorb;
uniform float ior;
uniform float disp;
uniform float bril;
uniform float foil;
uniform float opaque;
uniform float envGain;
varying vec3 vPw;
varying vec3 vNw;
varying vec3 vUpW;
varying vec3 vXw;
varying vec3 vLocal;
flat varying float vFacet;
#include <common>
#include <logdepthbuf_pars_fragment>
float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
vec3 h3(float n) { return vec3(h1(n), h1(n + 1.73), h1(n + 3.11)) * 2.0 - 1.0; }
vec3 envAt(vec3 d) { return textureCube(envCube, d).rgb * envGain; }
// pavilion facet normal (stone frame) facing the horizontal direction of travel
vec3 pav(vec2 hz) {
  hz = normalize(hz + vec2(1e-4, 0.0));
  const float a = 0.71; // about 41 degrees, an ideal pavilion
  return normalize(vec3(hz.x * sin(a), -cos(a), hz.y * sin(a)));
}
void main() {
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vNw);
  vec3 V = normalize(cameraPosition - vPw);
  vec3 I = -V;
  float cosT = clamp(dot(n, V), 0.0, 1.0);
  float F0 = pow((ior - 1.0) / (ior + 1.0), 2.0);
  float F = F0 + (1.0 - F0) * pow(1.0 - cosT, 5.0);
  vec3 refl = envAt(reflect(I, n));
  // stone frame
  vec3 U = normalize(vUpW);
  vec3 X = normalize(vXw - U * dot(vXw, U));
  vec3 Z = cross(X, U);
  mat3 toW = mat3(X, U, Z);
  mat3 toL = transpose(toW);
  vec3 il = toL * I;
  vec3 nl = toL * n;
  vec3 jit = h3(vFacet + 0.5);
  // light path: into the crown, two pavilion bounces, out through a crown facet towards the viewer
  vec3 t = refract(il, nl, 1.0 / ior);
  if (dot(t, t) < 1e-4) t = reflect(il, nl);
  vec3 t1 = reflect(t, pav(t.xz + jit.xz * 0.6));
  vec3 t2 = reflect(t1, pav(t1.xz - jit.zx * 0.6));
  if (t2.y < 0.0) t2.y = -t2.y;
  vec3 cn = normalize(vec3(0.0, 1.0, 0.0) + vec3(jit.x, 0.0, jit.z) * 0.85);
  vec3 eR = refract(t2, -cn, ior * (1.0 - disp));
  vec3 eG = refract(t2, -cn, ior);
  vec3 eB = refract(t2, -cn, ior * (1.0 + disp));
  vec3 fb = reflect(t2, cn); // total internal reflection: light leaks around again
  if (dot(eR, eR) < 1e-4) eR = fb;
  if (dot(eG, eG) < 1e-4) eG = fb;
  if (dot(eB, eB) < 1e-4) eB = fb;
  // light mostly enters from above: bias the exit rays towards the lit upper half of the room
  vec3 lift = vec3(0.0, 0.5, 0.0);
  vec3 inner = vec3(envAt(normalize(toW * eR + lift)).r, envAt(normalize(toW * eG + lift)).g, envAt(normalize(toW * eB + lift)).b);
  // foil-backed stones (polki, kundan) mirror the room off a flat backing
  if (foil > 0.0) {
    // the foil is a crumpled mirror: it sends light from above back out through the stone
    vec3 fr = normalize(toW * reflect(t, normalize(vec3(0.0, 1.0, 0.0) + jit * 0.3)) + vec3(0.0, 0.9, 0.0));
    inner = mix(inner, envAt(fr) * vec3(1.0, 0.95, 0.84) * 1.25, clamp(foil * 0.65, 0.0, 1.0));
  }
  // body colour deepens with the path length through the stone
  float path = 1.0 + 1.5 * (1.0 - cosT) + 0.5 * h1(vFacet * 0.37);
  vec3 body = pow(tint, vec3(max(0.6, absorb * path * 0.9 + 0.5)));
  float coloured = step(0.001, absorb);
  body = mix(vec3(1.0), body, coloured);
  // coloured stones: keep the light inside the stone below the point where tone mapping bleaches it to white
  float lum = dot(inner, vec3(0.2126, 0.7152, 0.0722));
  inner = mix(inner, inner / (1.0 + lum * 0.6), coloured);
  vec3 col = refl * F + inner * body * bril * (1.0 - F) + tint * coloured * 0.04;
  // opaque stones (coral, cat's eye): a waxy body
  col = mix(col, tint * (0.15 + 0.55 * max(0.0, dot(n, normalize(vec3(0.3, 1.0, 0.4))))) + refl * F * 0.8, opaque);
  gl_FragColor = vec4(min(col, vec3(6.0)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const gemCache = new Map();
/**
 * Shader material for a gem kind. One material per kind, shared by every instance.
 * frame: the stones carry their own frames per vertex (imported 3D models) instead of an instance matrix.
 */
export function gemMaterial(kind, cube, frame) {
  const k = kind + '|' + (cube ? cube.uuid : '') + (frame ? '|f' : '');
  if (gemCache.has(k)) return gemCache.get(k);
  const g = GEMS[kind] || GEMS.diamond;
  const mat = new THREE.ShaderMaterial({
    name: 'gem-' + kind,
    uniforms: {
      envCube: { value: cube },
      tint: { value: new THREE.Vector3(...g.tint) },
      absorb: { value: g.absorb },
      ior: { value: g.ior },
      disp: { value: g.disp },
      bril: { value: g.bril },
      foil: { value: g.foil || 0 },
      opaque: { value: g.opaque || 0 },
      envGain: { value: 1 },
    },
    vertexShader: GEM_VERT,
    fragmentShader: GEM_FRAG,
  });
  if (frame) mat.defines = { STONE_FRAME: '' };
  gemCache.set(k, mat);
  return mat;
}

/* ---------------------------------------------------------------- pearls, enamel, velvet */
export const PEARLS = {
  white: { n: 'White pearl', color: '#f3eee4', iri: 0.55 },
  cream: { n: 'Cream pearl', color: '#f1e4c8', iri: 0.5 },
  gold: { n: 'Golden pearl', color: '#e9c98e', iri: 0.45 },
  black: { n: 'Tahitian pearl', color: '#3a3a40', iri: 0.75 },
  pink: { n: 'Pink pearl', color: '#f2d6cf', iri: 0.6 },
};
const pearlCache = new Map();
export function pearlMaterial(kind, env) {
  const k = kind + '|' + (env ? env.uuid : '');
  if (pearlCache.has(k)) return pearlCache.get(k);
  const p = PEARLS[kind] || PEARLS.white;
  const mat = new THREE.MeshPhysicalMaterial({
    color: p.color,
    roughness: 0.32,
    metalness: 0.0,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    sheen: 0.6,
    sheenColor: new THREE.Color('#ffe9f0'),
    sheenRoughness: 0.4,
    iridescence: p.iri,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [180, 420],
    envMap: env || null,
    envMapIntensity: 1.1,
  });
  mat.name = 'pearl-' + kind;
  pearlCache.set(k, mat);
  return mat;
}
export const ENAMELS = {
  red: '#b3142e',
  green: '#0f6b3c',
  blue: '#163c8c',
  white: '#f2efe8',
  pink: '#d4577f',
  black: '#141414',
};
const enamelCache = new Map();
export function enamelMaterial(kind, env) {
  const k = kind + '|' + (env ? env.uuid : '');
  if (enamelCache.has(k)) return enamelCache.get(k);
  const mat = new THREE.MeshPhysicalMaterial({
    color: ENAMELS[kind] || kind,
    roughness: 0.25,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMap: env || null,
    envMapIntensity: 1,
  });
  mat.name = 'enamel-' + kind;
  enamelCache.set(k, mat);
  return mat;
}
/** Velvet for display busts, trays and ring cones. */
export function velvetMaterial(color, o) {
  o = o || {};
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.92,
    metalness: 0,
    sheen: 1,
    sheenRoughness: o.sheenRough || 0.42,
    sheenColor: new THREE.Color(o.sheen || color).lerp(new THREE.Color('#ffffff'), 0.35),
    envMapIntensity: o.env == null ? 0.5 : o.env,
  });
}
