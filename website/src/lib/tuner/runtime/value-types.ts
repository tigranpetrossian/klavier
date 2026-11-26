import type { ColorModel } from '../shared/constant-type';

export type SourceLocation = { file: string; line: number };

export type PropertyType =
  'color' | 'length' | 'percentage' | 'length-percentage' | 'number' | 'integer' | 'angle' | 'time' | 'text';

export type Presence = 'applied' | 'inactive' | 'absent';

export type ConstantEntry = {
  kind: 'constant';
  id: string;
  value: unknown;
  defaultValue: unknown;
  changed: boolean;
  location: SourceLocation | null;
  options: readonly (string | number)[] | null;
  colorModel: ColorModel | null;
};

export type PropertyEntry = {
  kind: 'property';
  id: string;
  name: string;
  context: string;
  type: PropertyType;
  value: string;
  defaultValue: string;
  changed: boolean;
  editable: boolean;
  location: SourceLocation | null;
  presence: Presence;
  form: 'raw' | 'reference' | 'expression';
  target: string | null;
  resolved: string | null;
  targetInEffect: string | null;
  targetDeclarations: readonly string[];
};

export type TunableEntry = ConstantEntry | PropertyEntry;

export type ValueChange = { id: string; before: unknown; after: unknown };

export type HistoryStep = { changes: readonly ValueChange[] };

export type TuningStorage = {
  readOverrides(): Record<string, unknown>;
  writeOverrides(overrides: Record<string, unknown>): void;
  readHistory(): unknown;
  writeHistory(steps: { undo: readonly HistoryStep[]; redo: readonly HistoryStep[] }): void;
};

export type SkippedValue = { id: string; location: SourceLocation | null; reason: string };

export type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; savedCount: number; skipped: readonly SkippedValue[] }
  | { status: 'failed'; reason: string };
