import { useCallback, useEffect } from 'react';
import type { Keymap } from 'types';
import { noop } from 'lib/noop';

type UseKeyboardProps = {
  enabled: boolean;
  activeNotes: Array<number>;
  playNote: (midiNumber: number) => void;
  stopNote: (midiNumber: number) => void;
  noteRange: [number, number];
  keyMap: Keymap;
};

function useKeyboard(props: UseKeyboardProps) {
  const { enabled, activeNotes, playNote, stopNote, keyMap, noteRange } = props;

  const handleKeyboardEvents = useCallback(
    (event: KeyboardEvent) => {
      if (!isValidEvent(event)) return;
      const midiNumber = getMidiNumberForKey(event.key, keyMap);
      if (!isValidMidiNumber(midiNumber, noteRange)) return;
      const actionMap = {
        keydown: !activeNotes.includes(midiNumber) ? playNote : noop,
        keyup: stopNote,
      };
      actionMap[event.type](midiNumber);
    },
    [noteRange, keyMap, activeNotes, playNote, stopNote]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyboardEvents);
    window.addEventListener('keyup', handleKeyboardEvents);

    return () => {
      window.removeEventListener('keydown', handleKeyboardEvents);
      window.removeEventListener('keyup', handleKeyboardEvents);
    };
  }, [handleKeyboardEvents, enabled]);
}

function isValidEvent(event: KeyboardEvent): event is KeyboardEvent & { type: 'keyup' | 'keydown' } {
  return !(event.metaKey || event.altKey || event.shiftKey) && ['keyup', 'keydown'].includes(event.type);
}

function getMidiNumberForKey(key: string, map: Keymap) {
  return map.find((item) => item.key === key)?.midiNumber;
}

function isValidMidiNumber(midiNumber: number | undefined, range: [number, number]): midiNumber is number {
  return typeof midiNumber === 'number' && midiNumber >= range[0] && midiNumber <= range[1];
}

export { useKeyboard };
