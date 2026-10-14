// The bundled copy of data/*.json. Loaded as its own chunk, only in static mode or when the API cannot be reached.
import store from '../../data/store.json';
import catalogue from '../../data/catalogue.json';
import merchandising from '../../data/merchandising.json';
import lenses from '../../data/lenses.json';
import { buildBootstrap } from '../../shared/bootstrap.js';

export const bootstrap = buildBootstrap({ store, catalogue, merchandising, lenses });
