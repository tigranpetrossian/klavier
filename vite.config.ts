/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  plugins: [tsconfigPaths(), react(), dts({ rollupTypes: true })],

  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      formats: ['es', 'cjs'],
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
});
