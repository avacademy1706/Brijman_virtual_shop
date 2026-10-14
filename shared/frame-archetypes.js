// Frame archetypes: canonical sizes in metres and the shape family of each. Used by the 3D scene,
// the SVG drawings and the API's shape filter.

/** @type {Record<string, {shape: string, style: string, A: number, B: number, dbl: number, thick?: number, dbridge?: boolean}>} */
export const ARCH = {
  rectA: { shape: 'rect', style: 'acetate', A: 0.053, B: 0.038, dbl: 0.018 },
  squareA: { shape: 'square', style: 'acetate', A: 0.052, B: 0.044, dbl: 0.019, thick: 1.25 },
  roundA: { shape: 'round', style: 'acetate', A: 0.048, B: 0.046, dbl: 0.02 },
  ovalA: { shape: 'oval', style: 'acetate', A: 0.051, B: 0.039, dbl: 0.018 },
  cateyeA: { shape: 'cateye', style: 'acetate', A: 0.052, B: 0.04, dbl: 0.017 },
  oversizeA: { shape: 'oversize', style: 'acetate', A: 0.056, B: 0.05, dbl: 0.016 },
  roundM: { shape: 'round', style: 'metal', A: 0.049, B: 0.047, dbl: 0.021 },
  rectM: { shape: 'rect', style: 'metal', A: 0.054, B: 0.037, dbl: 0.017 },
  ovalM: { shape: 'oval', style: 'metal', A: 0.051, B: 0.038, dbl: 0.018 },
  cateyeM: { shape: 'cateye', style: 'metal', A: 0.052, B: 0.04, dbl: 0.017 },
  geoM: { shape: 'geo', style: 'metal', A: 0.05, B: 0.044, dbl: 0.02 },
  aviatorM: { shape: 'aviator', style: 'metal', A: 0.058, B: 0.05, dbl: 0.014, dbridge: true },
  browC: { shape: 'brow', style: 'combo', A: 0.051, B: 0.04, dbl: 0.02 },
};

/**
 * Shape family of a product, or null for contact lenses and care products.
 * @param {{type: string, arch?: string}} p
 * @returns {string|null}
 */
export const shapeOf = (p) => (p.type === 'frame' && ARCH[p.arch] ? ARCH[p.arch].shape : null);

/**
 * Width the endpieces and rims add beyond 2 × lens + bridge, in mm, per archetype. Measured from the generated
 * geometry (src/three/frame-model.js); tests/three/frame-model.test.js keeps them within ±0.5 mm.
 */
export const ENDPIECE_MM = Object.freeze({
  rectA: 10.25,
  squareA: 12.6,
  roundA: 9.55,
  ovalA: 9.55,
  cateyeA: 11.6,
  oversizeA: 11.2,
  roundM: 4.2,
  rectM: 5.0,
  ovalM: 4.2,
  cateyeM: 6.25,
  geoM: 3.3,
  aviatorM: 4.2,
  browC: 13.25,
});

/**
 * Total outer width of a frame front in mm: 2 × lens + bridge + endpieces.
 * @param {{arch: string}} p frame
 * @param {{lens: number, bridge: number}} size
 */
export const frontWidthMm = (p, size) => 2 * size.lens + size.bridge + (ENDPIECE_MM[p.arch] || 8);
