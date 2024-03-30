/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import postCssNesting from 'postcss-nesting';
import { resolve } from 'path';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'Klavier',
      fileName: 'klavier',
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
    },
  },
  css: {
    postcss: {
      plugins: [postCssNesting()],
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: './vitest/setup.js',
  },
  server: {
    open: true,
  },
});
