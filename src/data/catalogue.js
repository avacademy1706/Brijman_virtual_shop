// Puts the store data on BM in the shape the interface and the 3D scene read, and adds the pricing helpers.
// The data itself lives in data/*.json and arrives through the API (or the bundled copy in static mode).
import { BM } from '../core/bm.js';
import * as pricing from '../../shared/pricing.js';

import './frames.js';

/**
 * Fills BM from a bootstrap payload: STORE, ZONES, TOUR, TOUR_TEXT, PRODUCTS, byId, MERCH and LENS.
 * Call it before importing ui/app.js or the scene; both read these synchronously.
 * @param {{store: object, zones: object[], tour: string[], tourText: object, products: object[], merchandising: object, lenses: object}} d
 */
export function installData(d) {
  BM.STORE = d.store;
  BM.ZONES = d.zones;
  BM.TOUR = d.tour;
  BM.TOUR_TEXT = d.tourText;
  BM.PRODUCTS = d.products;
  BM.byId = {};
  d.products.forEach((p) => {
    BM.byId[p.id] = p;
  });
  BM.MERCH = d.merchandising;
  BM.LENS = d.lenses;
}

BM.colorOf = pricing.colorOf;
BM.lensRules = pricing.lensRules;
BM.defaultCfg = pricing.defaultCfg;
BM.needsRx = pricing.needsRx;
BM.needsAdd = pricing.needsAdd;
BM.priceOf = (p, cfg) => pricing.priceOf(p, cfg, BM.LENS);
BM.cfgSummary = (p, cfg) => pricing.cfgSummary(p, cfg, BM.LENS);
