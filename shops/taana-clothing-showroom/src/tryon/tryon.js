// Camera try-on: the shopper's camera feed with the garment simulated over them, live.
// MediaPipe Pose tracks the body; the cloth engine drapes the garment on a matching body proxy every frame;
// depth-only occluders let real arms and the head pass in front of the cloth.
// Video never leaves the device: frames go from the camera to the GPU and the pose model, nothing is uploaded.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { NY } from '../core/ny.js';
import { h, ic, money } from '../lib/dom.js';
import { Outfit } from '../cloth/outfit.js';
import { defaultMeasurements, withShape, frames, SEG } from '../cloth/body.js';
import { bodyFromMeasurements } from '../cloth/measure.js';
import { createLandmarker, PoseTracker } from './tracker.js';
import '../styles/tryon.css';

const BODY_KIND = { women: 'female', men: 'male', kids: 'child', free: 'female' };
const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
const DEBUG = typeof location !== 'undefined' && /[?&]tryondebug=1/.test(location.search);
const BUILDS = { slim: 0.93, regular: 1, broad: 1.1 };

let T = null;
export function openTryOn(o) {
  if (!T) T = createTryOn();
  T.open(o || {});
}
export function closeTryOn() {
  if (T) T.close();
}

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
  const stage = h('div', { class: 'to-stage' }, video, canvas, dbg);
  const status = h('span', { class: 'to-status', role: 'status', 'aria-live': 'polite' }, 'Camera off');
  const closeBtn = h('button', { class: 'to-icon', type: 'button', 'aria-label': 'Close the try-on' }, ic('close'));
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
    flipBtn,
  );
  const guide = h('p', { class: 'to-guide', hidden: true, 'aria-live': 'polite' });
  const startBtn = h(
    'button',
    { class: 'btn primary', type: 'button', id: 'to-start' },
    ic('camera'),
    h('span', null, 'Start camera'),
  );
  const mannequinBtn = h(
    'button',
    { class: 'btn', type: 'button', id: 'to-mannequin' },
    ic('user'),
    h('span', null, 'Use the mannequin instead'),
  );
  const introMsg = h('p', { class: 'to-error', hidden: true, role: 'alert' });
  const intro = h(
    'section',
    { class: 'to-intro' },
    h('span', { class: 'to-intro-ic' }, ic('camera')),
    h('h2', null, 'Try it on with your camera'),
    h(
      'p',
      null,
      'Stand about two metres back so your shoulders and hips are in view. The garment drapes over you and moves as you move.',
    ),
    h(
      'ul',
      { class: 'to-points' },
      h('li', null, ic('check'), h('span', null, 'Video stays on this device. Nothing is recorded or uploaded.')),
      h('li', null, ic('check'), h('span', null, 'Good light, a plain background and only you in view help tracking.')),
    ),
    introMsg,
    h('div', { class: 'to-intro-actions' }, startBtn, mannequinBtn),
  );
  // bottom panel
  const pName = h('b', { class: 'to-pname' });
  const pPrice = h('span', { class: 'to-price' });
  const pFit = h('span', { class: 'to-fit' });
  const sizes = h('div', { class: 'chips to-sizes', role: 'radiogroup', 'aria-label': 'Size' });
  const pieceTabs = h('div', {
    class: 'chips to-pieces',
    role: 'radiogroup',
    'aria-label': 'Piece to adjust',
    hidden: true,
  });
  const swatches = h('div', { class: 'swatches to-swatches', role: 'radiogroup', 'aria-label': 'Colour' });
  const carousel = h('div', { class: 'to-carousel', role: 'listbox', 'aria-label': 'Garments' });
  const layers = h('div', { class: 'chips to-layers', role: 'radiogroup', 'aria-label': 'Layer on top' });
  const drapes = h('div', { class: 'chips to-drapes', role: 'radiogroup', 'aria-label': 'Drape', hidden: true });
  const builds = h('div', { class: 'chips to-builds', role: 'radiogroup', 'aria-label': 'Body build' });
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
  const moreBtn = h(
    'button',
    { class: 'to-more', type: 'button', 'aria-expanded': 'false' },
    h('span', null, 'More options'),
  );
  const extra = h(
    'div',
    { class: 'to-extra', hidden: true },
    h('div', { class: 'to-row' }, h('span', { class: 'to-label' }, 'Layer on top'), layers),
    h('div', { class: 'to-row', hidden: true, id: 'to-drape-row' }, h('span', { class: 'to-label' }, 'Drape'), drapes),
    h('div', { class: 'to-row' }, h('span', { class: 'to-label' }, 'Body'), builds),
  );
  // fold the panel away to see the whole body (phones)
  const handle = h(
    'button',
    { class: 'to-handle', type: 'button', 'aria-expanded': 'true', 'aria-label': 'Hide the options' },
    h('span'),
  );
  const panel = h(
    'section',
    { class: 'to-panel', 'aria-label': 'Garment options' },
    handle,
    carousel,
    h(
      'div',
      { class: 'to-head' },
      h('div', { class: 'to-pinfo' }, pName, h('span', { class: 'to-meta' }, pPrice, pFit)),
      h('div', { class: 'to-actions' }, photoBtn, bagBtn),
    ),
    h('div', { class: 'to-row' }, pieceTabs, sizes),
    h('div', { class: 'to-row' }, swatches),
    moreBtn,
    extra,
  );
  function setMin(min) {
    panel.classList.toggle('min', min);
    handle.setAttribute('aria-expanded', min ? 'false' : 'true');
    handle.setAttribute('aria-label', min ? 'Show the options' : 'Hide the options');
  }
  handle.addEventListener('click', () => setMin(!panel.classList.contains('min')));
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

  /* ------------------------------------------------------------------ 3D overlay */
  let renderer = null;
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 30);
  cam.position.set(0, 0, 10);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8178, 0.75);
  const key = new THREE.DirectionalLight(0xfff4e8, 1.55);
  key.position.set(0.6, 1.4, 2.2);
  const fill = new THREE.DirectionalLight(0xe8eeff, 0.45);
  fill.position.set(-1.5, 0.4, 1.2);
  scene.add(hemi, key, fill);
  // depth-only occluders: the shopper's arms, hands and head pass in front of the garment
  const occMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  const capGeo = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true);
  const ballGeo = new THREE.SphereGeometry(1, 14, 10);
  const occ = { group: new THREE.Group(), parts: [] };
  occ.group.renderOrder = -1;
  scene.add(occ.group);
  const mkOcc = (geo) => {
    const m = new THREE.Mesh(geo, occMat);
    m.renderOrder = -1;
    m.matrixAutoUpdate = false;
    occ.group.add(m);
    return m;
  };
  const OCC = {
    lUarm: mkOcc(capGeo),
    rUarm: mkOcc(capGeo),
    lFarm: mkOcc(capGeo),
    rFarm: mkOcc(capGeo),
    lHand: mkOcc(ballGeo),
    rHand: mkOcc(ballGeo),
    head: mkOcc(ballGeo),
    neck: mkOcc(capGeo),
    lElb: mkOcc(ballGeo),
    rElb: mkOcc(ballGeo),
  };
  const tA = new THREE.Vector3(),
    tB = new THREE.Vector3(),
    tD = new THREE.Vector3(),
    tQ = new THREE.Quaternion(),
    UP = new THREE.Vector3(0, 1, 0);
  function placeCap(mesh, a, b, r) {
    tA.fromArray(a);
    tB.fromArray(b);
    tD.subVectors(tB, tA);
    const L = tD.length() || 1e-3;
    tQ.setFromUnitVectors(UP, tD.multiplyScalar(1 / L));
    mesh.matrix.compose(tA.lerp(tB, 0.5), tQ, new THREE.Vector3(r, L, r));
    mesh.matrixWorldNeedsUpdate = true;
  }
  function placeBall(mesh, c, r, sy) {
    mesh.matrix.compose(tA.fromArray(c), tQ.identity(), new THREE.Vector3(r, r * (sy || 1), r));
    mesh.matrixWorldNeedsUpdate = true;
  }
  function updateOccluders(J, m) {
    const F = frames(J);
    const T0 = F[SEG.TORSO];
    // Arms only occlude when they are clearly in front of the torso (arms crossed, hand on the waist).
    // Beside the body, tracking depth is too noisy and would punch holes in the garment.
    const inFront = (p) => {
      const d = [p[0] - T0.o[0], p[1] - T0.o[1], p[2] - T0.o[2]];
      const lx = d[0] * T0.x[0] + d[1] * T0.x[1] + d[2] * T0.x[2];
      const lz = d[0] * T0.z[0] + d[1] * T0.z[1] + d[2] * T0.z[2];
      return Math.abs(lx) < m.chestA * 1.05 && lz > m.chestB * 0.9;
    };
    const hand = (W, E) => {
      const d = [W[0] - E[0], W[1] - E[1], W[2] - E[2]];
      const l = Math.hypot(d[0], d[1], d[2]) || 1;
      return [W[0] + (d[0] / l) * 0.075, W[1] + (d[1] / l) * 0.075, W[2] + (d[2] / l) * 0.075];
    };
    for (const sd of ['l', 'r']) {
      const E = J[sd + 'Elbow'],
        W = J[sd + 'Wrist'];
      const mid = [(E[0] + W[0]) / 2, (E[1] + W[1]) / 2, (E[2] + W[2]) / 2];
      const hp = hand(W, E);
      const fo = inFront(mid),
        ho = inFront(hp);
      OCC[sd + 'Farm'].visible = fo;
      OCC[sd + 'Elb'].visible = fo && inFront(E);
      OCC[sd + 'Hand'].visible = ho;
      OCC[sd + 'Uarm'].visible = inFront(J[sd + 'Elbow']) && inFront(J[sd + 'Shoulder']);
      placeCap(OCC[sd + 'Uarm'], J[sd + 'Shoulder'], E, m.upperArmR * 0.85);
      placeCap(OCC[sd + 'Farm'], E, W, m.foreArmR * 0.85);
      placeBall(OCC[sd + 'Elb'], E, m.foreArmR * 0.9);
      placeBall(OCC[sd + 'Hand'], hp, m.foreArmR * 0.85, 1.25);
    }
    const up = (s) => [T0.o[0] + T0.y[0] * s, T0.o[1] + T0.y[1] * s, T0.o[2] + T0.y[2] * s];
    const headC = up(m.shoulderW * 0.62);
    placeBall(OCC.head, headC, m.headR * 1.05, 1.18);
    placeCap(OCC.neck, up(0.03), up(m.shoulderW * 0.4), m.neckR * 0.95);
  }

  /* ------------------------------------------------------------------ state */
  const S = {
    o: null,
    stream: null,
    facing: 'user',
    running: false,
    landmarker: null,
    detectErrors: 0, // detection errors in a row
    tracker: new PoseTracker(),
    outfit: null,
    outfitKey: '',
    m: null,
    calibrated: false,
    kind: 'women',
    base: null, // { pid, ci, si }
    layer: null, // { pid, ci, si } outer piece (jacket or dupatta)
    drape: 'stole',
    build: 'regular',
    focus: 'base',
    J: null,
    lastVideoTime: -1,
    raf: 0,
    last: 0,
    fps: 0,
    seen: false,
    lum: 0.5,
    lumT: 0,
  };
  NY.tryonState = S;

  const pieceProducts = () => [S.base, S.layer].filter(Boolean).map((x) => NY.byId[x.pid]);
  const isOuter = (p) => p.type === 'dupatta' || p.cat === 'jacket';
  const mainSel = () => (S.focus === 'layer' && S.layer ? S.layer : S.base || S.layer);

  /* ------------------------------------------------------------------ body */
  function bodyKindFor() {
    const p = NY.byId[(S.base || S.layer).pid];
    return p.kind === 'free' ? 'women' : p.kind;
  }
  /** Body proxy: lengths from tracking, girths from the shopper's saved measurements if any, then the build. */
  function makeBody(tracked) {
    const kind = S.kind;
    let m = tracked ? Object.assign({}, tracked) : defaultMeasurements(BODY_KIND[kind]);
    m = withShape(m, BODY_KIND[kind]);
    const saved = NY.userBody ? NY.userBody(kind) : null;
    if (saved) {
      const k = m.shoulderW / saved.shoulderW;
      for (const g of ['chestA', 'chestB', 'waistA', 'waistB', 'hipA', 'hipB']) m[g] = saved[g] * Math.pow(k, 0.5);
    }
    // silhouette widths from the camera, so the garment covers the shopper's real outline
    const w = S.widths;
    if (w && !saved) {
      const fitW = (a, cur) => (a > 0 ? Math.min(cur * 1.45, Math.max(cur * 0.75, a)) : cur);
      const ca = fitW(w.chest, m.chestA),
        wa = fitW(w.waist, m.waistA),
        ha = fitW(w.hip, m.hipA);
      m.chestB *= ca / m.chestA;
      m.waistB *= wa / m.waistA;
      m.hipB *= ha / m.hipA;
      m.chestA = ca;
      m.waistA = wa;
      m.hipA = ha;
    }
    const b = BUILDS[S.build] || 1;
    for (const g of ['chestA', 'chestB', 'waistA', 'waistB', 'hipA', 'hipB']) m[g] *= b;
    m.upperArmR *= b;
    m.foreArmR *= Math.sqrt(b);
    return m;
  }
  const girth = (m) => NY.girth(m.chestA, m.chestB);
  // Height used to fix the camera's absolute scale: the shopper's own if saved, else a typical height.
  const AVG_HEIGHT = { women: 1.58, men: 1.7, kids: 1.3 };
  function setHeightPrior() {
    const b = NY.savedBody ? NY.savedBody() : null;
    const hgt = b && b.kind === S.kind && b.height ? b.height / 100 : AVG_HEIGHT[S.kind] || 1.6;
    S.tracker.setHeight(hgt, BODY_KIND[S.kind]);
    S.heightKnown = !!(b && b.kind === S.kind && b.height);
  }

  /* ------------------------------------------------------------------ outfit */
  function specOf(sel, outer) {
    const p = NY.byId[sel.pid];
    const spec = NY.specFor(p, sel.si, sel.ci);
    if (p.type === 'dupatta') spec.drape = S.drape;
    if (outer && !spec.layer) spec.layer = 1;
    return spec;
  }
  function rebuildOutfit(force) {
    if (!S.m) return;
    const sels = [S.base, S.layer].filter(Boolean);
    const key = JSON.stringify([sels.map((s) => [s.pid, s.si]), S.drape, S.m.shoulderW, S.m.chestA, S.build]);
    const specs = sels.map((s, i) => specOf(s, i > 0 || isOuter(NY.byId[s.pid])));
    if (S.outfit && S.outfitKey === key && !force) {
      specs.forEach((sp, i) => S.outfit.setLook(i, sp));
      return;
    }
    if (S.outfit) {
      scene.remove(S.outfit.group);
      S.outfit.dispose();
    }
    S.outfit = new Outfit({
      m: S.m,
      pieces: specs.map((spec) => ({ spec })),
      res: coarse ? 0.66 : 0.85,
      substeps: coarse ? 2 : 3,
      texSize: 512,
      legs: true,
    });
    S.outfitKey = key;
    scene.add(S.outfit.group);
  }

  /* ------------------------------------------------------------------ panel */
  function tryonProducts() {
    // products from the current product's zone first, then everything else
    const cur = NY.byId[(S.base || S.layer).pid];
    const all = NY.PRODUCTS.slice();
    all.sort((a, b) => (a.zone === cur.zone ? 0 : 1) - (b.zone === cur.zone ? 0 : 1));
    return all;
  }
  function drawCarousel() {
    carousel.replaceChildren(
      ...tryonProducts().map((p) => {
        const on = (S.base && S.base.pid === p.id) || (S.layer && S.layer.pid === p.id);
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
          h('span', { class: 'to-thumb', html: NY.garmentSVG(p, on ? mainSel().ci : 0, 40, 48) }),
          h(
            'span',
            { class: 'to-iname' },
            p.name.replace(/ (Kurta|Anarkali|Dress|Tee|Shirt|Dupatta|Jacket|Stole)$/, ''),
          ),
        );
        b.addEventListener('click', () => pickProduct(p.id));
        return b;
      }),
    );
  }
  function pickProduct(pid, ci, si) {
    const p = NY.byId[pid];
    const pk = p.kind === 'free' ? null : p.kind;
    // a different body (women, men, kids) drops pieces that don't fit it
    if (pk && pk !== S.kind) {
      if (S.layer && NY.byId[S.layer.pid].kind !== 'free') S.layer = null;
      if (S.base && NY.byId[S.base.pid].kind !== pk) S.base = null;
      S.kind = pk;
      S.trackedM = null;
      S.calibrated = false;
      S.tracker.samples = [];
      S.tracker.scaleSamples = [];
      S.tracker.corr = 1;
      setHeightPrior();
      S.m = S.J ? makeBody(scaleBody(S.J)) : null;
    }
    const sel = { pid, ci: ci || 0, si: si != null ? si : recommended(p), auto: si == null };
    if (isOuter(p)) {
      S.layer = sel;
      S.focus = 'layer';
    } else {
      S.base = sel;
      S.focus = 'base';
    }
    if (p.type === 'dupatta' && p.drape) S.drape = p.drape;
    rebuildOutfit();
    drawPanel();
    drawCarousel();
  }
  function recommended(p) {
    if (p.type === 'dupatta') return 0;
    const m = S.m || makeBody(null);
    return NY.recommendSize(p, girth(m));
  }
  function drawPanel() {
    const sel = mainSel();
    const p = NY.byId[sel.pid];
    const prods = pieceProducts();
    pName.textContent = prods.map((x) => x.name).join(' + ');
    pieceTabs.hidden = !(S.base && S.layer);
    if (S.base && S.layer)
      pieceTabs.replaceChildren(
        ...[
          ['base', NY.byId[S.base.pid]],
          ['layer', NY.byId[S.layer.pid]],
        ].map(([id, q]) => {
          const c = h(
            'button',
            {
              class: 'chip',
              type: 'button',
              role: 'radio',
              'aria-checked': (S.focus === id) === true ? 'true' : 'false',
              id: 'to-piece-' + id,
            },
            q.type === 'dupatta' ? 'Dupatta' : NY.CAT_LABEL[q.cat].replace(/s$/, ''),
          );
          c.addEventListener('click', () => {
            S.focus = id;
            drawPanel();
          });
          return c;
        }),
      );
    pPrice.textContent = money(prods.reduce((a, x) => a + x.price, 0));
    // sizes for the piece the shopper picked last
    sizes.replaceChildren();
    if (p.type !== 'dupatta') {
      const rec = recommended(p);
      NY.SIZES[p.kind].forEach(([n], i) => {
        const c = h(
          'button',
          {
            class: 'chip' + (i === rec ? ' has-badge' : ''),
            type: 'button',
            role: 'radio',
            'aria-checked': i === sel.si ? 'true' : 'false',
            id: 'to-size-' + i,
          },
          n,
          i === rec ? h('span', { class: 'chip-badge' }, 'Fit') : null,
        );
        c.addEventListener('click', () => {
          sel.si = i;
          sel.auto = false;
          rebuildOutfit();
          drawPanel();
        });
        sizes.append(c);
      });
      const m = S.m || makeBody(null);
      const ease = NY.garmentChest(p, sel.si) - girth(m);
      pFit.textContent = ' · ' + NY.fitWord(ease) + (S.calibrated ? ' on you' : '');
    } else {
      sizes.append(h('span', { class: 'to-note' }, 'Free size'));
      pFit.textContent = '';
    }
    swatches.replaceChildren(
      ...p.colors.map((c, i) => {
        const b = h('button', {
          class: 'swatch',
          type: 'button',
          role: 'radio',
          'aria-checked': i === sel.ci ? 'true' : 'false',
          'aria-label': c.n,
          title: c.n,
          style:
            'background:' +
            (c.accent ? 'radial-gradient(circle at 70% 30%,' + c.accent + ' 0 22%,transparent 24%),' + c.base : c.base),
        });
        b.addEventListener('click', () => {
          sel.ci = i;
          rebuildOutfit();
          drawPanel();
          drawCarousel();
        });
        return b;
      }),
    );
    // layers: none + outer pieces for this body
    const outers = NY.PRODUCTS.filter((q) => isOuter(q) && (q.kind === 'free' || q.kind === S.kind));
    const lay = [{ id: '', n: 'None' }].concat(
      outers.map((q) => ({ id: q.id, n: q.name.replace(/ (Dupatta|Jacket|Stole)$/, '') })),
    );
    layers.replaceChildren(
      ...lay.map((o) => {
        const on = (S.layer ? S.layer.pid : '') === o.id;
        const c = h(
          'button',
          {
            class: 'chip',
            type: 'button',
            role: 'radio',
            'aria-checked': on ? 'true' : 'false',
            id: 'to-layer-' + (o.id || 'none'),
          },
          o.n,
        );
        c.addEventListener('click', () => {
          if (!o.id) {
            if (!S.base) return; // keep at least one piece on
            S.layer = null;
            S.focus = 'base';
          } else {
            S.layer = { pid: o.id, ci: 0, si: recommended(NY.byId[o.id]), auto: true };
            S.focus = 'layer';
            if (NY.byId[o.id].drape) S.drape = NY.byId[o.id].drape;
          }
          rebuildOutfit();
          drawPanel();
          drawCarousel();
        });
        return c;
      }),
    );
    const hasDup = prods.some((x) => x.type === 'dupatta');
    extra.querySelector('#to-drape-row').hidden = !hasDup;
    drapes.replaceChildren(
      ...[
        ['stole', 'Stole'],
        ['shoulder', 'One shoulder'],
      ].map(([id, n]) => {
        const c = h(
          'button',
          {
            class: 'chip',
            type: 'button',
            role: 'radio',
            'aria-checked': S.drape === id ? 'true' : 'false',
            id: 'to-drape-' + id,
          },
          n,
        );
        c.addEventListener('click', () => {
          S.drape = id;
          rebuildOutfit(true);
          drawPanel();
        });
        return c;
      }),
    );
    builds.replaceChildren(
      ...[
        ['slim', 'Slim'],
        ['regular', 'Regular'],
        ['broad', 'Broad'],
      ].map(([id, n]) => {
        const c = h(
          'button',
          {
            class: 'chip',
            type: 'button',
            role: 'radio',
            'aria-checked': S.build === id ? 'true' : 'false',
            id: 'to-build-' + id,
          },
          n,
        );
        c.addEventListener('click', () => {
          S.build = id;
          if (S.m) S.m = makeBody(S.trackedM || (S.J ? scaleBody(S.J) : null));
          rebuildOutfit(true);
          drawPanel();
        });
        return c;
      }),
    );
  }
  moreBtn.addEventListener('click', () => {
    const open = extra.hidden;
    extra.hidden = !open;
    moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    moreBtn.firstChild.textContent = open ? 'Fewer options' : 'More options';
  });
  bagBtn.addEventListener('click', () => {
    for (const sel of [S.base, S.layer].filter(Boolean)) if (S.o && S.o.addToBag) S.o.addToBag(sel.pid, sel.ci, sel.si);
  });

  /* ------------------------------------------------------------------ camera */
  function setStatus(t, kind) {
    status.textContent = t;
    status.dataset.kind = kind || '';
  }
  function showGuide(t) {
    if (!t) {
      guide.hidden = true;
      return;
    }
    guide.textContent = t;
    guide.hidden = false;
  }
  /** Replaces a GPU tracker that fails on every frame (some phones) with a CPU one; tracking resumes once loaded. */
  function toCpu() {
    const old = S.landmarker;
    S.landmarker = null;
    S.delegate = 'CPU';
    try {
      if (old) old.close();
    } catch (e) {
      /* already gone */
    }
    // masks only while the body is still being measured
    S.cpuLoading = createLandmarker(S.model || 'lite', !S.calibrated, ['CPU']).then(
      (r) => {
        S.landmarker = r.landmarker;
        S.model = r.model;
        S.detectErrors = 0;
        S.cpuLoading = null;
      },
      (e) => {
        S.cpuLoading = null;
        console.warn(e);
      },
    );
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
      await video.play().catch(() => {});
      root.classList.toggle('mirrored', S.facing === 'user');
      intro.hidden = true;
      panel.hidden = false;
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        flipBtn.hidden = devs.filter((d) => d.kind === 'videoinput').length < 2;
      } catch (e) {
        flipBtn.hidden = true;
      }
      setStatus('Loading body tracking…');
      if (!S.landmarker && S.cpuLoading) await S.cpuLoading;
      if (!S.landmarker) {
        const r = await createLandmarker(coarse ? 'lite' : 'full');
        S.landmarker = r.landmarker;
        S.delegate = r.delegate;
        S.model = r.model;
      }
      ensureRenderer();
      S.running = true;
      S.seen = false;
      setStatus('Looking for you…');
      showGuide('Step back until your shoulders and hips are in view.');
      loop();
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
              : 'The try-on could not start here. You can still see every garment on the mannequin.';
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
  }
  flipBtn.addEventListener('click', () => {
    S.facing = S.facing === 'user' ? 'environment' : 'user';
    S.tracker.reset();
    startCamera();
  });
  startBtn.addEventListener('click', startCamera);
  mannequinBtn.addEventListener('click', () => {
    const sel = mainSel();
    const o = S.o;
    close();
    if (o && o.openProduct && sel) o.openProduct(sel.pid, sel.ci);
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
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.setPixelRatio(1);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    scene.environmentIntensity = 0.5;
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
      // match the garment to the room: darker rooms get a darker garment, with limits
      renderer.toneMappingExposure = Math.min(1.25, Math.max(0.55, 0.55 + S.lum * 1.1));
    } catch (e) {
      /* ignore */
    }
  }
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
        const va = W / H,
          sa = root.clientWidth / Math.max(1, root.clientHeight);
        root.classList.toggle('fit-contain', (va < 0.8 && sa > 1.15) || (va > 1.25 && sa < 0.8));
        canvas.width = W;
        canvas.height = H;
        renderer.setSize(W, H, false);
        dbg.width = W;
        dbg.height = H;
      }
      const dt = Math.min(1 / 30, Math.max(0.001, (now - S.last) / 1000));
      S.last = now;
      S.fps += (1 / dt - S.fps) * 0.05;
      if (video.currentTime !== S.lastVideoTime && !S.optionsBusy && S.landmarker) {
        S.lastVideoTime = video.currentTime;
        let res = null;
        try {
          res = S.landmarker.detectForVideo(video, now);
          S.detectErrors = 0;
        } catch (e) {
          console.warn(e);
          // Some phones load the GPU delegate and then fail on every frame: rebuild the tracker on the CPU.
          if (++S.detectErrors >= 5 && S.delegate !== 'CPU') toCpu();
        }
        const J = S.tracker.update(res, W, H, now);
        onPose(J);
        if (DEBUG) drawDebug(res, W, H);
      }
      sampleLight(now);
      if (S.J && S.outfit) {
        S.outfit.step(S.J, dt, { legs: true });
        S.outfit.sync();
        updateOccluders(S.J, S.m);
        const s = S.tracker.scale;
        cam.left = (-W / 2) * s;
        cam.right = (W / 2) * s;
        cam.top = (H / 2) * s;
        cam.bottom = (-H / 2) * s;
        cam.updateProjectionMatrix();
        S.outfit.group.visible = true;
        occ.group.visible = true;
      } else if (S.outfit) {
        S.outfit.group.visible = false;
      }
      renderer.render(scene, cam);
    };
    S.raf = requestAnimationFrame(tick);
  }
  function onPose(J) {
    if (!J) {
      if (S.J) {
        S.J = null;
        setStatus('Looking for you…');
        showGuide('Step into view. Keep your shoulders in the frame.');
      }
      return;
    }
    const firstSight = !S.J;
    // body proxy: provisional from the first frames, then the calibrated median
    if (!S.m) {
      S.trackedM = null;
      S.m = makeBody(scaleBody(J));
      rebuildOutfit(true);
      drawPanel();
    }
    if (!S.calibrated) {
      const ready =
        S.tracker.samples.length >= 12 && (S.tracker.widthSamples.length >= 6 || S.tracker.samples.length >= 40);
      if (ready) S.tracker.calibrateScale();
      const m = ready ? S.tracker.measurements(BODY_KIND[S.kind]) : null;
      const w = ready ? S.tracker.widths() : null;
      if (m) {
        S.calibrated = true;
        S.widths = w;
        S.tracker.wantWidths = false;
        if (S.landmarker && S.landmarker.setOptions) {
          S.optionsBusy = true;
          S.landmarker
            .setOptions({ outputSegmentationMasks: false })
            .catch(() => {})
            .finally(() => (S.optionsBusy = false));
        }
        S.trackedM = m;
        S.m = makeBody(m);
        S.tracker.m = S.m;
        // sizes the shopper hasn't picked by hand follow the measured body
        for (const sl of [S.base, S.layer]) if (sl && sl.auto) sl.si = recommended(NY.byId[sl.pid]);
        rebuildOutfit(true);
        drawPanel();
        if (S.o && S.o.toast)
          S.o.toast(
            S.heightKnown
              ? 'Measured you from the camera using your saved height.'
              : 'Measured you from the camera. Add your height in My measurements for exact sizes.',
          );
      }
    }
    // big jumps (tracking glitches) move the cloth with the body instead of flinging it
    if (S.J && !firstSight) {
      const a = S.J.lShoulder,
        b = J.lShoulder;
      const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      if (d > 0.35) S.outfit && S.outfit.reset();
      else if (d > 0.08) S.outfit && S.outfit.translate(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    } else if (S.outfit) S.outfit.reset();
    S.J = J;
    const v = S.tracker.vis;
    const hipsIn = v.lHip > 0.5 && v.rHip > 0.5;
    setStatus(S.calibrated ? 'Tracking' : 'Measuring…', 'ok');
    // folded arms or hands held in front of the body (both wrists in front of the torso): the sleeves cannot follow
    // and the hands cut into the garment, so ask for relaxed arms
    const mid = (J.lShoulder[0] + J.rShoulder[0]) / 2;
    const half = Math.abs(J.lShoulder[0] - J.rShoulder[0]) / 2;
    const inFront = (w) => v[w] > 0.3 && Math.abs(J[w][0] - mid) < 0.8 * half;
    // timed (whatever the frame rate), so the hint neither flickers nor appears for a passing gesture
    const held = inFront('lWrist') && inFront('rWrist');
    const t = performance.now();
    if (held) {
      S.armsFreeAt = 0;
      S.armsInFrontAt = S.armsInFrontAt || t;
      if (t - S.armsInFrontAt > 500) S.crossed = true;
    } else {
      S.armsInFrontAt = 0;
      S.armsFreeAt = S.armsFreeAt || t;
      if (t - S.armsFreeAt > 2000) S.crossed = false;
    }
    showGuide(
      S.crossed
        ? 'Let your arms hang by your sides, so the sleeves can follow them.'
        : hipsIn
          ? ''
          : 'Step back a little so your hips are in view. The fit is better.',
    );
    if (!S.seen) {
      S.seen = true;
      panel.classList.add('live');
      // on phones (upright or sideways) and portrait tablets the panel covers the body: fold it once the shopper is
      // in view
      if (
        window.matchMedia('(max-width: 760px), (max-height: 500px), (orientation: portrait) and (max-width: 1100px)')
          .matches
      )
        setMin(true);
    }
  }
  /** Provisional body from one frame: default proportions scaled to the tracked shoulder width. */
  function scaleBody(J) {
    const base = defaultMeasurements(BODY_KIND[S.kind]);
    const sw = Math.hypot(
      J.lShoulder[0] - J.rShoulder[0],
      J.lShoulder[1] - J.rShoulder[1],
      J.lShoulder[2] - J.rShoulder[2],
    );
    const k = Math.min(1.35, Math.max(0.7, sw / base.shoulderW));
    const m = Object.assign({}, base);
    for (const q of ['shoulderW', 'torsoLen', 'hipJointW', 'upperArm', 'foreArm', 'thigh', 'shin']) m[q] = base[q] * k;
    return m;
  }
  function drawDebug(res, W, H) {
    const g = dbg.getContext('2d');
    g.clearRect(0, 0, W, H);
    const lm = res && res.landmarks && res.landmarks[0];
    if (!lm) return;
    g.fillStyle = '#e3b765';
    for (const p of lm) {
      g.beginPath();
      g.arc(p.x * W, p.y * H, 5, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffffff';
    g.font = '16px monospace';
    g.fillText(S.fps.toFixed(0) + ' fps · ' + S.delegate + ' · ' + S.model, 12, 24);
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
    g.fillStyle = 'rgba(20,18,30,0.55)';
    g.fillRect(0, H - 44, W, 44);
    g.fillStyle = '#f4efe4';
    g.font = '600 18px "Hanken Grotesk", system-ui, sans-serif';
    g.fillText(
      'Taana Studio · ' +
        pieceProducts()
          .map((p) => p.name)
          .join(' + '),
      16,
      H - 16,
    );
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const file = typeof File === 'function' ? new File([blob], 'taana-try-on.jpg', { type: 'image/jpeg' }) : null;
    const img = h('img', { src: url, alt: 'Photo of you wearing ' + pName.textContent });
    const dl = h(
      'a',
      { class: 'btn primary', href: url, download: 'taana-try-on.jpg' },
      ic('download'),
      h('span', null, 'Save photo'),
    );
    const acts = h('div', { class: 'to-shot-actions' }, dl);
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      const share = h('button', { class: 'btn', type: 'button' }, h('span', null, 'Share'));
      share.addEventListener('click', () => navigator.share({ files: [file], title: 'My try-on' }).catch(() => {}));
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
  photoBtn.addEventListener('click', takePhoto);

  /* ------------------------------------------------------------------ open / close */
  function open(o) {
    S.o = o;
    const look = o.look && o.look.length ? o.look : null;
    S.base = null;
    S.layer = null;
    S.m = null;
    S.trackedM = null;
    S.calibrated = false;
    S.focus = 'base';
    S.drape = o.drape || 'stole';
    const first = look ? look[0] : o.pid ? [o.pid, o.ci || 0] : null;
    const pid0 = first ? first[0] : NY.PRODUCTS.find((p) => p.zone === 'ethnic').id;
    const p0 = NY.byId[pid0];
    S.kind = p0.kind === 'free' ? 'women' : p0.kind;
    const sel = (pid, ci, si) => ({
      pid,
      ci: ci || 0,
      si: si != null ? si : recommended(NY.byId[pid]),
      auto: si == null,
    });
    if (isOuter(p0) && !look) {
      S.layer = sel(pid0, first ? first[1] : 0, o.si);
      S.focus = 'layer';
    } else S.base = sel(pid0, first ? first[1] : 0, look ? null : o.si);
    if (look && look[1]) S.layer = sel(look[1][0], look[1][1]);
    if (p0.type === 'dupatta' && !o.drape) S.drape = p0.drape || 'stole';
    S.tracker.reset();
    S.tracker.m = null;
    S.tracker.corr = 1;
    setHeightPrior();
    S.tracker.widthSamples = [];
    S.tracker.wantWidths = true;
    S.widths = null;
    if (S.landmarker && S.landmarker.setOptions) {
      S.optionsBusy = true;
      S.landmarker
        .setOptions({ outputSegmentationMasks: true })
        .catch(() => {})
        .finally(() => (S.optionsBusy = false));
    }
    root.hidden = false;
    document.documentElement.classList.add('tryon-open');
    intro.hidden = false;
    panel.hidden = false;
    panel.classList.remove('live');
    setMin(false);
    drawPanel();
    drawCarousel();
    setStatus('Camera off');
    showGuide('');
    setTimeout(() => startBtn.focus({ preventScroll: true }), 30);
  }
  function close() {
    S.running = false;
    cancelAnimationFrame(S.raf);
    stopStream();
    root.hidden = true;
    shot.hidden = true;
    document.documentElement.classList.remove('tryon-open');
    if (S.outfit) {
      scene.remove(S.outfit.group);
      S.outfit.dispose();
      S.outfit = null;
      S.outfitKey = '';
    }
    S.J = null;
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
  return { open, close };
}
