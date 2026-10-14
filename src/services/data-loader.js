// Loads the data the first screen needs and fills BM in the shape the interface and the 3D scene expect.
import { installData } from '../data/catalogue.js';
import { DATA_SOURCE, getJSON } from './http.js';

/**
 * One call to GET /api/v1/bootstrap, or the bundled JSON in static mode. If the API fails, it falls back to the
 * bundled JSON and reports `fallback: true` so the interface can say so.
 * @returns {Promise<{source: 'api'|'static', fallback: boolean}>}
 */
export async function loadInitialData() {
  if (DATA_SOURCE === 'api') {
    try {
      const { data } = await getJSON('/bootstrap');
      if (!data || !Array.isArray(data.products) || !Array.isArray(data.zones)) throw new Error('Incomplete bootstrap');
      installData(data);
      return { source: 'api', fallback: false };
    } catch (err) {
      console.warn('Catalogue API unavailable, using the saved catalogue:', err && err.message);
      await installStatic();
      return { source: 'static', fallback: true };
    }
  }
  await installStatic();
  return { source: 'static', fallback: false };
}

async function installStatic() {
  const { bootstrap } = await import('./static-data.js');
  installData(bootstrap);
}
