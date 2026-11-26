import { count } from '../../support/untransformed';
import { STACK_HEIGHT, TOAST_LIMIT } from './toast-constants';

export const STACK_SUMMARY = describeStack(STACK_HEIGHT, TOAST_LIMIT);

function describeStack(height: number, limit: number): string {
  count('STACK_SUMMARY');
  return `${height}px for ${limit}`;
}
