/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import tsconfigPaths from 'vite-tsconfig-paths';

const extensions = {
  cjs: 'cjs',
  es: 'mjs',
};

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    react(),
    dts({ rollupTypes: true }),
    viteStaticCopy({
      targets: [
        {
          src: 'src/presets/realistic.css',
          dest: '',
        },
      ],
    }),
  ],

  build: {
    lib: {
      entry: ['src/index.ts', 'src/presets/realistic.tsx'],
      formats: ['es', 'cjs'],
      name: 'Klavier',
      fileName: (format, entryName) => {
        // @ts-ignore
        return `${entryName}.${extensions[format]}`;
      },
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
