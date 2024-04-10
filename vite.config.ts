/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import mkcert from 'vite-plugin-mkcert';
import { resolve } from 'path';

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  plugins: [mkcert(), tsconfigPaths(), react()],

  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'Klavier',
      fileName: 'klavier',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
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
