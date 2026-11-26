import { describe, expectTypeOf, test } from 'vitest';
import {
  createBrowserStorage,
  createMemoryStorage,
  useProperty,
  useTunable,
  useTunables,
  useTuningSession,
  type ColorModel,
  type ConstantControl,
  type ConstantEntry,
  type ConstantType,
  type HistoryStep,
  type Presence,
  type PropertyCodec,
  type PropertyControl,
  type PropertyEntry,
  type PropertyType,
  type SaveState,
  type SkippedValue,
  type SourceLocation,
  type TunableEntry,
  type TuningSessionControls,
  type TuningStorage,
  type ValueChange,
} from './react';

type ToastPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

type SpecConstantType =
  | { kind: 'number' }
  | { kind: 'string' }
  | { kind: 'boolean' }
  | { kind: 'null' }
  | { kind: 'color' }
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'array'; element: SpecConstantType }
  | { kind: 'tuple'; elements: readonly SpecConstantType[] }
  | { kind: 'object'; fields: Readonly<Record<string, SpecConstantType>> }
  | { kind: 'union'; members: readonly SpecConstantType[] };

declare const limitControl: ConstantControl<number>;
declare const accentControl: PropertyControl;
declare const pixels: PropertyCodec<number>;
declare const session: TuningSessionControls;
declare const entries: ReturnType<typeof useTunables>;

describe('value types', () => {
  test('ConstantType, ColorModel, PropertyType and Presence are the spec unions', () => {
    expectTypeOf<ConstantType>().toEqualTypeOf<SpecConstantType>();
    expectTypeOf<ColorModel>().toEqualTypeOf<'hex' | 'rgb' | 'hsl' | 'oklch'>();
    expectTypeOf<PropertyType>().toEqualTypeOf<
      'color' | 'length' | 'percentage' | 'length-percentage' | 'number' | 'integer' | 'angle' | 'time' | 'text'
    >();
    expectTypeOf<Presence>().toEqualTypeOf<'applied' | 'inactive' | 'absent'>();
  });

  test('a source location is a project-relative file and a line', () => {
    expectTypeOf<SourceLocation>().toEqualTypeOf<{ file: string; line: number }>();
  });

  test('a constant entry carries its options and color model', () => {
    expectTypeOf<ConstantEntry>().toEqualTypeOf<{
      kind: 'constant';
      id: string;
      value: unknown;
      defaultValue: unknown;
      changed: boolean;
      location: SourceLocation | null;
      options: readonly (string | number)[] | null;
      colorModel: ColorModel | null;
    }>();
  });

  test('a property entry carries its context, presence, form and target', () => {
    expectTypeOf<PropertyEntry>().toEqualTypeOf<{
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
    }>();
  });

  test('a tunable entry narrows on kind', () => {
    expectTypeOf<TunableEntry>().toEqualTypeOf<ConstantEntry | PropertyEntry>();
    for (const entry of entries) {
      if (entry.kind === 'constant') expectTypeOf(entry).toEqualTypeOf<ConstantEntry>();
      else expectTypeOf(entry).toEqualTypeOf<PropertyEntry>();
    }
  });
});

describe('useTunable', () => {
  test('takes an id, a type guard and a fallback, and always returns a control', () => {
    expectTypeOf(useTunable<number>).toEqualTypeOf<
      (id: string, check: (value: unknown) => value is number, fallback: number) => ConstantControl<number>
    >();
  });

  test('types the control by its guard', () => {
    const useToastLimit = () => useTunable('toasts.limit', isNumber, 3);
    const useToastPosition = () => useTunable('toasts.position', isToastPosition, 'top-right');
    expectTypeOf(useToastLimit).returns.toEqualTypeOf<ConstantControl<number>>();
    expectTypeOf(useToastPosition).returns.toEqualTypeOf<ConstantControl<ToastPosition>>();
  });

  test('a constant control holds field props and the raw entry', () => {
    expectTypeOf<ConstantControl<number>>().branded.toEqualTypeOf<{
      value: number;
      defaultValue: number;
      changed: boolean;
      disabled: boolean;
      onValueChange(value: number): boolean;
      onPreviewChange(value: number | null): boolean;
      onReset(): void;
      entry: ConstantEntry | null;
    }>();
    expectTypeOf(limitControl.onValueChange(limitControl.value + 1)).toEqualTypeOf<boolean>();
    // @ts-expect-error: the limit is a number
    limitControl.onValueChange('4');
  });
});

