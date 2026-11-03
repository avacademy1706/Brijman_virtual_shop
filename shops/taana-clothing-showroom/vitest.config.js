// Unit tests (Node, no browser). Run with `npm test`; see docs/TESTING.md.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
    // the cloth tests run real simulations; give slow laptops room
    testTimeout: 120_000,
    hookTimeout: 120_000,
    pool: 'forks',
  },
});
