import { defineConfig } from 'vitest/config';

// Tests run in Node with no network. Kept separate from vite.config.js so tests never start the dev API plugin.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
  },
});
