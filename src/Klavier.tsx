import { useRef } from 'react';
import { DEFAULT_KEYMAP } from 'keymap';
import classNames from 'klavier.module.css';
import type { Keymap } from 'types';
import { Key } from 'Key';
import { range } from 'utils';
import { isMidiNumber } from 'midi/midi.utils';
import { useKlavier } from 'useKlavier';
import { useMouse } from 'interactivity/useMouse';
import { useComputerKeyboard } from 'interactivity/useComputerKeyboard';
import { useTouch } from 'interactivity/useTouch';

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
          data-midi-number={midiNumber}
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
