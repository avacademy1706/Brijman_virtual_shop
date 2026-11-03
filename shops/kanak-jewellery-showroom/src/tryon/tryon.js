// Camera try-on for jewellery. The shopper's camera feed with the pieces drawn on them, live: earrings hang
// from the earlobes and swing as the head moves, a necklace sits at the base of the neck, a maang tikka in the
// parting, a nath at the left nostril, a ring on the ring finger and a bangle at the wrist. Several pieces can
// be worn at once (a whole bridal set). Depth-only stand-ins for the head, neck, finger and forearm hide the
// parts of each piece that would be behind the body.
// Video never leaves the device: frames go from the camera to the GPU and the tracking models, nothing is uploaded.
import * as THREE from 'three';

import { NY } from '../core/ny.js';
import '../data/catalogue.js';
import '../lib/drawings.js';
import { h, ic, money } from '../lib/dom.js';
import { pieceKit } from '../jewel/source.js';
import { realize } from '../jewel/kit.js';
import { bustGeometry } from '../jewel/shapes.js';
import { makeJewelEnv, addStudioLights } from '../jewel/materials.js';
import { makeSparkle } from '../jewel/sparkle.js';
import { Tracker, ModelMissing } from './tracker.js';
import { Swing, FACE_MM } from './anchors.js';
import '../styles/tryon.css';

const DEBUG = typeof location !== 'undefined' && /[?&]tryondebug=1/.test(location.search);
const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
/** Try-on slots: where each piece is worn and which tracking it needs. */
export const SLOTS = [
  { id: 'ear', n: 'Earrings', track: 'face' },
  { id: 'neck', n: 'Necklace', track: 'face' },
  { id: 'forehead', n: 'Tikka', track: 'face' },
  { id: 'nose', n: 'Nath', track: 'face' },
  { id: 'finger', n: 'Ring', track: 'hand' },
  { id: 'wrist', n: 'Bangle', track: 'hand' },
];
const slotOf = (p) => p.tryon;
const ROLE_SHORT = { main: 'Stone', accent: 'Accents', drop: 'Drops', side: 'Side', pearl: 'Pearls', band: 'Band' };

let T = null;
export function openTryOn(o) {
  if (!T) T = createTryOn();
  T.open(o || {});
}
export function closeTryOn() {
  if (T) T.close();
}
/** Internal state, for the development simulator (tools/tryon-sim.html) and tests. */
export const tryOnState = () => T && T.state;

