// Back-button support. Every panel that opens over the store (sheet views, the tour, the try-on, photo compare) adds
// a history entry; the phone's Back button or gesture closes the top one instead of leaving the site. Back from the
// bare store behaves normally, because no entry is added for it.
//
// history.go() is asynchronous. If a panel opens while an earlier go() is still pending, its pushState would land
// first and the late go() would remove it instead, so Back would then leave the site. New entries therefore wait
// until the pending go() has finished.

const stack = []; // open layers, bottom to top
let ignore = 0; // popstate events caused by our own go() calls
const waiting = []; // layers whose pushState waits for a pending go()
let settleTimer = 0;

function push(layer) {
  try {
    history.pushState({ bmLayer: stack.indexOf(layer) + 1 }, '');
    layer.pushed = true;
  } catch (e) {
    /* history unavailable (some embedded browsers): the panel still works */
  }
}
function settle() {
  clearTimeout(settleTimer);
  ignore = 0;
  while (waiting.length) {
    const layer = waiting.shift();
    if (stack.includes(layer)) push(layer);
  }
}

window.addEventListener('popstate', () => {
  if (ignore > 0) {
    ignore--;
    if (ignore === 0) settle();
    return;
  }
  const top = stack.pop();
  if (top) top.onBack();
});

/**
 * Adds a history entry for a panel.
 * @param {string} name for debugging
 * @param {() => void} onBack closes the panel (called when the visitor presses Back)
 * @returns {object} the layer, to pass to dropLayer when the panel is closed another way
 */
export function pushLayer(name, onBack) {
  const layer = { name, onBack, pushed: false };
  stack.push(layer);
  if (ignore > 0) waiting.push(layer);
  else push(layer);
  return layer;
}

/**
 * Removes a panel's entry (and any above it) when the panel was closed with its own button, so the history stays in
 * step. Does nothing if Back already removed it.
 * @param {object} layer from pushLayer
 */
export function dropLayer(layer) {
  const i = stack.lastIndexOf(layer);
  if (i < 0) return;
  const removed = stack.splice(i);
  const n = removed.filter((l) => l.pushed).length;
  for (const l of removed) {
    const w = waiting.indexOf(l);
    if (w >= 0) waiting.splice(w, 1);
  }
  if (!n) return;
  ignore += n;
  history.go(-n);
  // Safety net: if the browser never reports the go() (very rare), stop waiting after a second.
  clearTimeout(settleTimer);
  settleTimer = setTimeout(settle, 1000);
}

/** Number of open layers (for tests and debugging). */
export const layerCount = () => stack.length;
