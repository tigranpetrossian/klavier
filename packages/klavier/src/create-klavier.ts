import { EMPTY_NOTE_BY_INPUT_ID, noteChanges, press, pressedNotes, release } from './note-by-input-id';
import { keyAtPoint } from './key-at-point';
import {
  createKeyButtons,
  labelKeyButtons,
  markPressedKeyButtons,
  moveTabStop,
  noteOfKeyButton,
  placeKeyButtons,
  removeKeyButtons,
} from './key-buttons';
import { layoutKeys, naturalAspectRatio } from './layout-keys';
import { bitmapSizeFor, measureElementSize, observeElementSize } from './observe-element-size';
import { DEFAULT_OPTIONS, resolveOptions } from './resolve-options';
import type { NoteByInputId } from './note-by-input-id';
import type { KeyHit } from './key-at-point';
import type { KeyButtons } from './key-buttons';
import type { Frame, KlavierEventMap, KlavierInstance, KlavierOptions, NoteOnEvent, Painter } from './klavier-types';
import type { KlavierLayout } from './layout-keys';
import type { ElementSize } from './observe-element-size';
import type { ResolvedOptions } from './resolve-options';

const SURFACE_STYLE =
  'position:relative;display:block;width:0;min-width:100%;height:100%;' +
  'user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;';
const CANVAS_STYLE = 'position:absolute;inset:0;display:block;width:100%;height:100%;';
const MIN_POINTER_VELOCITY = 0.25;
const DEFAULT_VELOCITY = 0.75;
const ASSISTIVE_CLICK_NOTE_MS = 250;
const POINTER_INPUT_ID_PREFIX = 'pointer:';
const COMPUTER_KEY_INPUT_ID_PREFIX = 'key:';
const ASSISTIVE_CLICK_INPUT_ID_PREFIX = 'click:';
const NON_TEXT_INPUT_TYPES = ['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit'];

const KEYBOARD_NOTE_ON_DETAIL: NoteOnDetail = { velocity: DEFAULT_VELOCITY, source: 'keyboard' };

type WithoutNote<Each> = Each extends unknown ? Omit<Each, 'note'> : never;
type NoteOnDetail = WithoutNote<NoteOnEvent>;
type Listeners = { [Type in keyof KlavierEventMap]: Set<(event: KlavierEventMap[Type]) => void> };
type View = Window & typeof globalThis;

