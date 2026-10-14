// Mobile and responsive audit: every screen on phones, tablets and desktops, portrait and landscape.
// Run with `npm run test:mobile` (builds, serves the production build, audits, then writes the report).
// AUDIT_PHASE=before|after chooses where results go (default after).
import { defineConfig, devices } from '@playwright/test';

const PORT = 4317;
// Software WebGL so the 3D store renders in headless Chromium.
const chromiumGL = { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };

const both = (name, d, extra = {}) => [
  { name, use: { ...devices[d], ...extra } },
  { name: name + ' landscape', use: { ...devices[d + ' landscape'], ...extra } },
];
const chromium = { launchOptions: chromiumGL };

const lowEnd = {
  viewport: { width: 360, height: 800 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 12; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  defaultBrowserType: 'chromium',
  ...chromium,
};

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  timeout: 8 * 60 * 1000,
  workers: process.env.AUDIT_WORKERS ? +process.env.AUDIT_WORKERS : 3,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:' + PORT, trace: 'off', actionTimeout: 15000 },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --port ' + PORT + ' --strictPort',
    cwd: '../..',
    url: 'http://localhost:' + PORT,
    reuseExistingServer: false,
    timeout: 60 * 1000,
  },
  projects: [
    // iPhone and iPad profiles run in WebKit (close to Safari, not identical).
    ...both('iPhone SE', 'iPhone SE'),
    ...both('iPhone 15 Pro', 'iPhone 15 Pro'),
    ...both('iPad Mini', 'iPad Mini'),
    // Android profiles and desktops run in Chromium.
    ...both('Pixel 7', 'Pixel 7', chromium),
    ...both('Galaxy S9+', 'Galaxy S9+', chromium),
    ...both('Galaxy Tab S4', 'Galaxy Tab S4', chromium),
    { name: 'Low-end Android', use: lowEnd },
    { name: 'Low-end Android landscape', use: { ...lowEnd, viewport: { width: 800, height: 360 } } },
    {
      name: 'Desktop 1366',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 }, ...chromium },
    },
    {
      name: 'Desktop 1920',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 }, ...chromium },
    },
  ],
});
