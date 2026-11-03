// Browser tests on a range of screens: phones (portrait and landscape, with notch safe areas), tablets,
// laptops and large desktops, plus a browser without WebGL. Run with `npm run test:e2e`; see docs/TESTING.md.
// The first run needs the browser: `npx playwright install chromium`.
import { defineConfig, devices } from '@playwright/test';

// WebGL in a headless browser (software rendering, works on machines and CI runners without a GPU)
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
// a fake camera for the try-on test (Chrome's built-in test pattern; nothing is recorded)
const CAMERA = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'];
const PORT = 4173;

const chromium = (device, extra = {}) => ({
  ...device,
  browserName: 'chromium',
  launchOptions: { args: [...GL, ...CAMERA] },
  ...extra,
});

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  timeout: 480_000, // software WebGL is slow; a GPU machine finishes far sooner
  expect: { timeout: 30_000 },
  fullyParallel: true,
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    permissions: ['camera'],
  },
  // tests run against the production build, with the same security headers as Vercel
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
  },
  projects: [
    // phones, portrait
    { name: 'phone-small', use: chromium(devices['iPhone SE']) }, // 320 x 568, the smallest phone in use
    { name: 'phone', use: chromium(devices['iPhone 13']) }, // 390 x 664, notch
    { name: 'phone-large', use: chromium(devices['iPhone 15 Pro Max']) }, // 430 x 739, notch
    { name: 'android', use: chromium(devices['Pixel 7']) }, // 412 x 839
    // phones, landscape
    { name: 'phone-landscape', use: chromium(devices['iPhone 13 landscape']) }, // 750 x 342, notch at the side
    { name: 'android-landscape', use: chromium(devices['Pixel 7 landscape']) }, // 863 x 360
    // tablets
    { name: 'tablet', use: chromium(devices['iPad Mini']) }, // 768 x 1024
    { name: 'tablet-landscape', use: chromium(devices['iPad Mini landscape']) }, // 1024 x 768
    { name: 'tablet-large', use: chromium(devices['iPad Pro 11']) }, // 834 x 1194
    // laptops and desktops
    { name: 'laptop', use: chromium(devices['Desktop Chrome'], { viewport: { width: 1366, height: 768 } }) },
    // big screens render many more pixels in software WebGL: allow more time
    {
      name: 'desktop',
      timeout: 900_000,
      use: chromium(devices['Desktop Chrome'], { viewport: { width: 1920, height: 1080 } }),
    },
    {
      name: 'desktop-xl',
      timeout: 1_200_000,
      use: chromium(devices['Desktop Chrome'], { viewport: { width: 2560, height: 1440 } }),
    },
    // a browser that cannot run WebGL: the floor-plan fallback must still work
    {
      name: 'no-webgl',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1366, height: 768 },
        launchOptions: { args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] },
      },
    },
  ],
});
