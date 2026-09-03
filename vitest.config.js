import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    exclude: ['tests/**/*.spec.js', 'tests/performance.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['tests/**', '*.config.js', 'build.js', 'src/**']
    },
    testTimeout: 15000,
    hookTimeout: 15000,
    env: {
      VITEST: 'true',
      VITEST_WORKER_ID: '1'
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});