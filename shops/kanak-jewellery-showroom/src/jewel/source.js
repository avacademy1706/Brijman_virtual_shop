// Where a piece's geometry comes from: an imported 3D model if the client supplied one (src/jewel/models.js),
// otherwise the built-in procedural builder (src/jewel/build.js). Everything that shows a piece goes through here.
import { buildPiece } from './build.js';
import { hasModel, modelKit } from './models.js';

export { hasModel };
/**
 * The Kit for a product. bc: NY.buildCfg(p, cfg); q: detail of the built-in piece (0..1);
 * which: 'store' for the light model file, otherwise the full one.
 */
export async function pieceKit(p, bc, q, which) {
  if (hasModel(p.id)) {
    try {
      return await modelKit(p, bc, which || (q < 0.5 ? 'store' : 'full'));
    } catch (e) {
      // a missing or broken model file must never break the boutique: fall back to the built-in piece
      console.warn(e);
    }
  }
  return buildPiece(p.build, bc, q);
}