function createKlavier(root: HTMLElement, initialOptions: KlavierOptions = {}): KlavierInstance {
  const ownerDocument = root.ownerDocument;
  const view: View = ownerDocument.defaultView ?? window;
  const surface = ownerDocument.createElement('div');
  const canvas = ownerDocument.createElement('canvas');
  const context = canvas.getContext('2d');
  const listeners: Listeners = { noteon: new Set(), noteoff: new Set(), layout: new Set() };
  const eventQueue: Array<() => void> = [];
  const activePointers = new Set<number>();
  const assistiveClickTimers = new Map<string, number>();
  const teardown = new AbortController();

  let options = resolveOptions(DEFAULT_OPTIONS, initialOptions);
  let noteByInputId = EMPTY_NOTE_BY_INPUT_ID;
  let surfaceSize: ElementSize = { cssWidth: 0, cssHeight: 0, devicePixelWidth: 0, devicePixelHeight: 0 };
  let layout = layoutKeysOnSurface(surfaceSize, options);
  let buttons: KeyButtons = new Map();
  let tabStopNote = options.range[0];
  let computerKeyBinding = new AbortController();
  let frameRequest: number | undefined;
  let isDispatching = false;
  let destroyed = false;

  surface.style.cssText = SURFACE_STYLE;
  canvas.style.cssText = CANVAS_STYLE;
  canvas.setAttribute('aria-hidden', 'true');
  surface.append(canvas);
  root.append(surface);
  styleSurface();
  rebuildKeyButtons();
  bindComputerKeyListeners();
  listen(surface, 'pointerdown', onPointerDown);
  listen(surface, 'pointermove', onPointerMove);
  listen(surface, 'pointerup', (event) => endPointer(event, false));
  listen(surface, 'pointercancel', (event) => endPointer(event, true));
  listen(surface, 'lostpointercapture', (event) => endPointer(event, true));
  listen(surface, 'touchstart', onTouchStart, { passive: false });
  listen(surface, 'contextmenu', onContextMenu);
  listen(surface, 'click', onClick);
  listen(surface, 'focusin', onFocusIn);
  listen(surface, 'focusout', onFocusOut);
  listen(view, 'blur', releaseComputerKeys);
  resize(measureElementSize(surface));
  const stopObservingSize = observeElementSize(surface, (size) => {
    resize(size);
    // Resizing clears the canvas, and a frame requested now would only run after the browser has shown it empty.
    if (frameRequest !== undefined) paint();
  });

  return {
    get layout() {
      return layout;
    },
    update,
    on,
    focus: () => buttons.get(tabStopNote)?.focus(),
    redraw: requestPaint,
    destroy,
  };

  function update(patch: KlavierOptions): void {
    if (destroyed) return;

    const previous = options;
    options = resolveOptions(previous, patch);
    const changed = (option: keyof ResolvedOptions): boolean => previous[option] !== options[option];
    const keysChanged = changed('range') || changed('interactive');

    if (keysChanged) releaseAllInputs();
    else if (changed('computerKeyboard')) releaseComputerKeys();

    if (changed('computerKeyboard')) bindComputerKeyListeners();
    if (keysChanged || changed('touchAction')) styleSurface();
    if (changed('range') || changed('blackKeyLength')) relayout();
    if (keysChanged) rebuildKeyButtons();
    else if (changed('keyName')) labelKeyButtons(buttons, options.keyName);
    if (changed('pressed') || changed('highlights') || changed('painter') || changed('overlay')) showKeyStates();
  }

  function on<Type extends keyof KlavierEventMap>(
    type: Type,
    listener: (event: KlavierEventMap[Type]) => void
  ): () => void {
    listeners[type].add(listener);
    return () => {
      listeners[type].delete(listener);
    };
  }

  function destroy(): void {
    if (destroyed) return;

    releaseAllInputs();
    destroyed = true;
    teardown.abort();
    computerKeyBinding.abort();
    stopObservingSize();
    for (const timer of assistiveClickTimers.values()) view.clearTimeout(timer);
    if (frameRequest !== undefined) view.cancelAnimationFrame(frameRequest);
    surface.remove();
  }

  function dispatch<Type extends keyof KlavierEventMap>(type: Type, event: KlavierEventMap[Type]): void {
    eventQueue.push(() => {
      for (const listener of [...listeners[type]]) listener(event);
    });
    if (isDispatching) return;

    isDispatching = true;
    try {
      for (let dispatchNext = eventQueue.shift(); dispatchNext; dispatchNext = eventQueue.shift()) dispatchNext();
    } finally {
      isDispatching = false;
    }
  }

  function setNoteByInputId(next: NoteByInputId, cancelled: boolean, detail?: NoteOnDetail): void {
    const { started, ended } = noteChanges(noteByInputId, next);
    noteByInputId = next;
    if (started.length === 0 && ended.length === 0) return;

    showKeyStates();
    for (const note of ended) dispatch('noteoff', { note, cancelled });
    if (detail) for (const note of started) dispatch('noteon', { note, ...detail });
  }

  function pressNote(inputId: string, note: number, detail: NoteOnDetail): void {
    setNoteByInputId(press(noteByInputId, inputId, note), false, detail);
  }

  function releaseInputs(shouldRelease: (inputId: string) => boolean, cancelled: boolean): void {
    setNoteByInputId(release(noteByInputId, shouldRelease), cancelled);
  }

  function releaseComputerKeys(): void {
    releaseInputs((inputId) => inputId.startsWith(COMPUTER_KEY_INPUT_ID_PREFIX), true);
  }

  function releaseAllInputs(): void {
    activePointers.clear();
    setNoteByInputId(EMPTY_NOTE_BY_INPUT_ID, true);
  }

  function notesShownPressed(): ReadonlySet<number> {
    return new Set([...pressedNotes(noteByInputId), ...options.pressed]);
  }

  function showKeyStates(): void {
    markPressedKeyButtons(buttons, notesShownPressed());
    requestPaint();
  }

  function resize(size: ElementSize): void {
    if (destroyed || sameElementSize(size, surfaceSize)) return;

    const bitmap = bitmapSizeFor(size);
    surfaceSize = size;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    relayout();
  }

  function relayout(): void {
    layout = layoutKeysOnSurface(surfaceSize, options);
    placeKeyButtons(buttons, layout.keys);
    dispatch('layout', layout);
    requestPaint();
  }

  function requestPaint(): void {
    if (destroyed || frameRequest !== undefined) return;
    frameRequest = view.requestAnimationFrame(paint);
  }

  function paint(): void {
    if (frameRequest !== undefined) view.cancelAnimationFrame(frameRequest);
    frameRequest = undefined;
    if (!context || layout.width === 0 || layout.height === 0) return;

    const frame = frameToPaint(layout, notesShownPressed(), options.highlights);
    context.setTransform(canvas.width / frame.width, 0, 0, canvas.height / frame.height, 0, 0);
    context.clearRect(0, 0, frame.width, frame.height);
    paintAndRestoreContext(context, options.painter, frame);
    if (options.overlay) paintAndRestoreContext(context, options.overlay, frame);
  }

  function styleSurface(): void {
    surface.style.aspectRatio = String(naturalAspectRatio(options.range));
    surface.style.touchAction = options.interactive ? options.touchAction : 'auto';
  }

  function rebuildKeyButtons(): void {
    const hadFocus = surface.matches(':focus-within');
    const showedFocusRing = buttons.get(tabStopNote)?.matches(':focus-visible') ?? false;
    const [first, last] = options.range;

    removeKeyButtons(buttons);
    buttons = options.interactive ? createKeyButtons(surface, layout.keys, options.keyName) : new Map();
    tabStopNote = tabStopNote >= first && tabStopNote <= last ? tabStopNote : first;
    moveTabStop(buttons, tabStopNote, tabStopNote);
    markPressedKeyButtons(buttons, notesShownPressed());
    if (hadFocus) buttons.get(tabStopNote)?.focus({ preventScroll: true, focusVisible: showedFocusRing });
  }

  function bindComputerKeyListeners(): void {
    computerKeyBinding.abort();
    computerKeyBinding = new AbortController();
    const target: GlobalEventHandlers = options.computerKeyboard === 'global' ? view : surface;
    target.addEventListener('keydown', onKeyDown, { signal: computerKeyBinding.signal });
    target.addEventListener('keyup', onKeyUp, { signal: computerKeyBinding.signal });
  }

  function listen<Type extends keyof GlobalEventHandlersEventMap>(
    target: GlobalEventHandlers,
    type: Type,
    listener: (event: GlobalEventHandlersEventMap[Type]) => void,
    settings?: AddEventListenerOptions
  ): void {
    target.addEventListener(type, listener, { ...settings, signal: teardown.signal });
  }

  function onPointerDown(event: PointerEvent): void {
    if (!options.interactive || event.button !== 0) return;

    activePointers.add(event.pointerId);
    if (event.isTrusted) surface.setPointerCapture(event.pointerId);

    const hit = hitAt(event);
    if (!hit) return;
    buttons.get(hit.note)?.focus({ preventScroll: true, focusVisible: false });
    pressNote(POINTER_INPUT_ID_PREFIX + event.pointerId, hit.note, noteOnDetailForPointerHit(hit));
  }

  function onPointerMove(event: PointerEvent): void {
    if (!activePointers.has(event.pointerId)) return;

    const inputId = POINTER_INPUT_ID_PREFIX + event.pointerId;
    const hit = hitAt(event);
    if (hit) pressNote(inputId, hit.note, noteOnDetailForPointerHit(hit));
    else releaseInputs((candidate) => candidate === inputId, false);
  }

  function endPointer(event: PointerEvent, cancelled: boolean): void {
    if (!activePointers.delete(event.pointerId)) return;
    releaseInputs((inputId) => inputId === POINTER_INPUT_ID_PREFIX + event.pointerId, cancelled);
  }

  function hitAt(event: PointerEvent): KeyHit | undefined {
    const rect = surface.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return undefined;

    const x = ((event.clientX - rect.left) * layout.width) / rect.width;
    const y = ((event.clientY - rect.top) * layout.height) / rect.height;
    return keyAtPoint(layout.keys, x, y);
  }

  function onTouchStart(event: TouchEvent): void {
    if (options.interactive && options.touchAction === 'none' && event.cancelable) event.preventDefault();
  }

  function onContextMenu(event: MouseEvent): void {
    if (options.interactive) event.preventDefault();
  }

  function onClick(event: MouseEvent): void {
    const note = noteOfKeyButton(buttons, event.target);
    const cameFromAssistiveTechnology = event.detail === 0;
    if (!options.interactive || !cameFromAssistiveTechnology || note === undefined) return;

    const inputId = ASSISTIVE_CLICK_INPUT_ID_PREFIX + note;
    pressNote(inputId, note, KEYBOARD_NOTE_ON_DETAIL);
    view.clearTimeout(assistiveClickTimers.get(inputId));
    assistiveClickTimers.set(
      inputId,
      view.setTimeout(() => {
        assistiveClickTimers.delete(inputId);
        releaseInputs((candidate) => candidate === inputId, false);
      }, ASSISTIVE_CLICK_NOTE_MS)
    );
  }

  function onFocusIn(event: FocusEvent): void {
    const note = noteOfKeyButton(buttons, event.target);
    if (note === undefined) return;

    moveTabStop(buttons, tabStopNote, note);
    tabStopNote = note;
  }

  function onFocusOut(event: FocusEvent): void {
    const staysInside = event.relatedTarget instanceof view.Node && surface.contains(event.relatedTarget);
    if (!staysInside && options.computerKeyboard !== 'global') releaseComputerKeys();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!options.interactive) return;
    if (event.metaKey) {
      // macOS never delivers keyup for keys released while Command is down.
      releaseComputerKeys();
      return;
    }
    if (event.ctrlKey || event.altKey) return;

    const origin = event.composedPath()[0];
    const semitones = mappedSemitones(event, origin);
    if (semitones !== undefined) {
      event.preventDefault();
      if (!event.repeat) playComputerKey(event.code, options.keymapBase + semitones);
      return;
    }

    const focused = noteOfKeyButton(buttons, origin);
    if (focused === undefined) return;

    const destination = noteToFocusOnNavigationKey(event.key, focused, options.range);
    if (destination !== undefined) {
      event.preventDefault();
      buttons.get(destination)?.focus();
    } else if (isSpaceOrEnter(event.key)) {
      event.preventDefault();
      if (!event.repeat) playComputerKey(event.code, focused);
    }
  }

  function onKeyUp(event: KeyboardEvent): void {
    const onKeyButton = noteOfKeyButton(buttons, event.composedPath()[0]) !== undefined;
    // The browser clicks a focused button when Space is released, which would play the key a second time.
    if (onKeyButton && isSpaceOrEnter(event.key)) event.preventDefault();

    releaseInputs((inputId) => inputId === COMPUTER_KEY_INPUT_ID_PREFIX + event.code, false);
  }

  function mappedSemitones(event: KeyboardEvent, origin: EventTarget | undefined): number | undefined {
    if (options.computerKeyboard === 'off') return undefined;
    if (options.computerKeyboard === 'global' && isEditableElement(view, origin)) return undefined;
    return options.keymap[event.code];
  }

  function playComputerKey(code: string, note: number): void {
    const [first, last] = options.range;
    if (note >= first && note <= last) pressNote(COMPUTER_KEY_INPUT_ID_PREFIX + code, note, KEYBOARD_NOTE_ON_DETAIL);
  }
}

