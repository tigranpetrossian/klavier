import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import {
  declarationsEndpointPlugin,
  tunerTransformPlugin,
} from './src/lib/tuner/browser-tests/support/vite-plugins.ts';
import path from 'node:path';

const ALIASES = {
  '@': path.resolve(import.meta.dirname, 'src'),
};

export default defineConfig({
  resolve: { alias: ALIASES },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/lib/tuner/**/*.test.ts'],
          exclude: ['src/lib/tuner/**/*.browser.test.{ts,tsx}'],
          typecheck: {
            enabled: true,
            include: ['src/lib/tuner/**/*.test-d.ts'],
            tsconfig: './tsconfig.json',
          },
        },
      },
      {
        extends: true,
        plugins: [tunerTransformPlugin(), declarationsEndpointPlugin()],
        test: {
          name: 'browser',
          include: ['src/lib/tuner/**/*.browser.test.{ts,tsx}'],
          setupFiles: ['./src/lib/tuner/browser-tests/support/fresh-storage.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
