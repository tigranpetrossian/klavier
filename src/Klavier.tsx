import { useRef } from 'react';
import classNames from 'klavier.module.css';
import { Key } from 'Key.tsx';
import { range } from 'utils.ts';
import { isMidiNumber } from 'midi/midi.utils.ts';
import { useKlavier } from 'useKlavier.ts';
import { useMouse } from 'useMouse.ts';
import { useComputerKeyboard } from 'useComputerKeyboard.ts';
import type { Keymap } from 'types.ts';
import { DEFAULT_KEYMAP } from 'keymap.ts';
import { useTouch } from 'useTouch';

export interface KlavierProps {
  noteRange?: [number, number];
  defaultActiveNotes?: Array<number>;
  activeNotes?: Array<number>;
  onPlayNote?: (midiNumber: number) => void;
  onStopNote?: (midiNumber: number) => void;
  onChange?: (activeNotes: Array<number>) => void;
  interactive?: boolean;
  keyMap?: Keymap;
}

export const Klavier = (props: KlavierProps) => {
  const {
    defaultActiveNotes,
    activeNotes,
    onPlayNote,
    onStopNote,
    onChange,
    noteRange = [21, 108],
    interactive = true,
    keyMap = DEFAULT_KEYMAP,
  } = props;
  const [first, last] = noteRange;
  const {
    state,
    actions: { playNote, stopNote },
  } = useKlavier({
    defaultActiveNotes,
    activeNotes,
    onPlayNote,
    onStopNote,
    onChange,
  });
  const klavierRootRef = useRef<HTMLDivElement>(null);

  validateRange(noteRange);

  useComputerKeyboard({ interactive, keyMap, noteRange, playNote, stopNote });
  const handleMouseEvents = useMouse({
    interactive,
    playNote,
    stopNote,
  });
  useTouch({ interactive, klavierRootRef, playNote, stopNote });

  return (
    <div className={classNames.klavier} ref={klavierRootRef}>
      {range(first, last + 1).map((midiNumber) => (
        <Key
          key={midiNumber}
          midiNumber={midiNumber}
          firstNoteMidiNumber={first}
          active={state.activeNotes.includes(midiNumber)}
          data-number={midiNumber}
          onMouseDown={handleMouseEvents}
          onMouseUp={handleMouseEvents}
          onMouseLeave={handleMouseEvents}
          onMouseEnter={handleMouseEvents}
        />
      ))}
    </div>
  );
};

const ERRORS = {
  INVALID_MIDI_VALUES: 'Note range must be within valid MIDI numbers (0-127).',
  INVALID_RANGE_ORDER: 'The last note must be greater than the first.',
};

function validateRange([first, last]: [number, number]) {
  const receivedRangeDisplay = `Received range: [${first}, ${last}]`;

  if (!isMidiNumber(first) || !isMidiNumber(last)) {
    throw new Error(`${ERRORS.INVALID_MIDI_VALUES} ${receivedRangeDisplay}`);
  }

  if (first >= last) {
    throw new Error(`${ERRORS.INVALID_RANGE_ORDER} ${receivedRangeDisplay}`);
  }
}
