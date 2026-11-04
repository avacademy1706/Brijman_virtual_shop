// Camera try-on for glasses. The shopper's camera feed with the chosen frame drawn on them, live: the frame sits
// on the bridge of the nose with the lenses in front of the eyes, turns with the head, and its temples run back
// along the sides of the head (a depth-only stand-in for the head hides what would be behind it). The frame is
// drawn at its real size: the irises (about 11.7 mm across in every adult) give the scale in millimetres, which
// also measures the face width and the pupillary distance, so the try-on can suggest a frame size.
// Video never leaves the device: frames go from the camera to the GPU and the tracking model, nothing is uploaded.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { NY } from '../core/ny.js';
import '../data/catalogue.js';
import '../lib/drawings.js';
import { h, ic, money } from '../lib/dom.js';
import { frameGroup } from '../frames/geometry.js';
import { Tracker, ModelMissing } from './tracker.js';
import { Calibrator, glassesPose, FACE, FACE_MM } from './anchors.js';
import '../styles/tryon.css';

const DEBUG = typeof location !== 'undefined' && /[?&]tryondebug=1/.test(location.search);
const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
/** Carousel tabs. */
export const TABS = [
  { id: 'sun', n: 'Sunglasses' },
  { id: 'women', n: 'Women' },
  { id: 'men', n: 'Men' },
  { id: 'atelier', n: 'Atelier' },
  { id: 'kids', n: 'Kids' },
];
const FIT_TEXT = { good: 'a good fit', wide: 'a little wide', narrow: 'a little narrow' };

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
    ic('glasses'),
    h('span', null, 'See it in 3D instead'),
  );
  const introMsg = h('p', { class: 'to-error', hidden: true, role: 'alert' });
  const intro = h(
    'section',
    { class: 'to-intro' },
    h('span', { class: 'to-intro-ic' }, ic('camera')),
    h('h2', null, 'Try frames on with your camera'),
    h('p', null, 'Face the camera in good light, about an arm’s length away.'),
    h(
      'ul',
      { class: 'to-points' },
      h('li', null, ic('check'), h('span', null, 'Video stays on this device. Nothing is recorded or uploaded.')),
      h('li', null, ic('check'), h('span', null, 'Frames are shown at their real size, so you can judge the fit.')),
      h(
        'li',
        null,
        ic('check'),
        h('span', null, 'Look straight at the camera for a moment: we measure your face width and suggest a size.'),
      ),
    ),
    introMsg,
    h('div', { class: 'to-intro-actions' }, startBtn, viewerBtn),
  );
  const tabs = h('div', { class: 'chips to-slots', role: 'tablist', 'aria-label': 'Collections' });
  const carousel = h('div', { class: 'to-carousel', role: 'listbox', 'aria-label': 'Frames' });
  const pName = h('b', { class: 'to-pname' });
  const pPrice = h('span', { class: 'to-price' });
  const pMeta = h('span', { class: 'to-fit-size' });
  const swatches = h('div', { class: 'swatches to-swatches', role: 'radiogroup', 'aria-label': 'Colour' });
  const sizes = h('div', { class: 'chips to-sizes', role: 'radiogroup', 'aria-label': 'Frame size' });
  const fitBox = h('p', { class: 'to-fit', 'aria-live': 'polite' });
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
  const handle = h(
    'button',
    { class: 'to-handle', type: 'button', 'aria-expanded': 'true', 'aria-label': 'Hide the options' },
    h('span'),
  );
  const panel = h(
    'section',
    { class: 'to-panel', 'aria-label': 'Frame options' },
    handle,
    tabs,
    carousel,
    h(
      'div',
      { class: 'to-head' },
      h('div', { class: 'to-pinfo' }, pName, h('span', { class: 'to-meta' }, pPrice, pMeta)),
      h('div', { class: 'to-actions' }, photoBtn, bagBtn),
    ),
    h(
      'div',
      { class: 'to-row' },
      h('span', { class: 'to-label' }, 'Colour'),
      swatches,
      h('span', { class: 'to-label' }, 'Size'),
      sizes,
    ),
    fitBox,
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
  let renderer = null;
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 20000);
  cam.position.set(0, 0, 10000);
  scene.add(new THREE.HemisphereLight(0xfffcf6, 0x80766c, 0.95));
  const key = new THREE.DirectionalLight(0xfff8f0, 1.15);
  key.position.set(-0.35, 0.55, 0.75);
  const fill = new THREE.DirectionalLight(0xf2f5ff, 0.45);
  fill.position.set(0.6, 0.1, 0.6);
  const rim = new THREE.DirectionalLight(0xffffff, 0.5);
  rim.position.set(0.1, 0.6, -0.8);
  scene.add(key, fill, rim);
  // a depth-only stand-in for the head: the temples disappear behind it like behind the ears and hair
  const occMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), occMat);
  head.renderOrder = -1;
  head.matrixAutoUpdate = false;
  head.visible = false;
  scene.add(head);
  const holder = new THREE.Group();
  holder.matrixAutoUpdate = false;
  holder.visible = false;
  scene.add(holder);
  const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const basis = (X, Y, Z, o, sx, sy, sz) => {
    const m = new THREE.Matrix4().makeBasis(V(X), V(Y), V(Z));
    m.scale(new THREE.Vector3(sx, sy == null ? sx : sy, sz == null ? sx : sz));
    m.setPosition(o[0], o[1], o[2]);
    return m;
  };

  /* ------------------------------------------------------------------ state */
  const S = {
    o: null,
    pid: null,
    ci: 0,
    size: 'M',
    userSized: false,
    tab: 'sun',
    facing: 'user',
    stream: null,
    running: false,
    raf: 0,
    tracker: new Tracker(),
    cal: new Calibrator(),
    frame: null,
    lum: 0.5,
    lumT: 0,
    seen: false,
    loading: false,
    suggested: false,
    measured: null,
  };
  const P = () => NY.byId[S.pid];
  const frames = (tab) => NY.PRODUCTS.filter((p) => p.type === 'frame' && p.zone === tab);

  /* ------------------------------------------------------------------ the worn frame */
  function build() {
    if (S.frame) {
      holder.remove(S.frame);
      if (S.frame.userData.dispose) S.frame.userData.dispose();
      S.frame = null;
    }
    const p = P();
    if (!p) return;
    S.frame = frameGroup(p, S.ci, S.size, { lensOpacity: 0.7 });
    holder.add(S.frame);
  }
  function drawTabs() {
    tabs.replaceChildren(
      ...TABS.map((t) => {
        const b = h(
          'button',
          { class: 'chip', type: 'button', role: 'tab', 'aria-selected': t.id === S.tab ? 'true' : 'false' },
          t.n,
        );
        b.addEventListener('click', () => {
          S.tab = t.id;
          drawTabs();
          drawCarousel();
        });
        return b;
      }),
    );
  }
  function drawCarousel() {
    carousel.replaceChildren(
      ...frames(S.tab).map((p) => {
        const b = h(
          'button',
          {
            class: 'to-item',
            type: 'button',
            role: 'option',
            'aria-selected': p.id === S.pid ? 'true' : 'false',
            id: 'to-item-' + p.id,
          },
          h('span', { class: 'to-thumb', html: NY.frameSVG(p, 0, 70, 30) }),
          h('span', { class: 'to-iname' }, p.name),
        );
        b.addEventListener('click', () => choose(p.id, 0));
        return b;
      }),
    );
    const sel = carousel.querySelector('[aria-selected="true"]');
    if (sel) carousel.scrollLeft = Math.max(0, sel.offsetLeft - carousel.clientWidth / 2 + sel.clientWidth / 2);
  }
  function drawPanel() {
    const p = P();
    if (!p) return;
    pName.textContent = p.name;
    pPrice.textContent = money(p.price);
    pMeta.textContent = NY.colorOf(p, S.ci).n + ' · ' + NY.sizeLabel(p, S.size);
    swatches.replaceChildren(
      ...p.colors.map((c, i) => {
        const b = h('button', {
          class: 'swatch',
          type: 'button',
          role: 'radio',
          'aria-checked': i === S.ci ? 'true' : 'false',
          'aria-label': c.n,
          title: c.n,
          style: 'background:' + (c.sw2 ? 'linear-gradient(135deg,' + c.sw + ' 50%,' + c.sw2 + ' 50%)' : c.sw),
        });
        if (p.sun) b.append(h('span', { class: 'swatch-lens', style: 'background:' + c.l }));
        b.addEventListener('click', () => {
          S.ci = i;
          build();
          drawPanel();
        });
        return b;
      }),
    );
    sizes.replaceChildren(
      ...NY.SIZES.map((sz) => {
        const b = h(
          'button',
          {
            class: 'chip',
            type: 'button',
            role: 'radio',
            'aria-checked': sz.id === S.size ? 'true' : 'false',
            'aria-label': 'Size ' + NY.sizeName(p, sz.id),
            id: 'to-size-' + sz.id,
          },
          NY.sizeName(p, sz.id),
        );
        b.addEventListener('click', () => {
          S.size = sz.id;
          S.userSized = true;
          build();
          drawPanel();
        });
        return b;
      }),
    );
    drawFit();
  }
  function drawFit() {
    const p = P();
    if (!p) return;
    const m = S.measured;
    fitBox.replaceChildren();
    if (!m) {
      fitBox.append(
        ic('tape'),
        h(
          'span',
          null,
          S.running
            ? 'Measuring your face: look straight at the camera for a moment.'
            : 'Start the camera to measure your face and get a size suggestion.',
        ),
      );
      fitBox.dataset.fit = '';
      return;
    }
    const f = NY.fitFor(p, S.size, m.face);
    const best = NY.bestSize(p, m.face);
    fitBox.dataset.fit = f.fit;
    fitBox.append(
      ic('tape'),
      h(
        'span',
        null,
        h('b', null, 'Face ≈ ' + Math.round(m.face) + ' mm · PD ≈ ' + m.pd.toFixed(1) + ' mm. '),
        'Size ' +
          NY.sizeName(p, S.size) +
          ' (' +
          Math.round(NY.frameWidth(p, S.size)) +
          ' mm) is ' +
          FIT_TEXT[f.fit] +
          (best !== S.size
            ? '; size ' + NY.sizeName(p, best) + ' may suit you better.'
            : f.fit === 'good'
              ? '.'
              : ', the closest size in this style; a ' +
                (f.fit === 'wide' ? 'narrower' : 'wider') +
                ' style may suit you better.') +
          ' Approximate: an optician confirms it at your fitting.',
      ),
    );
  }
  function choose(pid, ci) {
    const p = NY.byId[pid];
    if (!p || p.type !== 'frame') return;
    S.pid = pid;
    S.ci = ci || 0;
    if (S.measured && !S.userSized) S.size = NY.bestSize(p, S.measured.face);
    S.tab = p.zone;
    build();
    drawTabs();
    drawCarousel();
    drawPanel();
  }
  // fold the panel away to see the face (phones)
  function setMin(min) {
    panel.classList.toggle('min', min);
    handle.setAttribute('aria-expanded', min ? 'false' : 'true');
    handle.setAttribute('aria-label', min ? 'Show the options' : 'Hide the options');
  }
  handle.addEventListener('click', () => setMin(!panel.classList.contains('min')));
  photoBtn.addEventListener('click', takePhoto);
  bagBtn.addEventListener('click', () => {
    if (S.o && S.o.addToBag) S.o.addToBag(S.pid, S.ci, { fs: S.size });
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
  function showModelError(e) {
    console.warn(e);
    // without tracking there is nothing to place: stop the camera and explain
    S.running = false;
    cancelAnimationFrame(S.raf);
    stopStream();
    holder.visible = false;
    if (renderer) renderer.clear();
    showGuide('');
    setStatus('Tracking unavailable');
    introMsg.textContent =
      e instanceof ModelMissing || (e && e.code === 'model-missing')
        ? 'The face tracking model is not installed on this site yet. (Developers: run npm run setup:tryon before building; see docs/TRYON.md.) You can still see every frame in 3D.'
        : 'Tracking could not start here. You can still see every frame in 3D.';
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
      // Asked for as 1280 x 720 whatever the screen's orientation, like the eyewear shop's try-on: phones describe camera
      // sizes sideways and turn the picture upright themselves (an upright phone gets 720 x 1280). Asking for 720 x 1280
      // matches no camera size, and many Android phones then send a wide picture that looks tiny or zoomed in.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: S.facing, width: { ideal: 1280 }, height: { ideal: 720 } },
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
      S.running = true;
      S.seen = false;
      loop();
      S.loading = true;
      setStatus('Loading tracking…');
      try {
        await S.tracker.ensure();
        S.loading = false;
        if (S.running) setStatus('Looking for you…');
      } catch (e) {
        S.loading = false;
        showModelError(e);
        return;
      }
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
              : 'The try-on could not start here. You can still see every frame in 3D.';
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
    const o = S.o,
      pid = S.pid,
      ci = S.ci,
      size = S.size;
    close();
    if (o && o.openProduct && pid) o.openProduct(pid, ci, size);
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
    scene.environmentIntensity = 0.7;
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
      // match the frame to the room: darker rooms, darker frame, within limits
      renderer.toneMappingExposure = Math.min(1.2, Math.max(0.65, 0.62 + S.lum * 1.05));
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
      if (video.currentTime !== S.lastVideoTime) {
        S.lastVideoTime = video.currentTime;
        const r = S.tracker.update(video, now);
        place(r);
        if (DEBUG) drawDebug(r, W, H);
      }
      sampleLight(now);
      renderer.render(scene, cam);
    };
    S.raf = requestAnimationFrame(tick);
  }
  /** Positions the frame and the head stand-in from the tracked face, and measures the face. */
  function place(r) {
    const face = r.face;
    if (face && !S.seen) {
      S.seen = true;
      panel.classList.add('live');
      // on phones and portrait tablets the panel covers the face: fold it once the shopper is in view
      if (window.matchMedia('(max-width: 760px), (orientation: portrait) and (max-width: 1100px)').matches)
        setMin(true);
    }
    if (!S.loading) {
      if (!face) {
        setStatus('Looking for you…');
        showGuide('Face the camera, about an arm’s length away');
      } else {
        setStatus('Tracking', 'ok');
        showGuide(S.measured ? '' : 'Look straight at the camera for a moment');
      }
    }
    holder.visible = !!face;
    head.visible = !!face;
    if (!face) return;
    const F = face.F;
    const s = S.cal.update(F, face.px);
    if (S.cal.ready) {
      const m = { face: S.cal.face, pd: S.cal.pd };
      const first = !S.measured;
      if (first || Math.abs(m.face - S.measured.face) > 0.8 || Math.abs(m.pd - S.measured.pd) > 0.4) {
        S.measured = m;
        if (S.o && S.o.onMeasure) S.o.onMeasure({ face: m.face, pd: m.pd });
        if (first && !S.userSized && P()) {
          const best = NY.bestSize(P(), m.face);
          if (best !== S.size) {
            S.size = best;
            build();
          }
          if (S.o && S.o.toast) S.o.toast('Size ' + NY.sizeName(P(), best) + ' suggested for your face');
        }
        drawPanel();
      }
    }
    const g = glassesPose(face.P, F, s);
    holder.matrix.copy(basis(g.X, g.Y, g.Z, g.o, s * 1000));
    // head: an ellipsoid as wide as the temples, whose front sits just behind the eyes (6 mm behind the cornea), so it
    // hides the temple arms past the cheeks but never the front of the frame. Measured from the lens plane: the face
    // origin (between the cheek points) lies near the ears, far behind the eyes.
    const halfW = (S.measured ? S.measured.face : 138) / 2;
    const RZ = 100;
    const back = (RZ + FACE_MM.vertex + 6) * s;
    const c = [0, 1, 2].map((i) => g.o[i] - F.Z[i] * back + F.Y[i] * 8 * s);
    head.matrix.copy(basis(F.X, F.Y, F.Z, c, (halfW + 3) * s, 112 * s, RZ * s));
  }
  function drawDebug(r, W, H) {
    const g = dbg.getContext('2d');
    g.clearRect(0, 0, W, H);
    const dot = (p, c) => {
      g.fillStyle = c;
      g.beginPath();
      g.arc(p[0] + W / 2, H / 2 - p[1], 4, 0, Math.PI * 2);
      g.fill();
    };
    if (r.raw) {
      g.fillStyle = 'rgba(31,43,69,.5)';
      for (const q of r.raw) g.fillRect(q.x * W - 1, q.y * H - 1, 2, 2);
    }
    if (r.face) {
      const P = r.face.P;
      for (const k of ['rightPupil', 'leftPupil', 'bridge']) dot(P[FACE[k]], '#ff4060');
      for (const k of ['rightTemple', 'leftTemple']) dot(P[FACE[k]], '#40c0ff');
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
    const grd = g.createLinearGradient(0, H - 76, 0, H);
    grd.addColorStop(0, 'rgba(24,20,16,0)');
    grd.addColorStop(1, 'rgba(24,20,16,.72)');
    g.fillStyle = grd;
    g.fillRect(0, H - 76, W, 76);
    const p = P();
    const label = p.name + ' · ' + NY.colorOf(p, S.ci).n + ' · ' + NY.sizeLabel(p, S.size);
    g.fillStyle = '#f6efe4';
    g.font = '500 24px "Bodoni Moda", Didot, Georgia, serif';
    g.fillText('BRIJMAN', 18, H - 24);
    g.font = '400 17px "Jost", "Futura", sans-serif';
    g.fillText(label, 112, H - 26);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const file = typeof File === 'function' ? new File([blob], 'brijman-try-on.jpg', { type: 'image/jpeg' }) : null;
    const img = h('img', { src: url, alt: 'Photo of you wearing ' + label });
    const dl = h(
      'a',
      { class: 'btn primary', href: url, download: 'brijman-try-on.jpg' },
      ic('download'),
      h('span', null, 'Save photo'),
    );
    const acts = h('div', { class: 'to-shot-actions' }, dl);
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      const share = h('button', { class: 'btn', type: 'button' }, h('span', null, 'Share'));
      share.addEventListener('click', () =>
        navigator.share({ files: [file], title: 'My Brijman Opticals try-on' }).catch(() => {}),
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
    const p0 = o.pid && NY.byId[o.pid] && NY.byId[o.pid].type === 'frame' ? NY.byId[o.pid] : NY.byId['s04'];
    S.pid = p0.id;
    S.ci = o.ci || 0;
    S.size = o.size || 'M';
    S.userSized = !!o.size && o.size !== 'M';
    S.tab = p0.zone;
    S.measured = o.fit && o.fit.face ? { face: o.fit.face, pd: o.fit.pd } : null;
    S.cal.reset();
    S.tracker.reset();
    build();
    root.hidden = false;
    document.documentElement.classList.add('tryon-open');
    intro.hidden = false;
    introMsg.hidden = true;
    panel.hidden = false;
    panel.classList.remove('live');
    setMin(false);
    drawTabs();
    drawCarousel();
    drawPanel();
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
    holder.visible = false;
    document.documentElement.classList.remove('tryon-open');
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
  return { open, close, choose, state: S };
}
