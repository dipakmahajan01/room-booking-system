import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { NODE_ENV: 'test' },
    // All test files share one test database, so run them one at a time.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
