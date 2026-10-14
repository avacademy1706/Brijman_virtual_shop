// Prices a bag on the server with shared/pricing.js. Client prices are never trusted.
import { CURRENCY, LIMITS } from '../../shared/constants.js';
import { priceOf, cfgSummary, cfgProblem, colorOf } from '../../shared/pricing.js';
import { sizeOf, sizeLabel } from '../../shared/fit.js';
import { sha256 } from '../lib/hash.js';
import { invalid } from '../lib/errors.js';

/**
 * Validates every line against the catalogue and returns server prices. Throws a 422 listing each bad line.
 * @param {import('../repositories/contract.js').Repository} repo
 * @param {Array<{productId: string, colourIndex: number, config: object, qty: number}>} lines already schema-checked
 */
export async function quote(repo, lines) {
  const [{ products }, lens] = await Promise.all([repo.getCatalogue(), repo.getLenses()]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const fields = {};
  const priced = lines.map((l, i) => {
    const at = 'lines.' + i + '.';
    const p = byId.get(l.productId);
    if (!p) {
      fields[at + 'productId'] = 'This product is no longer available.';
      return null;
    }
    const colours = p.type === 'frame' ? p.colors.length : 1;
    if (l.colourIndex >= colours) fields[at + 'colourIndex'] = 'This colour is not available for ' + p.name + '.';
    const problem = cfgProblem(p, l.config, lens);
    if (problem) fields[at + 'config'] = problem;
    if (p.type === 'frame' && l.qty !== LIMITS.frameQty) fields[at + 'qty'] = 'Frames are added one pair per line.';
    if (p.type === 'frame' && !l.sizeId) fields[at + 'sizeId'] = 'Choose a size for ' + p.name + '.';
    else if (p.type === 'frame' && !sizeOf(p, l.sizeId))
      fields[at + 'sizeId'] = 'Size ' + l.sizeId + ' is not available for ' + p.name + '.';
    else if (p.type !== 'frame' && l.sizeId) fields[at + 'sizeId'] = p.name + ' has no frame sizes.';
    if (Object.keys(fields).some((k) => k.startsWith(at))) return null;
    const unitPrice = priceOf(p, l.config, lens, l.sizeId);
    const size = p.type === 'frame' ? sizeOf(p, l.sizeId) : null;
    return {
      productId: p.id,
      name: p.name,
      colourIndex: l.colourIndex,
      colour: p.type === 'frame' ? colorOf(p, l.colourIndex).n : null,
      sizeId: size ? size.id : null,
      sizeLabel: size ? sizeLabel(size) : null,
      config: l.config,
      summary: cfgSummary(p, l.config, lens),
      qty: l.qty,
      unitPrice,
      lineTotal: unitPrice * l.qty,
    };
  });
  if (Object.keys(fields).length) throw invalid(fields, 'Some items in your bag need attention.');
  const subtotal = priced.reduce((a, l) => a + l.lineTotal, 0);
  const delivery = 0;
  const total = subtotal + delivery;
  const quoteId =
    'q_' +
    sha256(
      JSON.stringify({
        lines: priced.map((l) => [l.productId, l.colourIndex, l.sizeId, l.config, l.qty, l.unitPrice]),
        total,
      }),
    ).slice(0, 24);
  return { quoteId, currency: CURRENCY, taxIncluded: true, lines: priced, subtotal, delivery, total };
}
