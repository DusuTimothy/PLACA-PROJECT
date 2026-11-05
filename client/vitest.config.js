import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Component smoke tests run in jsdom so they exercise the same React code the
 * browser runs. The PWA plugin is deliberately excluded: service workers do
 * not exist in jsdom and are not relevant to these tests.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
  },
});
