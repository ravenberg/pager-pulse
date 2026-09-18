import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // The whole app boots per file: Nest, a seeded database and Vite.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
