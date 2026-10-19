// Virtual try-on interface: privacy notice, live mirror, sizes, colours, browsing, fit guide, photos and add to bag.
// Loaded only when a shopper taps "Try on". It talks to the engine only through engine.js's public API.
import './tryon.css';

import { BM } from '../core/bm.js';
import { h, ic } from '../lib/dom.js';
import { sizeOf, sizeMarking, fitResult, suggestSize } from '../../shared/fit.js';
import { track } from './analytics.js';
import { pushLayer, dropLayer } from '../ui/history.js';

const MAX_PHOTOS = 4;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const RM = !!BM.reduceMotion;
const DEBUG = /[?&]tryon-debug\b/.test(location.search);

const MSG = {
  blocked: 'Camera is blocked. Allow it in your browser settings, or use a photo instead.',
  failed: 'Try-on couldn’t start on this device. You can still use a photo.',
  insecure: 'Camera needs a secure (https) page.',
  noCamera: 'No camera was found. You can use a photo instead.',
  inApp: 'Open in Chrome or Safari to use the camera, or use a photo instead.',
  look: 'Look at the camera',
  noFace: 'No face found in this photo. Use a clear, front-facing photo in good light.',
  manyFaces: 'More than one face is in this photo. Use a photo of just you.',
  badFile: 'This file can’t be opened. Use a JPEG or PNG photo up to 10 MB.',
  loading: 'Loading try-on (about 15 MB, only the first time)',
};

let open = null; // the current session; only one at a time

/** In-app browsers (WhatsApp, Instagram, Facebook and similar) often block the camera. */
export const inAppBrowser = () =>
  /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Snapchat|Line\/|LinkedInApp|; wv\)/i.test(navigator.userAgent || '');

/**
 * Opens the try-on.
 * @param {{pid: string, ci: number, sizeId: string, settings: object, saveSettings: Function, onClose: Function,
 *   onAddToBag: (pid: string, ci: number, sizeId: string) => void}} o
 */
export function openTryOn(o) {
  if (open) return;
  open = new Session(o);
}

class Session {
  constructor(o) {
    this.o = o;
    this.p = BM.byId[o.pid];
    this.ci = o.ci;
    this.sizeId = sizeOf(this.p, o.sizeId).id;
    this.nudge = 0;
    this.photos = [];
    this.engine = null;
    this.stream = null;
    this.video = null;
    this.widths = [];
    this.lastFit = null;
    this.mode = null; // 'camera' | 'photo'
    this.camToken = 0;
    this.lastFocus = document.activeElement;
    // Back (the phone's button or gesture) closes the try-on instead of leaving the site.
    this.layer = pushLayer('tryon', () => {
      this.layer = null;
      this.close(true);
    });
    this.compareLayer = null;
    this.build();
    track('tryon_open', { productId: this.p.id });
    if (this.o.settings.tryonConsent) this.startCamera();
    else this.showPrivacy();
  }

