import { memo, type ReactNode } from 'react';

const counts = new Map<string, number>();

export function count(name: string): void {
  counts.set(name, (counts.get(name) ?? 0) + 1);
}

export function countOf(name: string): number {
  return counts.get(name) ?? 0;
}

export function resetCounts(): void {
  counts.clear();
}

export const PlainList = memo(function PlainList({ renderItem }: { renderItem: (index: number) => ReactNode }) {
  return <p data-testid="plain-list">{[0, 1].map((index) => renderItem(index))}</p>;
});

export function SlowComponent({ milliseconds }: { milliseconds: number }) {
  const end = performance.now() + milliseconds;
  while (performance.now() < end) continue;
  return null;
}
