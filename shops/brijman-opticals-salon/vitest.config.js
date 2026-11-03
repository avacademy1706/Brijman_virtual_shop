// Unit tests (Node, no browser). Run with `npm test`; see docs/TESTING.md.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
    // every catalogue piece is built in every metal; give slow laptops room
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: 'forks',
  },
});
