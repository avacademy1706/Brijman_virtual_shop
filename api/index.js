// Vercel Function entry. vercel.json rewrites /api/(.*) here; the original path reaches the Hono router.
import { app } from '../server/app.js';

export default { fetch: app.fetch };
