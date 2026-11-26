import { tunable } from '@/lib/tuner/tunable';

export const SHARE_COUNT = tunable('broken.share-count', 2);
export const SHARE = divide(100, SHARE_COUNT);

function divide(total: number, parts: number): number {
  if (parts === 0) throw new RangeError('parts must not be zero');
  return total / parts;
}
