import type { PlainData } from './script-literals.ts';

export type ConstantSaveItem = {
  kind: 'constant';
  id: string;
  file: string;
  value: PlainData;
  loadedDefault: unknown;
};

export type PropertySaveItem = {
  kind: 'property';
  id: string;
  file: string;
  name: string;
  context: string;
  value: string;
  loadedDefault: string;
};

export type SaveItem = ConstantSaveItem | PropertySaveItem;

export function parseSaveRequest(body: unknown): readonly SaveItem[] | null {
  if (!isRecord(body) || !Array.isArray(body.values)) return null;
  const items = body.values.map(parseSaveItem);
  return items.every((item) => item !== null) ? items : null;
}

function parseSaveItem(raw: unknown): SaveItem | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !isRecord(raw.location)) {
    return null;
  }
  const { id, location } = raw;
  if (typeof location.file !== 'string') return null;
  if (raw.kind === 'constant' && 'loadedDefault' in raw && isPlainData(raw.value)) {
    return {
      kind: 'constant',
      id,
      file: location.file,
      value: raw.value,
      loadedDefault: raw.loadedDefault,
    };
  }
  if (
    raw.kind === 'property' &&
    typeof raw.name === 'string' &&
    typeof raw.context === 'string' &&
    typeof raw.value === 'string' &&
    typeof raw.loadedDefault === 'string'
  ) {
    return {
      kind: 'property',
      id,
      file: location.file,
      name: raw.name,
      context: raw.context,
      value: raw.value.trim(),
      loadedDefault: raw.loadedDefault,
    };
  }
  return null;
}

function isPlainData(value: unknown): value is PlainData {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isPlainData);
  return isRecord(value) && Object.values(value).every(isPlainData);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