function layoutKeysOnSurface(surfaceSize: ElementSize, options: ResolvedOptions): KlavierLayout {
  return layoutKeys({
    width: surfaceSize.cssWidth,
    height: surfaceSize.cssHeight,
    pixelRatio: surfaceSize.cssWidth === 0 ? 1 : bitmapSizeFor(surfaceSize).width / surfaceSize.cssWidth,
    range: options.range,
    blackKeyLength: options.blackKeyLength,
  });
}

function frameToPaint(
  layout: KlavierLayout,
  notesShownPressed: ReadonlySet<number>,
  highlights: Readonly<Record<number, string>>
): Frame {
  return {
    width: layout.width,
    height: layout.height,
    pixelRatio: layout.pixelRatio,
    keys: layout.keys.map((key) => ({
      ...key,
      pressed: notesShownPressed.has(key.note),
      highlight: highlights[key.note],
    })),
  };
}

function paintAndRestoreContext(context: CanvasRenderingContext2D, painter: Painter, frame: Frame): void {
  context.save();
  try {
    painter(context, frame);
  } finally {
    context.restore();
  }
}

function noteOnDetailForPointerHit(hit: KeyHit): NoteOnDetail {
  return {
    velocity: MIN_POINTER_VELOCITY + (1 - MIN_POINTER_VELOCITY) * hit.keyY,
    source: 'pointer',
    keyX: hit.keyX,
    keyY: hit.keyY,
  };
}

