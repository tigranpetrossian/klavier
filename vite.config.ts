import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import postCssNesting from 'postcss-nesting';

// https://vitejs.dev/config/
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
});
