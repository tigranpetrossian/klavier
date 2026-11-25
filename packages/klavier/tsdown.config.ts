import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts', react: 'src/react/index.ts' },
  platform: 'neutral',
  dts: { generator: 'oxc' },
  exports: true,
});
