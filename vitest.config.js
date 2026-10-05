import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['server/tests/**/*.test.js'], environment: 'node', testTimeout: 30000, hookTimeout: 60000 },
});
