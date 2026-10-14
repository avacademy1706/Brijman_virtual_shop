// Back-button layers, against a fake browser history whose go() is asynchronous like the real one.
import { describe, it, expect, beforeEach, vi } from 'vitest';

function fakeBrowser() {
  const listeners = [];
  const h = {
    entries: ['page'],
    index: 0,
    left: false,
    pushState() {
      h.entries.splice(h.index + 1);
      h.entries.push('layer');
      h.index++;
    },
    go(n) {
      setTimeout(() => {
        h.index += n;
        if (h.index < 0) h.left = true; // went back past the page: the visitor left the site
        listeners.forEach((fn) => fn());
      }, 5);
    },
    back() {
      h.go(-1);
    },
  };
  globalThis.history = h;
  globalThis.addEventListener = (type, fn) => type === 'popstate' && listeners.push(fn);
  return h;
}
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

describe('Back-button layers', () => {
  let H, mod;
  beforeEach(async () => {
    vi.resetModules();
    H = fakeBrowser();
    mod = await import('../../src/ui/history.js');
  });

  it('Back closes the top panel and never leaves the page', async () => {
    const closed = [];
    mod.pushLayer('sheet', () => closed.push('sheet'));
    mod.pushLayer('nested', () => closed.push('nested'));
    H.back();
    await tick();
    expect(closed).toEqual(['nested']);
    H.back();
    await tick();
    expect(closed).toEqual(['nested', 'sheet']);
    expect(H.index).toBe(0);
    expect(H.left).toBe(false);
  });

  it('closing with the panel button removes its entry without calling onBack', async () => {
    const onBack = vi.fn();
    const a = mod.pushLayer('sheet', onBack);
    mod.dropLayer(a);
    await tick();
    expect(onBack).not.toHaveBeenCalled();
    expect(H.index).toBe(0);
    expect(mod.layerCount()).toBe(0);
  });

  it('a panel opened while a close is still pending keeps its entry (the iPad race)', async () => {
    const closedB = vi.fn();
    const a = mod.pushLayer('eye test', () => {});
    mod.dropLayer(a); // go(-1) pending
    mod.pushLayer('try-on', closedB); // opened at once
    await tick();
    expect(H.index).toBe(1); // the try-on entry is in place
    H.back();
    await tick();
    expect(closedB).toHaveBeenCalledTimes(1);
    expect(H.index).toBe(0);
    expect(H.left).toBe(false);
  });

  it('dropping a lower panel removes the ones above it too', async () => {
    const a = mod.pushLayer('sheet', () => {});
    mod.pushLayer('nested', () => {});
    mod.dropLayer(a);
    await tick();
    expect(H.index).toBe(0);
    expect(mod.layerCount()).toBe(0);
  });
});
