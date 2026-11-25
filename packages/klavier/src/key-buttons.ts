import type { KeyRect } from './layout-keys';

const KEY_BUTTON_STYLE =
  'position:absolute;box-sizing:border-box;margin:0;padding:0;border:0;border-radius:0;background:none;' +
  'appearance:none;-webkit-appearance:none;cursor:inherit;outline-offset:-2px;';

type KeyButtons = ReadonlyMap<number, HTMLButtonElement>;

function createKeyButtons(
  surface: HTMLElement,
  keys: readonly KeyRect[],
  keyName: (note: number) => string
): KeyButtons {
  const buttons = new Map<number, HTMLButtonElement>();

  for (const key of keys) {
    const button = surface.ownerDocument.createElement('button');
    button.type = 'button';
    button.tabIndex = -1;
    button.dataset.note = String(key.note);
    button.style.cssText = KEY_BUTTON_STYLE;
    button.style.zIndex = key.black ? '1' : '0';
    button.setAttribute('aria-label', keyName(key.note));
    button.setAttribute('aria-pressed', 'false');
    buttons.set(key.note, button);
  }

  surface.append(...buttons.values());
  placeKeyButtons(buttons, keys);
  return buttons;
}

function placeKeyButtons(buttons: KeyButtons, keys: readonly KeyRect[]): void {
  for (const key of keys) {
    const style = buttons.get(key.note)?.style;
    if (!style) continue;
    style.left = `${key.x}px`;
    style.top = `${key.y}px`;
    style.width = `${key.width}px`;
    style.height = `${key.height}px`;
  }
}

function labelKeyButtons(buttons: KeyButtons, keyName: (note: number) => string): void {
  for (const [note, button] of buttons) button.setAttribute('aria-label', keyName(note));
}

function removeKeyButtons(buttons: KeyButtons): void {
  for (const button of buttons.values()) button.remove();
}

function markPressedKeyButtons(buttons: KeyButtons, pressed: ReadonlySet<number>): void {
  for (const [note, button] of buttons) {
    const value = String(pressed.has(note));
    if (button.getAttribute('aria-pressed') !== value) button.setAttribute('aria-pressed', value);
  }
}

function moveTabStop(buttons: KeyButtons, from: number, to: number): void {
  const previous = buttons.get(from);
  const next = buttons.get(to);
  if (previous) previous.tabIndex = -1;
  if (next) next.tabIndex = 0;
}

function noteOfKeyButton(buttons: KeyButtons, target: EventTarget | null | undefined): number | undefined {
  for (const [note, button] of buttons) {
    if (button === target) return note;
  }
  return undefined;
}

export {
  createKeyButtons,
  placeKeyButtons,
  labelKeyButtons,
  removeKeyButtons,
  markPressedKeyButtons,
  moveTabStop,
  noteOfKeyButton,
};
export type { KeyButtons };
