import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import type { BrowserInstanceOption } from 'vitest/node';

const PIXEL_RATIOS = [1, 1.25, 1.5, 2];
const VIEWPORT = { width: 1000, height: 600 };
const PREBUNDLED_FOR_BROWSER_TESTS = [
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom',
  'react-dom/client',
  'react-dom/server',
  'fast-check',
];

function chromiumAt(pixelRatio: number): BrowserInstanceOption {
  return {
    browser: 'chromium',
    name: `chromium@${pixelRatio}x`,
    provider: playwright({ contextOptions: { deviceScaleFactor: pixelRatio, hasTouch: true } }),
  };
}

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.browser.test.ts'],
        },
      },
      {
        // Pre-bundling vitest-browser-react gives it a second copy of Vitest that has no test runner.
        optimizeDeps: { include: PREBUNDLED_FOR_BROWSER_TESTS, exclude: ['vitest-browser-react'] },
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.{ts,tsx}'],
          browser: {
            enabled: true,
            headless: true,
            screenshotFailures: false,
            viewport: VIEWPORT,
            provider: playwright(),
            instances: PIXEL_RATIOS.map(chromiumAt),
            expect: {
              toMatchScreenshot: {
                comparatorOptions: { allowedMismatchedPixelRatio: 0.01 },
                resolveScreenshotPath: ({ root, testFileDirectory, screenshotDirectory, testFileName, arg, ext }) =>
                  `${root}/${testFileDirectory}/${screenshotDirectory}/${testFileName}/${arg}${ext}`,
              },
            },
          },
        },
      },
    ],
  },
});