function createTryOn() {
  /* ------------------------------------------------------------------ DOM */
  const video = h('video', {
    class: 'to-video',
    playsinline: true,
    muted: true,
    autoplay: true,
    'aria-hidden': 'true',
  });
  video.muted = true;
  const canvas = h('canvas', { class: 'to-canvas', 'aria-hidden': 'true' });
  const dbg = h('canvas', { class: 'to-canvas to-debug', hidden: !DEBUG, 'aria-hidden': 'true' });
  const backdrop = h('video', {
    class: 'to-backdrop',
    playsinline: true,
    muted: true,
    autoplay: true,
    'aria-hidden': 'true',
  });
  backdrop.muted = true;
  const stage = h('div', { class: 'to-stage' }, backdrop, video, canvas, dbg);
  const status = h('span', { class: 'to-status', role: 'status', 'aria-live': 'polite' }, 'Camera off');
  const closeBtn = h('button', { class: 'to-icon', type: 'button', 'aria-label': 'Close the try-on' }, ic('close'));
  // switches between filling the screen and showing the whole camera picture
  const viewIcon = (whole) => {
    const t = document.createElement('template');
    t.innerHTML =
      '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (whole
        ? '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'
        : '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>') +
      '</svg>';
    return t.content.firstChild;
  };
  const viewBtn = h('button', { class: 'to-icon', type: 'button', hidden: true });
  viewBtn.addEventListener('click', () => {
    S.view = root.classList.contains('fit-contain') ? 'fill' : 'whole';
    fit();
  });
  const flipBtn = h(
    'button',
    { class: 'to-icon', type: 'button', 'aria-label': 'Switch camera', hidden: true },
    ic('swap'),
  );
  const top = h(
    'header',
    { class: 'to-top' },
    closeBtn,
    h('div', { class: 'to-title' }, h('b', null, 'Try-on'), status),
    viewBtn,
    flipBtn,
  );
  const guide = h('p', { class: 'to-guide', hidden: true, 'aria-live': 'polite' });
  const startBtn = h(
    'button',
    { class: 'btn primary', type: 'button', id: 'to-start' },
    ic('camera'),
    h('span', null, 'Start camera'),
  );
  const viewerBtn = h(
    'button',
    { class: 'btn', type: 'button', id: 'to-viewer' },
    ic('diamond'),
    h('span', null, 'See it in 3D instead'),
  );
  const introMsg = h('p', { class: 'to-error', hidden: true, role: 'alert' });
  const intro = h(
    'section',
    { class: 'to-intro' },
    h('span', { class: 'to-intro-ic' }, ic('camera')),
    h('h2', null, 'Try it on with your camera'),
    h('p', { id: 'to-intro-text' }, 'Face the camera in good light.'),
    h(
      'ul',
      { class: 'to-points' },
      h('li', null, ic('check'), h('span', null, 'Video stays on this device. Nothing is recorded or uploaded.')),
      h(
        'li',
        null,
        ic('check'),
        h('span', null, 'Tie your hair back or tuck it behind your ears to see earrings best.'),
      ),
    ),
    introMsg,
    h('div', { class: 'to-intro-actions' }, startBtn, viewerBtn),
  );
  const slots = h('div', { class: 'chips to-slots', role: 'tablist', 'aria-label': 'Where to wear' });
  const carousel = h('div', { class: 'to-carousel', role: 'listbox', 'aria-label': 'Pieces' });
  const pName = h('b', { class: 'to-pname' });
  const pPrice = h('span', { class: 'to-price' });
  const pMeta = h('span', { class: 'to-fit' });
  const metals = h('div', { class: 'swatches to-swatches', role: 'radiogroup', 'aria-label': 'Metal' });
  const stones = h('div', { class: 'chips to-stones', role: 'radiogroup', 'aria-label': 'Stone' });
  const photoBtn = h(
    'button',
    { class: 'btn', type: 'button', id: 'to-photo' },
    ic('download'),
    h('span', null, 'Photo'),
  );
  const bagBtn = h(
    'button',
    { class: 'btn primary', type: 'button', id: 'to-bag' },
    ic('bag'),
    h('span', null, 'Add to bag'),
  );
  const optRow = h('div', { class: 'to-row' }, metals, stones);
  const handle = h(
    'button',
    { class: 'to-handle', type: 'button', 'aria-expanded': 'true', 'aria-label': 'Hide the options' },
    h('span'),
  );
  const panel = h(
    'section',
    { class: 'to-panel', 'aria-label': 'Jewellery options' },
    handle,
    slots,
    carousel,
    h(
      'div',
      { class: 'to-head' },
      h('div', { class: 'to-pinfo' }, pName, h('span', { class: 'to-meta' }, pPrice, pMeta)),
      h('div', { class: 'to-actions' }, photoBtn, bagBtn),
    ),
    optRow,
  );
  const shot = h('div', { class: 'to-shot', hidden: true, role: 'dialog', 'aria-label': 'Your photo' });
  const root = h(
    'div',
    { class: 'to', id: 'tryon', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Camera try-on', hidden: true },
    stage,
    top,
    guide,
    intro,
    panel,
    shot,
  );
  document.body.append(root);
  // the intro card and the panel share the screen badly on phones: the panel waits until the card is gone
  new MutationObserver(() => root.classList.toggle('intro-open', !intro.hidden)).observe(intro, {
    attributes: true,
    attributeFilter: ['hidden'],
  });
  root.classList.add('intro-open');

  /* ------------------------------------------------------------------ 3D overlay */
  let renderer = null,
    env = null;
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 20000);
  cam.position.set(0, 0, 10000);
  // neutral three-point lighting (key, fill, rim), so the metal shows its own colour on the shopper
  addStudioLights(scene, 0.85);
  // depth-only stand-ins for the body
  const occMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  const mkOcc = (g) => {
    const m = new THREE.Mesh(g, occMat);
    m.renderOrder = -1;
    m.visible = false;
    m.matrixAutoUpdate = false;
    scene.add(m);
    return m;
  };
  const occ = {
    head: mkOcc(new THREE.SphereGeometry(1, 24, 16)),
    neck: mkOcc(new THREE.CylinderGeometry(1, 1, 1, 24, 1, false)),
    finger: mkOcc(new THREE.CylinderGeometry(1, 1, 1, 16, 1, false)),
    forearm: mkOcc(new THREE.CylinderGeometry(1, 1, 1, 20, 1, false)),
    // the shoulders and chest: the same bust the necklaces are shaped on, so the strands that pass behind the neck
    // and shoulders are hidden and the ones lying on the chest stay in front
    bust: bustGeometry(32, 24).map(mkOcc),
  };
  const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const basis = (X, Y, Z, o, sx, sy, sz) => {
    const m = new THREE.Matrix4().makeBasis(V(X), V(Y), V(Z));
    m.scale(new THREE.Vector3(sx, sy == null ? sx : sy, sz == null ? sx : sz));
    m.setPosition(o[0], o[1], o[2]);
    return m;
  };
  /** Matrix whose +y runs from a to b (a cylinder of radius r between two points). */
  const between = (a, b, r) => {
    const A = V(a),
      B = V(b);
    const d = B.clone().sub(A);
    const len = d.length() || 1;
    const Y = d.normalize();
    const X =
      Math.abs(Y.z) < 0.9
        ? new THREE.Vector3(0, 0, 1).cross(Y).normalize()
        : new THREE.Vector3(1, 0, 0).cross(Y).normalize();
    const Z = new THREE.Vector3().crossVectors(X, Y);
    const m = new THREE.Matrix4().makeBasis(X, Y, Z);
    m.scale(new THREE.Vector3(r, len, r));
    m.setPosition(A.clone().add(B).multiplyScalar(0.5));
    return m;
  };

  /* ------------------------------------------------------------------ state */
  const S = {
    o: null,
    worn: {},
    focus: 'ear',
    facing: 'user',
    stream: null,
    running: false,
    raf: 0,
    tracker: new Tracker(),
    built: {}, // slot -> { key, group(s), sparkle(s), kit }
    swings: { L: new Swing(18), R: new Swing(18) },
    lobes: { L: [], R: [] },
    lum: 0.5,
    lumT: 0,
    seen: false,
    loading: false,
    t0: performance.now(),
  };
  const needs = () => {
    const n = { face: false, hand: false };
    for (const sl of SLOTS) if (S.worn[sl.id]) n[sl.track] = true;
    return n;
  };
  const clone = (c) => JSON.parse(JSON.stringify(c));

  /* ------------------------------------------------------------------ building the worn pieces */
  function disposeSlot(id) {
    const b = S.built[id];
    if (!b) return;
    for (const g of b.groups) {
      scene.remove(g);
      g.traverse((o) => {
        if (o.isMesh && o.geometry && !o.isInstancedMesh) o.geometry.dispose();
      });
    }
    delete S.built[id];
  }
  const pending = {};
  async function buildSlot(id) {
    const w = S.worn[id];
    if (!w || !env) {
      pending[id] = null;
      disposeSlot(id);
      return;
    }
    const p = NY.byId[w.pid];
    const bc = NY.buildCfg(p, w.cfg);
    const key = p.id + '|' + JSON.stringify(bc) + '|' + w.cfg.metal + '|' + JSON.stringify(w.cfg.stones || {});
    if ((S.built[id] && S.built[id].key === key) || pending[id] === key) return;
    pending[id] = key;
    // the client's 3D model when there is one (full detail), otherwise the built-in piece
    const kit = await pieceKit(p, bc, coarse ? 0.6 : 0.8, 'full');
    if (pending[id] !== key) return; // the shopper chose something else meanwhile
    pending[id] = null;
    disposeSlot(id);
    const o = { env, metal: w.cfg.metal, stones: NY.stonesFor(p, w.cfg), whiteClaws: p.whiteClaws, pearlDetail: 16 };
    const groups = [];
    const make = (k) => {
      const g = realize(k, o);
      const sp = makeSparkle(g.userData.glints, { maxPx: 30 });
      g.add(sp);
      g.userData.sparkle = sp;
      g.matrixAutoUpdate = false;
      g.visible = false;
      scene.add(g);
      groups.push(g);
      return g;
    };
    if (id === 'ear') {
      make(kit.single);
      make(kit.single);
      const len = Math.max(6, -(kit.anchors.bottom || -20) * 0.55);
      S.swings.L = new Swing(len);
      S.swings.R = new Swing(len);
    } else make(kit);
    S.built[id] = { key, groups, kit, p };
  }
  function rebuildAll() {
    for (const sl of SLOTS) buildSlot(sl.id);
  }

  /* ------------------------------------------------------------------ panel */
  function drawSlots() {
    slots.replaceChildren(
      ...SLOTS.map((sl) => {
        const has = NY.PRODUCTS.some((p) => slotOf(p) === sl.id);
        if (!has) return null;
        const c = h(
          'button',
          {
            class: 'chip' + (S.worn[sl.id] ? ' worn' : ''),
            type: 'button',
            role: 'tab',
            id: 'to-slot-' + sl.id,
            'aria-selected': S.focus === sl.id ? 'true' : 'false',
            'aria-pressed': S.focus === sl.id ? 'true' : 'false',
          },
          sl.n,
          S.worn[sl.id] ? h('span', { class: 'to-dot', 'aria-label': 'wearing' }) : null,
        );
        c.addEventListener('click', () => {
          setMin(false);
          S.focus = sl.id;
          drawSlots();
          drawCarousel();
          drawPanel();
        });
        return c;
      }),
    );
  }
  function drawCarousel() {
    const list = NY.PRODUCTS.filter((p) => slotOf(p) === S.focus);
    carousel.replaceChildren(
      ...list.map((p) => {
        const w = S.worn[S.focus];
        const on = w && w.pid === p.id;
        const cfg = on ? w.cfg : NY.defaultCfg(p);
        const b = h(
          'button',
          {
            class: 'to-item',
            type: 'button',
            role: 'option',
            'aria-selected': on ? 'true' : 'false',
            id: 'to-item-' + p.id,
            title: p.name,
          },
          h('span', { class: 'to-thumb', html: NY.pieceSVG(p, cfg, 44, 44) }),
          h('span', { class: 'to-iname' }, p.name),
        );
        b.addEventListener('click', () => {
          const cur = S.worn[S.focus];
          if (cur && cur.pid === p.id) S.worn[S.focus] = null;
          else S.worn[S.focus] = { pid: p.id, cfg: NY.defaultCfg(p) };
          afterChange();
        });
        return b;
      }),
    );
  }
  function drawPanel() {
    const worn = SLOTS.map((sl) => S.worn[sl.id]).filter(Boolean);
    const total = worn.reduce((a, w) => a + NY.priceOf(NY.byId[w.pid], w.cfg).total, 0);
    const focus = S.worn[S.focus];
    if (!worn.length) {
      pName.textContent = 'Choose a piece to wear';
      pPrice.textContent = '';
      pMeta.textContent = '';
    } else {
      const shown = focus || worn[0];
      pName.textContent = NY.byId[shown.pid].name;
      pPrice.textContent = worn.length > 1 ? money(total) + ' for ' + worn.length + ' pieces' : money(total);
      pMeta.textContent = NY.cfgSummary(NY.byId[shown.pid], shown.cfg);
    }
    bagBtn.disabled = !worn.length;
    photoBtn.disabled = !worn.length || !S.running;
    metals.replaceChildren();
    stones.replaceChildren();
    optRow.hidden = true;
    if (!focus) return;
    const p = NY.byId[focus.pid];
    if (p.metals.length > 1)
      for (const k of p.metals) {
        const m = NY.METAL[k];
        const b = h('button', {
          class: 'swatch metal',
          type: 'button',
          role: 'radio',
          'aria-checked': focus.cfg.metal === k ? 'true' : 'false',
          'aria-label': m.n,
          title: m.n,
          style:
            'background: radial-gradient(circle at 32% 28%, #fffaf0 0 12%, ' +
            m.swatch +
            ' 46%, #00000033 100%), ' +
            m.swatch,
        });
        b.addEventListener('click', () => {
          focus.cfg.metal = k;
          afterChange();
        });
        metals.append(b);
      }
    const roles = Object.keys(p.stoneOptions || {});
    for (const role of roles) {
      if (roles.length > 1) stones.append(h('span', { class: 'to-label' }, ROLE_SHORT[role] || 'Stone'));
      for (const k of p.stoneOptions[role]) {
        const st = NY.STONE[k];
        const c = h(
          'button',
          {
            class: 'chip has-swatch',
            type: 'button',
            role: 'radio',
            'aria-checked': focus.cfg.stones[role] === k ? 'true' : 'false',
          },
          h('span', { class: 'chip-sw', style: 'background:' + (st ? st.swatch : k), 'aria-hidden': 'true' }),
          st ? st.n : k,
        );
        c.addEventListener('click', () => {
          focus.cfg.stones[role] = k;
          afterChange();
        });
        stones.append(c);
      }
    }
    optRow.hidden = !metals.childElementCount && !stones.childElementCount;
  }
  async function afterChange() {
    drawSlots();
    drawCarousel();
    drawPanel();
    rebuildAll();
    if (S.running) await loadTracking();
  }
  /** Loads the tracking models the worn pieces need; while loading, the status says so. */
  async function loadTracking() {
    S.loading = true;
    setStatus('Loading tracking…');
    try {
      await S.tracker.ensure(needs());
      S.loading = false;
      if (S.running) {
        setStatus('Looking for you…');
        updateGuide();
      }
    } catch (e) {
      S.loading = false;
      showModelError(e);
    }
  }
  // fold the panel away to see the neck and chest (phones)
  function setMin(min) {
    panel.classList.toggle('min', min);
    handle.setAttribute('aria-expanded', min ? 'false' : 'true');
    handle.setAttribute('aria-label', min ? 'Show the options' : 'Hide the options');
  }
  handle.addEventListener('click', () => setMin(!panel.classList.contains('min')));
  photoBtn.addEventListener('click', takePhoto);
  bagBtn.addEventListener('click', () => {
    for (const sl of SLOTS) {
      const w = S.worn[sl.id];
      if (w && S.o && S.o.addToBag) S.o.addToBag(w.pid, w.cfg);
    }
  });

  /* ------------------------------------------------------------------ camera */
  function setStatus(t, kind) {
    status.textContent = t;
    status.dataset.kind = kind || '';
  }
  function showGuide(t) {
    guide.hidden = !t;
    if (t) guide.textContent = t;
  }
  /** found: { face, hand } booleans (undefined before the first frame). */
  function updateGuide(found) {
    const n = needs();
    if (!S.running) return;
    found = found || {};
    const missFace = n.face && !found.face,
      missHand = n.hand && !found.hand;
    const what = [S.worn.finger && 'ring', S.worn.wrist && 'bangle'].filter(Boolean).join(' and ');
    if (!n.face && !n.hand) showGuide('Choose a piece to wear');
    else if (missFace && missHand) showGuide('Show your face and raise your hand');
    else if (missFace) showGuide('Face the camera, with your neck in view');
    else if (missHand)
      showGuide(n.face ? 'Raise your hand to see the ' + what : 'Hold up your hand, back to the camera');
    else showGuide('');
  }
  function showModelError(e) {
    console.warn(e);
    // without tracking there is nothing to place: stop the camera and explain
    S.running = false;
    cancelAnimationFrame(S.raf);
    stopStream();
    for (const id in S.built) for (const g of S.built[id].groups) g.visible = false;
    if (renderer) renderer.clear();
    showGuide('');
    if (e instanceof ModelMissing || (e && e.code === 'model-missing')) {
      setStatus('Tracking unavailable');
      introMsg.textContent =
        'The ' +
        e.kind +
        ' tracking model is not installed on this site yet. (Developers: run npm run setup:tryon before building; see docs/TRYON.md.) You can still see every piece in 3D.';
    } else {
      setStatus('Tracking unavailable');
      introMsg.textContent = 'Tracking could not start here. You can still see every piece in 3D.';
    }
    introMsg.hidden = false;
    intro.hidden = false;
  }
  async function startCamera() {
    introMsg.hidden = true;
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      introMsg.textContent = 'The camera needs a secure (https) page and a browser that supports it.';
      introMsg.hidden = false;
      return;
    }
    startBtn.disabled = true;
    setStatus('Starting camera…');
    try {
      const portrait = window.innerHeight > window.innerWidth;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: S.facing,
          width: { ideal: portrait ? 720 : 1280 },
          height: { ideal: portrait ? 1280 : 720 },
          frameRate: { ideal: 30, max: 30 },
        },
      });
      stopStream();
      S.stream = stream;
      video.srcObject = stream;
      backdrop.srcObject = stream;
      await video.play().catch(() => {});
      backdrop.play().catch(() => {});
      root.classList.toggle('mirrored', S.facing === 'user');
      intro.hidden = true;
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        flipBtn.hidden = devs.filter((d) => d.kind === 'videoinput').length < 2;
      } catch (e) {
        flipBtn.hidden = true;
      }
      ensureRenderer();
      rebuildAll();
      S.running = true;
      S.seen = false;
      loop();
      await loadTracking();
      drawPanel();
    } catch (e) {
      console.warn(e);
      stopStream();
      const n = e && e.name;
      introMsg.textContent =
        n === 'NotAllowedError'
          ? 'Camera access was blocked. Allow the camera for this site in your browser settings, then try again.'
          : n === 'NotFoundError' || n === 'OverconstrainedError'
            ? 'No camera was found on this device.'
            : n === 'NotReadableError'
              ? 'The camera is busy in another app. Close it and try again.'
              : 'The try-on could not start here. You can still see every piece in 3D.';
      introMsg.hidden = false;
      intro.hidden = false;
      setStatus('Camera off');
    } finally {
      startBtn.disabled = false;
    }
  }
  function stopStream() {
    if (S.stream) for (const t of S.stream.getTracks()) t.stop();
    S.stream = null;
    video.srcObject = null;
    backdrop.srcObject = null;
  }
  flipBtn.addEventListener('click', () => {
    S.facing = S.facing === 'user' ? 'environment' : 'user';
    S.tracker.reset();
    startCamera();
  });
  startBtn.addEventListener('click', startCamera);
  viewerBtn.addEventListener('click', () => {
    const w = S.worn[S.focus] || SLOTS.map((sl) => S.worn[sl.id]).find(Boolean);
    const o = S.o;
    close();
    if (o && o.openProduct && w) o.openProduct(w.pid, w.cfg);
  });
  function ensureRenderer() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Khronos PBR Neutral: true-to-colour gold and stones (ACES pushes yellow gold towards orange)
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.setPixelRatio(1);
    env = makeJewelEnv(renderer, coarse ? 128 : 256);
    scene.environment = env.pmrem;
    scene.environmentIntensity = 0.6;
  }

  /* ------------------------------------------------------------------ frame loop */
  const lumC = document.createElement('canvas');
  lumC.width = lumC.height = 16;
  const lumG = lumC.getContext('2d', { willReadFrequently: true });
  function sampleLight(now) {
    if (now - S.lumT < 600) return;
    S.lumT = now;
    try {
      lumG.drawImage(video, 0, 0, 16, 16);
      const d = lumG.getImageData(0, 0, 16, 16).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      S.lum += (s / (d.length / 4) / 255 - S.lum) * 0.5;
      // match the metal to the room: darker rooms, darker jewellery, within limits
      renderer.toneMappingExposure = Math.min(1.25, Math.max(0.6, 0.6 + S.lum * 1.1));
    } catch (e) {
      /* ignore */
    }
  }
  /**
   * How the camera picture fits the screen. Filling the screen crops the picture; a phone that sends a wide picture
   * while held upright would then be zoomed in about three times. So the picture fills the screen only when that
   * keeps at least 60% of it, and is otherwise shown whole over a blurred copy of itself. The view button overrides.
   */
  function fit() {
    const W = video.videoWidth,
      H = video.videoHeight;
    if (!W || !H) return;
    const va = W / H,
      sa = root.clientWidth / Math.max(1, root.clientHeight);
    const kept = Math.min(va, sa) / Math.max(va, sa); // share of the picture left on screen when it fills the screen
    const whole = S.view === 'whole' || (S.view !== 'fill' && kept < 0.6);
    root.classList.toggle('fit-contain', whole);
    viewBtn.hidden = kept > 0.85;
    viewBtn.setAttribute('aria-label', whole ? 'Fill the screen' : 'Show the whole camera picture');
    viewBtn.title = viewBtn.getAttribute('aria-label');
    viewBtn.replaceChildren(viewIcon(whole));
  }
  window.addEventListener('resize', () => {
    if (!root.hidden) fit();
  });
  function loop() {
    cancelAnimationFrame(S.raf);
    S.last = performance.now();
    const tick = (now) => {
      if (!S.running) return;
      S.raf = requestAnimationFrame(tick);
      const W = video.videoWidth,
        H = video.videoHeight;
      if (!W || !H || video.readyState < 2) return;
      if (canvas.width !== W || canvas.height !== H) {
        fit();
        renderer.setSize(W, H, false);
        dbg.width = W;
        dbg.height = H;
        cam.left = -W / 2;
        cam.right = W / 2;
        cam.top = H / 2;
        cam.bottom = -H / 2;
        cam.updateProjectionMatrix();
      }
      const dt = Math.min(1 / 15, Math.max(0.001, (now - S.last) / 1000));
      S.last = now;
      if (video.currentTime !== S.lastVideoTime) {
        S.lastVideoTime = video.currentTime;
        const r = S.tracker.update(video, now, needs());
        place(r, dt);
        if (DEBUG) drawDebug(r, W, H);
      }
      sampleLight(now);
      const t = (now - S.t0) / 1000;
      for (const id in S.built) for (const g of S.built[id].groups) g.userData.sparkle.userData.update(t, cam, W, H);
      renderer.render(scene, cam);
    };
    S.raf = requestAnimationFrame(tick);
  }
  /** Positions every worn piece from the tracked anchors. */
  function place(r, dt) {
    const face = r.face,
      hand = r.hand;
    const n = needs();
    const found = (!n.face || face) && (!n.hand || hand);
    const some = (n.face && face) || (n.hand && hand);
    if (some && !S.seen) {
      S.seen = true;
      panel.classList.add('live');
      // on phones and portrait tablets the panel covers the neck and chest: fold it once the shopper is in view
      if (window.matchMedia('(max-width: 760px), (orientation: portrait) and (max-width: 1100px)').matches)
        setMin(true);
    }
    if (!S.loading) {
      setStatus(found || some ? 'Tracking' : 'Looking for you…', found || some ? 'ok' : '');
      updateGuide({ face: !!face, hand: !!hand });
    }
    // occluders
    occ.head.visible = !!face;
    occ.neck.visible = !!face && !!S.worn.neck;
    for (const m of occ.bust) m.visible = occ.neck.visible;
    if (face) {
      const F = face.F;
      // head: an ellipsoid behind the face centre
      const c = [0, 1, 2].map((i) => F.o[i] - (F.Z[i] * 70 + F.Y[i] * 10) * F.s);
      occ.head.matrix.copy(basis(F.X, F.Y, F.Z, c, 76 * F.s, 104 * F.s, 92 * F.s));
      const N = face.neck;
      const nc = [N.o[0] + N.Y[0] * 40 * N.s, N.o[1] + N.Y[1] * 40 * N.s, N.o[2] + N.Y[2] * 40 * N.s];
      occ.neck.matrix.copy(basis(N.X, N.Y, N.Z, nc, 50 * N.s, 140 * N.s, 46 * N.s));
      // a little smaller than the necklace's own bust, so the strands (2 mm or more off its surface) stay in front
      for (const m of occ.bust) m.matrix.copy(basis(N.X, N.Y, N.Z, N.o, 0.985 * N.s));
    }
    occ.finger.visible = !!hand && !!S.worn.finger;
    occ.forearm.visible = !!hand && !!S.worn.wrist;
    if (hand) {
      const f = hand.finger;
      const ext = [
        f.b[0] + (f.b[0] - f.a[0]) * 0.6,
        f.b[1] + (f.b[1] - f.a[1]) * 0.6,
        f.b[2] + (f.b[2] - f.a[2]) * 0.6,
      ];
      const sta = [
        f.a[0] - (f.b[0] - f.a[0]) * 0.3,
        f.a[1] - (f.b[1] - f.a[1]) * 0.3,
        f.a[2] - (f.b[2] - f.a[2]) * 0.3,
      ];
      occ.finger.matrix.copy(between(sta, ext, f.r));
      occ.forearm.matrix.copy(between(hand.forearm.a, hand.forearm.b, hand.forearm.r));
    }
    for (const sl of SLOTS) {
      const b = S.built[sl.id];
      if (!b) continue;
      const vis = sl.track === 'face' ? !!face : !!hand;
      for (const g of b.groups) g.visible = vis;
      if (!vis) continue;
      if (sl.id === 'ear') placeEarrings(b, face, dt);
      else if (sl.id === 'neck') {
        const N = face.neck;
        b.groups[0].matrix.copy(basis(N.X, N.Y, N.Z, N.o, N.s));
      } else if (sl.id === 'forehead') {
        // hook up in the parting, pendant just below the hairline
        const F = face.F,
          K = face.tikka;
        const up = ((b.kit.anchors.chain || 50) - FACE_MM.tikkaDown) * F.s;
        const o = [0, 1, 2].map((i) => K.o[i] + K.Y[i] * up);
        b.groups[0].matrix.copy(basis(K.X, K.Y, K.Z, o, F.s));
      } else if (sl.id === 'nose') {
        const F = face.F;
        // the hoop turns a little towards the cheek
        const a = 0.45;
        const X = [
          F.X[0] * Math.cos(a) + F.Z[0] * Math.sin(a),
          F.X[1] * Math.cos(a) + F.Z[1] * Math.sin(a),
          F.X[2] * Math.cos(a) + F.Z[2] * Math.sin(a),
        ];
        const Z = [
          F.Z[0] * Math.cos(a) - F.X[0] * Math.sin(a),
          F.Z[1] * Math.cos(a) - F.X[1] * Math.sin(a),
          F.Z[2] * Math.cos(a) - F.X[2] * Math.sin(a),
        ];
        b.groups[0].matrix.copy(basis(X, F.Y, Z, face.nath, F.s));
      } else if (sl.id === 'finger') {
        const R = hand.ring;
        const Z = R.axis,
          Y = R.up;
        const X = cross(Y, Z);
        const p = NY.byId[S.worn.finger.pid];
        const dia = NY.buildCfg(p, S.worn.finger.cfg).ringDia || 17.2;
        const s = (R.fingerPx * 1.04) / dia;
        b.groups[0].matrix.copy(basis(X, Y, Z, R.o, s));
      } else if (sl.id === 'wrist') {
        const B = hand.bangle;
        const X = cross(B.up, B.axis);
        b.groups[0].matrix.copy(basis(X, B.up, B.axis, B.o, hand.s));
      }
    }
  }
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  /** Earrings hang from the lobes, follow the head's turn and swing with its movement. */
  function placeEarrings(b, face, dt) {
    const F = face.F;
    for (const [side, g, lobe, hide] of [
      ['R', b.groups[0], face.lobeR, face.hideR],
      ['L', b.groups[1], face.lobeL, face.hideL],
    ]) {
      g.visible = hide < 0.7;
      // lobe acceleration (mm/s^2) from its last three positions
      const hist = S.lobes[side];
      hist.push(lobe.slice());
      if (hist.length > 3) hist.shift();
      let ax = 0,
        az = 0;
      if (hist.length === 3) {
        const k = 1 / (dt * dt * F.s);
        ax = (hist[2][0] - 2 * hist[1][0] + hist[0][0]) * k;
        az = (hist[2][2] - 2 * hist[1][2] + hist[0][2]) * k;
        ax = Math.max(-40000, Math.min(40000, ax));
        az = Math.max(-40000, Math.min(40000, az));
      }
      const sw = S.swings[side].step(ax, az, dt);
      // hang along gravity (screen down), facing the way the head faces
      const yaw = F.yaw * 0.85;
      const down = new THREE.Matrix4().makeRotationY(yaw);
      down.multiply(new THREE.Matrix4().makeRotationZ(sw.sway));
      down.multiply(new THREE.Matrix4().makeRotationX(-sw.tilt));
      down.scale(new THREE.Vector3(F.s, F.s, F.s));
      down.setPosition(lobe[0], lobe[1], lobe[2]);
      g.matrix.copy(down);
    }
  }
  function drawDebug(r, W, H) {
    const g = dbg.getContext('2d');
    g.clearRect(0, 0, W, H);
    const dot = (p, c) => {
      g.fillStyle = c;
      g.beginPath();
      g.arc(p[0] + W / 2, H / 2 - p[1], 5, 0, Math.PI * 2);
      g.fill();
    };
    if (r.raw.face) {
      g.fillStyle = 'rgba(227,183,101,.5)';
      for (const q of r.raw.face) g.fillRect(q.x * W - 1, q.y * H - 1, 2, 2);
    }
    if (r.face) {
      dot(r.face.lobeL, '#ff4060');
      dot(r.face.lobeR, '#ff4060');
      dot(r.face.tikka.o, '#40c0ff');
      dot(r.face.nath, '#40ff80');
      dot(r.face.neck.o, '#ffffff');
    }
    if (r.hand) {
      dot(r.hand.ring.o, '#ff4060');
      dot(r.hand.bangle.o, '#40c0ff');
    }
  }

  /* ------------------------------------------------------------------ photo */
  async function takePhoto() {
    if (!S.running || !video.videoWidth) return;
    const W = video.videoWidth,
      H = video.videoHeight;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.save();
    if (S.facing === 'user') {
      g.translate(W, 0);
      g.scale(-1, 1);
    }
    g.drawImage(video, 0, 0, W, H);
    renderer.render(scene, cam);
    g.drawImage(canvas, 0, 0, W, H);
    g.restore();
    const grd = g.createLinearGradient(0, H - 70, 0, H);
    grd.addColorStop(0, 'rgba(14,10,8,0)');
    grd.addColorStop(1, 'rgba(14,10,8,.75)');
    g.fillStyle = grd;
    g.fillRect(0, H - 70, W, 70);
    g.fillStyle = '#f2dfae';
    g.font = '600 22px "Cormorant Garamond", Garamond, serif';
    const names = SLOTS.map((sl) => S.worn[sl.id])
      .filter(Boolean)
      .map((w) => NY.byId[w.pid].name)
      .join(' · ');
    g.fillText('KANAK · ' + names, 18, H - 20);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const file = typeof File === 'function' ? new File([blob], 'kanak-try-on.jpg', { type: 'image/jpeg' }) : null;
    const img = h('img', { src: url, alt: 'Photo of you wearing ' + names });
    const dl = h(
      'a',
      { class: 'btn primary', href: url, download: 'kanak-try-on.jpg' },
      ic('download'),
      h('span', null, 'Save photo'),
    );
    const acts = h('div', { class: 'to-shot-actions' }, dl);
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      const share = h('button', { class: 'btn', type: 'button' }, h('span', null, 'Share'));
      share.addEventListener('click', () =>
        navigator.share({ files: [file], title: 'My Kanak try-on' }).catch(() => {}),
      );
      acts.append(share);
    }
    const done = h('button', { class: 'btn', type: 'button' }, h('span', null, 'Done'));
    done.addEventListener('click', () => {
      shot.hidden = true;
      URL.revokeObjectURL(url);
    });
    acts.append(done);
    shot.replaceChildren(
      h(
        'div',
        { class: 'to-shot-card' },
        img,
        h('p', { class: 'to-note' }, 'Saved only when you tap Save. Nothing was uploaded.'),
        acts,
      ),
    );
    shot.hidden = false;
  }

  /* ------------------------------------------------------------------ open / close */
  function open(o) {
    S.o = o;
    S.worn = {};
    const wear = (pid, cfg) => {
      const p = NY.byId[pid];
      if (!p || !slotOf(p)) return null;
      S.worn[slotOf(p)] = { pid, cfg: cfg ? clone(cfg) : NY.defaultCfg(p) };
      return slotOf(p);
    };
    let focus = null;
    if (o.set) {
      const set = NY.SETS.find((s) => s.id === o.set);
      if (set)
        for (const id of set.pieces) {
          const sl = wear(id);
          focus = focus || sl;
        }
    } else if (o.pid) focus = wear(o.pid, o.cfg);
    if (!focus) {
      for (const id of ['p03', 'p01', 'p04']) wear(id);
      focus = 'ear';
    }
    S.focus = focus;
    const n = needs();
    $text(
      n.hand && !n.face
        ? 'Hold your hand up with the back of the hand towards the camera, about 40 cm away. The ring sits on your ring finger; bangles at the wrist.'
        : 'Face the camera in good light, about 50 cm away, with your neck in view. Earrings hang from your earlobes and swing as you move.',
    );
    S.tracker.reset();
    for (const k in S.swings) S.swings[k].reset();
    S.lobes = { L: [], R: [] };
    root.hidden = false;
    document.documentElement.classList.add('tryon-open');
    intro.hidden = false;
    introMsg.hidden = true;
    panel.hidden = false;
    panel.classList.remove('live');
    setMin(false);
    drawSlots();
    drawCarousel();
    drawPanel();
    setStatus('Camera off');
    showGuide('');
    setTimeout(() => startBtn.focus({ preventScroll: true }), 30);
  }
  function $text(t) {
    const el = intro.querySelector('#to-intro-text');
    if (el) el.textContent = t;
  }
  function close() {
    S.running = false;
    cancelAnimationFrame(S.raf);
    stopStream();
    root.hidden = true;
    shot.hidden = true;
    document.documentElement.classList.remove('tryon-open');
    for (const sl of SLOTS) disposeSlot(sl.id);
    const o = S.o;
    S.o = null;
    if (o && o.onClose) o.onClose();
  }
  closeBtn.addEventListener('click', close);
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!shot.hidden) shot.hidden = true;
      else close();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (root.hidden) return;
    if (document.hidden) {
      S.running = false;
      stopStream();
      intro.hidden = false;
      setStatus('Paused');
    }
  });
  window.addEventListener('pagehide', stopStream);
  return { open, close, state: S };
}
