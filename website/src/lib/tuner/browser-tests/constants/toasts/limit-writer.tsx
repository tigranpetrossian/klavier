import { useLayoutEffect } from 'react';
import { useTunable } from '@/lib/tuner/react';

export function LimitWriter({ value }: { value: number | null }) {
  const limit = useTunable('toasts.limit', isNumber, Number.NaN);
  useLayoutEffect(() => {
    if (value !== null) limit.onValueChange(value);
  }, [limit, value]);
  return null;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}
