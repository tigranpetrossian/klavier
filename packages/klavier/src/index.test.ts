import { expect, test } from 'vitest';
import { packageName } from './index';

test('exports the package name', () => {
  expect(packageName).toBe('klavier');
});
