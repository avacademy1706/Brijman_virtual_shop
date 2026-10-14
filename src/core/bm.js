// Shared namespace: store layout, catalogue, drawing helpers and the bridge between the UI and the 3D scene.
// It holds sample data only, never secrets. It is exposed as window.BM so you can inspect it in the browser console.
export const BM = {};
BM.reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
window.BM = BM;
