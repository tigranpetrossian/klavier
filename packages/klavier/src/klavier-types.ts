import type { KeyRect, KlavierLayout } from './layout-keys';

type Keymap = Readonly<Record<string, number>>;

type Painter = (ctx: CanvasRenderingContext2D, frame: Frame) => void;

interface KlavierOptions {
  range?: readonly [first: number, last: number] | undefined;
  pressed?: Iterable<number> | undefined;
  highlights?: Readonly<Record<number, string>> | undefined;
  interactive?: boolean | undefined;
  computerKeyboard?: 'focus' | 'global' | 'off' | undefined;
  keymap?: Keymap | undefined;
  keymapBase?: number | undefined;
  touchAction?: 'none' | 'pan-x' | 'pan-y' | undefined;
  blackKeyLength?: number | undefined;
  painter?: Painter | undefined;
  overlay?: Painter | undefined;
  keyName?: ((note: number) => string) | undefined;
}

interface Frame {
  width: number;
  height: number;
  pixelRatio: number;
  keys: readonly KeyView[];
}

interface KeyView extends KeyRect {
  pressed: boolean;
  highlight: string | undefined;
}

interface KlavierInstance {
  readonly layout: KlavierLayout;
  update(patch: KlavierOptions): void;
  on<T extends keyof KlavierEventMap>(type: T, listener: (event: KlavierEventMap[T]) => void): () => void;
  focus(): void;
  redraw(): void;
  destroy(): void;
}

interface KlavierEventMap {
  noteon: NoteOnEvent;
  noteoff: NoteOffEvent;
  layout: KlavierLayout;
}

type NoteOnEvent =
  | { note: number; velocity: number; source: 'pointer'; keyX: number; keyY: number }
  | { note: number; velocity: number; source: 'keyboard' };

type NoteOffEvent = { note: number; cancelled: boolean };

export type {
  Keymap,
  Painter,
  KlavierOptions,
  Frame,
  KeyView,
  KlavierInstance,
  KlavierEventMap,
  NoteOnEvent,
  NoteOffEvent,
};
