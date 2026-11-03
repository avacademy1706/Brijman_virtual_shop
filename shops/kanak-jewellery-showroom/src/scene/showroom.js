// The walkable 3D boutique: architecture, jewellery on its stands, lighting, reflections, bloom and sparkle,
// the walk planner, input, labels and the product viewer used in the product sheet.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { NY } from '../core/ny.js';
import { Batcher } from './batch.js';
import { buildBoutique } from './boutique.js';
import { stand } from './displays.js';
import * as TX from './textures.js';
import { Kit, appendKit, realize } from '../jewel/kit.js';
import { pieceKit as sourceKit } from '../jewel/source.js';
import { makeJewelEnv, velvetMaterial } from '../jewel/materials.js';
import { makeSparkle } from '../jewel/sparkle.js';
import { JewelStage } from '../jewel/stage.js';

start().catch((err) => {
  console.error(err);
  if (NY && NY.fail3D) NY.fail3D(err);
});

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

async function start() {
  if (!NY || !NY.L) throw new Error('Boutique data missing');
  const L = NY.L,
    EYE = 1.6;
  const V2 = THREE.Vector2,
    V3 = THREE.Vector3;
  const RM = !!NY.reduceMotion;
  const canvas = document.getElementById('scene');
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const progress = (t) => NY.onBuildProgress && NY.onBuildProgress(t);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    NY.fail3D(e);
    return;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Khronos PBR Neutral keeps the jewellery's colours true (ACES pushes yellow gold towards orange)
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  const aniso = renderer.capabilities.getMaxAnisotropy();

  try {
    await Promise.race([
      Promise.all([document.fonts.load('600 64px "Cormorant Garamond"'), document.fonts.load('500 24px "Jost"')]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch (e) {
    /* fonts optional */
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1a1410');
  const camera = new THREE.PerspectiveCamera(60, 1, 0.02, 80);
  camera.rotation.order = 'YXZ';

  /* ------------------------------------------------------------------
     Textures and materials
     ------------------------------------------------------------------ */
  progress('Polishing the marble…');
  await nextFrame();
  const tex = {
    floorRot: TX.texRotundaFloor(L.R + 0.6, aniso),
    statuario: TX.texMarble(Object.assign({ size: 512 }, TX.MARBLE.statuario), aniso),
    nero: TX.texMarble(Object.assign({ size: 256 }, TX.MARBLE.nero), aniso),
    soft: TX.texSoftRound(),
    softRect: TX.texSoftRect(),
    cone: TX.texCone(),
    board: TX.rateBoard(aniso),
    dusk: TX.texDusk(),
  };
  // foyer floor: Statuario and Nero laid on the diagonal
  {
    const S = 512,
      c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.drawImage(tex.statuario.image, 0, 0, S, S);
    g.save();
    g.translate(S / 2, S / 2);
    g.rotate(Math.PI / 4);
    g.drawImage(tex.nero.image, -S * 0.18, -S * 0.18, S * 0.36, S * 0.36);
    g.restore();
    for (const [x, y] of [
      [0, 0],
      [S, 0],
      [0, S],
      [S, S],
    ]) {
      g.save();
      g.translate(x, y);
      g.rotate(Math.PI / 4);
      g.drawImage(tex.nero.image, -S * 0.18, -S * 0.18, S * 0.36, S * 0.36);
      g.restore();
    }
    g.strokeStyle = '#c9a458';
    g.lineWidth = 3;
    g.strokeRect(0, 0, S, S);
    tex.foyerFloor = TX.ctex(c, {}, aniso);
  }
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const basic = (o) => new THREE.MeshBasicMaterial(o);
  const add = (o) =>
    basic(
      Object.assign({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }, o),
    );
  const shadowMat = (map, opacity) =>
    basic({
      map,
      color: 0x000000,
      transparent: true,
      opacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
  const domeTex = (() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 512;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#fff4dc');
    gr.addColorStop(0.25, '#f2e2c5');
    gr.addColorStop(0.5, '#e8d6b8');
    gr.addColorStop(1, '#d9c3a0');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 512);
    // painted coffer rings
    g.strokeStyle = 'rgba(176,138,76,.55)';
    for (let y = 70; y < 512; y += 62) {
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(64, y);
      g.stroke();
    }
    return TX.ctex(c, { repeat: false }, aniso);
  })();
  const M = {
    floorRot: std({ map: tex.floorRot, roughness: 0.12, metalness: 0 }),
    foyerFloor: std({ map: tex.foyerFloor, roughness: 0.14 }),
    statuarioTop: std({ map: tex.statuario, roughness: 0.1 }),
    nero: std({ map: tex.nero, roughness: 0.14 }),
    wall: std({ color: '#efe6d6', roughness: 0.85 }),
    wallTrim: std({ color: '#f5eee2', roughness: 0.6 }),
    wallFlute: std({ color: '#e6dccb', roughness: 0.7 }),
    dome: std({
      map: domeTex,
      emissiveMap: domeTex,
      emissive: '#ffffff',
      emissiveIntensity: 0.32,
      roughness: 0.9,
      side: THREE.BackSide,
    }),
    ceil: std({
      color: '#f1e8d9',
      roughness: 0.9,
      emissive: '#f1e8d9',
      emissiveIntensity: 0.18,
      side: THREE.DoubleSide,
    }),
    gold: std({ color: '#d6ac5a', roughness: 0.22, metalness: 1 }),
    lacquer: std({ color: '#2a1c14', roughness: 0.3, metalness: 0.1 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.07,
      roughness: 0.02,
      metalness: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      envMapIntensity: 1.4,
    }),
    glow: basic({ color: new THREE.Color('#fff1d6').multiplyScalar(3), toneMapped: false }),
    glowSoft: basic({ color: new THREE.Color('#ffe6bf').multiplyScalar(1.6), toneMapped: false }),
    bulb: basic({ color: new THREE.Color('#fff0d0').multiplyScalar(5), toneMapped: false }),
    candle: std({ color: '#f6efe2', roughness: 0.5 }),
    sky: basic({ color: new THREE.Color('#fff2dc').multiplyScalar(2.2), toneMapped: false }),
    pool: add({ map: tex.soft, color: '#ffe3b5', opacity: 0.35 }),
    poolFloor: add({ map: tex.soft, color: '#ffd9a0', opacity: 0.22 }),
    poolWall: add({ map: tex.soft, color: '#ffd59a', opacity: 0.32 }),
    shRect: shadowMat(tex.softRect, 0.45),
    shRound: shadowMat(tex.soft, 0.45),
    board: basic({ map: tex.board }),
    dusk: basic({ map: tex.dusk }),
    pavement: std({ color: '#2b2622', roughness: 0.7 }),
    lampShade: std({
      color: '#f3e6cc',
      roughness: 0.8,
      side: THREE.DoubleSide,
      emissive: '#ffd9a0',
      emissiveIntensity: 0.6,
    }),
    petal: std({ color: '#fbf7f2', roughness: 0.6 }),
    stem: std({ color: '#4d6b3a', roughness: 0.7 }),
    rose: std({ color: '#8f1027', roughness: 0.55 }),
    rug: std({ map: TX.texCarpet('#5b1a22', '#c49a55', aniso), roughness: 1 }),
    drape: velvetMaterial('#5a2338', { sheen: '#c58aa0' }),
    sofa: velvetMaterial('#5d2a40', { sheen: '#d3a0b6' }),
    sofaCushion: velvetMaterial('#6b3149', { sheen: '#e0b2c4' }),
    mirror: std({ color: '#e9e6e1', roughness: 0.03, metalness: 1, envMapIntensity: 1.2 }),
    mirrorDecor: std({ color: '#d8d2c8', roughness: 0.06, metalness: 1 }),
    velvet_rotunda: velvetMaterial('#1a1310', { sheen: '#7a5f45' }),
    wall_lounge: std({ color: '#ecd6cd', roughness: 0.85 }),
    velvet_lounge: velvetMaterial('#4a1d31', { sheen: '#c78fa6' }),
    carpet_lounge: std({ map: TX.texCarpet('#d9b9ae', '#f3e3d8', aniso), roughness: 1 }),
  };
  for (const z of NY.ZONES) {
    if (!z.colors || z.id === 'lounge') continue;
    M['wall_' + z.id] = std({ color: z.colors.wall, roughness: 0.85 });
    M['velvet_' + z.id] = velvetMaterial(z.colors.velvet, { sheen: z.colors.accent });
    const base = new THREE.Color(z.colors.velvet).lerp(new THREE.Color('#2a2420'), 0.25).getStyle();
    M['carpet_' + z.id] = std({ map: TX.texCarpet(base, z.colors.accent, aniso), roughness: 1 });
  }
  const BATCH = {
    glass: { solid: false, order: 5 },
    glow: { solid: false },
    glowSoft: { solid: false },
    bulb: { solid: false },
    sky: { solid: false },
    pool: { solid: false, order: 3 },
    poolFloor: { solid: false, order: 2 },
    poolWall: { solid: false, order: 3 },
    shRect: { solid: false, order: 1 },
    shRound: { solid: false, order: 1 },
    ceil: { solid: false },
    dome: { solid: false },
    dusk: { solid: false },
    pavement: { solid: false },
    floorRot: { solid: false },
    foyerFloor: { solid: false },
    rug: { solid: false },
    carpet_lounge: { solid: false },
    drape: { solid: false },
    board: { solid: false },
  };
  for (const z of NY.ZONES) if (z.colors) BATCH['carpet_' + z.id] = { solid: false };
  const B = new Batcher(scene, M, BATCH);

  /* ------------------------------------------------------------------
     Architecture
     ------------------------------------------------------------------ */
  progress('Raising the dome…');
  await nextFrame();
  const built = buildBoutique({ B, coarse });
  // signage over the arches
  for (const s of built.signs) {
    const c = TX.textCanvas(s.text, {
      w: 1024,
      h: Math.round((1024 * s.h) / s.w),
      track: s.track,
      size: s.size ? Math.round(((1024 * s.h) / s.w) * s.size) : null,
    });
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(s.w, s.h),
      basic({ map: TX.ctex(c, { repeat: false }, aniso), transparent: true, depthWrite: false }),
    );
    m.applyMatrix4(s.m);
    m.renderOrder = 2;
    scene.add(m);
  }

  /* ------------------------------------------------------------------
     Jewellery on its stands
     ------------------------------------------------------------------ */
  progress('Setting out the jewellery…');
  await nextFrame();
  const jenv = makeJewelEnv(renderer, coarse ? 128 : 256);
  const Q = coarse ? 0.25 : 0.35;
  const kitCache = new Map();
  // a piece's kit: the client's 3D model when there is one (the light store file), otherwise built here
  const pieceKit = async (p, cfg, q, which) => {
    const bc = NY.buildCfg(p, cfg);
    const key = p.id + '|' + q + '|' + (which || '') + '|' + JSON.stringify(bc);
    let e = kitCache.get(key);
    if (!e) {
      const kit = await sourceKit(p, bc, q, which || 'store');
      e = { kit, bounds: kit.bounds() };
      kitCache.set(key, e);
    }
    return e;
  };
  const cfgFor = (item) => {
    const p = NY.byId[item[0]];
    const cfg = NY.defaultCfg(p);
    if (item[1]) cfg.metal = item[1];
    if (item[2]) Object.assign(cfg.stones, item[2]);
    return { p, cfg };
  };
  const roomKits = new Map();
  /** How much larger than life a piece is shown. Busts only grow in the roomy wall niches. */
  const showScale = (type, mode) => {
    if (type === 'necklace' || type === 'pendant') return mode === 'niche' ? 1.3 : 1;
    return mode === 'niche' ? 1.3 : 1.45;
  };
  const records = [];
  const pickProxies = [];
  const hitMat = basic({ visible: false });
  const velvetKey = (zone) => (M['velvet_' + zone] ? 'velvet_' + zone : 'velvet_rotunda');
  let n = 0;
  for (const s of built.slots) {
    if (!s.item) continue;
    const { p, cfg } = cfgFor(s.item);
    const e = await pieceKit(p, cfg, p.type === 'necklace' ? Q * 0.9 : Q);
    // display scale: small pieces (and the busts in the wall niches) are shown a little larger than life, the
    // way a showcase presents them, so their metal and stones read clearly from where the visitor stands
    const k = showScale(p.type, s.mode);
    const frame = s.frame.clone().multiply(new THREE.Matrix4().makeScale(k, k, k));
    B.pushM(frame);
    const local = stand(B, { type: p.type, bounds: e.bounds, anchors: e.kit.anchors, coarse }, s.mode, {
      gold: 'gold',
      velvet: velvetKey(s.zone),
    });
    B.pop();
    const world = frame.clone().multiply(local);
    let rk = roomKits.get(s.zone);
    if (!rk) roomKits.set(s.zone, (rk = new Kit()));
    appendKit(rk, e.kit, world, { metal: cfg.metal, stones: NY.stonesFor(p, cfg), whiteClaws: p.whiteClaws });
    // a pick box around the piece, at least 7 cm so small pieces are easy to tap
    const bb = e.bounds.clone().applyMatrix4(world);
    const c = bb.getCenter(new V3()),
      sz = bb.getSize(new V3());
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.07, sz.x), Math.max(0.07, sz.y), Math.max(0.07, sz.z)),
      hitMat,
    );
    box.position.copy(c);
    box.updateMatrixWorld(true);
    const facing = new V3(0, 0, 1).transformDirection(s.frame);
    const rec = { pid: p.id, cfg, center: c, zone: s.zone, facing, kind: s.mode };
    box.userData.rec = rec;
    pickProxies.push(box);
    records.push(rec);
    if (++n % 12 === 0) await nextFrame();
  }
  B.flush();
  const solids = B.solids;
  const jewellery = new THREE.Group();
  jewellery.name = 'jewellery';
  scene.add(jewellery);
  const glints = [];
  for (const [zone, rk] of roomKits) {
    const g = realize(rk, { env: jenv, pearlDetail: coarse ? 8 : 12 });
    g.name = 'jewellery-' + zone;
    jewellery.add(g);
    for (const gl of g.userData.glints) if (gl.size > 0.0015) glints.push(gl);
    await nextFrame();
  }
  // chandelier crystals
  const crystals = realize(built.chandelier, { env: jenv });
  scene.add(crystals);
  for (const gl of crystals.userData.glints) glints.push(gl);
  // the signature piece turning on the plinth
  const hero = new THREE.Group();
  hero.position.set(0, built.hero.y, 0);
  scene.add(hero);
  {
    const { p, cfg } = cfgFor(built.hero.item);
    const e = await pieceKit(p, cfg, coarse ? 0.4 : 0.6, 'full');
    const bustB = new Batcher(hero, { velvet: M.velvet_rotunda }, {});
    const local = stand(bustB, { type: p.type, bounds: e.bounds, anchors: e.kit.anchors, coarse }, 'pillar', {
      gold: 'velvet',
      velvet: 'velvet',
    });
    bustB.flush();
    const g = realize(e.kit, {
      env: jenv,
      metal: cfg.metal,
      stones: NY.stonesFor(p, cfg),
      pearlDetail: coarse ? 10 : 16,
    });
    g.applyMatrix4(local);
    hero.add(g);
    const sp = makeSparkle(
      g.userData.glints.map((x) => ({ pos: x.pos.clone().applyMatrix4(local), size: x.size * 0.001, up: x.up })),
      { maxPx: 24, minPx: 3, gain: 0.75 },
    );
    hero.add(sp);
    hero.userData.sparkle = sp;
    const turn = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.02, 48), M.velvet_rotunda);
    turn.position.y = 0.0;
    hero.add(turn);
    const bb = e.bounds.clone().applyMatrix4(local);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.5), hitMat);
    box.position.set(0, built.hero.y + (bb.min.y + bb.max.y) / 2, 0);
    box.updateMatrixWorld(true);
    const rec = {
      pid: p.id,
      cfg,
      center: box.position.clone(),
      zone: 'rotunda',
      facing: new V3(0, 0, 1),
      kind: 'hero',
    };
    box.userData.rec = rec;
    pickProxies.push(box);
    records.push(rec);
  }
  const sparkle = makeSparkle(glints, { maxPx: coarse ? 16 : 20, minPx: 2.5, gain: 0.65 });
  scene.add(sparkle);
  kitCache.clear();

  /* ------------------------------------------------------------------
     Light: environment, lamps, cones of light, dust in the beam
     ------------------------------------------------------------------ */
  progress('Lighting the chandelier…');
  await nextFrame();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environmentIntensity = 0.42;
  scene.add(new THREE.HemisphereLight(0xfff6ec, 0x3b342e, coarse ? 0.9 : 0.6));
  const key = new THREE.DirectionalLight(0xfff6ec, 0.45);
  key.position.set(2, 10, 3);
  scene.add(key);
  const lamps = [];
  for (const l of built.lights) {
    const strong = l.kind === 'chandelier';
    const pl = new THREE.PointLight(strong ? 0xffe6c8 : 0xffedd8, strong ? 42 : 12, strong ? 0 : 7.5, 2);
    if (l.pos.length === 4) pl.position.set(l.pos[0], l.pos[2], l.pos[1]);
    else pl.position.set(l.pos[0], l.pos[1], l.pos[2]);
    pl.userData.kind = l.kind;
    scene.add(pl);
    lamps.push(pl);
  }
  for (const c of built.cones) {
    const h = c.top[1] - c.bottom[1];
    const g = new THREE.CylinderGeometry(c.r0, c.r1, h, 40, 1, true);
    const m = new THREE.Mesh(g, add({ map: tex.cone, color: '#ffe2b0', opacity: 0.09, side: THREE.DoubleSide }));
    m.position.set(c.top[0], (c.top[1] + c.bottom[1]) / 2, c.top[2]);
    m.renderOrder = 6;
    scene.add(m);
  }
  // dust motes drifting in the beam over the plinth
  const motes = (() => {
    const N = coarse ? 70 : 140;
    const pos = new Float32Array(N * 3),
      seed = new Float32Array(N);
    const r = TX.rng(17);
    for (let i = 0; i < N; i++) {
      const a = r() * Math.PI * 2,
        d = Math.sqrt(r()) * 0.75;
      pos[i * 3] = Math.cos(a) * d;
      pos[i * 3 + 1] = r();
      pos[i * 3 + 2] = Math.sin(a) * d;
      seed[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, map: { value: tex.soft } },
      vertexShader: `attribute float seed; uniform float time; varying float vA;
        void main(){ vec3 p = position; float t = fract(p.y + time * (0.012 + seed * 0.02));
        p.y = 1.9 + t * 3.6; p.x += sin(time * 0.3 + seed * 20.0) * 0.06; p.z += cos(time * 0.25 + seed * 13.0) * 0.06;
        vA = sin(t * 3.14159) * (0.4 + 0.6 * seed);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (2.0 + seed * 3.0) * (6.0 / -mv.z); }`,
      fragmentShader: `uniform sampler2D map; varying float vA; void main(){ float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(vec3(1.0, 0.92, 0.78) * a * vA * 0.9, 1.0); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    return pts;
  })();

  /* ------------------------------------------------------------------
     Polished marble: planar reflection blended over the rotunda and foyer floors
     ------------------------------------------------------------------ */
  let reflector = null;
  function makeReflector() {
    const shapes = built.reflect.map((poly) => new THREE.Shape(poly.map(([x, z]) => new V2(x, -z))));
    const geo = new THREE.ShapeGeometry(shapes);
    const r = new Reflector(geo, {
      textureWidth: 512,
      textureHeight: 512,
      clipBias: 0.003,
      multisample: 0,
      shader: {
        name: 'MarbleReflection',
        uniforms: {
          color: { value: null },
          tDiffuse: { value: null },
          textureMatrix: { value: null },
          strength: { value: 0.2 },
          texel: { value: new V2(1 / 512, 1 / 512) },
        },
        vertexShader: /* glsl */ `
          uniform mat4 textureMatrix;
          varying vec4 vUv;
          #include <common>
          #include <logdepthbuf_pars_vertex>
          void main() {
            vUv = textureMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            #include <logdepthbuf_vertex>
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D tDiffuse;
          uniform float strength;
          uniform vec2 texel;
          varying vec4 vUv;
          #include <logdepthbuf_pars_fragment>
          void main() {
            #include <logdepthbuf_fragment>
            vec2 uv = vUv.xy / vUv.w;
            vec3 c = texture2D(tDiffuse, uv).rgb * 0.36;
            c += texture2D(tDiffuse, uv + vec2(texel.x * 2.0, 0.0)).rgb * 0.16;
            c += texture2D(tDiffuse, uv - vec2(texel.x * 2.0, 0.0)).rgb * 0.16;
            c += texture2D(tDiffuse, uv + vec2(0.0, texel.y * 2.0)).rgb * 0.16;
            c += texture2D(tDiffuse, uv - vec2(0.0, texel.y * 2.0)).rgb * 0.16;
            gl_FragColor = vec4(c, strength);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      },
    });
    r.material.transparent = true;
    r.material.depthWrite = false;
    r.rotation.x = -Math.PI / 2;
    r.position.y = 0.003;
    r.renderOrder = 1;
    r.name = 'reflection';
    return r;
  }

  /* ------------------------------------------------------------------
     Post-processing: bloom on the brightest highlights
     ------------------------------------------------------------------ */
  let composer = null,
    bloom = null;
  function setupPost(on, samples) {
    if (composer) {
      composer.dispose();
      composer = null;
      bloom = null;
    }
    if (!on) return;
    const size = renderer.getDrawingBufferSize(new V2());
    const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
      type: THREE.HalfFloatType,
      samples,
    });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(
      new V2(Math.max(1, size.x / 2), Math.max(1, size.y / 2)),
      coarse ? 0.3 : 0.38,
      0.42,
      1.05,
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  /* ------------------------------------------------------------------
     Walk planner: grid, A*, smoothing
     ------------------------------------------------------------------ */
  // Where the visitor may stand: inside a room, BODY_R clear of everything built between ankle and head height
  // (walls, cases, counters, the plinth, furniture), out of the fixture footprints in NY.OBS and the keep-out
  // areas in NY.NO_GO (behind the counters and the concierge desk), and reachable from the entrance.
  const BODY_R = 0.32;
  const BD = NY.BOUNDS;
  const NAV = (() => {
    const t0 = performance.now();
    const cell = 0.1,
      R = BODY_R,
      W = BD.x1 - BD.x0,
      D = BD.z1 - BD.z0,
      cols = Math.round(W / cell),
      rows = Math.round(D / cell),
      blocked = new Uint8Array(cols * rows);
    const inPoly = NY.inPoly;
    const distSeg = (px, pz, a, b) => {
      const dx = b[0] - a[0],
        dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz || 1)));
      return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
    };
    const nearPoly = (x, z, pts, r) => {
      if (inPoly(x, z, pts)) return true;
      for (let i = 0; i < pts.length; i++) if (distSeg(x, z, pts[i], pts[(i + 1) % pts.length]) < r) return true;
      return false;
    };
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = BD.x0 + (c + 0.5) * cell,
          z = BD.z0 + (r + 0.5) * cell;
        let b = false;
        for (const o of NY.NO_GO)
          if (inPoly(x, z, o.pts)) {
            b = true;
            break;
          }
        if (!b)
          for (const o of NY.OBS) {
            if (o.t === 'c' ? (x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + R) ** 2 : nearPoly(x, z, o.pts, R)) {
              b = true;
              break;
            }
          }
        blocked[r * cols + c] = b ? 1 : 0;
      }
    // fine occupancy: outside the rooms, plus solid geometry between ankle and head height
    const fc = 0.05,
      fcols = Math.ceil(W / fc),
      frows = Math.ceil(D / fc),
      occ = new Uint8Array(fcols * frows);
    for (let fz = 0; fz < frows; fz++)
      for (let fx = 0; fx < fcols; fx++) {
        const x = BD.x0 + (fx + 0.5) * fc,
          z = BD.z0 + (fz + 0.5) * fc;
        if (!NY.inside(x, z)) occ[fz * fcols + fx] = 1;
      }
    const yLo = 0.12,
      yHi = EYE + 0.15;
    const markXZ = (x, z) => {
      const fx = Math.floor((x - BD.x0) / fc),
        fz = Math.floor((z - BD.z0) / fc);
      if (fx >= 0 && fz >= 0 && fx < fcols && fz < frows) occ[fz * fcols + fx] = 1;
    };
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
        for (let i = 0; i < poly.length; i++) {
          const p = poly[i],
            q = poly[(i + 1) % poly.length];
          const m = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[2] - p[2]) / (fc * 0.7)));
          for (let j = 0; j <= m; j++) markXZ(p[0] + ((q[0] - p[0]) * j) / m, p[2] + ((q[2] - p[2]) * j) / m);
        }
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
        for (let fz = Math.floor((z0 - BD.z0) / fc); fz <= Math.floor((z1 - BD.z0) / fc); fz++)
          for (let fx = Math.floor((x0 - BD.x0) / fc); fx <= Math.floor((x1 - BD.x0) / fc); fx++) {
            const x = BD.x0 + (fx + 0.5) * fc,
              z = BD.z0 + (fz + 0.5) * fc;
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
    // pockets that cannot be reached from the entrance are blocked too
    {
      const seen = new Uint8Array(cols * rows);
      const isFree = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && !blocked[r * cols + c];
      const c0 = Math.floor((NY.START.x - BD.x0) / cell);
      let r0 = Math.floor((NY.START.z - BD.z0) / cell);
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
  const cellOf = (x, z) => [Math.floor((x - BD.x0) / NAV.cell), Math.floor((z - BD.z0) / NAV.cell)];
  const free = (c, r) => c >= 0 && r >= 0 && c < NAV.cols && r < NAV.rows && !NAV.blocked[r * NAV.cols + c];
  const freeAt = (x, z) => {
    const q = cellOf(x, z);
    return free(q[0], q[1]);
  };
  const centerOf = (c, r) => new V2(BD.x0 + (c + 0.5) * NAV.cell, BD.z0 + (r + 0.5) * NAV.cell);
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
      const n2 = nearestFree(a.x, a.y);
      if (!n2) return null;
      s = cellOf(n2.x, n2.y);
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
    x: NY.START.x,
    z: NY.START.z,
    yaw: 0,
    pitch: -0.04,
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
    return { yaw: Math.atan2(-dx, -dz), pitch: Math.max(-0.95, Math.min(0.75, Math.atan2(dy, Math.hypot(dx, dz)))) };
  }
  const markMat = basic({ color: '#d4b16a', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.21, 48).rotateX(-Math.PI / 2), markMat);
  ring.visible = false;
  ring.renderOrder = 8;
  scene.add(ring);
  const dest = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.23, 48).rotateX(-Math.PI / 2),
    basic({ color: '#d4b16a', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }),
  );
  dest.visible = false;
  dest.renderOrder = 8;
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
  const LOOK_SPEED = { slow: 0.45, normal: 0.7, fast: 1 };
  const lookSpeed = () => LOOK_SPEED[(NY.settings && NY.settings.look) || 'normal'] || LOOK_SPEED.normal;
  const DRAG_PX = { mouse: 8, pen: 10, touch: 14 };
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
      T: Math.min(5.5, Math.max(0.8, len / 1.8)),
      look: endLook,
      turn: null,
    });
    dest.position.set(end.x, 0.014, end.y);
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
  const hitboxes = B.hitboxes;
  const pickables = pickProxies.concat(hitboxes);
  const floors = scene.children.filter((o) => o.isMesh && /^batch-(floorRot|foyerFloor|carpet_|rug)/.test(o.name));
  const allHits = pickables.concat(solids, floors);
  const recOf = (hit) => (hit && hit.object.userData.rec) || null;
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
      zoom = Math.max(0.3, Math.min(1.15, (pinch.z * pinch.d) / Math.max(10, pdist())));
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
        nav.pitch = Math.max(-1.0, Math.min(0.85, nav.pitch + dy * k));
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
      zoom = Math.max(0.3, Math.min(1.15, zoom * Math.exp(e.deltaY * 0.0012)));
      kick();
    },
    { passive: false },
  );
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function tap(cx, cy, type) {
    setRay(cx, cy);
    const hit = ray.intersectObjects(allHits, false)[0];
    if (!hit) return;
    const o = hit.object;
    const rec = recOf(hit);
    if (rec) {
      if (NY.onProductTap) {
        nav.turn = yawPitch(nav.x, nav.z, rec.center);
        kick();
        NY.onProductTap(rec.pid, rec.cfg, { at: { x: rec.center.x, z: rec.center.z, zone: rec.zone || null } });
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
    if (floors.indexOf(o) < 0 && hit.point.y > 0.05) {
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
        dest.position.set(end.x, 0.014, end.y);
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
    rates: '<b>Today’s rates</b>Click to see how prices are worked out',
    appointment: '<b>Concierge</b>Click to book a private viewing',
    tryon: '<b>Try-on mirror</b>Click to try jewellery on with your camera',
    sets: '<b>Bridal sets</b>Click to see the complete sets',
  };
  function tipFor(rec) {
    const p = NY.byId[rec.pid];
    return (
      '<b>' +
      esc(p.name) +
      '</b>' +
      esc(NY.METAL[rec.cfg.metal].short) +
      ' · from ' +
      NY.money(NY.priceOf(p, rec.cfg).total)
    );
  }
  function showTip(cx, cy, html) {
    const r = appEl.getBoundingClientRect();
    tipEl.innerHTML = html;
    tipEl.hidden = false;
    const x = Math.min(cx - r.left, r.width - 260),
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
    let hit = ray.intersectObjects(pickables, false)[0];
    if (hit) {
      const occ = ray.intersectObjects(solids, false)[0];
      if (occ && occ.distance < hit.distance - 0.05) hit = null;
    }
    const rec = recOf(hit);
    const feat = hit && hit.object.userData.action ? hit.object.userData.action : null;
    const featTip =
      feat &&
      (FEATURE_TIPS[feat] ||
        (feat.startsWith('browse:')
          ? '<b>' + esc((NY.zoneById(feat.slice(7)) || {}).name || '') + '</b>Click to browse this counter'
          : null));
    setHover(rec);
    if (rec || featTip) {
      showTip(cx, cy, rec ? tipFor(rec) : featTip);
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
          ring.position.set(x, 0.014, z);
          ring.visible = true;
        }
      }
    }
    kick(150);
  }
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
    pinLabel.textContent = p.name + ' · ' + NY.METAL[rec.cfg.metal].short;
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
    tmpV.y += 0.08;
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
    const hideAll = !labelsOn || paused;
    for (const lb of labels) {
      if (hideAll || lb.z.id === curZone || (lb.z.id === 'rotunda' && curZone !== 'foyer')) {
        lb.el.hidden = true;
        continue;
      }
      const d = Math.hypot(lb.p.x - nav.x, lb.p.z - nav.z);
      tmpV.copy(lb.p).project(camera);
      if (tmpV.z > 1 || tmpV.z < -1 || Math.abs(tmpV.x) > 1.02 || Math.abs(tmpV.y) > 1.02 || d > 16 || d < 1.4) {
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
      lb.el.style.opacity = d > 12 ? String(Math.max(0.35, (16 - d) / 4)) : '1';
    }
  }

  /* ------------------------------------------------------------------
     Product viewer (second renderer inside the product sheet)
     ------------------------------------------------------------------ */
  let VW = null;
  const viewKits = new Map();
  function ensureViewer() {
    if (VW) return VW;
    const st = new JewelStage({ coarse, bloom: true, dpr: coarse ? 1.75 : 2 });
    st.domElement.className = 'viewer-canvas';
    VW = { st, el: null, active: false, key: '' };
    return VW;
  }
  let showSeq = 0;
  async function viewerShow(o) {
    const seq = ++showSeq;
    const p = NY.byId[o.pid];
    const bc = NY.buildCfg(p, o.cfg);
    const key = p.id + '|' + JSON.stringify(bc);
    let kit = viewKits.get(key);
    if (!kit) {
      kit = await sourceKit(p, bc, coarse ? 0.7 : 0.9, 'full');
      if (viewKits.size > 6) viewKits.clear();
      viewKits.set(key, kit);
    }
    // a newer request (another piece or option) arrived while this one loaded
    if (seq !== showSeq || !VW) return;
    VW.st.keepView = VW.key === p.id;
    VW.st.show(kit, { type: p.type, metal: o.cfg.metal, stones: NY.stonesFor(p, o.cfg), whiteClaws: p.whiteClaws });
    VW.key = p.id;
  }
  function sizeViewer() {
    if (!VW || !VW.el) return;
    const r = VW.el.getBoundingClientRect();
    VW.st.setSize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)));
  }
  function mountViewer(el, o) {
    try {
      ensureViewer();
    } catch (e) {
      console.warn(e);
      return false;
    }
    VW.el = el;
    VW.key = '';
    VW.st.userTurned = false;
    VW.st.spin = !RM;
    VW.st.domElement.setAttribute('aria-label', 'The piece in 3D. Drag to turn it, pinch or scroll to look closer.');
    el.prepend(VW.st.domElement);
    sizeViewer();
    viewerShow(o);
    VW.active = true;
    return true;
  }
  function updateViewer(o) {
    if (!VW || !VW.active) return;
    viewerShow(o);
  }
  function unmountViewer() {
    if (!VW) return;
    VW.active = false;
    const d = VW.st.domElement;
    if (d.parentNode) d.parentNode.removeChild(d);
    VW.el = null;
  }

  /* ------------------------------------------------------------------
     Quality, sizing and the frame loop
     ------------------------------------------------------------------ */
  const QUAL = { dpr: 1, mode: 'auto' };
  function resize() {
    const r = canvas.getBoundingClientRect(),
      w = Math.max(1, Math.round(r.width)),
      h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Tall phones held upright get a taller view, so the view is wide enough (about 48° across) to take in a display.
    baseFov = camera.aspect < 0.6 ? 82 : camera.aspect < 0.75 ? 72 : camera.aspect < 1.15 ? 64 : 58;
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    }
    if (reflector) {
      const s = renderer.getDrawingBufferSize(new V2());
      reflector.getRenderTarget().setSize(Math.round(s.x * 0.5), Math.round(s.y * 0.5));
      reflector.material.uniforms.texel.value.set(2 / s.x, 2 / s.y);
    }
    needs = true;
    sizeViewer();
  }
  function applyQuality(mode) {
    QUAL.mode = mode;
    const dpr = window.devicePixelRatio || 1;
    let max, post, refl, lights;
    if (mode === 'high') {
      max = 2;
      post = true;
      refl = true;
      lights = true;
    } else if (mode === 'low') {
      max = 1;
      post = false;
      refl = false;
      lights = false;
    } else {
      max = coarse ? 1.5 : 1.75;
      post = true;
      refl = !coarse;
      lights = !coarse;
    }
    QUAL.dpr = Math.min(dpr, max);
    renderer.setPixelRatio(QUAL.dpr);
    setupPost(post, coarse || mode === 'low' ? 0 : 4);
    if (refl && !reflector) {
      reflector = makeReflector();
      scene.add(reflector);
    } else if (!refl && reflector) {
      scene.remove(reflector);
      reflector.dispose();
      reflector = null;
    }
    for (const l of lamps) l.visible = lights || l.userData.kind === 'chandelier';
    resize();
  }
  let slow = 0;
  function adapt(dt) {
    if (!NY.settings || NY.settings.quality !== 'auto') return;
    if (dt > 1 / 32) slow++;
    else slow = Math.max(0, slow - 1);
    if (slow > 50) {
      slow = 0;
      if (QUAL.dpr > 1) {
        QUAL.dpr = Math.max(1, QUAL.dpr - 0.25);
        renderer.setPixelRatio(QUAL.dpr);
        resize();
      } else if (reflector) {
        scene.remove(reflector);
        reflector.dispose();
        reflector = null;
      } else if (composer) setupPost(false);
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
  let tSec = 0;
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
        const tp = nav.look ? lerp(-0.04, nav.look.pitch, w) : -0.04;
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
        const sp = 1.7 * dt,
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
  function render(dt) {
    camera.position.set(nav.x, EYE, nav.z);
    camera.rotation.set(nav.pitch, nav.yaw, 0, 'YXZ');
    camera.fov = baseFov * zoom;
    camera.updateProjectionMatrix();
    tSec += dt;
    if (!RM) hero.rotation.y = tSec * 0.22;
    const sz = renderer.getDrawingBufferSize(new V2());
    sparkle.userData.update(tSec, camera, sz.x, sz.y);
    hero.userData.sparkle.userData.update(tSec, camera, sz.x, sz.y);
    motes.material.uniforms.time.value = tSec;
    if (composer) composer.render();
    else renderer.render(scene, camera);
    needs = false;
    updateLabels();
    updatePin();
    if ((frameN++ & 1) === 0 && NY.onPose) NY.onPose(pose());
  }
  // The boutique is never quite still (the signature piece turns, stones twinkle), but when nothing is
  // happening it draws at about 20 frames a second to save battery.
  let last = performance.now(),
    lastDraw = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const act = update(dt) || (drag.active && drag.moved) || !!pinch;
    if (!paused) {
      const busy = act || needs || now < keepAlive;
      if (busy || now - lastDraw > (RM ? 1000 : 50)) {
        render(Math.min(0.1, (now - (lastDraw || now)) / 1000));
        lastDraw = now;
        if (act) adapt(dt);
      }
    }
    if (VW && VW.active) VW.st.render(now);
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    if (NY.toast) NY.toast('The 3D view paused. It resumes when the browser restores it.');
  });
  canvas.addEventListener('webglcontextrestored', () => {
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
  if (camera.aspect < 0.75) nav.pitch = -0.1;
  render(0);

  NY.attach3D({
    goZone(id, tag) {
      const z = NY.zoneById(id);
      if (!z) return;
      goTo(z.view.p[0], z.view.p[1], new V3(z.view.t[0], z.view.t[1], z.view.t[2]), { reason: 'zone', id, tag });
    },
    goProduct(pid, metal) {
      const cands = records
        .filter((r) => r.pid === pid)
        .sort((a, b) => (a.cfg.metal === metal ? 0 : 1) - (b.cfg.metal === metal ? 0 : 1));
      const rec = cands[0];
      if (!rec) return false;
      const dist = rec.kind === 'niche' ? 1.5 : rec.kind === 'hero' ? 1.7 : 1.0;
      const at = new V3(rec.center.x + rec.facing.x * dist, 0, rec.center.z + rec.facing.z * dist);
      goTo(at.x, at.z, rec.center, { reason: 'product', rec });
      return true;
    },
    hasProduct(pid) {
      return records.some((r) => r.pid === pid);
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
          : floors.indexOf(o) >= 0 || hit.point.y <= 0.05
            ? 'floor'
            : 'surface';
      return { kind, x: hit.point.x, y: hit.point.y, z: hit.point.z, dist: hit.distance, nx: n.x, nz: n.z };
    },
    clearPin,
    mountViewer,
    updateViewer,
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
    navGrid() {
      const { cell, cols, rows, ms } = NAV;
      return { cell, x0: BD.x0, z0: BD.z0, cols, rows, ms, blocked: Array.from(NAV.blocked) };
    },
    stats() {
      return {
        draws: renderer.info.render.calls,
        tris: renderer.info.render.triangles,
        records: records.length,
        glints: glints.length,
        post: !!composer,
        reflection: !!reflector,
      };
    },
  });
  requestAnimationFrame(loop);
}
