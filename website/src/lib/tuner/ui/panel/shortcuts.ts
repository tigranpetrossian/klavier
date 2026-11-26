import { useHotkeys, type HotkeyChord, type UseHotkeyDefinition } from '@tanstack/react-hotkeys';
import { isTunerScope } from '../tuner-scope';

const NON_TEXT_INPUT_TYPES: ReadonlySet<string> = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

export type Shortcut = {
  keys: HotkeyChord;
  run(): void;
  repeat?: boolean;
  whenClosed?: boolean;
};

export function useShortcuts(open: boolean, shortcuts: readonly Shortcut[]): void {
  useHotkeys(shortcuts.map((shortcut) => hotkeyDefinition(shortcut, open)));
}

function hotkeyDefinition(shortcut: Shortcut, open: boolean): UseHotkeyDefinition {
  return {
    hotkey: shortcut.keys,
    callback: (event) => handleKeyPress(event, shortcut),
    options: { enabled: open || shortcut.whenClosed === true, preventDefault: false, stopPropagation: false },
  };
}

function handleKeyPress(event: KeyboardEvent, shortcut: Shortcut): void {
  if (isTypingInPage(event)) return;
  event.preventDefault();
  if (event.repeat && shortcut.repeat !== true) return;
  shortcut.run();
}

function isTypingInPage(event: KeyboardEvent): boolean {
  const path = event.composedPath();
  return isTextField(path[0]) && !path.some(isTunerScope);
}

function isTextField(target: EventTarget | undefined): boolean {
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type) && !target.readOnly;
  if (target instanceof HTMLTextAreaElement) return !target.readOnly;
  return target instanceof HTMLElement && target.isContentEditable;
}
