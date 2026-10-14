// Picks the repository from DATA_SOURCE: 'static' (default) or 'http'.
import { createStaticRepository } from './static-repository.js';
import { createHttpRepository } from './http-repository.js';

let current = null;

/** @returns {import('./contract.js').Repository} */
export function getRepository() {
  if (current) return current;
  const source = (process.env.DATA_SOURCE || 'static').toLowerCase();
  if (source === 'static') current = createStaticRepository();
  else if (source === 'http') current = createHttpRepository();
  else throw new Error('DATA_SOURCE must be "static" or "http".');
  return current;
}

/** Name of the active data source, for /health. */
export const dataSourceName = () => (process.env.DATA_SOURCE || 'static').toLowerCase();
