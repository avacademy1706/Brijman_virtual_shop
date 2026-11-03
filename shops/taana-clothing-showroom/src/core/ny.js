// Shared namespace: store layout, catalogue, drawing helpers and the bridge between the UI and the 3D scene.
// It holds sample data only, never secrets. In the browser it is exposed as window.NY so you can inspect it in
// the console. The same data modules also load in Node (scripts/bake-drapes.mjs), so browser globals are guarded.
export const NY = {};
const hasWindow = typeof window !== 'undefined';
NY.reduceMotion = !!(hasWindow && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
if (hasWindow) window.NY = NY;
