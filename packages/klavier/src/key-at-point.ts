import type { KeyRect } from './layout-keys';

interface KeyHit {
  note: number;
  keyX: number;
  keyY: number;
}

function keyAtPoint(keys: readonly KeyRect[], x: number, y: number): KeyHit | undefined {
  const key =
    keys.find((candidate) => candidate.black && contains(candidate, x, y)) ??
    keys.find((candidate) => !candidate.black && contains(candidate, x, y));

  if (!key) return undefined;
  return { note: key.note, keyX: (x - key.x) / key.width, keyY: (y - key.y) / key.height };
}

function contains(key: KeyRect, x: number, y: number): boolean {
  return x >= key.x && x < key.x + key.width && y >= key.y && y < key.y + key.height;
}

export { keyAtPoint };
export type { KeyHit };
