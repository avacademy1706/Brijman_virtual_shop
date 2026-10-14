// Serves the Hono API on /api inside `npm run dev` and `npm run preview`, so both work without Vercel or a login.
// In dev the app is loaded through Vite, so edits in server/, shared/ and data/ apply on the next request.
import { getRequestListener } from '@hono/node-server';
import { pathToFileURL, fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('./app.js', import.meta.url));

/** @returns {import('vite').Plugin} */
export function apiPlugin() {
  const mount = (middlewares, loadApp) => {
    middlewares.use(async (req, res, next) => {
      if (req.url !== '/api' && !req.url.startsWith('/api/') && !req.url.startsWith('/api?')) return next();
      try {
        const { app } = await loadApp();
        await getRequestListener(app.fetch)(req, res);
      } catch (err) {
        console.error('[api] failed to load the API:', err && err.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ error: { code: 'internal_error', message: 'The local API could not start.' } }));
      }
    });
  };
  return {
    name: 'brijman-api',
    configureServer(server) {
      mount(server.middlewares, () => server.ssrLoadModule(APP));
    },
    configurePreviewServer(server) {
      let loaded;
      mount(server.middlewares, () => (loaded ||= import(pathToFileURL(APP).href)));
    },
  };
}
