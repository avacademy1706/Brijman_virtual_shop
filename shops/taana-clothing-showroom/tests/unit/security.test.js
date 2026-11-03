// Security checks that run with every `npm test`: no secrets in the code, secrets kept out of git and Vercel
// uploads, a strict Content Security Policy, and no third-party requests at runtime.
// This test never opens a .env file; it only checks that they are ignored.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');

// Patterns for real credentials (not variable names): cloud keys, tokens, private keys, live payment keys.
const SECRET_PATTERNS = [
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
  [/-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, 'private key'],
  [/gh[pousr]_[A-Za-z0-9]{36,}/, 'GitHub token'],
  [/xox[abposr]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/sk_live_[A-Za-z0-9]{16,}/, 'Stripe live key'],
  [/rzp_live_[A-Za-z0-9]{10,}/, 'Razorpay live key'],
  [/AIza[0-9A-Za-z_-]{35}/, 'Google API key'],
  [/eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, 'JSON Web Token'],
  [/sk-[A-Za-z0-9_-]{32,}/, 'API secret key'],
];
const TEXT = /\.(js|mjs|cjs|json|html|css|md|txt|svg|yml|yaml|example)$/;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'test-results', 'playwright-report', '.vercel']);

function* files(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    if (/^\.env(\.|$)/.test(name) && name !== '.env.example') continue; // never read local secrets
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) yield* files(p);
    else if (TEXT.test(name) && s.size < 3_000_000) yield p;
  }
}

describe('no secrets in the project', () => {
  it('source, scripts, docs and config contain no credentials', () => {
    const found = [];
    for (const f of files(root)) {
      const text = readFileSync(f, 'utf8');
      for (const [re, what] of SECRET_PATTERNS) if (re.test(text)) found.push(relative(root, f) + ': ' + what);
    }
    expect(found).toEqual([]);
  });

  it('the built site (if present) contains no credentials and no source maps', () => {
    const dist = join(root, 'dist');
    if (!existsSync(dist)) return;
    const found = [];
    const walk = (d) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (n.endsWith('.map')) found.push(relative(root, p) + ': source map');
        else if (/\.(js|html|css|json)$/.test(n)) {
          const t = readFileSync(p, 'utf8');
          for (const [re, what] of SECRET_PATTERNS) if (re.test(t)) found.push(relative(root, p) + ': ' + what);
        }
      }
    };
    walk(dist);
    expect(found).toEqual([]);
  });

  it('runtime code reads no VITE_ variables (Vite would copy them into the public bundle)', () => {
    const found = [];
    for (const f of files(join(root, 'src'))) if (/VITE_/.test(readFileSync(f, 'utf8'))) found.push(relative(root, f));
    expect(found).toEqual([]);
  });
});

describe('secrets stay out of git and Vercel uploads', () => {
  it.each(['.gitignore', '.vercelignore'])('%s ignores .env files but keeps .env.example', (f) => {
    const lines = read(f)
      .split(/\r?\n/)
      .map((l) => l.trim());
    expect(lines).toContain('.env');
    expect(lines).toContain('.env.*');
    expect(lines).toContain('!.env.example');
  });

  it('.env.example holds no values', () => {
    for (const line of read('.env.example').split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      expect(line, 'an example variable has a value').toMatch(/^[A-Z0-9_]+=\s*$/);
    }
  });
});

describe('security headers (vercel.json, also served by npm run preview)', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const site = vercel.headers.find((h) => h.source === '/(.*)');
  const header = (k) => (site.headers.find((h) => h.key === k) || {}).value || '';
  const csp = Object.fromEntries(
    header('Content-Security-Policy')
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((d) => d[0])
      .map(([k, ...v]) => [k, v]),
  );

  it('has a strict Content Security Policy', () => {
    expect(csp['default-src']).toEqual(["'self'"]);
    expect(csp['script-src']).toContain("'self'");
    expect(csp['script-src']).not.toContain("'unsafe-inline'");
    expect(csp['script-src']).not.toContain("'unsafe-eval'");
    expect(csp['connect-src']).toEqual(["'self'"]); // camera data and analytics cannot leave the site
    expect(csp['object-src']).toEqual(["'none'"]);
    expect(csp['frame-ancestors']).toBeDefined();
  });

  it('allows the camera for this site only, and nothing else sensitive', () => {
    const pp = header('Permissions-Policy');
    expect(pp).toContain('camera=(self)');
    expect(pp).toContain('microphone=()');
    expect(pp).toContain('geolocation=()');
    expect(pp).toContain('payment=()');
  });

  it('sets the other hardening headers', () => {
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('Strict-Transport-Security')).toMatch(/max-age=\d{7,}/);
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(header('X-Frame-Options')).toBe('SAMEORIGIN');
  });
});

describe('no third-party requests at runtime', () => {
  it('runtime code and the page load nothing from other sites', () => {
    const found = [];
    const check = (f) => {
      const t = readFileSync(f, 'utf8');
      // URLs inside comments and licence files are fine; look at code that fetches, imports or links
      const urls = t.match(/(fetch|import|src=|href=|url\()\s*\(?\s*['"`]https?:\/\/[^'"`]+/g) || [];
      for (const u of urls) found.push(relative(root, f) + ': ' + u);
    };
    for (const f of files(join(root, 'src'))) if (/\.(js|css|html)$/.test(f)) check(f);
    check(join(root, 'index.html'));
    expect(found).toEqual([]);
  });
});