function noteToFocusOnNavigationKey(
  keyboardKey: string,
  focusedNote: number,
  range: readonly [number, number]
): number | undefined {
  const [first, last] = range;
  if (keyboardKey === 'ArrowLeft') return Math.max(first, focusedNote - 1);
  if (keyboardKey === 'ArrowRight') return Math.min(last, focusedNote + 1);
  if (keyboardKey === 'Home') return first;
  if (keyboardKey === 'End') return last;
  return undefined;
}

function isSpaceOrEnter(keyboardKey: string): boolean {
  return keyboardKey === ' ' || keyboardKey === 'Enter';
}

function isEditableElement(view: View, eventTarget: EventTarget | undefined): boolean {
  if (!(eventTarget instanceof view.HTMLElement)) return false;
  if (eventTarget.isContentEditable) return true;
  if (eventTarget instanceof view.HTMLTextAreaElement || eventTarget instanceof view.HTMLSelectElement) return true;
  return eventTarget instanceof view.HTMLInputElement && !NON_TEXT_INPUT_TYPES.includes(eventTarget.type);
}

function sameElementSize(a: ElementSize, b: ElementSize): boolean {
  return (
    a.cssWidth === b.cssWidth &&
    a.cssHeight === b.cssHeight &&
    a.devicePixelWidth === b.devicePixelWidth &&
    a.devicePixelHeight === b.devicePixelHeight
  );
}

export { createKlavier };
