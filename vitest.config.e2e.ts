import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // The whole app boots per file: Nest, a seeded database and Vite.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
