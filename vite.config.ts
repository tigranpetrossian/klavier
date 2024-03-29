import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
});
