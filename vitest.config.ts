// vitest.config.ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['server/**/*.spec.ts', 'server/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'client/**'],
    setupFiles: ['server/test.setup.ts'],
  },
});
