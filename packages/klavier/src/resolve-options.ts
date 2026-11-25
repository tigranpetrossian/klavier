import { DEFAULT_KEYMAP } from './default-keymap';
import { DEFAULT_BLACK_KEY_LENGTH, DEFAULT_RANGE, isBlackKey, normalizeRange } from './layout-keys';
import { paintDefaultKeys } from './default-painter';
import type { Keymap, KlavierOptions, Painter } from './klavier-types';

const DEFAULT_KEYMAP_BASE = 48;
const NOTES_PER_OCTAVE = 12;
const NOTE_LETTERS = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
const COMPUTER_KEYBOARD_MODES: readonly ComputerKeyboardMode[] = ['focus', 'global', 'off'];
const TOUCH_ACTIONS: readonly TouchAction[] = ['none', 'pan-x', 'pan-y'];

type ComputerKeyboardMode = NonNullable<KlavierOptions['computerKeyboard']>;
type TouchAction = NonNullable<KlavierOptions['touchAction']>;

interface ResolvedOptions {
  range: readonly [first: number, last: number];
  pressed: ReadonlySet<number>;
  highlights: Readonly<Record<number, string>>;
  interactive: boolean;
  computerKeyboard: ComputerKeyboardMode;
  keymap: Keymap;
  keymapBase: number;
  touchAction: TouchAction;
  blackKeyLength: number;
  painter: Painter;
  overlay: Painter | undefined;
  keyName: (note: number) => string;
}

const DEFAULT_OPTIONS: ResolvedOptions = {
  range: DEFAULT_RANGE,
  pressed: new Set(),
  highlights: {},
  interactive: true,
  computerKeyboard: 'focus',
  keymap: DEFAULT_KEYMAP,
  keymapBase: DEFAULT_KEYMAP_BASE,
  touchAction: 'none',
  blackKeyLength: DEFAULT_BLACK_KEY_LENGTH,
  painter: paintDefaultKeys,
  overlay: undefined,
  keyName: englishKeyName,
};

function resolveOptions(current: ResolvedOptions, patch: KlavierOptions): ResolvedOptions {
  const defaults = DEFAULT_OPTIONS;

  return {
    range: 'range' in patch ? keepIfEqual(current.range, normalizeRange(patch.range), sameRange) : current.range,
    pressed: 'pressed' in patch ? keepIfEqual(current.pressed, new Set(patch.pressed ?? []), sameSet) : current.pressed,
    highlights:
      'highlights' in patch
        ? keepIfEqual(current.highlights, patch.highlights ?? defaults.highlights, sameRecord)
        : current.highlights,
    interactive: 'interactive' in patch ? (patch.interactive ?? defaults.interactive) : current.interactive,
    computerKeyboard:
      'computerKeyboard' in patch
        ? oneOf(COMPUTER_KEYBOARD_MODES, patch.computerKeyboard, defaults.computerKeyboard)
        : current.computerKeyboard,
    keymap: 'keymap' in patch ? (patch.keymap ?? defaults.keymap) : current.keymap,
    keymapBase:
      'keymapBase' in patch ? Math.round(finiteOr(patch.keymapBase, defaults.keymapBase)) : current.keymapBase,
    touchAction:
      'touchAction' in patch ? oneOf(TOUCH_ACTIONS, patch.touchAction, defaults.touchAction) : current.touchAction,
    blackKeyLength:
      'blackKeyLength' in patch ? finiteOr(patch.blackKeyLength, defaults.blackKeyLength) : current.blackKeyLength,
    painter: 'painter' in patch ? (patch.painter ?? defaults.painter) : current.painter,
    overlay: 'overlay' in patch ? patch.overlay : current.overlay,
    keyName: 'keyName' in patch ? (patch.keyName ?? defaults.keyName) : current.keyName,
  };
}

function englishKeyName(note: number): string {
  const letter = NOTE_LETTERS[note % NOTES_PER_OCTAVE];
  const octave = Math.floor(note / NOTES_PER_OCTAVE) - 1;
  return isBlackKey(note) ? `${letter} sharp ${octave}` : `${letter}${octave}`;
}

function keepIfEqual<T>(current: T, next: T, isEqual: (a: T, b: T) => boolean): T {
  return isEqual(current, next) ? current : next;
}

function sameRange(a: readonly [number, number], b: readonly [number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function sameSet(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  return a.size === b.size && [...a].every((value) => b.has(value));
}

function sameRecord(a: Readonly<Record<number, string>>, b: Readonly<Record<number, string>>): boolean {
  const entriesOfA = Object.entries(a);
  return entriesOfA.length === Object.keys(b).length && entriesOfA.every(([key, value]) => b[Number(key)] === value);
}

function oneOf<T extends string>(allowed: readonly T[], value: string | undefined, fallback: T): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

export { DEFAULT_OPTIONS, resolveOptions };
export type { ResolvedOptions };
