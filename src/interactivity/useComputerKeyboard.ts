import { useCallback, useEffect } from 'react';
import type { Keymap } from 'types';

type UseComputerKeyboardProps = {
  interactive: boolean;
  playNote: (midiNumber: number) => void;
  stopNote: (midiNumber: number) => void;
  noteRange: [number, number];
  keyMap: Keymap;
};

export function useComputerKeyboard(props: UseComputerKeyboardProps) {
  const { interactive, playNote, stopNote, keyMap, noteRange } = props;

  const handleKeyboardEvents = useCallback(
    (event: KeyboardEvent) => {
      const actionMap = {
        keydown: playNote,
        keyup: stopNote,
      };
      if (!isValidEvent(event)) return;
      const midiNumber = getMidiNumber(event.key, keyMap);
      if (!isValidMidiNumber(midiNumber, noteRange)) return;
      actionMap[event.type](midiNumber);
    },
    [noteRange, keyMap, playNote, stopNote]
  );

  useEffect(() => {
    if (!interactive) return;

    window.addEventListener('keydown', handleKeyboardEvents);
    window.addEventListener('keyup', handleKeyboardEvents);

    return () => {
      window.removeEventListener('keydown', handleKeyboardEvents);
      window.removeEventListener('keyup', handleKeyboardEvents);
    };
  }, [handleKeyboardEvents, interactive]);
}

function isValidEvent(event: KeyboardEvent): event is KeyboardEvent & { type: 'keyup' | 'keydown' } {
  return !(event.metaKey || event.altKey || event.shiftKey) && ['keyup', 'keydown'].includes(event.type);
}

function getMidiNumber(key: string, map: Keymap) {
  return map.find((item) => item.computerKey === key)?.midiNumber;
}

function isValidMidiNumber(midiNumber: number | undefined, range: [number, number]): midiNumber is number {
  return typeof midiNumber === 'number' && midiNumber >= range[0] && midiNumber <= range[1];
}
