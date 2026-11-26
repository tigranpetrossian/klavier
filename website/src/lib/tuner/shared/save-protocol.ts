export const SAVE_ENDPOINT = '/api/tuner/save';

type SavedLocation = { file: string; line: number };

export type ConstantSaveValue = {
  kind: 'constant';
  id: string;
  location: SavedLocation;
  value: unknown;
  loadedDefault: unknown;
};

export type PropertySaveValue = {
  kind: 'property';
  id: string;
  name: string;
  context: string;
  location: SavedLocation;
  value: string;
  loadedDefault: string;
};

export type SaveValue = ConstantSaveValue | PropertySaveValue;

export type SaveRequest = { values: readonly SaveValue[] };

export type SaveSkip = { id: string; reason: string };

export type SaveResponse =
  { ok: true; saved: readonly string[]; skipped: readonly SaveSkip[] } | { ok: false; reason: string };
