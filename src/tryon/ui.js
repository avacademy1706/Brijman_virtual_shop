// Placeholder until the try-on interface lands (phase 5).
import { BM } from '../core/bm.js';

export function openTryOn(o) {
  BM.toast('Try-on is coming soon.');
  if (o && o.onClose) o.onClose();
}