  /* ---------- Layout ---------- */
  build() {
    this.live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
    this.stage = h('div', { class: 'tryon-stage' });
    this.message = h('div', { class: 'tryon-message', role: 'status', hidden: true });
    this.debug = DEBUG ? h('pre', { class: 'tryon-debug' }) : null;
    this.closeBtn = h(
      'button',
      { class: 'tryon-icon', type: 'button', 'aria-label': 'Close try-on', onclick: () => this.close() },
      ic('close'),
    );
    this.title = h('div', { class: 'tryon-title' });
    this.fitChip = h('button', {
      class: 'tryon-fit',
      type: 'button',
      'aria-expanded': 'false',
      'aria-controls': 'tryon-fit-info',
      hidden: true,
      onclick: () => this.toggleFitInfo(),
    });
    this.fitInfo = h('div', { class: 'tryon-pop', id: 'tryon-fit-info', hidden: true });
    const top = h('header', { class: 'tryon-top' }, this.closeBtn, this.title, this.fitChip);
    this.nudgeBox = h(
      'div',
      { class: 'tryon-nudge', role: 'group', 'aria-label': 'Move the frame on your nose' },
      (this.nudgeUp = this.iconBtn('up', 'Move frame up', () => this.setNudge(this.nudge + this.nudgeStep()))),
      (this.nudgeReset = this.iconBtn('reset', 'Reset frame position', () => this.setNudge(0))),
      (this.nudgeDown = this.iconBtn('down', 'Move frame down', () => this.setNudge(this.nudge - this.nudgeStep()))),
      (this.nudgeVal = h('span', { class: 'tryon-nudge-val', 'aria-hidden': 'true', hidden: true })),
    );
    this.colours = h('div', { class: 'tryon-row', role: 'radiogroup', 'aria-label': 'Colour' });
    this.sizes = h('div', { class: 'tryon-row', role: 'radiogroup', 'aria-label': 'Size' });
    this.carousel = h('div', { class: 'tryon-carousel', role: 'list', 'aria-label': 'Other frames in this section' });
    this.captureBtn = h(
      'button',
      { class: 'tryon-capture', type: 'button', 'aria-label': 'Take a photo', onclick: () => this.capture() },
      ic('camera'),
    );
    this.compareBtn = h(
      'button',
      {
        class: 'btn small tryon-compare-btn',
        type: 'button',
        hidden: true,
        'aria-label': 'Compare photos',
        onclick: () => this.showCompare(),
      },
      ic('compare'),
      h('span', null, 'Photos'),
    );
    this.photoBtn = h(
      'button',
      { class: 'btn small', type: 'button', 'aria-label': 'Use a photo', onclick: () => this.pickPhoto() },
      ic('upload'),
      h('span', null, 'Use a photo'),
    );
    this.cameraBtn = h(
      'button',
      {
        class: 'btn small',
        type: 'button',
        hidden: true,
        'aria-label': 'Use the camera',
        onclick: () => this.startCamera(),
      },
      ic('camera'),
      h('span', null, 'Use the camera'),
    );
    this.addBtn = h(
      'button',
      { class: 'btn primary small', type: 'button', onclick: () => this.addToBag() },
      ic('bag'),
      h('span', null, 'Add to bag'),
    );
    this.file = h('input', {
      type: 'file',
      accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif',
      class: 'sr-only',
      tabindex: '-1',
      'aria-hidden': 'true',
    });
    this.file.addEventListener('change', () => this.onFile());
    const actions = h(
      'div',
      { class: 'tryon-actions' },
      this.compareBtn,
      this.photoBtn,
      this.cameraBtn,
      this.captureBtn,
      this.addBtn,
    );
    this.panel = h('div', { class: 'tryon-panel' }, this.colours, this.sizes, this.carousel, actions);
    this.overlay = h('div', { class: 'tryon-overlay' }, top, this.fitInfo, this.nudgeBox, this.message, this.panel);
    this.sheet = h('div', { class: 'tryon-sheet', hidden: true }); // privacy, loading, compare, errors
    this.root = h(
      'div',
      { class: 'tryon' + (RM ? ' rm' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Virtual try-on' },
      this.stage,
      this.overlay,
      this.sheet,
      this.live,
      this.file,
      this.debug,
    );
    document.body.append(this.root);
    document.documentElement.classList.add('tryon-open');
    this.onKey = (e) => this.key(e);
    // Capture phase, so Escape and arrows reach the try-on before the showroom's own shortcuts.
    window.addEventListener('keydown', this.onKey, true);
    this.onHide = () => {
      if (document.visibilityState === 'hidden') this.pauseCamera();
    };
    this.onPageHide = () => this.pauseCamera();
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onPageHide);
    this.swipe();
    this.overlay.hidden = true;
    this.renderControls();
  }

  iconBtn(icon, label, fn) {
    return h(
      'button',
      { class: 'tryon-icon', type: 'button', 'aria-label': label, title: label, onclick: fn },
      ic(icon),
    );
  }

  /* ---------- Privacy notice and loading ---------- */
  showPrivacy() {
    const allow = h(
      'button',
      {
        class: 'btn primary block',
        type: 'button',
        onclick: () => {
          this.o.settings.tryonConsent = true;
          this.o.saveSettings();
          this.startCamera();
        },
      },
      ic('camera'),
      h('span', null, 'Allow camera'),
    );
    const photo = h(
      'button',
      { class: 'btn block', type: 'button', onclick: () => this.pickPhoto() },
      ic('upload'),
      h('span', null, 'Use a photo instead'),
    );
    this.showSheet(
      h('span', { class: 'tryon-badge' }, ic('face')),
      h('h2', { id: 'tryon-privacy-title', tabindex: '-1' }, 'Try frames on with your camera'),
      h('p', null, 'Your camera runs on this device. Nothing is recorded or sent anywhere.'),
      allow,
      photo,
      h(
        'button',
        { class: 'link-btn', type: 'button', onclick: () => this.showPrivacyNote() },
        'How your privacy is protected',
      ),
      this.cancelLink(),
    );
  }
  showPrivacyNote() {
    this.showSheet(
      h('h2', { tabindex: '-1' }, 'Privacy in the try-on'),
      h(
        'ul',
        { class: 'tryon-list' },
        h('li', null, 'Face tracking runs inside your browser, on this device.'),
        h(
          'li',
          null,
          'The camera picture, your face shape and your measurements are never uploaded, recorded or stored.',
        ),
        h('li', null, 'Photos you take stay in this browser tab until you save them or close the try-on.'),
        h('li', null, 'We only count which frames and sizes are tried, never anything about your face.'),
        h('li', null, 'The camera turns off when you close the try-on or leave the page.'),
      ),
      h('button', { class: 'btn block', type: 'button', onclick: () => this.showPrivacy() }, 'Back'),
    );
  }
  cancelLink() {
    return h('button', { class: 'link-btn', type: 'button', onclick: () => this.close() }, 'Not now');
  }
  showSheet(...kids) {
    this.sheet.classList.remove('wide');
    this.sheet.replaceChildren(h('div', { class: 'tryon-card' }, ...kids));
    this.sheet.hidden = false;
    const first = this.sheet.querySelector('h2, button');
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
  }
  hideSheet(fromHistory) {
    if (this.compareLayer && fromHistory !== true) dropLayer(this.compareLayer);
    this.compareLayer = null;
    this.sheet.hidden = true;
    this.sheet.replaceChildren();
  }
  /** The camera is blocked in an in-app browser: offer to copy the link, or use a photo. */
  showInApp() {
    const copy = h(
      'button',
      {
        class: 'btn block',
        type: 'button',
        onclick: async () => {
          try {
            await navigator.clipboard.writeText(location.href);
            copy.querySelector('span').textContent = 'Link copied';
          } catch (e) {
            copy.querySelector('span').textContent = location.href;
          }
        },
      },
      ic('share'),
      h('span', null, 'Copy the link'),
    );
    this.showSheet(
      h('span', { class: 'tryon-badge warn' }, ic('camera')),
      h('h2', { tabindex: '-1' }, 'Open in your browser'),
      h('p', null, MSG.inApp),
      copy,
      h(
        'button',
        { class: 'btn primary block', type: 'button', onclick: () => this.pickPhoto() },
        ic('upload'),
        h('span', null, 'Use a photo'),
      ),
      h('button', { class: 'link-btn', type: 'button', onclick: () => this.close() }, 'Close'),
    );
  }
  showLoading() {
    this.bar = h('span');
    this.showSheet(
      h(
        'p',
        { class: 'tryon-loading', role: 'status' },
        h('span', { class: 'spinner', 'aria-hidden': 'true' }),
        MSG.loading,
      ),
      h('div', { class: 'tryon-progress', 'aria-hidden': 'true' }, this.bar),
      this.cancelLink(),
    );
  }
  showError(text, opts = {}) {
    this.showSheet(
      h('span', { class: 'tryon-badge warn' }, ic('info')),
      h('h2', { tabindex: '-1' }, 'Try-on'),
      h('p', null, text),
      opts.photo !== false
        ? h(
            'button',
            { class: 'btn primary block', type: 'button', onclick: () => this.pickPhoto() },
            ic('upload'),
            h('span', null, 'Use a photo'),
          )
        : null,
      opts.retry
        ? h('button', { class: 'btn block', type: 'button', onclick: opts.retry }, opts.retryLabel || 'Try again')
        : null,
      h('button', { class: 'link-btn', type: 'button', onclick: () => this.close() }, 'Close'),
    );
  }

  /* ---------- Engine ---------- */
  async ensureEngine() {
    if (this.engine) return this.engine;
    this.showLoading();
    let createEngine;
    try {
      ({ createEngine } = await import('./engine.js'));
    } catch (e) {
      throw new Error('load');
    }
    const eng = await createEngine({
      onProgress: ({ loaded, total }) => {
        if (this.bar) this.bar.style.width = Math.round((100 * loaded) / total) + '%';
      },
    });
    if (!open || open !== this) {
      eng.stop();
      throw new Error('closed');
    }
    this.engine = eng;
    eng.on('face', ({ visible }) => this.setMessage(visible ? '' : MSG.look));
    eng.on('fit', () => this.updateFit());
    eng.on('stats', (s) => {
      if (this.debug)
        this.debug.textContent =
          s.fps.toFixed(0) +
          ' fps · ' +
          s.inferMs.toFixed(1) +
          ' ms inference · ' +
          s.delegate +
          '\nface ' +
          s.faceWidthMm.toFixed(1) +
          ' mm' +
          (s.calibrated ? ' (calibrated)' : ' (' + s.samples + '/30 samples)') +
          (s.pose
            ? '\nyaw ' +
              s.pose.yaw.toFixed(1) +
              '° pitch ' +
              s.pose.pitch.toFixed(1) +
              '° eyes ' +
              s.pose.open.toFixed(2) +
              (s.pose.good ? ' good' : ' skipped')
            : '');
    });
    eng.on('error', (e) => console.warn(e.message));
    return eng;
  }

  /* ---------- Camera ---------- */
  async startCamera() {
    this.mode = 'camera';
    if (!window.isSecureContext) return this.showError(MSG.insecure);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
      return inAppBrowser() ? this.showInApp() : this.showError(MSG.noCamera);
    try {
      await this.ensureEngine();
    } catch (e) {
      if (e.message !== 'closed') this.showError(MSG.failed);
      return;
    }
    // The camera is requested only now, after the shopper chose it. A newer request cancels an older one, so a
    // double tap can never leave a second camera running.
    this.stopCamera();
    const token = ++this.camToken;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (e) {
      const name = e && e.name;
      if (inAppBrowser() && (name === 'NotAllowedError' || name === 'NotSupportedError' || name === 'SecurityError'))
        return this.showInApp();
      if (name === 'NotAllowedError' || name === 'SecurityError') return this.showError(MSG.blocked);
      if (name === 'NotFoundError' || name === 'OverconstrainedError') return this.showError(MSG.noCamera);
      return this.showError(MSG.failed);
    }
    if (open !== this || token !== this.camToken) {
      for (const t of stream.getTracks()) t.stop();
      return;
    }
    this.stream = stream;
    // The shopper turned the camera on themselves: remember it, so the notice is not shown again.
    if (!this.o.settings.tryonConsent) {
      this.o.settings.tryonConsent = true;
      this.o.saveSettings();
    }
    const v = h('video', { playsinline: true, muted: true, autoplay: true, class: 'tryon-video' });
    v.muted = true;
    v.playsInline = true;
    v.srcObject = this.stream;
    this.video = v;
    try {
      await v.play();
      if (!v.videoWidth) await new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true }));
    } catch (e) {
      return this.showError(MSG.failed);
    }
    await this.begin(v);
  }
  stopCamera() {
    this.camToken++;
    if (this.stream) for (const t of this.stream.getTracks()) t.stop();
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.video = null;
  }
  pauseCamera() {
    if (!this.stream) return;
    this.stopCamera();
    if (this.engine) this.engine.stopLoop();
    this.showError('The camera paused while the page was in the background.', {
      photo: false,
      retry: () => this.startCamera(),
      retryLabel: 'Turn the camera back on',
    });
  }

  /* ---------- Photo ---------- */
  pickPhoto() {
    this.file.value = '';
    this.file.click();
  }
  async onFile() {
    const f = this.file.files && this.file.files[0];
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES || !/^image\//.test(f.type || 'image/')) return this.showError(MSG.badFile);
    this.mode = 'photo';
    try {
      await this.ensureEngine();
    } catch (e) {
      if (e.message !== 'closed') this.showError(MSG.failed, { photo: false });
      return;
    }
    const url = URL.createObjectURL(f);
    const img = new Image();
    try {
      img.src = url;
      await img.decode();
    } catch (e) {
      URL.revokeObjectURL(url);
      return this.showError(MSG.badFile);
    }
    this.stopCamera();
    const res = await this.begin(img);
    URL.revokeObjectURL(url);
    if (res && res.faces === 0) this.showError(MSG.noFace);
    else if (res && res.faces > 1) this.showError(MSG.manyFaces);
  }

  /* ---------- Session ---------- */
  async begin(source) {
    const eng = this.engine;
    this.hideSheet();
    this.overlay.hidden = false;
    this.stage.replaceChildren(eng.canvas);
    this.lastFit = null;
    this.fitChip.hidden = true;
    this.toggleFitInfo(false);
    await this.applyFrame();
    const res = await eng.start(source);
    this.updateFit();
    this.cameraBtn.hidden = this.mode !== 'photo';
    this.setMessage(this.mode === 'camera' ? MSG.look : '');
    setTimeout(() => this.closeBtn.focus({ preventScroll: true }), 30);
    return res;
  }

  async applyFrame() {
    if (!this.engine) return;
    const r = await this.engine.setFrame(this.p.id, this.ci, this.sizeId);
    this.widths = r.widths;
    this.engine.setNudge(this.nudge);
    this.updateFit();
  }

  renderControls() {
    const p = this.p;
    const price = BM.priceOf(p, BM.defaultCfg(p), this.sizeId);
    this.title.replaceChildren(h('b', null, p.name), h('span', null, BM.money(price)));
    this.colours.replaceChildren(
      ...p.colors.map((c, i) => {
        const b = h('button', {
          class: 'tryon-swatch',
          type: 'button',
          role: 'radio',
          'aria-checked': i === this.ci ? 'true' : 'false',
          'aria-label': c.n,
          title: c.n,
          style: 'background:' + (c.sw2 ? 'linear-gradient(135deg,' + c.sw + ' 50%,' + c.sw2 + ' 50%)' : c.sw),
          onclick: () => this.setColour(i),
        });
        if (p.sun) b.append(h('span', { class: 'swatch-lens', style: 'background:' + c.l }));
        return b;
      }),
    );
    this.sizes.replaceChildren(
      ...p.sizes.map((s) =>
        h(
          'button',
          {
            class: 'tryon-chip',
            type: 'button',
            role: 'radio',
            'aria-checked': s.id === this.sizeId ? 'true' : 'false',
            'aria-label': 'Size ' + s.id + ', ' + sizeMarking(s),
            onclick: () => this.setSize(s.id),
          },
          h('b', null, s.id),
          h('span', null, sizeMarking(s)),
        ),
      ),
    );
    const list = this.zoneFrames();
    this.carousel.replaceChildren(
      ...list.map((q) =>
        h(
          'button',
          {
            class: 'tryon-thumb',
            type: 'button',
            role: 'listitem',
            'aria-current': q.id === p.id ? 'true' : 'false',
            'aria-label': 'Try on ' + q.name,
            title: q.name,
            onclick: () => this.setProduct(q.id),
          },
          h('span', { class: 'tryon-thumb-art', html: BM.frameSVG(q, 0, 96, 40) }),
          h('span', null, q.name),
        ),
      ),
    );
    const cur = this.carousel.querySelector('[aria-current="true"]');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' });
  }

  zoneFrames() {
    return BM.PRODUCTS.filter((q) => q.type === 'frame' && q.zone === this.p.zone);
  }

  async setColour(i) {
    this.ci = i;
    track('tryon_colour_change', { productId: this.p.id, colourIndex: i });
    this.renderControls();
    await this.applyFrame();
  }
  async setSize(id) {
    this.sizeId = id;
    track('tryon_size_change', { productId: this.p.id, sizeId: id });
    this.renderControls();
    await this.applyFrame();
    this.live.textContent = 'Size ' + id + ' on. ' + (this.lastFit ? this.lastFit.label : '');
  }
  async setProduct(id) {
    const q = BM.byId[id];
    if (!q || q.type !== 'frame' || q.id === this.p.id) return;
    this.p = q;
    this.ci = 0;
    this.sizeId = q.defaultSize;
    this.lastFit = null;
    track('tryon_open', { productId: q.id, source: 'carousel' });
    this.renderControls();
    await this.applyFrame();
    this.live.textContent = q.name + ' on.';
  }
  step(dir) {
    const list = this.zoneFrames();
    const i = list.findIndex((q) => q.id === this.p.id);
    const next = list[(i + dir + list.length) % list.length];
    if (next) this.setProduct(next.id);
  }
  nudgeStep() {
    return (this.engine && this.engine.nudge && this.engine.nudge.stepMm) || 2;
  }
  setNudge(mm) {
    const lim = (this.engine && this.engine.nudge && this.engine.nudge.limitMm) || 10;
    this.nudge = this.engine ? this.engine.setNudge(mm) : Math.max(-lim, Math.min(lim, mm));
    // Show where the frame is and which way it can still go.
    this.nudgeUp.disabled = this.nudge >= lim;
    this.nudgeDown.disabled = this.nudge <= -lim;
    this.nudgeVal.hidden = this.nudge === 0;
    this.nudgeVal.textContent = (this.nudge > 0 ? '+' : '') + this.nudge + ' mm';
    this.live.textContent =
      this.nudge === 0
        ? 'Frame position reset.'
        : 'Frame moved ' +
          (this.nudge > 0 ? 'up ' : 'down ') +
          Math.abs(this.nudge) +
          ' mm' +
          (Math.abs(this.nudge) >= lim ? ', as far as it goes.' : '.');
  }

  /* ---------- Fit guide ---------- */
  updateFit() {
    const eng = this.engine;
    if (!eng || !this.widths.length) return;
    const cur = this.widths.find((w) => w.id === this.sizeId);
    if (!eng.calibrated && this.mode !== 'photo') {
      this.fitChip.hidden = false;
      this.fitChip.className = 'tryon-fit measuring';
      this.fitChip.textContent = 'Measuring fit…';
      return;
    }
    const fit = fitResult(cur.widthMm, eng.faceWidthMm);
    const better = suggestSize(this.widths, this.sizeId, eng.faceWidthMm);
    this.fitChip.hidden = false;
    this.fitChip.className = 'tryon-fit ' + fit.result;
    this.fitChip.replaceChildren(h('span', null, fit.label), ic('info'));
    this.fitChip.setAttribute('aria-label', fit.label + '. More about the fit estimate');
    this.fitInfo.replaceChildren(
      h('p', null, h('b', null, fit.label + '. '), 'This frame is about ' + Math.round(cur.widthMm) + ' mm wide.'),
      better
        ? h(
            'button',
            { class: 'btn small primary', type: 'button', onclick: () => this.setSize(better) },
            'Size ' + better + ' may fit you better',
          )
        : null,
      h(
        'p',
        { class: 'field-note' },
        'An estimate from your face width, measured against the average eye size (about 11.7 mm). It is not a measurement for prescriptions. Try the frame in the showroom to be sure.',
      ),
    );
    if (!this.lastFit || this.lastFit.result !== fit.result || this.lastFit.size !== this.sizeId) {
      if (!this.lastFit || this.lastFit.result !== fit.result)
        track('fit_result', { productId: this.p.id, result: fit.result });
      this.live.textContent = fit.label + (better ? '. Size ' + better + ' may fit you better.' : '.');
    }
    this.lastFit = { result: fit.result, label: fit.label, size: this.sizeId };
  }
  toggleFitInfo(force) {
    const show = force == null ? this.fitInfo.hidden : force;
    this.fitInfo.hidden = !show;
    this.fitChip.setAttribute('aria-expanded', show ? 'true' : 'false');
  }

  setMessage(text) {
    this.message.textContent = text;
    this.message.hidden = !text;
  }

  /* ---------- Photos ---------- */
  async capture() {
    if (!this.engine) return;
    if (this.photos.length >= MAX_PHOTOS) {
      this.live.textContent = 'You have 4 photos. Remove one to take another.';
      return this.showCompare();
    }
    let blob;
    try {
      blob = await this.engine.snapshot();
    } catch (e) {
      this.live.textContent = 'The photo could not be taken. Try again.';
      return;
    }
    const s = sizeOf(this.p, this.sizeId);
    this.photos.push({
      url: URL.createObjectURL(blob),
      blob,
      name: this.p.name,
      colour: BM.colorOf(this.p, this.ci).n,
      size: s.id + ' · ' + sizeMarking(s),
    });
    track('tryon_photo', { productId: this.p.id, sizeId: this.sizeId });
    this.compareBtn.hidden = false;
    this.compareBtn.querySelector('span').textContent = 'Photos (' + this.photos.length + ')';
    this.compareBtn.setAttribute('aria-label', 'Compare photos, ' + this.photos.length + ' taken');
    this.root.classList.remove('flash');
    void this.root.offsetWidth;
    if (!RM) this.root.classList.add('flash');
    this.live.textContent = 'Photo ' + this.photos.length + ' of ' + MAX_PHOTOS + ' taken.';
  }
  showCompare() {
    const grid = h(
      'div',
      { class: 'tryon-photos' },
      ...this.photos.map((ph, i) =>
        h(
          'figure',
          null,
          h('img', { src: ph.url, alt: ph.name + ', ' + ph.colour + ', size ' + ph.size }),
          h('figcaption', null, h('b', null, ph.name), h('span', null, ph.colour), h('span', null, 'Size ' + ph.size)),
          h(
            'div',
            { class: 'tryon-photo-acts' },
            h(
              'button',
              { class: 'btn small', type: 'button', onclick: () => this.savePhoto(ph) },
              ic('share'),
              h('span', null, 'Save'),
            ),
            h('button', { class: 'link-btn', type: 'button', onclick: () => this.removePhoto(i) }, 'Remove'),
          ),
        ),
      ),
    );
    this.showSheet(
      h('h2', { tabindex: '-1' }, 'Compare your photos'),
      this.photos.length ? grid : h('p', null, 'No photos yet. Tap the camera button to take one.'),
      h(
        'button',
        { class: 'btn primary block', type: 'button', onclick: () => this.hideSheet() },
        'Back to the mirror',
      ),
    );
    this.sheet.classList.add('wide');
    if (!this.compareLayer)
      this.compareLayer = pushLayer('tryon-compare', () => {
        this.compareLayer = null;
        this.hideSheet(true);
      });
  }
  removePhoto(i) {
    const [ph] = this.photos.splice(i, 1);
    if (ph) URL.revokeObjectURL(ph.url);
    this.compareBtn.hidden = !this.photos.length;
    this.compareBtn.querySelector('span').textContent = 'Photos (' + this.photos.length + ')';
    this.showCompare();
  }
  async savePhoto(ph) {
    const name =
      ('brijman-try-on-' + ph.name + '-' + ph.size.split(' ')[0]).toLowerCase().replace(/[^a-z0-9-]+/g, '-') + '.jpg';
    const file = typeof File === 'function' ? new File([ph.blob], name, { type: 'image/jpeg' }) : null;
    const mobile = window.matchMedia('(pointer: coarse)').matches;
    if (mobile && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'My try-on: ' + ph.name });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    const a = h('a', { href: ph.url, download: name, class: 'sr-only' });
    document.body.append(a);
    a.click();
    a.remove();
  }

  /* ---------- Bag ---------- */
  addToBag() {
    const { p, ci, sizeId } = this;
    track('tryon_add_to_bag', { productId: p.id, sizeId, colourIndex: ci });
    this.close();
    this.o.onAddToBag(p.id, ci, sizeId);
  }

  /* ---------- Input ---------- */
  key(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!this.fitInfo.hidden) return this.toggleFitInfo(false);
      if (!this.sheet.hidden && this.engine && !this.overlay.hidden) return this.hideSheet();
      return this.close();
    }
    if (this.overlay.hidden || !this.sheet.hidden) return this.trap(e);
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.isContentEditable);
    if (!typing && e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.step(1);
    } else if (!typing && e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.step(-1);
    } else this.trap(e);
  }
  // Keeps keyboard focus inside the try-on while it is open.
  trap(e) {
    if (e.key !== 'Tab') return;
    const items = [...this.root.querySelectorAll('button, [href], input:not([tabindex="-1"])')].filter(
      (el) => !el.disabled && el.offsetParent !== null,
    );
    if (!items.length) return;
    const first = items[0],
      last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  swipe() {
    let x0 = null,
      y0 = 0;
    this.stage.addEventListener('pointerdown', (e) => {
      x0 = e.clientX;
      y0 = e.clientY;
    });
    this.stage.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0,
        dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) this.step(dx < 0 ? 1 : -1);
    });
  }

  /* ---------- Close: stop the camera, free everything ---------- */
  close(fromHistory) {
    if (open !== this) return;
    open = null;
    if (fromHistory !== true && this.layer) dropLayer(this.layer);
    this.layer = null;
    this.compareLayer = null;
    this.stopCamera();
    if (this.engine) this.engine.stop();
    for (const ph of this.photos) URL.revokeObjectURL(ph.url);
    this.photos = [];
    window.removeEventListener('keydown', this.onKey, true);
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onPageHide);
    document.documentElement.classList.remove('tryon-open');
    this.root.remove();
    this.o.onClose();
    const f = this.lastFocus;
    if (f && f.focus && document.contains(f)) f.focus({ preventScroll: true });
  }
}

/** For tests: whether a session is open. */
export const isOpen = () => !!open;
