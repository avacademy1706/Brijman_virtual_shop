// Builds the payload of GET /api/v1/bootstrap from the data files. The browser's static mode builds the same shape.

/**
 * @param {{store: object, catalogue: {products: object[]}, merchandising: object, lenses: object}} files
 */
export function buildBootstrap({ store, catalogue, merchandising, lenses }) {
  return {
    store: store.store,
    zones: store.zones,
    tour: store.tour,
    tourText: store.tourText,
    products: catalogue.products,
    merchandising,
    lenses,
  };
}
