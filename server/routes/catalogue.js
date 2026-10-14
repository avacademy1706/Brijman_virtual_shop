// Health, bootstrap, store, products and lenses.
import { API_VERSION } from '../../shared/constants.js';
import { ProductsQuerySchema, fieldErrors } from '../../shared/schemas.js';
import { ok, fail, CACHE_PUBLIC } from '../lib/respond.js';
import { route, cached } from '../lib/http.js';
import { dataSourceName } from '../repositories/index.js';
import { getBootstrap, getStoreInfo, getLensOptions, listProducts, getProduct } from '../services/catalogue-service.js';

/**
 * @param {import('hono').Hono} app
 * @param {{repo: () => import('../repositories/contract.js').Repository}} deps
 */
export function registerCatalogueRoutes(app, { repo }) {
  route(app, '/v1/health', {
    GET: [
      (c) =>
        ok(c, { status: 'ok', dataSource: dataSourceName(), version: API_VERSION, time: new Date().toISOString() }),
    ],
  });

  route(app, '/v1/bootstrap', { GET: [async (c) => cached(c, await getBootstrap(repo()))] });
  route(app, '/v1/store', { GET: [async (c) => cached(c, await getStoreInfo(repo()))] });
  route(app, '/v1/lenses', { GET: [async (c) => cached(c, await getLensOptions(repo()))] });

  route(app, '/v1/products', {
    GET: [
      async (c) => {
        const q = ProductsQuerySchema.safeParse(c.req.query());
        if (!q.success) return fail(c, 422, 'validation_failed', 'Check the search filters.', fieldErrors(q.error));
        const products = await listProducts(repo(), q.data);
        return ok(c, products, { cache: CACHE_PUBLIC, meta: { count: products.length } });
      },
    ],
  });
  route(app, '/v1/products/:id', {
    GET: [async (c) => ok(c, await getProduct(repo(), c.req.param('id')), { cache: CACHE_PUBLIC })],
  });
}