describe('useProperty', () => {
  test('takes a name and optional options, and always returns a control', () => {
    const useAccent = () => useProperty('--accent');
    const useDarkAccent = () => useProperty('--accent', { context: '.dark' });
    expectTypeOf(useAccent).returns.toEqualTypeOf<PropertyControl>();
    expectTypeOf(useDarkAccent).returns.toEqualTypeOf<PropertyControl>();
  });

  test('a codec types the control by what it parses', () => {
    const useGap = () => useProperty('--gap', { codec: pixels });
    expectTypeOf(useGap).returns.toEqualTypeOf<PropertyControl<number>>();
  });

  test('a codec passed through an options variable still types the control', () => {
    const options = { context: '.dark', codec: pixels };
    const useDarkGap = () => useProperty('--gap', options);
    expectTypeOf(useDarkGap).returns.toEqualTypeOf<PropertyControl<number>>();
  });

  test('a property control edits CSS text, points at targets and detaches', () => {
    expectTypeOf<PropertyControl>().branded.toEqualTypeOf<{
      value: string;
      defaultValue: string;
      changed: boolean;
      disabled: boolean;
      onValueChange(value: string): boolean;
      onPreviewChange(value: string | null): boolean;
      onReset(): void;
      entry: PropertyEntry | null;
      targets: readonly string[];
      pointTo(name: string): boolean;
      detach(): boolean;
    }>();
    expectTypeOf(accentControl.pointTo('--brand')).toEqualTypeOf<boolean>();
    expectTypeOf(accentControl.detach()).toEqualTypeOf<boolean>();
    // @ts-expect-error: property values are CSS text
    accentControl.onValueChange(12);
  });

  test('a property codec parses and formats CSS text', () => {
    expectTypeOf<PropertyCodec<number>>().toEqualTypeOf<{
      empty: number;
      parse(css: string): number | null;
      format(value: number, current: string): string;
    }>();
  });
});

describe('useTunables', () => {
  test('lists every value as a read-only array', () => {
    expectTypeOf(useTunables).toEqualTypeOf<() => readonly TunableEntry[]>();
  });
});

describe('useTuningSession', () => {
  test('returns the session controls when called without arguments', () => {
    const useSession = () => useTuningSession();
    expectTypeOf(useSession).returns.toEqualTypeOf<TuningSessionControls>();
  });

  test('session controls count changes, expose undo and redo ids, close the open step, and save', () => {
    expectTypeOf<TuningSessionControls>().toEqualTypeOf<{
      changedCount: number;
      undoIds: readonly string[] | null;
      redoIds: readonly string[] | null;
      saveState: SaveState;
      undo(): void;
      redo(): void;
      commitUndo(): void;
      resetAll(): void;
      save(): Promise<void>;
    }>();
  });

  test('a save state narrows on status', () => {
    const { saveState } = session;
    switch (saveState.status) {
      case 'idle':
      case 'saving':
        expectTypeOf(saveState).toEqualTypeOf<{ status: 'idle' } | { status: 'saving' }>();
        break;
      case 'saved':
        expectTypeOf(saveState).toEqualTypeOf<{
          status: 'saved';
          savedCount: number;
          skipped: readonly SkippedValue[];
        }>();
        break;
      case 'failed':
        expectTypeOf(saveState).toEqualTypeOf<{ status: 'failed'; reason: string }>();
        break;
      default:
        expectTypeOf(saveState).toBeNever();
    }
    // @ts-expect-error: only a failed save has a reason
    expectTypeOf(saveState.reason).toBeString();
  });

  test('a skipped value names its id, location and reason', () => {
    expectTypeOf<SkippedValue>().toEqualTypeOf<{ id: string; location: SourceLocation | null; reason: string }>();
  });
});

describe('storage', () => {
  test('a tuning storage reads and writes overrides and history', () => {
    expectTypeOf<TuningStorage>().toEqualTypeOf<{
      readOverrides(): Record<string, unknown>;
      writeOverrides(overrides: Record<string, unknown>): void;
      readHistory(): unknown;
      writeHistory(steps: { undo: readonly HistoryStep[]; redo: readonly HistoryStep[] }): void;
    }>();
    expectTypeOf<HistoryStep>().toEqualTypeOf<{ changes: readonly ValueChange[] }>();
    expectTypeOf<ValueChange>().toEqualTypeOf<{ id: string; before: unknown; after: unknown }>();
  });

  test('the browser and memory factories both create a tuning storage', () => {
    expectTypeOf(createBrowserStorage).toEqualTypeOf<() => TuningStorage>();
    expectTypeOf(createMemoryStorage).toEqualTypeOf<() => TuningStorage>();
  });
});

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

function isToastPosition(value: unknown): value is ToastPosition {
  return value === 'top-left' || value === 'top-right' || value === 'bottom-left' || value === 'bottom-right';
}
