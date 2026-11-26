export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a)) return Array.isArray(b) && arraysEqual(a, b);
  if (isRecord(a)) return isRecord(b) && !Array.isArray(b) && recordsEqual(a, b);
  return false;
}

export function clonePlain<T>(value: T): T {
  return structuredClone(value);
}

export function isPlainData(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return Object.keys(value).length === value.length && value.every(isPlainData);
  return isPlainObject(value) && Object.values(value).every(isPlainData);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function arraysEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && Array.from(a).every((item, index) => deepEqual(item, b[index]));
}

function recordsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]));
}
