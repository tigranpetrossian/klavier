import React, { useRef } from 'react';
import { DEFAULT_KEYMAP } from 'keymap';
import type { CSSProperties, Keymap, KlavierKeyProps } from 'types';
import { Key } from 'Key';
import { range } from 'utils/range';
import { isMidiNumber } from 'utils/midi';
import { useKlavier } from 'useKlavier';
import { useMouse } from 'interactivity/useMouse';
import { useKeyboard } from 'interactivity/useKeyboard';
import { useTouch } from 'interactivity/useTouch';
import { flat } from 'presets';

export interface KlavierProps {
  noteRange?: [number, number];
  defaultActiveNotes?: Array<number>;
  activeNotes?: Array<number>;
  onPlayNote?: (midiNumber: number) => void;
  onStopNote?: (midiNumber: number) => void;
  onChange?: (activeNotes: Array<number>) => void;
  interactive?: boolean;
  keyMap?: Keymap;
  components?: {
    blackKey: React.ComponentType<KlavierKeyProps>;
    whiteKey: React.ComponentType<KlavierKeyProps>;
  };
}

export const Klavier = (props: KlavierProps) => {
  const klavierRootRef = useRef<HTMLDivElement>(null);
  const {
    defaultActiveNotes,
    activeNotes,
    onPlayNote,
    onStopNote,
    onChange,
    noteRange = [21, 108],
    interactive = true,
    keyMap = DEFAULT_KEYMAP,
    components = flat,
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

  validateRange(noteRange);

  useKeyboard({ interactive, keyMap, noteRange, playNote, stopNote });
  const handleMouseEvents = useMouse({
    interactive,
    playNote,
    stopNote,
  });
  useTouch({ interactive, klavierRootRef, playNote, stopNote });

  return (
    <div style={style} ref={klavierRootRef}>
      {range(first, last + 1).map((midiNumber) => (
        <Key
          key={midiNumber}
          midiNumber={midiNumber}
          firstNoteMidiNumber={first}
          active={state.activeNotes.includes(midiNumber)}
          onMouseDown={handleMouseEvents}
          onMouseUp={handleMouseEvents}
          onMouseLeave={handleMouseEvents}
          onMouseEnter={handleMouseEvents}
          components={components}
        />
      ))}
    </div>
  );
};

const style: CSSProperties = {
  display: 'grid',
  gap: '1px',
  position: 'relative',
  WebkitUserSelect: 'none',
  userSelect: 'none',
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
