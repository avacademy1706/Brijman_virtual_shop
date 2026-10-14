// Server prices for the bag.
import { postJSON } from './http.js';

/**
 * Turns bag lines into the API's cart line shape.
 * @param {Array<{pid: string, ci: number, cfg: object, qty: number}>} cart
 */
export const toApiLines = (cart) =>
  cart.map((l) =>
    Object.assign({ productId: l.pid, colourIndex: l.ci }, l.size ? { sizeId: l.size } : {}, {
      config: l.cfg,
      qty: l.qty,
    }),
  );

/**
 * POST /api/v1/cart/quote. Resolves with the server's prices; rejects with an ApiError.
 * @param {Array<object>} cart bag lines
 */
export async function quoteCart(cart) {
  const { data } = await postJSON('/cart/quote', { lines: toApiLines(cart) });
  return data;
}
